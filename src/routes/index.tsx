import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Clock3, CheckSquare, UserRound, ChartNoAxesColumn, ChevronRight, RefreshCw, GraduationCap, CheckCircle2, UserX } from "lucide-react";

type GradeRow = { course: string; title: string; grade: string; weight: string };
type CourseAverage = { course: string; average: string };
type Attendance = { total_lessons: number; absent: number; sick: number; unauthorized: number; late: number; excused: number; present: number; percentage: number };
type SchoolYear = { id: number; label: string; begin: string; end: string; grades: GradeRow[]; course_averages: CourseAverage[]; attendance: Attendance };

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "MagImp" }, { name: "description", content: "Your Magister grades at a glance." }] }),
  component: Index,
});

function numericGrade(value: string): number | null {
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) && number <= 10 ? number : null;
}

function Index() {
  const [years, setYears] = useState<SchoolYear[] | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function login() {
    setLoading(true); setError(null);
    try {
      const { invoke, isTauri } = await import("@tauri-apps/api/core");
      if (!isTauri()) throw new Error("Open this in the MagImp desktop app to log in.");
      const imported = await invoke<SchoolYear[]>("magister_login_and_fetch");
      setYears(imported); setSelectedYear(imported[0]?.id ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  const year = years?.find((item) => item.id === selectedYear) ?? years?.[0] ?? null;
  const rows = year?.grades ?? [];
  const grouped = useMemo(() => {
    const groups = new Map<string, GradeRow[]>();
    for (const row of rows) { const key = row.course || "Overig"; groups.set(key, [...(groups.get(key) ?? []), row]); }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  const chartData = useMemo(() => (year?.course_averages ?? [])
    .map((item) => ({ course: item.course, average: numericGrade(item.average), shown: item.average }))
    .filter((item) => item.average !== null)
    .sort((a, b) => a.course.localeCompare(b.course)), [year]);

  if (!years) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-6 py-10 text-[#18231f]">
      <div className="w-full max-w-sm rounded-[28px] border border-[#e9eeea] bg-white p-8 shadow-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f2ed] text-[#65947c]"><GraduationCap size={24} /></div>
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-[#739783]">Your school overview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">MagImp</h1>
        <p className="mt-3 text-sm leading-6 text-[#78847d]">Import your grades and attendance directly from Magister.</p>
        <button onClick={login} disabled={loading} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#709b84] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#5f8c74] disabled:opacity-60">
          <GraduationCap size={17} /> {loading ? "Importing…" : "Continue with Magister"}
        </button>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <p className="mt-5 text-center text-[11px] text-[#a0aaa3]">Secure sign-in · No grade database</p>
      </div>
    </main>
  );

  const attendance = year?.attendance;
  return (
    <div className="min-h-screen bg-[#f7f8f7] pb-24 text-[#18231f]">
      <main className="mx-auto w-full max-w-[1440px] px-6 pb-12 pt-8 lg:px-10">
        <header className="mb-7 flex items-center justify-between">
          <div><p className="text-[30px] font-semibold tracking-[-.045em]">Cijfers</p><p className="mt-1 text-xs text-[#8b968f]">{year?.label ?? "Schooljaar"}</p></div>
          <button aria-label="Refresh grades" onClick={login} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8ede9] bg-white text-[#789383] shadow-[0_2px_8px_rgba(30,55,40,.04)] disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        </header>

        {years.length > 1 && <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {years.map((item) => <button key={item.id} onClick={() => { setSelectedYear(item.id); setExpanded(null); }} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition ${item.id === year?.id ? "bg-[#719b85] text-white" : "border border-[#e7ece8] bg-white text-[#7b8980]"}`}>{item.label}</button>)}
        </div>}

        <section className="rounded-[22px] border border-[#e9eeea] bg-white px-4 pb-3 pt-4 shadow-[0_3px_16px_rgba(32,57,42,.035)]">
          <h2 className="mb-1 text-sm font-medium text-[#35443b]">Overzicht per vak</h2>
          <p className="mb-1 text-[10px] text-[#a0aaa3]">Gemiddelde volgens Magister</p>
          {chartData.length ? <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 20, left: -10, bottom: 55 }}>
                <CartesianGrid strokeDasharray="2 3" vertical={false} stroke="#edf1ee" />
                <XAxis dataKey="course" interval={0} angle={-32} textAnchor="end" height={68} tick={{ fontSize: 11, fill: "#859188" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 8, fill: "#9aa59d" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [String(value).replace(".", ","), "Gemiddelde"]} contentStyle={{ borderRadius: 10, border: "1px solid #e8eee9", fontSize: 11 }} />
                <Bar dataKey="average" fill="#78a58d" radius={[5, 5, 0, 0]} maxBarSize={54} />
              </BarChart>
            </ResponsiveContainer>
          </div> : <p className="py-12 text-center text-xs text-[#9aa59d]">Geen officiële gemiddelden ontvangen van Magister.</p>}
        </section>

        <div className="mt-7 grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-[#35443b]">Per vak</h2><span className="text-[10px] text-[#a0aaa3]">{grouped.length} vakken</span></div>
          <div className="overflow-hidden rounded-[20px] border border-[#e9eeea] bg-white shadow-[0_3px_16px_rgba(32,57,42,.035)]">
            {grouped.length === 0 && <p className="px-5 py-9 text-center text-xs text-[#9aa59d]">Geen cijfers gevonden voor dit schooljaar.</p>}
            {grouped.map(([course, courseRows], index) => {
              const average = year?.course_averages.find((item) => item.course === course)?.average;
              const open = expanded === course;
              return <div key={course} className={index ? "border-t border-[#eef1ee]" : ""}>
                <button onClick={() => setExpanded(open ? null : course)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#fbfcfb]">
                  <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-[#35443b]">{course}</p><p className="mt-0.5 text-[10px] text-[#9aa59d]">{courseRows.length} cijfers</p></div>
                  <span className={`flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[11px] font-semibold tabular-nums ${average && numericGrade(average) !== null ? numericGrade(average)! >= 5.5 ? "border-[#dcebe1] bg-[#f0f7f2] text-[#65947c]" : "border-[#f0dedb] bg-[#fff4f2] text-[#c16b5c]" : "border-[#e8ede9] bg-white text-[#9aa59d]"}`}>{average ?? "—"}</span>
                  <ChevronRight size={15} className={`text-[#a3ada6] transition-transform ${open ? "rotate-90" : ""}`} />
                </button>
                {open && <div className="border-t border-[#f0f3f0] bg-[#fbfcfb] px-4 py-2">
                  {courseRows.map((row, i) => <div key={`${row.title}-${i}`} className="flex items-center gap-3 border-b border-[#eff2ef] py-2.5 last:border-0">
                    <div className="min-w-0 flex-1"><p className="truncate text-[11px] text-[#68766d]">{row.title || "Toets"}</p><p className="mt-0.5 text-[9px] text-[#a0aaa3]">Weging {row.weight || "—"}</p></div>
                    <span className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tabular-nums ${numericGrade(row.grade) === null ? "bg-[#f0f3f0] text-[#758178]" : numericGrade(row.grade)! >= 5.5 ? "bg-[#edf6f0] text-[#65947c]" : "bg-[#fff0ed] text-[#c16b5c]"}`}>{row.grade || "—"}</span>
                  </div>)}
                </div>}
              </div>;
            })}
          </div>
        </section>

        <section className="rounded-[20px] border border-[#e9eeea] bg-white p-5 shadow-[0_3px_16px_rgba(32,57,42,.035)]">
          <div className="mb-4"><h2 className="text-sm font-semibold text-[#35443b]">Aanwezigheid</h2><p className="mt-1 text-[10px] text-[#9aa59d]">Dit schooljaar</p></div>
          {attendance && attendance.total_lessons > 0 ? <>
            <div className="flex items-end justify-between"><div><p className="text-[32px] font-semibold tracking-tight text-[#5f9277] tabular-nums">{attendance.percentage}<span className="text-base">%</span></p><p className="text-[10px] text-[#9aa59d]">Aanwezig</p></div><p className="text-[10px] text-[#9aa59d]">{attendance.present} van {attendance.total_lessons - attendance.excused} lessen</p></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#78a58d]" style={{ width: `${attendance.percentage}%` }} /></div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <MiniStat icon={<CheckCircle2 size={13}/>} label="Aanwezig" value={attendance.present}/>
              <MiniStat icon={<UserX size={13}/>} label="Afwezig" value={attendance.absent}/>
              <MiniStat icon={<Clock3 size={13}/>} label="Te laat" value={attendance.late}/>
              <MiniStat icon={<CalendarDays size={13}/>} label="Geoorloofd" value={attendance.excused}/>
            </div>
          </> : <p className="py-5 text-center text-xs text-[#9aa59d]">Geen aanwezigheidsgegevens ontvangen.</p>}
        </section>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      </main>

      <nav className="mt-10 border-t border-[#e9eeea] bg-white px-6 py-3">
        <div className="mx-auto grid max-w-[1440px] grid-cols-5">
          <NavItem icon={<CalendarDays size={17}/>} label="Agenda"/>
          <NavItem icon={<Clock3 size={17}/>} label="Studie"/>
          <NavItem icon={<ChartNoAxesColumn size={18}/>} label="Cijfers" active/>
          <NavItem icon={<CheckSquare size={17}/>} label="Taken"/>
          <NavItem icon={<UserRound size={17}/>} label="Account"/>
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return <div className={`flex flex-col items-center gap-1 py-1 text-[9px] font-medium ${active ? "text-[#67947b]" : "text-[#a0aaa3]"}`}>{icon}<span>{label}</span></div>;
}
function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-xl bg-[#f7f9f7] px-1.5 py-2 text-center"><div className="flex items-center justify-center gap-1 text-[9px] text-[#8d9a90]">{icon}{label}</div><p className="mt-1 text-sm font-semibold tabular-nums text-[#45564b]">{value}</p></div>;
}
