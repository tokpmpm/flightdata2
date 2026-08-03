const { execSync } = require('child_process');

console.log('=== Starting Standardized Build Pipeline ===');
try {
    console.log('Running Stage 1: Prerender...');
    execSync('node prerender.js', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', VERCEL: '1' } });
    
    console.log('Running Stage 2: SEO Verification...');
    execSync('node verify_seo.js', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', VERCEL: '1' } });
    
    console.log('Running Stage 3: AdSense Verification...');
    execSync('node tests/verify_adsense.js', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', VERCEL: '1' } });
    
    console.log('=== Build Pipeline Completed Successfully! ===');
    process.exit(0);
} catch (err) {
    console.error('❌ Build Pipeline failed during execution:', err.message);
    process.exit(1);
}
