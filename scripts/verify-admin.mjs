import { readFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile('.dev.vars', 'utf8')).split(/\r?\n/).flatMap((line) => {
  const index = line.indexOf('=');
  return index > 0 && !line.trimStart().startsWith('#') ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
}));
const login = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
});
if (!login.ok) throw new Error(`Admin login failed (${login.status}).`);
const session = await login.json();
const secret = env.SUPABASE_SERVICE_ROLE_KEY;
const admins = await fetch(`${env.SUPABASE_URL}/rest/v1/admins?user_id=eq.${session.user.id}&select=user_id`, {
  headers: { apikey: secret, ...(secret.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${secret}` }) },
});
if (!admins.ok || !(await admins.json()).length) throw new Error('Admin role verification failed.');
console.log('Admin login and authorization verified.');
