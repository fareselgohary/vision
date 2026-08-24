import { readFile } from 'node:fs/promises';

const text = await readFile('.dev.vars', 'utf8');
const env = Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
  const index = line.indexOf('=');
  return index > 0 && !line.trimStart().startsWith('#') ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
}));
const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0];
const query = `select academic_year, count(*) as groups, min(min_capacity) as minimum, max(max_capacity) as maximum from public.groups group by academic_year order by academic_year;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query/read-only`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!response.ok) throw new Error(`Verification failed (${response.status}): ${await response.text()}`);
console.log(JSON.stringify(await response.json()));
