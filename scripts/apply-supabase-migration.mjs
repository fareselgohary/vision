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
if (!env.SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN is missing in .dev.vars');
if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL is missing in .dev.vars');

const projectRef = new URL(env.SUPABASE_URL).hostname.split('.')[0];
const query = await readFile('supabase/migrations/001_initial.sql', 'utf8');
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
});
const result = await response.text();
if (!response.ok) throw new Error(`Migration request failed (${response.status}): ${result}`);
console.log('Migration applied successfully through Supabase Management API.');
