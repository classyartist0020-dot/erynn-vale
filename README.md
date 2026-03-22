# Erynn Vale — Portfolio Website

## First time setup (do this once)

### Step 1 — Install dependencies
Open this folder in VS Code, open the Terminal (Ctrl + `) and run:
```
npm install
```

### Step 2 — Set up your API keys
1. Find the file called  .env.example
2. Make a copy of it and rename the copy to  .env  (just  .env  no extension)
3. Open  .env  and fill in your keys:
   - GROQ_API_KEY → from console.groq.com → API Keys
   - IMAGEKIT keys → from imagekit.io → Settings → Developer Options

### Step 3 — Add your images
Put all your compressed JPG photos into the  images/  folder

### Step 4 — Run the scripts in order

**Compress images first (makes them web-ready):**
```
npm run compress
```

**Scan with Groq AI (analyses every photo):**
```
npm run scan
```
If it stops due to rate limit — swap your Groq API key in .env, then run again.
It will resume from where it stopped automatically.

**Sort and upload to ImageKit:**
```
npm run sort
```

### Step 5 — Test locally
Open index.html in your browser. You should see all your photos.

### Step 6 — Deploy to Vercel
1. Push this folder to GitHub
2. Go to vercel.com → Import your GitHub repo
3. Deploy — done. Your site is live.

---

## File guide

| File | What it does |
|------|-------------|
| index.html | The website |
| compress.js | Compresses images to web size |
| scan.js | AI analyses each photo |
| sort.js | Sorts images + uploads to ImageKit |
| progress.json | Auto-created — tracks scan progress |
| uploaded.json | Auto-created — tracks upload progress |
| images.json | Auto-created — website reads this |
| .env | Your API keys — NEVER share or upload |
| .gitignore | Protects sensitive files from GitHub |
