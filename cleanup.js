const fs = require("fs");

const PROGRESS_FILE = "./progress.json";
const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));

const before = Object.keys(progress).length;

// Only delete entries that have an error field
Object.keys(progress).forEach(key => {
  if (progress[key].error) {
    delete progress[key];
  }
});

const after = Object.keys(progress).length;
const removed = before - after;

fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

console.log(`Removed ${removed} bad error entries.`);
console.log(`Kept ${after} good entries untouched.`);
console.log(`Now run: npm run scan`);
```

