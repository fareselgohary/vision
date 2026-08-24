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
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) {
  if (!env[name]) throw new Error(`${name} is missing in .dev.vars`);
}

const secret = env.SUPABASE_SERVICE_ROLE_KEY;
const serverHeaders = {
  apikey: secret,
  'Content-Type': 'application/json',
  ...(secret.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${secret}` }),
};
const createUser = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: serverHeaders,
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, email_confirm: true }),
});
const user = await createUser.json();
if (!createUser.ok) throw new Error(`Could not create admin user (${createUser.status}): ${user.msg || user.message || 'unknown error'}`);

const grantAdmin = await fetch(`${env.SUPABASE_URL}/rest/v1/admins`, {
  method: 'POST',
  headers: { ...serverHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ user_id: user.id }),
});
if (!grantAdmin.ok) throw new Error(`Could not grant admin role (${grantAdmin.status}).`);
console.log(`Admin account created for ${env.ADMIN_EMAIL}.`);
