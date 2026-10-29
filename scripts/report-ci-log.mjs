/**Expose failed CI command details as GitHub job annotations.
 * GitHub truncates individual annotation messages, so emit small numbered
 * parts and prefer explicit error blocks over an arbitrary slice of a log.
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
  const message = `${blocks.slice(0, 12000)}\n--- log tail ---\n${tail.slice(-2000)}`;
  const parts = [];
  for (let i = 0; i < message.length; i += 3500) parts.push(message.slice(i, i + 3500));
  parts.forEach((part, index) => {
    const title = parts.length > 1 ? `${file} (${index + 1}/${parts.length})` : file;
    console.log(`::error title=${title}::${escape(part)}`);
  });
}
