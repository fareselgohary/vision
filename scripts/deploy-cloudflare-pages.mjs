import { readFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile('.dev.vars', 'utf8')).split(/\r?\n/).flatMap((line) => {
  const index = line.indexOf('=');
  return index > 0 && !line.trimStart().startsWith('#') ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
}));
const headers = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' };
const accountsResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', { headers });
const accounts = await accountsResponse.json();
if (!accounts.success) throw new Error('Could not load Cloudflare accounts.');
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accounts.result[0].id}/pages/projects/the-vision/deployments`, { method: 'POST', headers });
const body = await response.json();
if (!body.success) throw new Error(body.errors?.map((item) => item.message).join('; ') || 'Could not start Pages deployment.');
console.log(`Production deployment started: ${body.result.url || 'the-vision.pages.dev'}`);
