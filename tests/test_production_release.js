// Tests for the "審核通過並部署正式站" button flow:
//   scripts/prepare_production_release.js, .github/workflows/release-production.yml,
//   and the review email button in scripts/send_update_email.py.
// No network, no Vercel, no GitHub. Git steps run against a local file:// remote.
// Requires: node, git, python3, ruby (only to parse the workflow YAML).
// Run: node tests/test_production_release.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkRelease, finalizeMetadata } = require('../scripts/prepare_production_release');

const ROOT = path.resolve(__dirname, '..');
const SHA = '6e00cce373a08feda82f670d45103c0b1c383f1a';
const STAGING_META = { latest_year: 2026, latest_month: 10, source: 'CAA', status: 'staging', generated_at: '2026-11-25T13:45:47.470Z' };
const PROD_META = { latest_year: 2026, latest_month: 9, source: 'CAA', status: 'production', generated_at: '2026-10-27T09:29:13.178Z' };

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function loadWorkflow(file) {
  const r = spawnSync('ruby', ['-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.load_file(ARGV[0]))', path.join(ROOT, file)], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const release = () => loadWorkflow('.github/workflows/release-production.yml');
const step = (wf, name) => {
  const s = wf.jobs.release.steps.find(x => x.name === name);
  assert.ok(s, `step not found: ${name}`);
  return s;
};

// ---------- prepare_production_release.js ----------
test('P1. staging 10 月、正式站 9 月 → 需要發布', () => {
  const r = checkRelease({ stagingSha: SHA, stagingMeta: STAGING_META, productionMeta: PROD_META });
  assert.deepStrictEqual([r.shouldRelease, r.label], [true, '2026-10']);
});

test('P2. staging 與正式站同月（已發布過、或重複按按鈕）→ 不發布，不報錯', () => {
  const r = checkRelease({ stagingSha: SHA, stagingMeta: { ...STAGING_META }, productionMeta: { ...PROD_META, latest_month: 10 } });
  assert.strictEqual(r.shouldRelease, false);
  assert.match(r.reason, /nothing to release/);
});

test('P3. staging 比正式站舊 → 不發布', () => {
  const r = checkRelease({ stagingSha: SHA, stagingMeta: { ...STAGING_META, latest_month: 8 }, productionMeta: PROD_META });
  assert.strictEqual(r.shouldRelease, false);
});

test('P4. staging metadata 狀態不是 staging、缺 generated_at、月份無效、短 SHA → 停止', () => {
  assert.throws(() => checkRelease({ stagingSha: SHA, stagingMeta: { ...STAGING_META, status: 'production' }, productionMeta: PROD_META }), /expected "staging"/);
  assert.throws(() => checkRelease({ stagingSha: SHA, stagingMeta: { ...STAGING_META, generated_at: undefined }, productionMeta: PROD_META }), /generated_at/);
  assert.throws(() => checkRelease({ stagingSha: SHA, stagingMeta: { ...STAGING_META, latest_month: 13 }, productionMeta: PROD_META }), /latest_month/);
  assert.throws(() => checkRelease({ stagingSha: '6e00cce', stagingMeta: STAGING_META, productionMeta: PROD_META }), /40-char/);
});

test('P5. finalize：改成 production、記錄核准 commit，保留月份與 generated_at 指紋', () => {
  const out = finalizeMetadata({ merged: STAGING_META, stagingSha: SHA, runUrl: 'https://run', now: new Date('2026-11-26T03:00:00Z') });
  assert.strictEqual(out.status, 'production');
  assert.strictEqual(out.latest_month, 10);
  assert.strictEqual(out.generated_at, STAGING_META.generated_at);
  assert.strictEqual(out.approved_staging_commit, SHA);
  assert.strictEqual(out.release_commit, SHA);
  assert.strictEqual(out.approved_at, '2026-11-26T03:00:00.000Z');
  assert.strictEqual(out.release_run_url, 'https://run');
});

// ---------- email button ----------
function email(extra) {
  const r = spawnSync('python3', ['scripts/send_update_email.py'], {
    cwd: ROOT, encoding: 'utf8',
    env: { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: '1', EMAIL_DRY_RUN: '1', LATEST_YEAR: '2026', LATEST_MONTH: '10',
      STAGING_URL: 'https://staging.example', ...extra },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout;
}

test('E1. 待審核信（staging_ready / staging_pending）有「審核通過並部署正式站」按鈕，不再叫你去 ChatGPT', () => {
  for (const kind of ['staging_ready', 'staging_pending']) {
    const out = email({ NOTIFY_KIND: kind, RELEASE_WORKFLOW_URL: 'https://github.com/tokpmpm/flightdata2/actions/workflows/release-production.yml', REVIEW_CHAT_URL: 'https://chat.example' });
    assert.match(out, /Button: .*href="https:\/\/github.com\/tokpmpm\/flightdata2\/actions\/workflows\/release-production.yml".*審核通過並部署正式站/);
    assert.match(out, /Run workflow/);
    assert.doesNotMatch(out, /ChatGPT/);
    assert.doesNotMatch(out, /chat\.example/);
  }
});

test('E2. 沒有設定按鈕網址時維持原本 ChatGPT 文字（向下相容）', () => {
  const out = email({ NOTIFY_KIND: 'staging_pending', REVIEW_CHAT_URL: 'https://chat.example' });
  assert.match(out, /回 ChatGPT 審核/);
  assert.match(out, /flightdata2 2026-10 審核通過/);
});

test('E3. 失敗通知、正式站通知不會出現審核按鈕', () => {
  for (const kind of ['update_failed', 'production_success', 'production_failed', 'no_data']) {
    const out = email({ NOTIFY_KIND: kind, RELEASE_WORKFLOW_URL: 'https://github.com/x/y/actions/workflows/release-production.yml' });
    assert.doesNotMatch(out, /審核通過並部署正式站/);
  }
});

// ---------- workflow structure ----------
test('W1. 發布流程只能手動按下（workflow_dispatch）執行，且只能從 main 執行', () => {
  const wf = release();
  assert.deepStrictEqual(Object.keys(wf.on || wf[true]), ['workflow_dispatch']);
  assert.strictEqual(wf.jobs.release.if, "github.ref == 'refs/heads/main'");
});

test('W2. 步驟順序：憑證 → 讀 staging → 等部署 → 重新驗收 staging → 合併 → 部署 → 驗收正式站 → 推 main → 成功信', () => {
  const names = release().jobs.release.steps.map(s => s.name);
  const order = ['Check Vercel production credentials', 'Read staging release', 'Wait for staging Vercel deployment READY',
    'Re-verify staging site before release', 'Merge approved staging commit into main (local only)', 'Deploy production on Vercel',
    'Verify production site', 'Push release to main', 'Send production success email'];
  const idx = order.map(n => names.indexOf(n));
  assert.ok(idx.every(i => i >= 0), JSON.stringify(idx));
  assert.deepStrictEqual([...idx].sort((a, b) => a - b), idx);
});

test('W3. 有變更的步驟都要求 should_release == true；推 main 不使用 --force', () => {
  const wf = release();
  for (const n of ['Wait for staging Vercel deployment READY', 'Re-verify staging site before release', 'Merge approved staging commit into main (local only)',
    'Deploy production on Vercel', 'Verify production site', 'Push release to main', 'Send production success email']) {
    assert.strictEqual(step(wf, n).if, "steps.release.outputs.should_release == 'true'", n);
  }
  const push = step(wf, 'Push release to main').run;
  assert.match(push, /git push origin HEAD:main/);
  assert.doesNotMatch(push, /--force|-f\b/);
});

test('W4. 和每月 staging 更新共用同一個 concurrency group（不會同時跑）', () => {
  assert.strictEqual(release().concurrency.group, loadWorkflow('.github/workflows/auto-update.yml').concurrency.group);
});

test('W5. Vercel token 只在憑證檢查與部署兩個步驟使用；auto-update 流程不會部署正式站', () => {
  const wf = release();
  const using = wf.jobs.release.steps.filter(s => JSON.stringify(s.env || {}).includes('secrets.VERCEL_TOKEN')).map(s => s.name);
  assert.deepStrictEqual(using, ['Check Vercel production credentials', 'Deploy production on Vercel']);
  const auto = fs.readFileSync(path.join(ROOT, '.github/workflows/auto-update.yml'), 'utf8');
  assert.doesNotMatch(auto, /vercel@|vercel deploy|--prod|VERCEL_TOKEN|HEAD:main/);
  assert.match(auto, /RELEASE_WORKFLOW_URL: https:\/\/github.com\/\$\{\{ github.repository \}\}\/actions\/workflows\/release-production.yml/);
});

// ---------- run the real `run:` blocks against a local git fixture ----------
function sh(cmd, cwd) {
  const r = spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `${cmd}\n${r.stderr}`);
  return r.stdout.trim();
}

function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd2-rel-'));
  const remote = path.join(tmp, 'remote.git');
  const src = path.join(tmp, 'src');
  sh(`git init -q --bare "${remote}"`, tmp);
  sh(`git init -q -b main "${src}"`, tmp);
  const g = c => sh(`git -c user.name=t -c user.email=t@example.com ${c}`, src);
  fs.mkdirSync(path.join(src, 'data'));
  fs.mkdirSync(path.join(src, 'scripts'));
  fs.copyFileSync(path.join(ROOT, 'scripts/prepare_production_release.js'), path.join(src, 'scripts/prepare_production_release.js'));
  fs.writeFileSync(path.join(src, 'data/release_metadata.json'), JSON.stringify(PROD_META, null, 2) + '\n');
  fs.writeFileSync(path.join(src, 'data/flight.json'), '[9]\n');
  g('add -A'); g('commit -q -m base');
  g('checkout -q -b staging');
  fs.writeFileSync(path.join(src, 'data/release_metadata.json'), JSON.stringify(STAGING_META, null, 2) + '\n');
  fs.writeFileSync(path.join(src, 'data/flight.json'), '[9,10]\n');
  g('add -A'); g('commit -q -m stage-oct');
  g('checkout -q main');
  fs.writeFileSync(path.join(src, 'README'), 'main moved after staging was cut\n');
  g('add -A'); g('commit -q -m main-change');
  g(`remote add origin "${remote}"`); g('push -q origin main staging');
  const ws = path.join(tmp, 'ws');
  sh(`git clone -q --branch main "file://${remote}" "${ws}"`, tmp);
  return { tmp, remote, src, ws, runnerTemp: fs.mkdtempSync(path.join(tmp, 'rt-')) };
}

function runStep(fx, name, env = {}) {
  const block = step(release(), name).run;
  const out = path.join(fx.tmp, `out-${Date.now()}-${Math.random()}`);
  fs.writeFileSync(out, '');
  const r = spawnSync('bash', ['-e', '-c', block], {
    cwd: fx.ws, encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, RUNNER_TEMP: fx.runnerTemp, GITHUB_OUTPUT: out,
      GITHUB_ENV: path.join(fx.tmp, 'env'), ...env },
  });
  const outputs = Object.fromEntries(fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { ...r, outputs };
}

test('R1. 沒設定 Vercel secrets → 第一步就停止，並列出缺少的項目', () => {
  const fx = fixture();
  const r = runStep(fx, 'Check Vercel production credentials', { VERCEL_TOKEN: '', VERCEL_ORG_ID: 'x', VERCEL_PROJECT_ID: '' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout, /Missing repository secrets:: VERCEL_TOKEN VERCEL_PROJECT_ID/);
});

test('R2. 讀 staging → 合併（只在本機）→ 推 main：main 得到 10 月資料與 production metadata，遠端 main 只在最後一步才變', () => {
  const fx = fixture();
  const remoteMainBefore = sh(`git --git-dir="${fx.remote}" rev-parse main`, fx.tmp);
  const stagingSha = sh(`git --git-dir="${fx.remote}" rev-parse staging`, fx.tmp);

  const read = runStep(fx, 'Read staging release');
  assert.strictEqual(read.status, 0, read.stderr);
  assert.deepStrictEqual([read.outputs.should_release, read.outputs.release_label, read.outputs.staging_sha], ['true', '2026-10', stagingSha]);

  const merge = runStep(fx, 'Merge approved staging commit into main (local only)',
    { STAGING_SHA: stagingSha, RELEASE_LABEL: '2026-10', GITHUB_RUN_URL: 'https://run' });
  assert.strictEqual(merge.status, 0, merge.stderr);
  assert.strictEqual(sh(`git --git-dir="${fx.remote}" rev-parse main`, fx.tmp), remoteMainBefore, 'merge step must not push');
  const meta = JSON.parse(fs.readFileSync(path.join(fx.ws, 'data/release_metadata.json'), 'utf8'));
  assert.deepStrictEqual([meta.status, meta.latest_month, meta.generated_at, meta.approved_staging_commit], ['production', 10, STAGING_META.generated_at, stagingSha]);
  assert.strictEqual(fs.readFileSync(path.join(fx.ws, 'data/flight.json'), 'utf8'), '[9,10]\n');
  assert.ok(fs.existsSync(path.join(fx.ws, 'README')), 'main-only changes are kept');
  assert.strictEqual(sh(`git log --format=%s -2`, fx.ws), 'chore(release): mark approved 2026-10 data live in production\nRelease 2026-10 CAA aviation data (approved staging commit)');

  const push = runStep(fx, 'Push release to main');
  assert.strictEqual(push.status, 0, push.stderr);
  assert.strictEqual(sh(`git --git-dir="${fx.remote}" rev-parse main`, fx.tmp), merge.outputs.main_sha);
  assert.strictEqual(sh(`git --git-dir="${fx.remote}" rev-parse staging`, fx.tmp), stagingSha, 'staging untouched');

  // Pressing the button again after release: nothing to release.
  const again = runStep(fx, 'Read staging release');
  assert.strictEqual(again.status, 0, again.stderr);
  assert.strictEqual(again.outputs.should_release, 'false');
});

test('R3. 發布期間遠端 main 被別人更新 → 推 main 被拒絕（不強推）', () => {
  const fx = fixture();
  const stagingSha = sh(`git --git-dir="${fx.remote}" rev-parse staging`, fx.tmp);
  runStep(fx, 'Read staging release');
  const merge = runStep(fx, 'Merge approved staging commit into main (local only)', { STAGING_SHA: stagingSha, RELEASE_LABEL: '2026-10' });
  assert.strictEqual(merge.status, 0, merge.stderr);
  fs.writeFileSync(path.join(fx.src, 'OTHER'), 'x\n');
  sh('git -c user.name=t -c user.email=t@example.com add -A && git -c user.name=t -c user.email=t@example.com commit -q -m other && git push -q origin main', fx.src);
  const before = sh(`git --git-dir="${fx.remote}" rev-parse main`, fx.tmp);
  const push = runStep(fx, 'Push release to main');
  assert.notStrictEqual(push.status, 0);
  assert.strictEqual(sh(`git --git-dir="${fx.remote}" rev-parse main`, fx.tmp), before);
});

test('W6. 正式站驗收必須清空 DEPLOYMENT_URL（避免沿用 staging 等待步驟寫入 $GITHUB_ENV 的 staging 網址）', () => {
  const env = step(release(), 'Verify production site').env;
  assert.ok(Object.prototype.hasOwnProperty.call(env, 'DEPLOYMENT_URL'), 'DEPLOYMENT_URL must be set explicitly');
  assert.strictEqual(env.DEPLOYMENT_URL, '');
  assert.strictEqual(env.BASE_URL, '${{ env.PRODUCTION_URL }}');
});

let finished = false;
process.on('exit', code => {
  if (!finished && code === 0) { console.log('\nFAIL test runner exited before all tests completed'); process.exitCode = 1; }
});
(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`PASS ${t.name}`); }
    catch (e) { failed += 1; console.log(`FAIL ${t.name}\n     ${e.stack.split('\n').slice(0, 4).join('\n     ')}`); }
  }
  finished = true;
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
