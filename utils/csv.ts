import fs from 'node:fs';
import path from 'node:path';

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Write a header row + data rows to a CSV file (creates the folder). Returns the absolute path. */
export function writeCsv(filePath: string, headers: string[], rows: string[][]): string {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(','));
  fs.writeFileSync(absolute, lines.join('\n') + '\n', 'utf8');
  return absolute;
}

/** Minimal CSV reader for verifying what we wrote (handles quoted cells). */
export function readCsv(filePath: string): string[][] {
  const text = fs.readFileSync(filePath, 'utf8').trimEnd();
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
