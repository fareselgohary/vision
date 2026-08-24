# The Vision — Student Group Registration

منصة عربية لاختيار مجموعات التدريب العملي لطلاب كلية طب الأسنان. الواجهة مبنية بـ React وTypeScript، والـ API تعمل كـ Cloudflare Pages Functions (Workers runtime)، والبيانات والمصادقة على Supabase/PostgreSQL.

## الموجود حاليًا

- صفحة عامة لاختيار السنة والجروب مع عدد الأماكن المتبقية.
- السنوات الثانية: 8 مجموعات، سعة 24–25.
- السنوات الثالثة: 10 مجموعات، سعة 20–22.
- السنوات الرابعة: 10 مجموعات، سعة 18–20.
- الأولى والخامسة تظهران غير متاحتين حتى إضافة قواعدهما.
- منع رقم التسجيل المكرر بقيد `unique` داخل PostgreSQL.
- حجز ذري بقفل صف الجروب لمنع تجاوز السعة أثناء الضغط المتزامن.
- Supabase Auth لدخول الأدمن، مع جدول صلاحيات منفصل.
- Dashboard تعرض الإشغال، المجموعات التي تحتاج طلابًا، وقائمة قابلة للبحث والتصفية.
- البيانات الحساسة لا تصل للمتصفح؛ مفتاح `service_role` موجود في Cloudflare فقط.

## 1. إعداد Supabase

1. أنشئ مشروعًا جديدًا على Supabase.
2. افتح **SQL Editor** والصق محتوى [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) ثم شغّله مرة واحدة.
3. من **Authentication → Users → Add user** أنشئ حساب الأدمن بالبريد وكلمة المرور.
4. غيّر البريد داخل [`supabase/create-admin.sql`](supabase/create-admin.sql) ثم شغّل الملف في SQL Editor لإعطاء الحساب صلاحية الإدارة.
5. من **Project Settings → API** انسخ:
   - Project URL
   - `anon` public key
   - `service_role` secret key

لا تضع `service_role` في أي متغير يبدأ بـ `VITE_` ولا تشاركه مع أي شخص.

## 2. تجربة محلية كاملة

```bash
npm install
cp .env.example .dev.vars
```

ضع مفاتيح Supabase في `.dev.vars` ثم شغّل:

```bash
npm run dev:cloudflare
```

يفتح Wrangler رابطًا محليًا يعمل عليه React والـ API معًا. أمر `npm run dev` وحده مناسب لتطوير الواجهة، لكنه لا يشغّل Pages Functions.

## 3. النشر على Cloudflare Pages

1. ارفع المشروع إلى GitHub.
2. من Cloudflare اختر **Workers & Pages → Create → Pages → Connect to Git**.
3. إعدادات البناء:
   - Build command: `npm run build`
   - Build output: `dist`
4. أضف المتغيرات التالية من **Settings → Variables and Secrets**:
   - `SUPABASE_URL` كمتغير عادي.
   - `SUPABASE_ANON_KEY` كـ Secret.
   - `SUPABASE_SERVICE_ROLE_KEY` كـ Secret.
5. أعد النشر. رابط التسجيل هو جذر الموقع. استخدم رابط الإدارة الخاص الذي يحدده التطبيق بدل نشره للعامة.

## مسارات التشغيل والاختبار

- `GET /api` يعرض فهرسًا بكل مسارات الـ API المتاحة.
- `GET /api/health` فحص خفيف لحالة Cloudflare Function بدون قراءة قاعدة البيانات.
- `GET /api/groups` يختبر المسار الفعلي لقراءة المجموعات من Supabase.
استخدم `/api/health` لاختبار تحمل الـ Worker نفسه، أو `/api/groups` لاختبار المسار الكامل
بما فيه الكاش وSupabase. لا تستخدم `POST /api/register` في اختبار تحميل عشوائي لأنه يغيّر بيانات التسجيل.

## إضافة السنة الأولى أو الخامسة

مثال لإضافة 8 مجموعات للسنة الأولى بسعة 24–25:

```sql
insert into public.groups (academic_year, group_number, min_capacity, max_capacity)
select 1, n, 24, 25 from generate_series(1, 8) n
on conflict (academic_year, group_number) do update
set min_capacity = excluded.min_capacity, max_capacity = excluded.max_capacity;
```

غيّر السنة وعدد المجموعات والسعات حسب القرار النهائي.

## ملاحظات تشغيل مهمة

- الحد الأدنى ليس شرطًا يمكن فرضه وقت أول تسجيل؛ يظهر في لوحة الإدارة كهدف تشغيلي حتى يكتمل الجروب. الحد الأقصى مفروض داخل المعاملة ولا يمكن تجاوزه.
- قبل إرسال الرابط لكل الطلاب، فعّل Cloudflare Turnstile أو Rate Limiting على `POST /api/register` للحماية من السبام، واختبر التسجيل بـ 20–50 حسابًا تجريبيًا.
- خذ نسخة CSV أو Database backup قبل وبعد فترة التسجيل.
- المشروع مصمم للدفعة المذكورة (نحو 700 طالب). لو زاد الحجم بعشرات الآلاف، أضف pagination لقائمة الإدارة بدل تحميل أول 2000 سجل.
