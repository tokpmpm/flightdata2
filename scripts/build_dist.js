/**
 * Build the Vercel publish directory (dist/) from a whitelist.
 *
 * prerender.js keeps writing its output to the repo root (verification scripts read it there);
 * this script then copies ONLY public site files into dist/, so build scripts, Python tools,
 * test reports, Markdown notes, etc. are never deployed.
 *
 * Usage: node prerender.js && node scripts/build_dist.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Public files / directories (relative to repo root).
const WHITELIST = [
  'index.html',
  'airport',
  'airline',
  'about',
  'privacy',
  'insights',
  'link',
  'css',
  'js',
  'data',
  'og-card.png',
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'llms-full.txt',
  'ads.txt',
  // Legacy standalone pages that are already live; kept so existing URLs keep working.
  // cny_charts.html stays excluded (it is in .vercelignore and already 404 in production).
  '2025_yoy_charts.html',
  'charts.html',
  'nov_analysis_infographic.html',
  'nov_regional_charts.html',
  'nov_regional_rankings.html',
  'nov_social_charts.html',
  'presentation.html',
  'q1_2026_airlines_cards.html',
  'summer_qa_cards.html',
];

// Never publish these even inside whitelisted directories.
function isExcluded(rel) {
  const base = path.basename(rel);
  if (base === '.DS_Store') return true;
  // Local monthly-report review artifacts (gitignored).
  if (/^insights\/.+\/review\.html$/.test(rel.split(path.sep).join('/'))) return true;
  return false;
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const missing = [];
  for (const entry of WHITELIST) {
    const src = path.join(ROOT, entry);
    if (!fs.existsSync(src)) { missing.push(entry); continue; }
    fs.cpSync(src, path.join(DIST, entry), {
      recursive: true,
      filter: (s) => !isExcluded(path.relative(ROOT, s)),
    });
  }
  if (missing.length) throw new Error('build_dist: whitelisted entries missing: ' + missing.join(', ') + ' (did prerender.js run?)');

  // Safety net: every root-relative asset referenced by a published HTML page must exist in dist/.
  // If it exists in the repo root but not in dist/, the whitelist is missing it -> fail the build.
  const htmlFiles = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.html')) htmlFiles.push(p);
    }
  })(DIST);

  const notWhitelisted = new Set();
  const brokenEverywhere = new Set();
  const refRe = /\b(?:src|href)="(\/[^"#?]*)/g;
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(refRe)) {
      const ref = m[1];
      if (ref.startsWith('//') || ref.startsWith('/api/')) continue; // protocol-relative / serverless functions
      const rel = decodeURIComponent(ref).replace(/^\//, '');
      const candidates = ref.endsWith('/') || rel === ''
        ? [path.join(rel, 'index.html')]
        : [rel, rel + '.html', path.join(rel, 'index.html')]; // cleanUrls
      const inDist = candidates.some(c => fs.existsSync(path.join(DIST, c)));
      if (inDist) continue;
      const inRoot = candidates.some(c => fs.existsSync(path.join(ROOT, c)));
      (inRoot ? notWhitelisted : brokenEverywhere).add(ref + '  (from ' + path.relative(DIST, file) + ')');
    }
  }
  if (brokenEverywhere.size) {
    console.warn('⚠️  build_dist: referenced paths that do not exist anywhere (pre-existing broken links):\n  ' + [...brokenEverywhere].join('\n  '));
  }
  if (notWhitelisted.size) {
    throw new Error('build_dist: HTML references files that exist in the repo but are not whitelisted:\n  ' + [...notWhitelisted].join('\n  '));
  }

  let count = 0;
  (function countFiles(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) countFiles(p); else count++;
    }
  })(DIST);
  console.log('✅ dist/ built: ' + count + ' files from ' + WHITELIST.length + ' whitelisted entries (' + htmlFiles.length + ' HTML pages checked).');
}

try {
  build();
} catch (err) {
  console.error('❌ ' + err.message);
  process.exit(1);
}
