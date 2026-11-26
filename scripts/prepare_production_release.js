// Guard + metadata helper for the "approve & deploy production" workflow.
//
//   node scripts/prepare_production_release.js check
//     env: STAGING_SHA, STAGING_METADATA_FILE (metadata from the staging commit),
//          PRODUCTION_METADATA_FILE (metadata currently on main)
//     Writes release_year / release_month / release_label / should_release to $GITHUB_OUTPUT.
//     should_release=false (exit 0) when staging holds nothing newer than production.
//     Exits 1 when staging metadata is malformed or not in "staging" status.
//
//   node scripts/prepare_production_release.js finalize
//     env: STAGING_SHA, RELEASE_METADATA_FILE (default data/release_metadata.json), GITHUB_RUN_URL
//     Rewrites the merged metadata file as a production release (keeps generated_at fingerprint).

const fs = require('fs');

function monthKey(m) {
  return Number(m.latest_year) * 100 + Number(m.latest_month);
}

function checkRelease({ stagingSha, stagingMeta, productionMeta }) {
  if (!/^[0-9a-f]{40}$/i.test(stagingSha || '')) throw new Error(`STAGING_SHA must be a full 40-char SHA, got "${stagingSha}"`);
  const y = Number(stagingMeta.latest_year), m = Number(stagingMeta.latest_month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new Error('staging release_metadata.json has no valid latest_year/latest_month');
  if (!stagingMeta.generated_at) throw new Error('staging release_metadata.json has no generated_at fingerprint');
  const label = `${y}-${String(m).padStart(2, '0')}`;
  if (monthKey(stagingMeta) <= monthKey(productionMeta)) {
    return { shouldRelease: false, year: y, month: m, label,
      reason: `staging ${label} is not newer than production ${productionMeta.latest_year}-${String(productionMeta.latest_month).padStart(2, '0')}; nothing to release` };
  }
  if (stagingMeta.status !== 'staging') throw new Error(`staging release_metadata.json status is "${stagingMeta.status}", expected "staging"`);
  return { shouldRelease: true, year: y, month: m, label, reason: `release ${label} from ${stagingSha}` };
}

function finalizeMetadata({ merged, stagingSha, runUrl, now = new Date() }) {
  return {
    ...merged,
    status: 'production',
    approved_staging_commit: stagingSha,
    release_commit: stagingSha,
    approved_at: now.toISOString(),
    approved_via: 'github-actions-release-button',
    ...(runUrl ? { release_run_url: runUrl } : {}),
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function appendKv(file, pairs) {
  if (!file) return;
  fs.appendFileSync(file, Object.entries(pairs).map(([k, v]) => `${k}=${String(v).replace(/[\r\n]+/g, ' ')}\n`).join(''));
}

function main() {
  const mode = process.argv[2];
  const stagingSha = (process.env.STAGING_SHA || '').trim();
  try {
    if (mode === 'check') {
      const r = checkRelease({
        stagingSha,
        stagingMeta: readJson(process.env.STAGING_METADATA_FILE),
        productionMeta: readJson(process.env.PRODUCTION_METADATA_FILE),
      });
      console.log(r.reason);
      appendKv(process.env.GITHUB_OUTPUT, {
        should_release: r.shouldRelease, release_year: r.year, release_month: r.month, release_label: r.label,
      });
      if (!r.shouldRelease) console.log(`::notice title=Nothing to release::${r.reason}`);
    } else if (mode === 'finalize') {
      const file = process.env.RELEASE_METADATA_FILE || 'data/release_metadata.json';
      const out = finalizeMetadata({ merged: readJson(file), stagingSha, runUrl: process.env.GITHUB_RUN_URL });
      fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
      console.log(`release_metadata.json marked production for ${out.latest_year}-${out.latest_month}`);
    } else {
      throw new Error('usage: prepare_production_release.js check|finalize');
    }
  } catch (err) {
    console.error(`::error title=Release preparation failed::${String(err.message).replace(/[\r\n]+/g, ' ')}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { checkRelease, finalizeMetadata };
