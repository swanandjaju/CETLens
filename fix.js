const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.html');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/<button(?!\s+type=)/g, '<button type="button"');
// Add <title> to inline SVGs
content = content.replace(/<svg\s([^>]+)>/g, function(match, p1) {
  if (p1.includes('<title>')) return match;
  return `<svg ${p1}>\n  <title>Icon</title>`;
});
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed buttons and SVGs in index.html');
