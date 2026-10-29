/**Expose the useful part of failed CI commands as GitHub job annotations.
 * GitHub truncates annotation messages, so keep this well under 4 KiB and
 * prefer explicit error blocks over an arbitrary byte slice of a long log.
 */
import fs from 'node:fs';

const escape = (text) =>
  text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
  const lines = text.split(/\r?\n/);
  const selected = new Set();
  lines.forEach((line, index) => {
    if (/^error|^Error|FAILED|Failure|exception|panicked|error:/i.test(line)) {
      for (let i = Math.max(0, index - 2); i < Math.min(lines.length, index + 14); i += 1) {
        selected.add(i);
      }
    }
  });
  const blocks = [...selected].sort((a, b) => a - b).map((index) => lines[index]).join('\n');
  const tail = lines.slice(-35).join('\n');
  const message = `${blocks}\n--- log tail ---\n${tail}`.slice(-3600);
  console.log(`::error title=${file}::${escape(message)}`);
}
