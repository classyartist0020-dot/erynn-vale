require("dotenv").config();
const Groq = require("groq-sdk");
const fs   = require("fs");
const path = require("path");

const IMAGES_DIR     = "./images";
const PROGRESS_FILE  = "./progress.json";
const RETRY_DELAY_MS = 10000;

if (!fs.existsSync(PROGRESS_FILE)) {
  console.error("progress.json not found. Run npm run scan first.");
  process.exit(1);
}

let progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));

const allImages = Object.keys(progress);
const remaining = allImages.filter(function(f) { return !progress[f].shootId; });

console.log("\nTotal images:     " + allImages.length);
console.log("Already grouped:  " + (allImages.length - remaining.length));
console.log("To process now:   " + remaining.length + "\n");

if (remaining.length === 0) {
  console.log("All images grouped! Run npm run sort next.");
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

function buildPrompt(existingData) {
  return "You are looking at a photo from a model portfolio shoot.\n\nExisting analysis: category=" + existingData.category + ", mood=" + existingData.mood + ", composition=" + existingData.composition + "\n\nAssign a shootId only. Respond ONLY with valid JSON, no extra text, no markdown:\n{\"shootId\": \"a 2-4 word kebab-case slug describing this specific shoot session based on location, outfit, and lighting. Examples: red-dress-studio, rooftop-sunset, beach-white-outfit, dark-alley-editorial. Images from the same session MUST get identical shootIds.\"}";
}

async function main() {
  let groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let totalDone = allImages.length - remaining.length;
  let retries = 0;

  for (let i = 0; i < remaining.length; i++) {
    const filename  = remaining[i];
    const imagePath = path.join(IMAGES_DIR, filename);

    if (!fs.existsSync(imagePath)) {
      console.log("  [SKIP] " + filename + " - file not found");
      progress[filename].shootId = progress[filename].category + "-shoot";
      saveProgress();
      totalDone++;
      continue;
    }

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
                  text: buildPrompt(progress[filename])
                }
              ]
            }
          ],
          max_tokens: 60,
          temperature: 0.1
        });

        const raw     = response.choices[0].message.content.trim();
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const result  = JSON.parse(cleaned);

        progress[filename].shootId = result.shootId;
        saveProgress();

        totalDone++;
        retries = 0;
        console.log("  [" + totalDone + "/" + allImages.length + "] " + filename);
        console.log("    Shoot: " + result.shootId + "\n");

        success = true;

      } catch (err) {
        const msg = err.message || "";
        const isRateLimit = msg.includes("rate_limit") || msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("Rate limit");

        retries++;

        if (isRateLimit) {
          console.log("\n  WARNING: Rate limit hit on: " + filename);
          console.log("  Attempt " + retries + " - waiting 10 seconds...");
          console.log("  Swap GROQ_API_KEY in .env anytime\n");
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
  console.log("All images grouped into shoots!");
  console.log("Next step: run  npm run sort");
  console.log("-----------------------------------------\n");
}

main();
