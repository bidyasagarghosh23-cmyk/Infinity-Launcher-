/**Expose the useful tail of failed CI commands as GitHub job annotations. */
import fs from 'node:fs';

for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
  const escaped = text
    .slice(-14000)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
  console.log(`::error title=${file}::${escaped}`);
}
