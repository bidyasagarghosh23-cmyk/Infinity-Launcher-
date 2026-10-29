//! Microsoft / Xbox Live / Minecraft authentication using the OAuth 2.0
//! **device code** flow — the only sign-in flow that works unchanged on
//! Windows, macOS, Linux, Android and iOS (no redirect URI, no embedded
//! browser, no local webserver to worry about).
//!
//! Chain: MSA device code → Microsoft token → Xbox Live (XBL) → XSTS →
//! Minecraft access token → profile.
//!
//! The launcher needs its own Azure application registration: create one as a
//! "Mobile and desktop application", enable *Allow public client flows*, add
//! the `XboxLive.signin` + `offline_access` scopes, then set
//! `INFINITY_MS_CLIENT_ID` (see docs/AUTH.md).

use serde::Deserialize;
use serde_json::json;

use crate::error::{Context, Error, Result};
use crate::model::{Account, AccountKind, DeviceCode};

const AUTH_BASE: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const XBL_AUTH: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE: &str = "https://api.minecraftservices.com/minecraft/profile";
const SCOPES: &str = "XboxLive.signin offline_access";

/// Deliberately not baked in: every launcher should ship its own Azure app ID.
pub fn client_id() -> Result<String> {
    if let Ok(id) = std::env::var("INFINITY_MS_CLIENT_ID") {
        if !id.trim().is_empty() {
            return Ok(id);
        }
    }
    if let Some(id) = option_env!("INFINITY_MS_CLIENT_ID") {
        if !id.trim().is_empty() {
            return Ok(id.to_string());
        }
    }
    Err(Error::Message(
        "Microsoft sign-in is not configured. Create an Azure app registration (Mobile & desktop, \
         public client flows on, scopes XboxLive.signin + offline_access) and set \
         INFINITY_MS_CLIENT_ID. Offline accounts work without this. See docs/AUTH.md."
            .to_string(),
    ))
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    #[serde(default = "default_interval")]
    interval: u64,
    #[serde(default)]
    message: String,
}

fn default_interval() -> u64 {
    5
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: u64,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    error_description: Option<String>,
}

/// Step 1: ask Microsoft for a code the player types into a browser.
pub async fn begin_device_code(client: &reqwest::Client) -> Result<DeviceCode> {
    let id = client_id()?;
    let response = client
        .post(format!("{AUTH_BASE}/devicecode"))
        .form(&[("client_id", id.as_str()), ("scope", SCOPES)])
        .send()
        .await?
        .error_for_status()?;
    let body: DeviceCodeResponse = response.json().await?;
    Ok(DeviceCode {
        message: if body.message.is_empty() {
            format!("Enter {} at {}", body.user_code, body.verification_uri)
        } else {
            body.message
        },
        device_code: body.device_code,
        user_code: body.user_code,
        verification_uri: body.verification_uri,
        expires_in: body.expires_in,
        interval: body.interval.max(1),
    })
}

/// Step 2: poll until the player finishes signing in, then walk the whole
/// Xbox → Minecraft chain and return a signed-in account.
pub async fn poll_device_code(
    client: &reqwest::Client,
    device_code: &str,
) -> Result<Account> {
    let id = client_id()?;
    // `AuthPending` keeps the UI polling without treating it as a failure.
    let response = client
        .post(format!("{AUTH_BASE}/token"))
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", id.as_str()),
            ("device_code", device_code),
        ])
        .send()
        .await?;
    let body: TokenResponse = response.json().await?;
    if let Some(error) = body.error {
        return Err(match error.as_str() {
            "authorization_pending" => Error::Auth("pending".into()),
            "slow_down" => Error::Auth("pending".into()),
            "expired_token" => Error::Auth("The sign-in code expired — start again.".into()),
            "authorization_declined" => Error::Auth("Sign-in was declined.".into()),
            _ => Error::Auth(
                body.error_description
                    .unwrap_or_else(|| format!("Microsoft returned {error}")),
            ),
        });
    }
    let refresh_token = body.refresh_token.clone().unwrap_or_default();
    finish_login(client, &body.access_token, Some(refresh_token), body.expires_in).await
}

/// Refresh an expired session without bothering the player.
pub async fn refresh(client: &reqwest::Client, account: &Account) -> Result<Account> {
    let id = client_id()?;
    let Some(refresh_token) = account.refresh_token.clone() else {
        return Err(Error::Auth("This account has no refresh token — sign in again.".into()));
    };
    let response = client
        .post(format!("{AUTH_BASE}/token"))
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", id.as_str()),
            ("refresh_token", refresh_token.as_str()),
            ("scope", SCOPES),
        ])
        .send()
        .await?;
    let body: TokenResponse = response.json().await?;
    if let Some(error) = body.error {
        return Err(Error::Auth(
            body.error_description
                .unwrap_or_else(|| format!("could not refresh the Microsoft session ({error})")),
        ));
    }
    let new_refresh = body.refresh_token.clone().unwrap_or(refresh_token);
    let mut updated =
        finish_login(client, &body.access_token, Some(new_refresh), body.expires_in).await?;
    updated.added_at = account.added_at;
    Ok(updated)
}

/// Xbox Live → XSTS → Minecraft token → profile.
async fn finish_login(
    client: &reqwest::Client,
    msa_token: &str,
    refresh_token: Option<String>,
    expires_in: u64,
) -> Result<Account> {
    let (xbl_token, user_hash) = xbox_live(client, msa_token).await?;
    let xsts_token = xsts(client, &xbl_token).await?;
    let mc = minecraft_token(client, &user_hash, &xsts_token).await?;
    let profile = profile(client, &mc.0).await?;

    let accent = if profile.skins.is_empty() {
        None
    } else {
        Some(profile.skins[0].url.clone())
    };
    Ok(Account {
        id: profile.id.clone(),
        username: profile.name.clone(),
        uuid: profile.id.clone(),
        kind: AccountKind::Microsoft,
        avatar_url: Some(format!(
            "https://mc-heads.net/avatar/{}/128",
            profile.id
        )),
        skin_url: accent,
        cape_url: profile.capes.first().map(|cape| cape.url.clone()),
        skin_variant: profile.skins.first().map(|skin| skin.variant.clone()),
        refresh_token,
        access_token: Some(mc.0),
        expires_at: Some(now_secs() + expires_in as i64 - 60),
        xuid: Some(user_hash),
        added_at: now_secs(),
    })
}

async fn xbox_live(client: &reqwest::Client, msa_token: &str) -> Result<(String, String)> {
    #[derive(Deserialize)]
    struct XblResponse {
        #[serde(rename = "Token")]
        token: String,
        #[serde(rename = "DisplayClaims")]
        claims: Claims,
    }
    #[derive(Deserialize)]
    struct Claims {
        xui: Vec<Xui>,
    }
    #[derive(Deserialize)]
    struct Xui {
        uhs: String,
    }

    let response = client
        .post(XBL_AUTH)
        .json(&json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={msa_token}")
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(Error::Auth(format!(
            "Xbox Live rejected the Microsoft token ({})",
            response.status()
        )));
    }
    let body: XblResponse = response.json().await?;
    let uhs = body
        .claims
        .xui
        .first()
        .map(|x| x.uhs.clone())
        .ok_or_else(|| Error::Auth("Xbox Live returned no user hash".into()))?;
    Ok((body.token, uhs))
}

async fn xsts(client: &reqwest::Client, xbl_token: &str) -> Result<String> {
    #[derive(Deserialize)]
    struct XstsResponse {
        #[serde(rename = "Token")]
        token: String,
    }

    let response = client
        .post(XSTS_AUTH)
        .json(&json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await?;
    let status = response.status();
    let text = response.text().await?;
    if !status.is_success() {
        let xerr = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v.get("XErr").and_then(|x| x.as_i64()));
        let hint = match xerr {
            Some(2148916233) => "This Microsoft account has no Xbox profile. Sign in to xbox.com once, then retry.",
            Some(2148916235) => "Xbox Live is not available in this account's country.",
            Some(2148916236) | Some(2148916237) => "This account needs adult verification on xbox.com.",
            Some(2148916238) => "Child accounts must be added to a Microsoft family first.",
            _ => "Xbox Live authorisation failed.",
        };
        return Err(Error::Auth(hint.to_string()));
    }
    let body: XstsResponse = serde_json::from_str(&text)?;
    Ok(body.token)
}

async fn minecraft_token(
    client: &reqwest::Client,
    user_hash: &str,
    xsts_token: &str,
) -> Result<(String, u64)> {
    #[derive(Deserialize)]
    struct McResponse {
        access_token: String,
        #[serde(default)]
        expires_in: u64,
    }
    let response = client
        .post(MC_LOGIN)
        .json(&json!({ "identityToken": format!("XBL3.0 x={user_hash};{xsts_token}") }))
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(Error::Auth(format!(
            "Minecraft services refused the login ({})",
            response.status()
        )));
    }
    let body: McResponse = response.json().await?;
    Ok((body.access_token, body.expires_in))
}

#[derive(Debug, Deserialize)]
struct Profile {
    id: String,
    name: String,
    #[serde(default)]
    skins: Vec<ProfileTexture>,
    #[serde(default)]
    capes: Vec<ProfileTexture>,
}

#[derive(Debug, Deserialize)]
struct ProfileTexture {
    url: String,
    #[serde(default)]
    variant: String,
}

async fn profile(client: &reqwest::Client, access_token: &str) -> Result<Profile> {
    let response = client.get(MC_PROFILE).bearer_auth(access_token).send().await?;
    if response.status().as_u16() == 404 {
        return Err(Error::Auth(
            "This account does not own Minecraft: Java Edition.".into(),
        ));
    }
    if !response.status().is_success() {
        return Err(Error::Auth(format!(
            "could not read the Minecraft profile ({})",
            response.status()
        )));
    }
    response.json::<Profile>().await.context("parsing the Minecraft profile")
}

pub fn now_secs() -> i64 {
    chrono::Utc::now().timestamp()
}

/// Offline ("cracked"/local) accounts: deterministic UUID from the name so
/// worlds and servers see a stable identity, exactly like vanilla's offline mode.
pub fn offline_account(username: &str) -> Account {
    let name = if username.trim().is_empty() {
        "Player".to_string()
    } else {
        username.trim().to_string()
    };
    let uuid = offline_uuid(&name);
    Account {
        id: uuid.clone(),
        username: name,
        uuid,
        kind: AccountKind::Offline,
        avatar_url: Some(format!("https://mc-heads.net/avatar/{uuid}/128")),
        skin_url: None,
        cape_url: None,
        skin_variant: None,
        refresh_token: None,
        access_token: None,
        expires_at: None,
        xuid: None,
        added_at: now_secs(),
    }
}

/// Java's `UUID.nameUUIDFromBytes("OfflinePlayer:<name>")`: MD5 with version 3
/// bits set. Implemented here to avoid pulling in another hash crate.
pub fn offline_uuid(username: &str) -> String {
    // md5 is only used to match vanilla's offline UUID derivation, never for
    // anything security sensitive.
    let digest = md5_bytes(format!("OfflinePlayer:{username}").as_bytes());
    let mut bytes = digest;
    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex = hex::encode(bytes);
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

// Minimal, dependency-free MD5 (RFC 1321) — 60 lines vs. a whole crate.
fn md5_bytes(input: &[u8]) -> [u8; 16] {
    const S: [u32; 64] = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5,
        9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10,
        15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];
    const K: [u32; 64] = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613,
        0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193,
        0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d,
        0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
        0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122,
        0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
        0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244,
        0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
        0xeb86d391,
    ];

    let mut message = input.to_vec();
    let bit_len = (input.len() as u64).wrapping_mul(8);
    message.push(0x80);
    while message.len() % 64 != 56 {
        message.push(0);
    }
    message.extend_from_slice(&bit_len.to_le_bytes());

    let mut a0: u32 = 0x67452301;
    let mut b0: u32 = 0xefcdab89;
    let mut c0: u32 = 0x98badcfe;
    let mut d0: u32 = 0x10325476;

    for chunk in message.chunks_exact(64) {
        let mut m = [0u32; 16];
        for (i, word) in m.iter_mut().enumerate() {
            let start = i * 4;
            *word = u32::from_le_bytes([
                chunk[start],
                chunk[start + 1],
                chunk[start + 2],
                chunk[start + 3],
            ]);
        }
        let (mut a, mut b, mut c, mut d) = (a0, b0, c0, d0);
        for i in 0..64 {
            let (f, g) = match i / 16 {
                0 => ((b & c) | (!b & d), i),
                1 => ((d & b) | (!d & c), (5 * i + 1) % 16),
                2 => (b ^ c ^ d, (3 * i + 5) % 16),
                _ => (c ^ (b | !d), (7 * i) % 16),
            };
            let temp = d;
            d = c;
            c = b;
            b = b.wrapping_add(
                a.wrapping_add(f)
                    .wrapping_add(K[i])
                    .wrapping_add(m[g])
                    .rotate_left(S[i]),
            );
            a = temp;
        }
        a0 = a0.wrapping_add(a);
        b0 = b0.wrapping_add(b);
        c0 = c0.wrapping_add(c);
        d0 = d0.wrapping_add(d);
    }

    let mut out = [0u8; 16];
    out[0..4].copy_from_slice(&a0.to_le_bytes());
    out[4..8].copy_from_slice(&b0.to_le_bytes());
    out[8..12].copy_from_slice(&c0.to_le_bytes());
    out[12..16].copy_from_slice(&d0.to_le_bytes());
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn md5_matches_reference_vectors() {
        assert_eq!(hex::encode(md5_bytes(b"")), "d41d8cd98f00b204e9800998ecf8427e");
        assert_eq!(hex::encode(md5_bytes(b"abc")), "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(
            hex::encode(md5_bytes(b"The quick brown fox jumps over the lazy dog")),
            "9e107d9d372bb6826bd81d3542a419d6"
        );
    }

    #[test]
    fn offline_uuid_matches_vanilla() {
        // UUID.nameUUIDFromBytes("OfflinePlayer:Notch") in Java.
        assert_eq!(offline_uuid("Notch"), "b50ad385-829d-3141-a216-7e7d7539ba7f");
        assert_eq!(offline_uuid("Steve"), "5627dd98-e6be-3c21-b8a8-e92344183641");
        assert_eq!(offline_uuid("jeb_"), "a762f560-4fce-3236-812a-b80efff0b62b");
        assert!(offline_account("").username == "Player");
    }
}
