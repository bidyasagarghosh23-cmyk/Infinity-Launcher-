# Authentication

Infinity Launcher supports two account types.

## Offline profiles

No password, no network. The UUID is derived exactly like vanilla's offline
mode so worlds, servers in `online-mode=false` and LAN games see a stable
identity:

```
uuid = UUID.nameUUIDFromBytes("OfflinePlayer:<name>")   // MD5, version 3, variant 2
```

The implementation lives in `src-tauri/src/auth.rs` (`offline_uuid`) and is
covered by unit tests against Java-computed vectors, e.g. `Notch` →
`b50ad385-829d-3141-a216-7e7d7539ba7f`.

Offline accounts cannot join `online-mode=true` servers. The UI says so before
you create one.

## Microsoft accounts

Infinity Launcher uses the **OAuth 2.0 device-code flow**:

```
launcher                       Microsoft                     Xbox / Mojang
   │  POST /devicecode            │
   │─────────────────────────────▶│
   │  user_code + verification_uri│
   │◀─────────────────────────────│
   │  (player enters code in any browser)
   │  POST /token  (poll)         │
   │─────────────────────────────▶│  access_token + refresh_token
   │◀─────────────────────────────│
   │  XBL: RpsTicket=d=<token>    │
   │──────────────────────────────────────────────────────────▶│
   │  XSTS: rp://api.minecraftservices.com                     │
   │──────────────────────────────────────────────────────────▶│
   │  Minecraft: login_with_xbox → access_token + profile      │
   │──────────────────────────────────────────────────────────▶│
```

Why device code? It is the only flow that behaves identically on all five
targets: no loopback redirect server (blocked on mobile), no embedded browser
(rejected by Microsoft), no custom URL scheme to register.

Xbox Live errors are translated into plain English (`2148916233` = no Xbox
profile, `2148916235` = Xbox Live unavailable in the account's country, and so
on) so the player knows what to fix.

### Registering your Azure application

Every launcher must ship its own client ID — there is no shared one to borrow.

1. <https://portal.azure.com> → **App registrations** → **New registration**.
2. Name it whatever you like; supported account types: **Personal Microsoft
   accounts only** (or "any org + personal").
3. **Authentication** → **Add a platform** → **Mobile and desktop applications**,
   tick **Allow public client flows** (this is what enables device code).
4. **API permissions** → add delegated permissions **XboxLive.signin** and
   **offline_access** (Microsoft Graph → not required).
5. Copy the **Application (client) ID** and expose it to the launcher:

```bash
export INFINITY_MS_CLIENT_ID="00000000-0000-0000-0000-000000000000"
npm run tauri:dev
```

For release builds bake it in at compile time:

```bash
INFINITY_MS_CLIENT_ID=... npm run tauri:build
```

If no client ID is configured, the Microsoft button fails with an explicit
message explaining this; offline accounts are unaffected.

### Token storage

| What | Where | Lifetime |
|---|---|---|
| MSA refresh token | `accounts.json` in the data folder | until sign-out |
| Minecraft access token | `accounts.json` | ~24 h, refreshed on demand |
| Xbox/XSTS tokens | never stored | per launch |

`accounts.json` is written with user-only permissions by the OS defaults of the
data directory. There is no server component, no telemetry and no analytics: the
tokens only ever travel to Microsoft, Xbox Live and Mojang over HTTPS.

If you are shipping this to other people, consider moving `accounts.json` into
the platform keychain (Windows Credential Manager / macOS Keychain / Android
Keystore / iOS Keychain) — `auth::refresh` is the only function that reads it,
so the change is local.

## Sessions during launch

The game receives the standard variables:

```
--username <name>
--uuid <uuid without dashes>
--accessToken <minecraft access token or 0>
--userType msa|legacy
--xuid <xuid or 0>
--clientId <INFINITY_MS_CLIENT_ID or 0>
```

Minecraft validates the token with Mojang on startup, which is why an expired
session shows as "Invalid session" rather than a launcher error.
