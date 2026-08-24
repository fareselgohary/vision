interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

type PagesContext = EventContext<Env, any, Record<string, unknown>>;

const json = (data: unknown, status = 200, cacheControl = 'no-store') => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
});

function safeText(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

async function supabase(context: PagesContext, path: string, init: RequestInit = {}, service = true) {
  const key = service ? context.env.SUPABASE_SERVICE_ROLE_KEY : context.env.SUPABASE_ANON_KEY;
  // Supabase now issues `sb_secret_...` server keys as well as legacy JWT service-role keys.
  // Secret keys select the service role through `apikey`; they must not be sent as a Bearer JWT.
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Content-Type', 'application/json');
  if (!key.startsWith('sb_secret_')) headers.set('Authorization', `Bearer ${key}`);
  return fetch(`${context.env.SUPABASE_URL}${path}`, {
    ...init,
    headers,
  });
}

async function requireAdmin(context: PagesContext) {
  const authorization = context.request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  const userResponse = await fetch(`${context.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: context.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return null;
  const adminResponse = await supabase(context, `/rest/v1/admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);
  if (!adminResponse.ok) return null;
  const admins = await adminResponse.json() as Array<{ user_id: string }>;
  return admins.length ? user : null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = context.request.method;

  try {
    if (method === 'GET' && path === '/groups') {
      const cacheKey = new Request(new URL('/api/groups', context.request.url).toString(), { method: 'GET' });
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
      const response = await supabase(context, '/rest/v1/group_availability?select=*&order=academic_year.asc,group_number.asc');
      if (!response.ok) throw new Error('SUPABASE_GROUPS');
      const result = json({ groups: await response.json() }, 200, 'public, max-age=2, s-maxage=2');
      context.waitUntil(caches.default.put(cacheKey, result.clone()));
      return result;
    }

    if (method === 'POST' && path === '/register') {
      const body = await context.request.json() as Record<string, unknown>;
      const fullName = safeText(body.fullName, 120);
      const registrationNumber = safeText(body.registrationNumber, 20);
      const academicYear = Number(body.academicYear);
      const groupId = safeText(body.groupId, 50);
      if (fullName.length < 3 || !/^\d{3,20}$/.test(registrationNumber) || ![1,2,3,4,5].includes(academicYear) || !/^[0-9a-f-]{36}$/i.test(groupId)) {
        return json({ error: 'راجع البيانات المدخلة وحاول مرة أخرى.' }, 400);
      }
      const response = await supabase(context, '/rest/v1/rpc/register_student', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ p_full_name: fullName, p_registration_number: registrationNumber, p_academic_year: academicYear, p_group_id: groupId }),
      });
      const result = await response.json() as { message?: string; group_number?: number; academic_year?: number };
      if (!response.ok) {
        const errors: Record<string, string> = {
          REGISTRATION_EXISTS: 'رقم التسجيل ده سجّل بالفعل في مجموعة قبل كده.',
          GROUP_FULL: 'للأسف آخر مكان في الجروب اتحجز حالًا. اختر جروبًا آخر.',
          GROUP_CLOSED: 'التسجيل في الجروب ده اتقفل.',
          GROUP_NOT_FOUND: 'الجروب غير موجود أو لا يتبع السنة المختارة.',
        };
        return json({ error: errors[result.message || ''] || 'تعذر تأكيد التسجيل. حاول مرة أخرى.' }, response.status === 409 ? 409 : 400);
      }
      const cacheKey = new Request(new URL('/api/groups', context.request.url).toString(), { method: 'GET' });
      context.waitUntil(caches.default.delete(cacheKey));
      return json({ registration: { groupNumber: result.group_number, academicYear: result.academic_year } }, 201);
    }

    if (method === 'POST' && path === '/admin/login') {
      const body = await context.request.json() as Record<string, unknown>;
      const email = safeText(body.email, 200);
      const password = typeof body.password === 'string' ? body.password : '';
      const auth = await fetch(`${context.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: context.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!auth.ok) return json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, 401);
      const session = await auth.json() as { access_token: string; refresh_token: string; user: { id: string } };
      const adminCheck = await supabase(context, `/rest/v1/admins?user_id=eq.${encodeURIComponent(session.user.id)}&select=user_id&limit=1`);
      const admins = adminCheck.ok ? await adminCheck.json() as Array<unknown> : [];
      if (!admins.length) return json({ error: 'هذا الحساب لا يملك صلاحية الإدارة.' }, 403);
      return json({ accessToken: session.access_token, refreshToken: session.refresh_token });
    }

    if (method === 'GET' && path === '/admin/dashboard') {
      if (!await requireAdmin(context)) return json({ error: 'انتهت الجلسة، سجل دخولك مرة أخرى.' }, 401);
      const [groupsResponse, registrationsResponse] = await Promise.all([
        supabase(context, '/rest/v1/group_availability?select=*&order=academic_year.asc,group_number.asc'),
        supabase(context, '/rest/v1/registration_details?select=*&order=created_at.desc&limit=2000'),
      ]);
      if (!groupsResponse.ok || !registrationsResponse.ok) throw new Error('SUPABASE_DASHBOARD');
      const groups = await groupsResponse.json() as Array<Record<string, unknown>>;
      let registrations = await registrationsResponse.json() as Array<{ full_name: string; registration_number: string; academic_year: number }>;
      const search = safeText(url.searchParams.get('search'), 80).toLocaleLowerCase('ar');
      const year = Number(url.searchParams.get('year'));
      if (search) registrations = registrations.filter((item) => item.full_name.toLocaleLowerCase('ar').includes(search) || item.registration_number.includes(search));
      if ([1,2,3,4,5].includes(year)) registrations = registrations.filter((item) => item.academic_year === year);
      const totalRegistrations = groups.reduce((total, group) => total + Number(group.registered_count || 0), 0);
      return json({ groups, registrations, totalRegistrations });
    }

    return json({ error: 'المسار غير موجود.' }, 404);
  } catch (error) {
    console.error('API error', error instanceof Error ? error.message : error);
    return json({ error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' }, 500);
  }
};
