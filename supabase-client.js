// ============================================================
// supabase-client.js
// Drop-in replacement for images.json — fetches live from Supabase
// Add this BEFORE your main script tag in index.html:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="supabase-client.js"></script>
// ============================================================

const SUPABASE_URL = "https://jndrwouruspnxhafpxun.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZHJ3b3VydXNwbnhoYWZweHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDAyNjEsImV4cCI6MjA4OTc3NjI2MX0.k0R_D0X9l22UTrcUl-1Xoatvptg9dM72rz4xzR5cBmA";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// MAIN FUNCTION — call this instead of fetch('images.json')
// Returns data in the same shape your site already expects
// ============================================================
async function loadSiteData() {
  try {
    // Fetch hero image
    const { data: heroData } = await db
      .from("images")
      .select("*")
      .eq("is_hero", true)
      .limit(1)
      .single();

    // Fetch featured images (top 8)
    const { data: featuredData } = await db
      .from("images")
      .select("*")
      .eq("is_featured", true)
      .order("impact", { ascending: false })
      .limit(8);

    // Fetch all cover images with shoot info (for gallery)
    const { data: coverImages } = await db
      .from("images")
      .select(`
        *,
        shoot:shoots(id, title, category)
      `)
      .eq("is_cover", true)
      .order("impact", { ascending: false });

    // Count images per shoot
    const { data: shootCounts } = await db
      .from("images")
      .select("shoot_id")
      .not("shoot_id", "is", null);

    const countMap = {};
    (shootCounts || []).forEach((img) => {
      countMap[img.shoot_id] = (countMap[img.shoot_id] || 0) + 1;
    });

    // Build gallery object grouped by category
    const gallery = {
      fitness: [],
      luxury: [],
      editorial: [],
      travel: [],
      baddie: [],
      premium: [],
    };

    (coverImages || []).forEach((img) => {
      const cat = img.category || "editorial";
      const item = {
        ...img,
        shootId: img.shoot_id,
        shotCount: countMap[img.shoot_id] || 1,
      };
      if (gallery[cat]) {
        gallery[cat].push(item);
      }
    });

    return {
      hero: heroData,
      featured: featuredData || [],
      gallery,
    };
  } catch (err) {
    console.error("Failed to load site data from Supabase:", err);
    return { hero: null, featured: [], gallery: {} };
  }
}

// ============================================================
// LIKES — functional like button using localStorage for session
// ============================================================
function getSessionId() {
  let id = localStorage.getItem("erynn_session");
  if (!id) {
    id = "sess_" + Math.random().toString(36).substr(2, 12);
    localStorage.setItem("erynn_session", id);
  }
  return id;
}

async function getLikeCount(imageId) {
  const { count } = await db
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("image_id", imageId);
  return count || 0;
}

async function hasLiked(imageId) {
  const sessionId = getSessionId();
  const { data } = await db
    .from("likes")
    .select("id")
    .eq("image_id", imageId)
    .eq("session_id", sessionId)
    .maybeSingle();
  return !!data;
}

async function toggleLike(imageId) {
  const sessionId = getSessionId();
  const liked = await hasLiked(imageId);

  if (liked) {
    await db
      .from("likes")
      .delete()
      .eq("image_id", imageId)
      .eq("session_id", sessionId);
    return false;
  } else {
    await db.from("likes").insert({ image_id: imageId, session_id: sessionId });
    return true;
  }
}

// ============================================================
// COMMENTS — fetch and post comments for an image
// ============================================================
async function getComments(imageId) {
  const { data } = await db
    .from("comments")
    .select("*")
    .eq("image_id", imageId)
    .order("created_at", { ascending: false });
  return data || [];
}

async function postComment(imageId, name, message) {
  const { data, error } = await db
    .from("comments")
    .insert({ image_id: imageId, name, message })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// ENQUIRIES — save contact form submissions
// ============================================================
async function submitEnquiry(name, email, subject, message) {
  const { error } = await db
    .from("enquiries")
    .insert({ name, email, subject, message });
  if (error) throw error;
}

// Expose everything globally so your HTML scripts can use them
window.erynnDB = {
  loadSiteData,
  getLikeCount,
  hasLiked,
  toggleLike,
  getComments,
  postComment,
  submitEnquiry,
  db,
};
