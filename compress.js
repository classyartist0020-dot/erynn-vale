// ─────────────────────────────────────────────────────────────
//  compress.js
//  Reads every JPG from images-original/
//  Compresses to 90% quality, max 1920px wide
//  Saves to images/ folder (creates it if it doesn't exist)
//  Skips PNGs automatically
//  Run with: npm run compress
// ─────────────────────────────────────────────────────────────

const sharp = require("sharp");
const fs    = require("fs");
const path  = require("path");

const INPUT_DIR  = "./images-original";
const OUTPUT_DIR = "./images";
const MAX_WIDTH  = 1920;
const QUALITY    = 90;

// ── Create output folder if it doesn't exist ──────────────────
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
  console.log(`Created folder: ${OUTPUT_DIR}`);
}

// ── Read all files from input folder ─────────────────────────
const allFiles = fs.readdirSync(INPUT_DIR);
const jpgFiles = allFiles.filter(f => {
  const ext = path.extname(f).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg";
});

const skipped = allFiles.filter(f => {
  const ext = path.extname(f).toLowerCase();
  return ext === ".png";
});

if (skipped.length > 0) {
  console.log(`\nSkipping ${skipped.length} PNG file(s): ${skipped.join(", ")}`);
}

console.log(`\nFound ${jpgFiles.length} JPG images to compress`);
console.log(`Quality: ${QUALITY}%  |  Max width: ${MAX_WIDTH}px\n`);

// ── Process each image ────────────────────────────────────────
let done = 0;
let errors = 0;

(async () => {
  for (const file of jpgFiles) {
    const inputPath  = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);

    // Skip if already compressed (resume support)
    if (fs.existsSync(outputPath)) {
      console.log(`  [SKIP] ${file} — already compressed`);
      done++;
      continue;
    }

    try {
      await sharp(inputPath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(outputPath);

      // Show file size reduction
      const originalSize  = (fs.statSync(inputPath).size  / 1024 / 1024).toFixed(2);
      const compressedSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);

      done++;
      console.log(`  [${done}/${jpgFiles.length}] ${file}  ${originalSize}MB → ${compressedSize}MB`);

    } catch (err) {
      errors++;
      console.error(`  [ERROR] ${file}: ${err.message}`);
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Done! ${done} compressed, ${errors} errors, ${skipped.length} PNGs skipped`);
  console.log(`Your compressed images are in: ${OUTPUT_DIR}/`);
  console.log(`\nNext step: run  npm run scan`);
})();
