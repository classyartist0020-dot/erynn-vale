require("dotenv").config();
const Groq = require("groq-sdk");
const fs   = require("fs");
const path = require("path");

const IMAGES_DIR     = "./images";
const PROGRESS_FILE  = "./progress.json";
const RETRY_DELAY_MS = 10000;

let progress = {};
if (fs.existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  console.log("\nResuming — " + Object.keys(progress).length + " images already scanned.\n");
} else {
  console.log("\nStarting fresh scan.\n");
}

const allImages = fs.readdirSync(IMAGES_DIR).filter(function(f) {
  const ext = path.extname(f).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg";
});

const remaining = allImages.filter(function(f) {
  return !progress[f];
});

console.log("Total: " + allImages.length + " | Done: " + (allImages.length - remaining.length) + " | Remaining: " + remaining.length + "\n");

if (remaining.length === 0) {
  console.log("All images scanned! Run  npm run sort  next.");
  process.exit(0);
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function imageToBase64(filePath) {
  return fs.readFileSync(filePath).toString("base64");
}

function buildPrompt() {
  return "You are analysing a photo of Erynn Vale, a young British model and influencer.\nRespond ONLY with a valid JSON object, no extra text, no markdown, no explanation.\n\nReturn exactly this structure:\n{\n  \"category\": \"one of: fitness, luxury, editorial, travel, baddie\",\n  \"title\": \"short punchy title max 5 words no quotes\",\n  \"impact\": 7,\n  \"mood\": \"one of: dark, bright, moody, bold, soft\",\n  \"composition\": \"one of: close-up, full-body, environmental, half-body\",\n  \"orientation\": \"one of: tall, wide, square\"\n}\n\nCategory guide:\n- fitness: gym, workout, athletic wear, sporty\n- luxury: elegant, high-end fashion, jewellery, hotels\n- editorial: artistic, magazine-style, studio, conceptual\n- travel: outdoors, locations, holiday, beach, city\n- baddie: street style, bold attitude, urban, confident\n\nBe decisive. Return only the JSON.";
}

async function main() {
  let groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let totalDone = allImages.length - remaining.length;
  let retries = 0;

  for (let i = 0; i < remaining.length; i++) {
    const filename  = remaining[i];
    const imagePath = path.join(IMAGES_DIR, filename);
    let success = false;

    while (!success) {
      try {
        const base64Image = imageToBase64(imagePath);

        const response = await groq.chat.completions.create({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: "data:image/jpeg;base64," + base64Image }
                },
                {
                  type: "text",
                  text: buildPrompt()
                }
              ]
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        });

        const raw     = response.choices[0].message.content.trim();
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const result  = JSON.parse(cleaned);

        progress[filename] = {
          filename:    filename,
          category:    result.category,
          title:       result.title,
          impact:      result.impact,
          mood:        result.mood,
          composition: result.composition,
          orientation: result.orientation,
          scannedAt:   new Date().toISOString()
        };
        saveProgress();

        totalDone++;
        retries = 0;
        console.log("  [" + totalDone + "/" + allImages.length + "] " + filename);
        console.log("    Category: " + result.category + " | Impact: " + result.impact + "/10 | Title: " + result.title + "\n");

        success = true;

      } catch (err) {
        const msg = err.message || "";
        const isRateLimit = msg.includes("rate_limit") || msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("Rate limit");

        retries++;

        if (isRateLimit) {
          console.log("\n  WARNING: Rate limit hit on: " + filename);
          console.log("  Attempt " + retries + " — waiting 10 seconds and retrying...");
          console.log("  You can swap GROQ_API_KEY in .env right now — reloads automatically\n");
        } else {
          console.log("  ERROR on " + filename + ": " + msg);
          console.log("  Retrying in 10 seconds...\n");
        }

        await sleep(RETRY_DELAY_MS);

        delete require.cache[require.resolve("dotenv")];
        require("dotenv").config();
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      }
    }

    await sleep(500);
  }

  console.log("-----------------------------------------");
  console.log("All " + allImages.length + " images scanned!");
  console.log("Next step: run  npm run sort");
  console.log("-----------------------------------------\n");
}

main();
