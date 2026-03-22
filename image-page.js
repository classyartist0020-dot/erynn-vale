// ============================================================
// image-page.js
// Powers image.html — carousel, real likes, real comments
// Add this AFTER supabase-client.js in image.html
// ============================================================

const SUPABASE_URL = "https://jndrwouruspnxhafpxun.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZHJ3b3VydXNwbnhoYWZweHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDAyNjEsImV4cCI6MjA4OTc3NjI2MX0.k0R_D0X9l22UTrcUl-1Xoatvptg9dM72rz4xzR5cBmA";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get shootId from URL: image.html?shoot=balcony-black-dress
const params = new URLSearchParams(window.location.search);
const shootId = params.get("shoot");

let images = [];
let currentIndex = 0;
let currentImageId = null;

// ============================================================
// INIT — runs when page loads
// ============================================================
async function initPage() {
  if (!shootId) {
    document.body.innerHTML = "<p style='color:white;padding:2rem'>No shoot specified.</p>";
    return;
  }

  // Fetch all images for this shoot
  const { data, error } = await db
    .from("images")
    .select("*")
    .eq("shoot_id", shootId)
    .order("impact", { ascending: false });

  if (error || !data || data.length === 0) {
    document.body.innerHTML = "<p style='color:white;padding:2rem'>Shoot not found.</p>";
    return;
  }

  images = data;
  renderCarousel();
  showImage(0);
}

// ============================================================
// CAROUSEL — render all thumbnails
// ============================================================
function renderCarousel() {
  const strip = document.getElementById("thumbnail-strip");
  const mainImage = document.getElementById("main-image");

  if (!strip || !mainImage) return;

  strip.innerHTML = "";
  images.forEach((img, i) => {
    const thumb = document.createElement("div");
    thumb.className = "thumbnail" + (i === 0 ? " active" : "");
    thumb.innerHTML = `<img src="${img.url}" alt="${img.title || ''}" loading="lazy">`;
    thumb.addEventListener("click", () => showImage(i));
    strip.appendChild(thumb);
  });
}

// ============================================================
// SHOW IMAGE — update main display when switching images
// ============================================================
async function showImage(index) {
  currentIndex = index;
  const img = images[index];
  currentImageId = img.id;

  // Update main image
  const mainImg = document.getElementById("main-image");
  if (mainImg) {
    mainImg.src = img.url;
    mainImg.alt = img.title || "";
  }

  // Update active thumbnail
  document.querySelectorAll(".thumbnail").forEach((t, i) => {
    t.classList.toggle("active", i === index);
  });

  // Update text info on right panel
  const titleEl = document.getElementById("shoot-title");
  const categoryEl = document.getElementById("shoot-category");
  const impactEl = document.getElementById("impact-bar-fill");

  if (titleEl) titleEl.textContent = img.title || "Untitled";
  if (categoryEl) {
    categoryEl.textContent = img.category || "";
    categoryEl.className = "category-badge " + (img.category || "");
  }
  if (impactEl) {
    impactEl.style.width = ((img.impact || 5) / 10 * 100) + "%";
  }

  // Update like button
  await refreshLikeButton();

  // Load comments
  await loadComments();
}

// ============================================================
// KEYBOARD NAVIGATION
// ============================================================
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" && currentIndex > 0) showImage(currentIndex - 1);
  if (e.key === "ArrowRight" && currentIndex < images.length - 1) showImage(currentIndex + 1);
});

// ============================================================
// LIKES — real, saved to Supabase
// ============================================================
async function refreshLikeButton() {
  const btn = document.getElementById("like-btn");
  const countEl = document.getElementById("like-count");
  if (!btn || !currentImageId) return;

  const [count, liked] = await Promise.all([
    window.erynnDB.getLikeCount(currentImageId),
    window.erynnDB.hasLiked(currentImageId),
  ]);

  if (countEl) countEl.textContent = count;
  btn.classList.toggle("liked", liked);
  btn.setAttribute("aria-label", liked ? "Unlike" : "Like");
}

async function handleLike() {
  if (!currentImageId) return;
  const btn = document.getElementById("like-btn");
  btn.disabled = true;

  const nowLiked = await window.erynnDB.toggleLike(currentImageId);
  await refreshLikeButton();

  btn.disabled = false;
}

// Attach like button click
document.addEventListener("DOMContentLoaded", () => {
  const likeBtn = document.getElementById("like-btn");
  if (likeBtn) likeBtn.addEventListener("click", handleLike);
});

// ============================================================
// COMMENTS — real, saved to Supabase
// ============================================================
async function loadComments() {
  const container = document.getElementById("comments-list");
  if (!container || !currentImageId) return;

  container.innerHTML = `<p style="color:#888;font-size:0.85rem">Loading comments...</p>`;

  const comments = await window.erynnDB.getComments(currentImageId);

  if (comments.length === 0) {
    container.innerHTML = `<p style="color:#555;font-size:0.85rem">No comments yet. Be the first!</p>`;
    return;
  }

  container.innerHTML = comments.map((c) => `
    <div class="comment-item">
      <span class="comment-name">${escapeHtml(c.name)}</span>
      <span class="comment-time">${timeAgo(c.created_at)}</span>
      <p class="comment-text">${escapeHtml(c.message)}</p>
    </div>
  `).join("");
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById("comment-name");
  const messageInput = document.getElementById("comment-message");
  const submitBtn = document.getElementById("comment-submit");

  if (!nameInput || !messageInput || !currentImageId) return;

  const name = nameInput.value.trim();
  const message = messageInput.value.trim();

  if (!name || !message) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Posting...";

  try {
    await window.erynnDB.postComment(currentImageId, name, message);
    nameInput.value = "";
    messageInput.value = "";
    await loadComments();
  } catch (err) {
    console.error("Comment failed:", err);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Post";
}

// Attach comment form
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("comment-form");
  if (form) form.addEventListener("submit", handleCommentSubmit);
  initPage();
});

// ============================================================
// ENQUIRY FORM — contact/booking form on index.html
// ============================================================
async function handleEnquirySubmit(e) {
  e.preventDefault();
  const name = document.getElementById("enquiry-name")?.value.trim();
  const email = document.getElementById("enquiry-email")?.value.trim();
  const subject = document.getElementById("enquiry-subject")?.value.trim();
  const message = document.getElementById("enquiry-message")?.value.trim();

  if (!name || !email || !message) return;

  try {
    await window.erynnDB.submitEnquiry(name, email, subject, message);
    alert("Message sent! Erynn will be in touch soon.");
    e.target.reset();
  } catch (err) {
    alert("Something went wrong. Please try again.");
    console.error(err);
  }
}

// ============================================================
// UTILS
// ============================================================
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

window.erynnPage = { showImage, handleLike, handleCommentSubmit };
