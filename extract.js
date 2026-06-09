const fs = require('fs');

const sql = fs.readFileSync('C:/Users/jkdgr/Downloads/shift_signatures_rows.sql', 'utf8');

const regex = /\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*'[^']*'\)/g;

let match;
const records = {};

while ((match = regex.exec(sql)) !== null) {
  const stream = match[1];
  const attempt = match[2];
  const shift = match[3];
  const signature = match[4];
  const count = parseInt(match[5], 10);

  const key = stream + '_' + attempt + '_' + shift;
  
  if (!records[key]) {
    records[key] = { stream, attempt, shift, signature, count };
  } else {
    if (count > records[key].count) {
      records[key] = { stream, attempt, shift, signature, count };
    }
  }
}

const signatureToShift = {};
for (const key in records) {
  const rec = records[key];
  signatureToShift[rec.signature] = { stream: rec.stream, attempt: rec.attempt, shift: rec.shift };
}

const output = 'window.STATIC_SHIFT_SIGNATURES = ' + JSON.stringify(signatureToShift, null, 2) + ';';
fs.writeFileSync('C:/Users/jkdgr/Desktop/experiment with project/upload these/data/static_signatures.js', output);
console.log('Extracted ' + Object.keys(signatureToShift).length + ' signatures.');
