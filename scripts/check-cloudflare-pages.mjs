import { readFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile('.dev.vars', 'utf8')).split(/\r?\n/).flatMap((line) => {
  const index = line.indexOf('=');
  return index > 0 && !line.trimStart().startsWith('#') ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
}));
const headers = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` };
const get = async (path) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers });
  const body = await response.json();
  if (!body.success) throw new Error(body.errors?.map((item) => item.message).join('; ') || 'Cloudflare API request failed');
  return body.result;
};
const accounts = await get('/accounts');
const deployments = await get(`/accounts/${accounts[0].id}/pages/projects/the-vision/deployments?per_page=1`);
const latest = deployments[0];
console.log(JSON.stringify({ stage: latest?.stages?.find((stage) => stage.status === 'active')?.name || latest?.stages?.at(-1)?.name, status: latest?.latest_stage?.status || latest?.stages?.at(-1)?.status, url: latest?.url, usesFunctions: latest?.uses_functions }));
