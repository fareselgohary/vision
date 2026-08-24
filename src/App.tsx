import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, GraduationCap, LockKeyhole, LogOut, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from './api';
import type { DashboardData, Group } from './types';

const yearNames: Record<number, string> = { 1: 'السنة الأولى', 2: 'السنة الثانية', 3: 'السنة الثالثة', 4: 'السنة الرابعة', 5: 'السنة الخامسة' };

function Brand({ admin = false }: { admin?: boolean }) {
  return <a className="brand" href="/" aria-label="The Vision - الرئيسية">
    <span className="brand-mark">V</span>
    <span><b>THE VISION</b><em>{admin ? 'إدارة التسجيل' : 'اتحاد طلاب طب الأسنان'}</em></span>
  </a>;
}

function PublicHeader() {
  return <header className="site-header"><div className="header-inner"><Brand /><a className="admin-link" href="/admin"><LockKeyhole size={17} /> دخول الإدارة</a></div></header>;
}

function RegistrationPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [groupId, setGroupId] = useState('');
  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ groupNumber: number; academicYear: number } | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setGroups((await api.getGroups()).groups); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل المجموعات.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const yearGroups = useMemo(() => groups.filter((g) => g.academic_year === year), [groups, year]);
  const selectedGroup = groups.find((g) => g.id === groupId);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!year || !groupId || fullName.trim().length < 3 || !/^\d{3,20}$/.test(registrationNumber.trim())) {
      setError('راجع الاسم ورقم التسجيل واختر السنة والجروب.'); return;
    }
    setSubmitting(true);
    try {
      const result = await api.register({ fullName: fullName.trim(), registrationNumber: registrationNumber.trim(), academicYear: year, groupId });
      setSuccess(result.registration);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تأكيد التسجيل.'); void load(); }
    finally { setSubmitting(false); }
  }

  if (success) return <><PublicHeader /><main className="success-page"><div className="success-icon"><Check size={34} /></div><h1>تم حجز مكانك بنجاح</h1><p>{yearNames[success.academicYear]} · المجموعة {success.groupNumber}</p><div className="success-note"><ShieldCheck size={20} /><span>رقم تسجيلك محفوظ، ولا تحتاج إلى إرسال الطلب مرة أخرى.</span></div><button className="secondary-button" onClick={() => { setSuccess(null); setYear(null); setGroupId(''); setFullName(''); setRegistrationNumber(''); void load(); }}>العودة للرئيسية</button></main></>;

  return <><PublicHeader /><main className="registration-layout">
    <section className="intro-panel"><div className="intro-content"><span className="issue-number">2026 / 2027</span><h1>اختيار مجموعات<br />التدريب العملي</h1><p>اختر مجموعتك قبل اكتمال الأماكن. يتم تثبيت اختيارك فور تأكيد التسجيل.</p></div><div className="intro-footer"><span>THE VISION</span><span>Students' Union</span></div></section>
    <section className="form-panel"><div className="form-heading"><span className="step-count">01</span><div><h2>بيانات التسجيل</h2><p>كل رقم تسجيل يمكنه الحجز في مجموعة واحدة فقط.</p></div></div>
      {error && <div className="alert" role="alert">{error}<button onClick={() => setError('')} aria-label="إغلاق">×</button></div>}
      <form onSubmit={submit}>
        <fieldset><legend>اختر السنة الدراسية</legend><div className="year-grid">
          {[1,2,3,4,5].map((item) => { const available = groups.some((g) => g.academic_year === item && g.is_open && g.remaining > 0); return <button type="button" key={item} aria-pressed={year === item} className={`year-option ${year === item ? 'selected' : ''}`} disabled={!available || loading} onClick={() => { setYear(item); setGroupId(''); }}><span>{item}</span><b>{yearNames[item].replace('السنة ', '')}</b>{!loading && !available && <em>غير متاحة</em>}</button>; })}
        </div></fieldset>

        {year && <fieldset className="groups-field"><div className="legend-row"><legend>اختر المجموعة</legend><span>الأماكن المتاحة الآن</span></div><div className="group-grid">
          {yearGroups.map((group) => <button type="button" key={group.id} aria-pressed={groupId === group.id} className={`group-option ${groupId === group.id ? 'selected' : ''}`} disabled={!group.is_open || group.remaining === 0} onClick={() => setGroupId(group.id)}><span className="group-name">مجموعة {group.group_number}</span><strong>{group.remaining}</strong><span className="seat-label">مكان متبقي</span><span className="capacity-line"><i style={{ width: `${Math.min(100, group.registered_count / group.max_capacity * 100)}%` }} /></span></button>)}
        </div>{yearGroups.length === 0 && <p className="empty-message">التسجيل لهذه السنة لم يُفتح بعد.</p>}</fieldset>}

        <div className="text-fields"><label><span>الاسم بالكامل</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="كما هو مسجل بالكلية" autoComplete="name" required minLength={3} /></label><label><span>رقم التسجيل</span><input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.replace(/\D/g, ''))} placeholder="مثال: 20231234" inputMode="numeric" autoComplete="off" required pattern="\d{3,20}" /></label></div>
        <div className="submit-row"><div className="selection-summary">{selectedGroup ? <><Check size={18} /><span>{yearNames[selectedGroup.academic_year]}، المجموعة {selectedGroup.group_number}</span></> : <span>اختر السنة والجروب لإكمال التسجيل</span>}</div><button className="primary-button" disabled={submitting || !selectedGroup}>{submitting ? <><RefreshCw className="spin" size={18} /> جاري التأكيد...</> : <>تأكيد الاختيار <ArrowLeft size={19} /></>}</button></div>
      </form>
    </section>
  </main><footer className="site-footer"><span>© 2026 The Vision Students' Union</span><span>كلية طب الأسنان</span></footer></>;
}

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setLoading(true); setError(''); try { const result = await api.login(email, password); localStorage.setItem('vision-admin-token', result.accessToken); onLogin(result.accessToken); } catch (err) { setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.'); } finally { setLoading(false); } }
  return <main className="login-page"><div className="login-header"><Brand admin /><a href="/">العودة للتسجيل <ChevronLeft size={17} /></a></div><div className="login-card"><LockKeyhole size={26} /><h1>دخول الإدارة</h1><p>هذه الصفحة مخصصة لمسؤولي اتحاد الطلاب.</p>{error && <div className="alert" role="alert">{error}</div>}<form onSubmit={submit}><label><span>البريد الإلكتروني</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label><span>كلمة المرور</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label><button className="primary-button" disabled={loading}>{loading ? 'جاري الدخول...' : 'تسجيل الدخول'}</button></form></div></main>;
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [year, setYear] = useState(''); const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); setError(''); try { setData(await api.dashboard(token, search, year)); } catch (e) { const message = e instanceof Error ? e.message : 'تعذر تحميل البيانات.'; setError(message); if (message.includes('الجلسة')) onLogout(); } finally { setLoading(false); } }
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [search, year]);
  const totalSeats = data?.groups.reduce((sum, g) => sum + g.max_capacity, 0) || 0;
  return <div className="admin-shell"><aside><Brand admin /><nav><a className="active" href="#overview"><Users size={18} /> نظرة عامة</a></nav><button onClick={onLogout}><LogOut size={18} /> تسجيل الخروج</button></aside><main className="dashboard"><header><div><h1>إدارة المجموعات</h1><p>متابعة التسجيل والإشغال لحظة بلحظة</p></div><button className="secondary-button" onClick={() => void load()}><RefreshCw size={17} /> تحديث</button></header>{error && <div className="alert" role="alert">{error}</div>}
    <section className="summary-strip"><div><span>إجمالي المسجلين</span><strong>{data?.totalRegistrations ?? '—'}</strong></div><div><span>إجمالي الأماكن</span><strong>{totalSeats || '—'}</strong></div><div><span>المجموعات المكتملة</span><strong>{data?.groups.filter(g => g.remaining === 0).length ?? '—'}</strong></div><div><span>نسبة الإشغال</span><strong>{totalSeats ? Math.round((data?.totalRegistrations || 0) / totalSeats * 100) : 0}%</strong></div></section>
    <section className="occupancy"><div className="section-title"><h2>حالة المجموعات</h2><span>{data?.groups.length || 0} مجموعة</span></div><div className="occupancy-list">{data?.groups.map(g => <div className="occupancy-row" key={g.id}><div><b>{yearNames[g.academic_year]}</b><span>المجموعة {g.group_number}</span></div><div className="occupancy-bar"><i style={{ width: `${g.registered_count/g.max_capacity*100}%` }} /></div><strong>{g.registered_count} / {g.max_capacity}</strong><span className={g.registered_count >= g.min_capacity ? 'good' : 'needs'}>{g.registered_count >= g.min_capacity ? 'ضمن المطلوب' : `ينقص ${g.min_capacity - g.registered_count}`}</span></div>)}</div></section>
    <section className="students-section"><div className="section-title"><h2>الطلاب المسجلون</h2><span>{data?.registrations.length || 0} نتيجة</span></div><div className="table-tools"><label><Search size={18} /><input placeholder="ابحث بالاسم أو رقم التسجيل" value={search} onChange={e => setSearch(e.target.value)} /></label><select value={year} onChange={e => setYear(e.target.value)}><option value="">كل السنوات</option>{[1,2,3,4,5].map(y => <option value={y} key={y}>{yearNames[y]}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>الطالب</th><th>رقم التسجيل</th><th>السنة</th><th>المجموعة</th><th>وقت التسجيل</th></tr></thead><tbody>{data?.registrations.map(r => <tr key={r.id}><td>{r.full_name}</td><td dir="ltr">{r.registration_number}</td><td>{yearNames[r.academic_year]}</td><td>مجموعة {r.group_number}</td><td>{new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(r.created_at))}</td></tr>)}</tbody></table>{!loading && !data?.registrations.length && <p className="empty-message">لا توجد نتائج مطابقة.</p>}{loading && <p className="empty-message">جاري تحميل البيانات...</p>}</div></section>
  </main></div>;
}

export function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  const [token, setToken] = useState(() => localStorage.getItem('vision-admin-token') || '');
  if (!isAdmin) return <RegistrationPage />;
  const logout = () => { localStorage.removeItem('vision-admin-token'); setToken(''); };
  return token ? <AdminDashboard token={token} onLogout={logout} /> : <AdminLogin onLogin={setToken} />;
}
