const fs = require('fs');
const path = require('path');

const srcDir = 'G:/2026/instagram/insta data/insta_data/vaibhav.codes';
const srcJson = path.join(srcDir, 'all_posts_data.json');
const srcPostsDir = path.join(srcDir, 'all_posts');
const dstJson = path.resolve(__dirname, '../public/data/reels-fallback.json');
const dstCoversDir = path.resolve(__dirname, '../public/data/covers');

if (!fs.existsSync(dstCoversDir)) {
  fs.mkdirSync(dstCoversDir, { recursive: true });
}

const rawData = JSON.parse(fs.readFileSync(srcJson, 'utf8'));

// Copy cover images locally
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
console.log(`Copied ${copiedCount} local cover images to public/data/covers/`);

// Update profile with local avatar
const profile = {
  ...rawData.profile,
  local_profile_pic: '/data/profile_pic.jpg',
  local_profile_pic_full: '/data/profile_pic.jpg'
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
console.log(`Successfully wrote clean UTF-8 reels-fallback.json with ${posts.length} posts`);
