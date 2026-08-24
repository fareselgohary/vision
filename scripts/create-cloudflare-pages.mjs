import { readFile } from 'node:fs/promises';

function readEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return [];
    const index = clean.indexOf('=');
    return index < 1 ? [] : [[clean.slice(0, index), clean.slice(index + 1)]];
  }));
}

const env = readEnv(await readFile('.dev.vars', 'utf8'));
for (const key of ['CLOUDFLARE_API_TOKEN', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[key]) throw new Error(`${key} is missing in .dev.vars`);
}

const headers = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' };
const api = async (path, init = {}) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.errors?.map((item) => item.message).join('; ') || `Cloudflare request failed (${response.status})`);
  return body.result;
};

const accounts = await api('/accounts');
if (!accounts.length) throw new Error('No Cloudflare account is available for this API token.');
const accountId = accounts[0].id;
const projectName = 'the-vision';
const envVars = {
  SUPABASE_URL: { value: env.SUPABASE_URL, type: 'secret_text' },
  SUPABASE_ANON_KEY: { value: env.SUPABASE_ANON_KEY, type: 'secret_text' },
  SUPABASE_SERVICE_ROLE_KEY: { value: env.SUPABASE_SERVICE_ROLE_KEY, type: 'secret_text' },
};

try {
  await api(`/accounts/${accountId}/pages/projects/${projectName}`);
  await api(`/accounts/${accountId}/pages/projects/${projectName}`, {
    method: 'PATCH',
    body: JSON.stringify({ deployment_configs: { production: { env_vars: envVars }, preview: { env_vars: envVars } } }),
  });
  console.log(`Cloudflare Pages project already exists: https://${projectName}.pages.dev`);
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('not found')) throw error;
  await api(`/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
      build_config: { build_command: 'npm run build', destination_dir: 'dist', root_dir: '/' },
      source: { type: 'github', config: { owner: 'fareselgohary', repo_name: 'vision', production_branch: 'main', production_deployments_enabled: true, preview_deployment_setting: 'none' } },
      deployment_configs: { production: { env_vars: envVars }, preview: { env_vars: envVars } },
    }),
  });
  console.log(`Cloudflare Pages project created: https://${projectName}.pages.dev`);
}
