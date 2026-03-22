// ─────────────────────────────────────────────────────────────
//  sort.js
//  Reads progress.json (created by scan.js)
//  Applies smart placement rules for best UX
//  Uploads all images to ImageKit
//  Outputs images.json — the website reads this
//  Run with: npm run sort
// ─────────────────────────────────────────────────────────────

require("dotenv").config();
const fs      = require("fs");
const path    = require("path");
const ImageKit = require("imagekit");

const PROGRESS_FILE = "./progress.json";
const OUTPUT_FILE   = "./images.json";
const IMAGES_DIR    = "./images";

// ── Load progress.json ────────────────────────────────────────
if (!fs.existsSync(PROGRESS_FILE)) {
  console.error("progress.json not found. Run  npm run scan  first.");
  process.exit(1);
}

const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
const images   = Object.values(progress).filter(img => !img.error || img.category);

console.log(`\nLoaded ${images.length} scanned images from progress.json\n`);

// ── ImageKit setup ────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// ── Helper: sleep ─────────────────────────────────────────────
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Helper: upload one image to ImageKit ─────────────────────
const uploadToImageKit = async (filename) => {
  const filePath = path.join(IMAGES_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);

  const response = await imagekit.upload({
    file: fileBuffer,
    fileName: filename,
    folder: "/erynn-vale",
    useUniqueFileName: false // keep original filename
  });

  return response.url;
};

// ── PLACEMENT RULES ───────────────────────────────────────────

// Sort all images by impact score descending
const byImpact = [...images].sort((a, b) => b.impact - a.impact);

// ── Rule 1: Hero image ────────────────────────────────────────
// Highest impact score + full-body or environmental composition
const heroImage = byImpact.find(img =>
  img.composition === "full-body" || img.composition === "environmental"
) || byImpact[0];

console.log(`Hero image: ${heroImage.filename} (impact: ${heroImage.impact}, "${heroImage.title}")`);

// ── Rule 2: Featured strip ────────────────────────────────────
// Top 2 from each category by impact, prefer tall orientation
// Exclude hero image, max 8 total
const categories = ["fitness", "luxury", "editorial", "travel", "baddie"];
const featuredSet = new Set([heroImage.filename]);
const featured = [];

for (const cat of categories) {
  const catImages = byImpact
    .filter(img => img.category === cat && !featuredSet.has(img.filename))
    .slice(0, 2);

  // prefer tall ones for the strip
  catImages.sort((a, b) => {
    if (a.orientation === "tall" && b.orientation !== "tall") return -1;
    if (b.orientation === "tall" && a.orientation !== "tall") return 1;
    return 0;
  });

  catImages.forEach(img => {
    featuredSet.add(img.filename);
    featured.push(img);
  });
}

console.log(`Featured strip: ${featured.length} images`);

// ── Rule 3: Gallery — ordered per category ────────────────────
// Sort by impact DESC within each category
// Apply mood alternation (never 3 dark in a row)
// Apply composition variety (never 2 close-ups in a row)

const buildGallery = (cat) => {
  const catImages = images
    .filter(img => img.category === cat)
    .sort((a, b) => b.impact - a.impact);

  const result = [];
  let darkStreak = 0;
  let lastComposition = null;

  for (const img of catImages) {
    // Composition variety — skip if same as last
    if (img.composition === "close-up" && lastComposition === "close-up") {
      // push to end instead
      catImages.push(img);
      continue;
    }

    // Mood rhythm — if dark streak is 2, insert a bright one
    if (darkStreak >= 2 && img.mood === "dark" || img.mood === "moody") {
      const brightAlternative = catImages.find(i =>
        (i.mood === "bright" || i.mood === "bold" || i.mood === "soft") &&
        !result.includes(i)
      );
      if (brightAlternative) {
        result.push(brightAlternative);
        darkStreak = 0;
        lastComposition = brightAlternative.composition;
      }
    }

    if (!result.includes(img)) {
      result.push(img);
      darkStreak = (img.mood === "dark" || img.mood === "moody") ? darkStreak + 1 : 0;
      lastComposition = img.composition;
    }
  }

  return result;
};

const gallery = {};
for (const cat of categories) {
  gallery[cat] = buildGallery(cat);
  console.log(`Gallery [${cat}]: ${gallery[cat].length} images`);
}

// ── Upload all images to ImageKit ────────────────────────────
console.log(`\nUploading images to ImageKit...`);
console.log(`(This may take a while for 300 images)\n`);

// Track already-uploaded (in case of resume)
const uploadedFile = "./uploaded.json";
let uploaded = {};
if (fs.existsSync(uploadedFile)) {
  uploaded = JSON.parse(fs.readFileSync(uploadedFile, "utf-8"));
  console.log(`Resuming — ${Object.keys(uploaded).length} already uploaded\n`);
}

const allToUpload = [...new Set([
  heroImage.filename,
  ...featured.map(i => i.filename),
  ...Object.values(gallery).flat().map(i => i.filename)
])];

let uploadCount = 0;

(async () => {
  for (const filename of allToUpload) {
    if (uploaded[filename]) {
      console.log(`  [SKIP] ${filename} — already uploaded`);
      continue;
    }

    try {
      const url = await uploadToImageKit(filename);
      uploaded[filename] = url;
      fs.writeFileSync(uploadedFile, JSON.stringify(uploaded, null, 2));
      uploadCount++;
      console.log(`  [${uploadCount}] Uploaded: ${filename}`);
    } catch (err) {
      console.error(`  [ERROR] ${filename}: ${err.message}`);
    }

    await sleep(200); // gentle on ImageKit API
  }

  // ── Build final images.json ───────────────────────────────
  const getUrl = (filename) => uploaded[filename] || "";

  const enrichImage = (img) => ({
    filename: img.filename,
    url:      getUrl(img.filename),
    category: img.category,
    title:    img.title,
    impact:   img.impact,
    mood:     img.mood,
    composition: img.composition,
    orientation: img.orientation,
    shootId:  img.shootId || img.category + "-general"
  });

  const output = {
    hero:     enrichImage(heroImage),
    featured: featured.map(enrichImage),
    gallery: {
      fitness:   gallery.fitness.map(enrichImage),
      luxury:    gallery.luxury.map(enrichImage),
      editorial: gallery.editorial.map(enrichImage),
      travel:    gallery.travel.map(enrichImage),
      baddie:    gallery.baddie.map(enrichImage)
    }
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log("\n─────────────────────────────────────────────────────");
  console.log("✅  images.json created successfully!");
  console.log(`    Hero:     1 image`);
  console.log(`    Featured: ${featured.length} images`);
  console.log(`    Gallery:  ${Object.values(gallery).flat().length} images`);
  console.log("\n    Your website is ready to display real photos.");
  console.log("    Next step: open index.html and check it works,");
  console.log("    then run  git push  to deploy to Vercel.");
  console.log("─────────────────────────────────────────────────────\n");
})();
