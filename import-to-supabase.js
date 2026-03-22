import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const data = JSON.parse(readFileSync("./images.json", "utf-8"));

async function importData() {
  console.log("Starting import...");

  // Collect all images from images.json
  const allImages = [];

  if (data.hero) allImages.push({ ...data.hero, is_hero: true });

  if (data.featured) {
    for (const img of data.featured) {
      if (!allImages.find((i) => i.filename === img.filename)) {
        allImages.push({ ...img, is_featured: true });
      }
    }
  }

  if (data.gallery) {
    for (const category of Object.keys(data.gallery)) {
      for (const img of data.gallery[category]) {
        if (!allImages.find((i) => i.filename === img.filename)) {
          allImages.push(img);
        }
      }
    }
  }

  console.log(`Found ${allImages.length} unique images`);

  // Step 1: collect all unique shootIds and insert into shoots table
  const shootMap = {};
  for (const img of allImages) {
    if (img.shootId && !shootMap[img.shootId]) {
      shootMap[img.shootId] = {
        id: img.shootId,
        title: img.title || img.shootId,
        category: img.category || "editorial",
        cover_image_url: null,
        cover_image_filename: null,
      };
    }
  }

  const shoots = Object.values(shootMap);
  console.log(`Found ${shoots.length} shoots`);

  if (shoots.length > 0) {
    const { error: shootError } = await supabase
      .from("shoots")
      .upsert(shoots, { onConflict: "id" });

    if (shootError) {
      console.error("Error inserting shoots:", shootError.message);
      return;
    }
    console.log("✅ Shoots inserted");
  }

  // Step 2: insert all images
  const imageRows = allImages.map((img) => ({
    filename: img.filename,
    url: img.url,
    category: img.category || "editorial",
    title: img.title || null,
    impact: img.impact || null,
    mood: img.mood || null,
    composition: img.composition || null,
    orientation: img.orientation || null,
    shoot_id: img.shootId || null,
    is_hero: img.is_hero || false,
    is_featured: img.is_featured || false,
    is_cover: false,
    is_premium: img.category === "premium",
  }));

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < imageRows.length; i += batchSize) {
    const batch = imageRows.slice(i, i + batchSize);
    const { error: imgError } = await supabase.from("images").insert(batch);
    if (imgError) {
      console.error(`Error inserting images batch ${i}:`, imgError.message);
      return;
    }
    console.log(`✅ Inserted images ${i + 1} to ${Math.min(i + batchSize, imageRows.length)}`);
  }

  // Step 3: for each shoot, mark the highest impact image as cover
  console.log("Setting cover images...");
  for (const shootId of Object.keys(shootMap)) {
    const { data: shootImages } = await supabase
      .from("images")
      .select("id, impact")
      .eq("shoot_id", shootId)
      .order("impact", { ascending: false })
      .limit(1);

    if (shootImages && shootImages.length > 0) {
      await supabase
        .from("images")
        .update({ is_cover: true })
        .eq("id", shootImages[0].id);

      await supabase
        .from("shoots")
        .update({ cover_image_url: null })
        .eq("id", shootId);
    }
  }

  // Update shoot cover_image_url from the cover image
  const { data: coverImages } = await supabase
    .from("images")
    .select("shoot_id, url, filename")
    .eq("is_cover", true);

  for (const cover of coverImages || []) {
    if (cover.shoot_id) {
      await supabase
        .from("shoots")
        .update({
          cover_image_url: cover.url,
          cover_image_filename: cover.filename,
        })
        .eq("id", cover.shoot_id);
    }
  }

  console.log("✅ Cover images set");
  console.log("\n🎉 Import complete! All data is now in Supabase.");
}

importData().catch(console.error);
