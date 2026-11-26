// Wait until the Vercel deployment for an exact git commit SHA is READY.
//
// Vercel's Git integration reports every deployment back to GitHub as
//   1) a GitHub Deployment (creator vercel[bot], sha = commit) + deployment statuses
//   2) a commit status with context "Vercel"
// so we can poll those with the workflow's GITHUB_TOKEN; no Vercel token is needed.
//
// Exit 0 only when a deployment whose sha === EXPECTED_SHA reports success (READY).
// Exit 1 on FAILED / ERROR / timeout / lookup errors, after recording the reason in
// $GITHUB_ENV (FAILURE_TYPE, FAILURE_DETAIL, DEPLOYMENT_STATE) for the notification step.

const fs = require('fs');

class DeploymentError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code; // DEPLOYMENT_FAILED | DEPLOYMENT_TIMEOUT | DEPLOYMENT_LOOKUP_FAILED
    this.details = details;
  }
}

const FAILURE_TYPES = {
  DEPLOYMENT_FAILED: 'deployment_failed',
  DEPLOYMENT_TIMEOUT: 'deployment_timeout',
  DEPLOYMENT_LOOKUP_FAILED: 'deployment_status_unavailable',
};

const FAILED_STATES = new Set(['failure', 'error', 'inactive']);

function requirePositive(name, value) {
  // NaN / 0 / negative would make the timeout check never fire (infinite polling).
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number, got "${value}"`);
  return value;
}

function newestFirst(a, b) {
  // ISO-8601 created_at sorts lexically; tie-break on numeric id. Never rely on API ordering.
  return String(b.created_at || '').localeCompare(String(a.created_at || '')) || (Number(b.id) || 0) - (Number(a.id) || 0);
}

async function waitForVercelDeployment({
  repo,
  sha,
  token,
  environment = '',
  timeoutMs = 5 * 60 * 1000,
  intervalMs = 10 * 1000,
  requestTimeoutMs = 15 * 1000,
  apiBase = 'https://api.github.com',
  fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(r => setTimeout(r, ms)),
  now = Date.now,
  log = console.log,
}) {
  if (!repo || !sha) throw new Error('repo and sha are required');
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error(`EXPECTED_SHA must be a full 40-char commit SHA, got "${sha}"`);
  requirePositive('timeoutMs', timeoutMs);
  requirePositive('intervalMs', intervalMs);
  requirePositive('requestTimeoutMs', requestTimeoutMs);

  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'flightdata2-release-check/1.0' };
  if (token) headers.authorization = `Bearer ${token}`;

  const start = now();

  async function api(path) {
    // Bound every request so a stalled connection cannot outlive the overall timeout.
    const budget = Math.max(1000, Math.min(requestTimeoutMs, timeoutMs - (now() - start)));
    const res = await fetchImpl(`${apiBase}${path}`, { headers, signal: AbortSignal.timeout(budget) });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new DeploymentError('DEPLOYMENT_LOOKUP_FAILED',
        `GitHub API ${path} returned HTTP ${res.status}; check workflow permissions (deployments: read, statuses: read)`,
        { httpStatus: res.status });
    }
    if (!res.ok) throw Object.assign(new Error(`GitHub API ${path} returned HTTP ${res.status}`), { transient: true });
    return res.json();
  }

  let lastState = 'not_found';
  let lastDeployment = null;
  let attempt = 0;

  for (;;) {
    attempt += 1;
    try {
      // 1) GitHub Deployments created by Vercel for this exact sha.
      const deployments = await api(`/repos/${repo}/deployments?sha=${sha}&per_page=20`);
      const candidates = (Array.isArray(deployments) ? deployments : [])
        .filter(d => d && d.sha === sha)
        .filter(d => !d.creator || !d.creator.login || /vercel/i.test(d.creator.login))
        .filter(d => !environment || String(d.environment || '').toLowerCase() === environment.toLowerCase())
        .sort(newestFirst);
      const deployment = candidates[0] || null;

      let state = 'not_found';
      let deploymentUrl = '';
      if (deployment) {
        lastDeployment = deployment;
        const statuses = await api(`/repos/${repo}/deployments/${deployment.id}/statuses?per_page=100`);
        const latest = (Array.isArray(statuses) ? [...statuses] : []).sort(newestFirst)[0];
        state = latest ? latest.state : 'pending';
        deploymentUrl = (latest && (latest.environment_url || latest.target_url)) || '';
      }

      // 2) The "Vercel" commit status reports build failures even before/without a deployment record.
      const commitStatuses = await api(`/repos/${repo}/commits/${sha}/statuses?per_page=100`);
      const vercelStatus = (Array.isArray(commitStatuses) ? commitStatuses : [])
        .filter(s => /^vercel/i.test(s.context || ''))
        .sort(newestFirst)[0];

      lastState = state;
      const elapsed = Math.round((now() - start) / 1000);
      log(`[vercel-wait] attempt ${attempt} t+${elapsed}s sha=${sha.slice(0, 7)} deployment=${deployment ? deployment.id : '-'} state=${state} commitStatus=${vercelStatus ? vercelStatus.state : '-'}`);

      if (state === 'success') {
        if (deployment.sha !== sha) {
          // Defensive: never accept a deployment for another commit.
          throw new DeploymentError('DEPLOYMENT_FAILED', `Deployment ${deployment.id} sha ${deployment.sha} != expected ${sha}`, { state });
        }
        return {
          state: 'READY',
          deploymentId: deployment.id,
          deploymentUrl,
          environment: deployment.environment,
          sha: deployment.sha,
          waitedMs: now() - start,
          attempts: attempt,
        };
      }
      if (FAILED_STATES.has(state)) {
        throw new DeploymentError('DEPLOYMENT_FAILED',
          `Vercel deployment ${deployment.id} for ${sha.slice(0, 7)} is ${state.toUpperCase()}`,
          { state, deploymentId: deployment.id, deploymentUrl });
      }
      if (vercelStatus && FAILED_STATES.has(vercelStatus.state)) {
        throw new DeploymentError('DEPLOYMENT_FAILED',
          `Vercel commit status for ${sha.slice(0, 7)} is ${vercelStatus.state.toUpperCase()}: ${vercelStatus.description || ''}`.trim(),
          { state: vercelStatus.state, deploymentUrl: vercelStatus.target_url || '' });
      }
      if (!deployment && vercelStatus) lastState = `commit_status_${vercelStatus.state}`;
    } catch (err) {
      if (err instanceof DeploymentError) throw err;
      log(`[vercel-wait] attempt ${attempt} transient error: ${err.message}`);
    }

    const remaining = timeoutMs - (now() - start);
    if (remaining <= 0) {
      throw new DeploymentError('DEPLOYMENT_TIMEOUT',
        `Vercel deployment for ${sha.slice(0, 7)} not READY after ${Math.round(timeoutMs / 1000)}s (last state: ${lastState})`,
        { state: lastState, deploymentId: lastDeployment ? lastDeployment.id : '' });
    }
    await sleep(Math.min(intervalMs, remaining));
  }
}

function oneLine(value) {
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').slice(0, 500);
}

function appendKv(file, pairs) {
  if (!file) return;
  fs.appendFileSync(file, Object.entries(pairs).map(([k, v]) => `${k}=${oneLine(v)}\n`).join(''));
}

async function main() {
  const sha = (process.env.EXPECTED_SHA || '').trim();
  const repo = process.env.GITHUB_REPOSITORY;
  try {
    const result = await waitForVercelDeployment({
      repo,
      sha,
      token: process.env.GITHUB_TOKEN,
      environment: process.env.VERCEL_ENVIRONMENT || 'Preview',
      apiBase: process.env.GITHUB_API_URL || 'https://api.github.com',
      timeoutMs: Number(process.env.VERCEL_WAIT_TIMEOUT_SECONDS || 300) * 1000,
      intervalMs: Number(process.env.VERCEL_POLL_INTERVAL_SECONDS || 10) * 1000,
    });
    console.log(`Vercel deployment READY: id=${result.deploymentId} sha=${result.sha} url=${result.deploymentUrl} waited=${Math.round(result.waitedMs / 1000)}s`);
    appendKv(process.env.GITHUB_OUTPUT, {
      deployment_state: result.state,
      deployment_id: result.deploymentId,
      deployment_url: result.deploymentUrl,
      deployment_sha: result.sha,
    });
    appendKv(process.env.GITHUB_ENV, { DEPLOYMENT_STATE: result.state, DEPLOYMENT_URL: result.deploymentUrl });
  } catch (err) {
    const code = err.code || 'DEPLOYMENT_LOOKUP_FAILED';
    const state = (err.details && err.details.state) || 'unknown';
    console.error(`::error title=Vercel deployment not ready::${oneLine(err.message)}`);
    appendKv(process.env.GITHUB_ENV, {
      FAILURE_TYPE: FAILURE_TYPES[code] || 'deployment_status_unavailable',
      FAILURE_DETAIL: err.message,
      DEPLOYMENT_STATE: state,
      DEPLOYMENT_URL: (err.details && err.details.deploymentUrl) || '',
    });
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { waitForVercelDeployment, DeploymentError, FAILURE_TYPES };
