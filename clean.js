const fs = require('fs');
const p = JSON.parse(fs.readFileSync('./progress.json'));
Object.keys(p).forEach(k => {
  delete p[k].shootId;
  delete p[k].isCover;
});
fs.writeFileSync('./progress.json', JSON.stringify(p, null, 2));
console.log('Cleaned! Ready to rescan.');
