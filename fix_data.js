const fs = require('fs');
let content = fs.readFileSync('data/marks_percentile_data.js', 'utf8');
const match = content.match(/window\.MARKS_VS_PERCENTILE_DATA = (\{[\s\S]*?\});/);
if (!match) { console.error('not found'); process.exit(1); }
let data = eval('(' + match[1] + ')');

for (let shift in data) {
  let pts = data[shift];
  // 1. group by marks, average percentiles
  let mmap = {};
  for (let p of pts) {
    if (!mmap[p[0]]) mmap[p[0]] = [];
    mmap[p[0]].push(p[1]);
  }
  let uniquePts = Object.keys(mmap).map(m => Number(m)).sort((a,b)=>a-b).map(m => {
    let arr = mmap[m];
    let avg = arr.reduce((a,b)=>a+b,0)/arr.length;
    return [m, Number(avg.toFixed(2))];
  });
  
  // 2. ensure strictly increasing percentiles
  let strictPts = [];
  let currentMaxPerc = -1;
  for (let p of uniquePts) {
    if (p[1] > currentMaxPerc) {
      strictPts.push(p);
      currentMaxPerc = p[1];
    }
  }
  data[shift] = strictPts;
}

// Convert back to string and match original format roughly
let out = "window.MARKS_VS_PERCENTILE_DATA = {\n";
for (let shift in data) {
  out += `  "${shift}": ` + JSON.stringify(data[shift]) + ",\n";
}
out += "};\n";

let newContent = content.replace(/window\.MARKS_VS_PERCENTILE_DATA = \{[\s\S]*?\};?/, out);
fs.writeFileSync('data/marks_percentile_data.js', newContent);
console.log('Fixed data anomalies');
