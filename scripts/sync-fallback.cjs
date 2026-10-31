const fs = require('fs');
const path = require('path');

// Resolve repository paths
const dstJson = path.resolve(__dirname, '../public/data/reels-fallback.json');
const dstCoversDir = path.resolve(__dirname, '../public/data/covers');
const logoSrc = path.resolve(__dirname, '../public/vaibhav-logo.png');
const profilePicDst = path.resolve(__dirname, '../public/data/profile_pic.jpg');

if (!fs.existsSync(dstCoversDir)) {
  fs.mkdirSync(dstCoversDir, { recursive: true });
}

// Ensure official logo is also copied to data/profile_pic.jpg
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, profilePicDst);
}

// Dynamic candidate directories for source instagram data (relative + absolute)
const candidateDirs = [
  process.env.INSTA_DATA_DIR,
  path.resolve(__dirname, '../../insta data/insta_data/vaibhav.codes'),
  path.resolve(__dirname, '../../insta data/vaibhav.codes'),
  path.resolve(__dirname, '../insta data/insta_data/vaibhav.codes'),
  path.resolve(__dirname, '../insta data/vaibhav.codes'),
  'G:/2026/instagram/insta data/insta_data/vaibhav.codes',
  'G:/2026/instagram/insta data/vaibhav.codes'
].filter(Boolean);

let srcDir = candidateDirs.find(dir => fs.existsSync(dir));

if (!srcDir) {
  if (fs.existsSync(dstJson)) {
    console.log('[Sync] External scrape folder not found; using existing committed static dataset in public/data/ (production mode).');
    process.exit(0);
  } else {
    console.error('[Sync] Error: Could not find instagram data source and no fallback exists.');
    process.exit(1);
  }
}

console.log(`[Sync] Found dynamic data source: ${srcDir}`);

const srcJson = path.join(srcDir, 'all_posts_data.json');
const srcPostsDir = path.join(srcDir, 'all_posts');

if (!fs.existsSync(srcJson)) {
  console.log('[Sync] all_posts_data.json not found in source dir; keeping existing static data.');
  process.exit(0);
}

const rawData = JSON.parse(fs.readFileSync(srcJson, 'utf8'));

// Copy cover images locally into public/data/covers/
let copiedCount = 0;
if (fs.existsSync(srcPostsDir)) {
  const folders = fs.readdirSync(srcPostsDir);
  for (const folder of folders) {
    const folderPath = path.join(srcPostsDir, folder);
    const detailsFile = path.join(folderPath, 'details.json');
    const coverFile = path.join(folderPath, 'cover_image.jpg');
    if (fs.existsSync(detailsFile) && fs.existsSync(coverFile)) {
      try {
        const details = JSON.parse(fs.readFileSync(detailsFile, 'utf8'));
        if (details.shortcode) {
          const targetCover = path.join(dstCoversDir, `${details.shortcode}.jpg`);
          fs.copyFileSync(coverFile, targetCover);
          copiedCount++;
        }
      } catch (e) {}
    }
  }
}
console.log(`[Sync] Copied ${copiedCount} local cover images to public/data/covers/`);

// Update profile with official vaibhav-logo.png
const profile = {
  ...rawData.profile,
  local_profile_pic: '/vaibhav-logo.png',
  local_profile_pic_full: '/vaibhav-logo.png'
};

// Sort newest first
const sortedPosts = (rawData.posts || []).sort((a, b) => {
  const timeA = new Date(a.timestamp_utc || a.date).getTime() || 0;
  const timeB = new Date(b.timestamp_utc || b.date).getTime() || 0;
  return timeB - timeA;
});

// Update each post with permanent local cover URLs
const posts = sortedPosts.map(post => {
  const shortcode = post.shortcode;
  const localCover = `/data/covers/${shortcode}.jpg`;
  return {
    ...post,
    local_cover_url: localCover,
    effective_cover_url: localCover
  };
});

const output = {
  profile,
  posts_count: posts.length,
  posts
};

fs.writeFileSync(dstJson, JSON.stringify(output, null, 2), 'utf8');
console.log(`[Sync] Successfully wrote clean UTF-8 reels-fallback.json with ${posts.length} posts and vaibhav-logo.png avatar`);
