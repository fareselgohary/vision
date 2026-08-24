import { readFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile('.dev.vars', 'utf8')).split(/\r?\n/).flatMap((line) => {
  const index = line.indexOf('=');
  return index > 0 && !line.trimStart().startsWith('#') ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
}));
const login = await fetch('https://the-vision.pages.dev/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
});
if (!login.ok) throw new Error(`Deployed admin login failed (${login.status}).`);
const session = await login.json();
const dashboard = await fetch('https://the-vision.pages.dev/api/admin/dashboard', { headers: { Authorization: `Bearer ${session.accessToken}` } });
if (!dashboard.ok) throw new Error(`Deployed dashboard failed (${dashboard.status}).`);
const data = await dashboard.json();
console.log(`Deployed admin flow verified: ${data.groups.length} groups, ${data.totalRegistrations} registrations.`);
