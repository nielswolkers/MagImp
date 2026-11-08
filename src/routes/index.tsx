import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownUp, BookOpen, GraduationCap, LayoutDashboard, RefreshCw,
  Search, Sparkles, TrendingUp, CalendarDays, CheckCircle2, Clock3, UserX,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type GradeRow = { course: string; title: string; grade: string; weight: string };
type CourseAverage = { course: string; average: string };
type Attendance = {
  total_lessons: number; absent: number; sick: number; unauthorized: number;
  late: number; excused: number; present: number; percentage: number;
};
type SchoolYear = {
  id: number; label: string; begin: string; end: string;
  grades: GradeRow[]; course_averages: CourseAverage[]; attendance: Attendance;
};

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "MagImp" },
    { name: "description", content: "Your grades, clearly organised." },
  ] }),
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
  const [search, setSearch] = useState("");
  const [sortHigh, setSortHigh] = useState(true);

  async function login() {
    setLoading(true);
    setError(null);
    try {
      const { invoke, isTauri } = await import("@tauri-apps/api/core");
      if (!isTauri()) throw new Error("Open this in the MagImp desktop app to log in.");
      const imported = await invoke<SchoolYear[]>("magister_login_and_fetch");
      setYears(imported);
      setSelectedYear(imported[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const year = years?.find((item) => item.id === selectedYear) ?? years?.[0] ?? null;
  const rows = year?.grades ?? [];
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => !query || [row.course, row.title, row.grade].some((v) => v.toLowerCase().includes(query)))
      .sort((a, b) => {
        const courseOrder = a.course.localeCompare(b.course);
        if (courseOrder !== 0) return courseOrder;
        const av = numericGrade(a.grade), bv = numericGrade(b.grade);
        if (av === null && bv === null) return a.title.localeCompare(b.title);
        if (av === null) return 1;
        if (bv === null) return -1;
        return sortHigh ? bv - av : av - bv;
      });
  }, [rows, search, sortHigh]);

  const grouped = useMemo(() => {
    const groups = new Map<string, GradeRow[]>();
    for (const row of filteredRows) {
      const key = row.course || "Overig";
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  const chartData = useMemo(() => (year?.course_averages ?? [])
    .map((item) => ({ course: item.course, average: numericGrade(item.average), shown: item.average }))
    .filter((item) => item.average !== null)
    .sort((a, b) => a.course.localeCompare(b.course)), [year]);

  if (!years) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6 py-12 text-[#172033]">
        <div className="w-full max-w-lg rounded-3xl border border-[#e8ebf2] bg-white p-10 shadow-[0_24px_80px_-36px_rgba(31,48,83,0.25)]">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9efff] text-[#3159c9]"><GraduationCap size={28} /></div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#5570b8]">Your academic overview</p>
          <h1 className="text-4xl font-semibold tracking-tight">MagImp</h1>
          <p className="mt-4 max-w-sm text-[15px] leading-7 text-[#6d7689]">Import every school year, every grade and your attendance directly from Magister.</p>
          <button onClick={login} disabled={loading} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3159c9] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#2549b2] disabled:opacity-60">
            <GraduationCap size={18} /> {loading ? "Importing all school years…" : "Continue with Magister"}
          </button>
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <p className="mt-6 text-center text-xs text-[#9aa2b2]">Secure sign-in · No grade database</p>
        </div>
      </main>
    );
  }

  const attendance = year?.attendance;
  const courseCount = new Set(rows.map((r) => r.course).filter(Boolean)).size;
  const strongGrades = rows.filter((r) => (numericGrade(r.grade) ?? 0) >= 7).length;

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#172033]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[232px] flex-col border-r border-[#e9ecf2] bg-white px-5 py-7 md:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3159c9] text-white"><GraduationCap size={22} /></div>
          <div><p className="text-[15px] font-bold tracking-tight">MagImp</p><p className="text-[11px] text-[#929bad]">STUDENT DASHBOARD</p></div>
        </div>
        <p className="mb-3 mt-12 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a0a8b7]">Workspace</p>
        <div className="flex items-center gap-3 rounded-xl bg-[#edf2ff] px-3 py-3 text-sm font-semibold text-[#3159c9]"><LayoutDashboard size={17} /> Overview</div>
        <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#7d8799]"><BookOpen size={17} /> All grades</div>
        <div className="mt-auto rounded-2xl bg-[#f6f8fc] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#52617c]"><Sparkles size={14} /> Stay on track</div>
          <p className="text-xs leading-5 text-[#8791a3]">All school years, grades and attendance in one place.</p>
        </div>
      </aside>

      <main className="min-h-screen md:ml-[232px]">
        <header className="flex min-h-[76px] items-center justify-between gap-3 border-b border-[#e9ecf2] bg-white/90 px-6 py-4 md:px-10">
          <div><p className="text-xs font-medium text-[#929bad]">Workspace / Overview</p><p className="mt-1 text-sm font-semibold">My academic dashboard</p></div>
          <button onClick={login} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#e5e9f1] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#52617c] hover:bg-[#f7f8fb] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Importing…" : "Refresh all data"}
          </button>
        </header>

        <div className="mx-auto max-w-[1320px] px-6 py-9 md:px-10 md:py-11">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5570b8]">Your overview</p><h1 className="text-3xl font-semibold tracking-tight md:text-[34px]">Academic overview</h1><p className="mt-2 text-sm text-[#8992a3]">Grades and attendance from your Magister account.</p></div>
            <div className="rounded-full border border-[#e5e9f1] bg-white px-3.5 py-2 text-xs font-medium text-[#778297]"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Connected to Magister</div>
          </div>

          <section className="mb-7 rounded-2xl border border-[#e8ebf2] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(31,48,83,0.2)] md:p-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8992a3]"><CalendarDays size={15} /> School year</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Switch school year">
              {years.map((item) => (
                <button key={item.id} onClick={() => { setSelectedYear(item.id); setSearch(""); }}
                  aria-pressed={item.id === year?.id}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${item.id === year?.id ? "border-[#3159c9] bg-[#3159c9] text-white shadow-md shadow-blue-900/10" : "border-[#e8ebf2] bg-white text-[#68748a] hover:bg-[#f7f8fb]"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Official course averages" value={String(chartData.length)} detail="Provided by Magister" icon={<TrendingUp size={19} />} />
            <StatCard label="Subjects" value={String(courseCount)} detail="With imported grades" icon={<BookOpen size={19} />} />
            <StatCard label="Grades 7 or higher" value={String(strongGrades)} detail={rows.length ? `${Math.round(strongGrades / rows.length * 100)}% of individual grades` : "No grades"} icon={<Sparkles size={19} />} />
          </section>

          <section className="mt-8 rounded-2xl border border-[#e8ebf2] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(31,48,83,0.2)] md:p-7">
            <div className="mb-5"><h2 className="text-base font-semibold">Average per course</h2><p className="mt-1 text-xs text-[#929bad]">Official averages supplied by Magister · {chartData.length} courses</p></div>
            {chartData.length ? (
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 12, left: -16, bottom: 65 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                    <XAxis dataKey="course" interval={0} angle={-35} textAnchor="end" height={85} tick={{ fontSize: 11, fill: "#788397" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#929bad" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [String(value).replace(".", ","), "Magister average"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8ebf2", fontSize: 12 }} />
                    <Bar dataKey="average" name="Magister average" fill="#4565c1" radius={[6, 6, 0, 0]} maxBarSize={54} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="rounded-xl bg-[#f8f9fc] px-4 py-8 text-center text-sm text-[#929bad]">Magister did not return official course-average rows for this school year.</p>}
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-[#e8ebf2] bg-white shadow-[0_8px_30px_-24px_rgba(31,48,83,0.2)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f5] px-5 py-5 md:px-7">
              <div><h2 className="text-base font-semibold">Grades by course</h2><p className="mt-1 text-xs text-[#929bad]">{rows.length} imported grades · {year?.label}</p></div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a8b7]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subjects or tests…" className="h-10 w-full rounded-xl border border-[#e8ebf2] bg-[#fafbfc] pl-9 pr-3 text-xs outline-none focus:border-[#9aade8] focus:ring-2 focus:ring-[#3159c9]/10" /></label>
                <button onClick={() => setSortHigh((v) => !v)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e8ebf2] px-3 text-xs font-semibold text-[#68748a] hover:bg-[#f8f9fc]"><ArrowDownUp size={14} /> {sortHigh ? "Highest first" : "Lowest first"}</button>
              </div>
            </div>
            <div className="divide-y divide-[#edf0f5]">
              {grouped.length === 0 && <p className="px-7 py-12 text-center text-sm text-[#929bad]">{search ? "No grades match your search." : "No grades found for this school year."}</p>}
              {grouped.map(([course, courseRows]) => (
                <div key={course}>
                  <div className="flex items-center justify-between gap-3 bg-[#fafbfc] px-5 py-3.5 md:px-7">
                    <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#39445a]">{course}</h3><span className="mt-0.5 block text-[11px] font-medium text-[#929bad]">{courseRows.length} cijfers</span></div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[#9aa3b2]">Magister-gem.</span>
                      {(() => { const average = year?.course_averages.find((item) => item.course === course)?.average; const value = average ? numericGrade(average) : null; return <span className={`inline-flex min-w-[44px] justify-center rounded-full border px-2.5 py-1.5 text-xs font-semibold tabular-nums ${value === null ? "border-[#e8ebf2] bg-white text-[#929bad]" : value >= 5.5 ? "border-[#dcebe1] bg-[#edf7f0] text-[#438363]" : "border-[#f1dfdc] bg-[#fff1ef] text-[#c45b49]"}`}>{average ?? "—"}</span>; })()}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left text-sm">
                      <thead className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa3b2]"><tr><th className="px-7 py-2.5">Test / assignment</th><th className="px-5 py-2.5">Grade</th><th className="px-7 py-2.5 text-right">Weight</th></tr></thead>
                      <tbody>{courseRows.map((row, index) => {
                        const value = numericGrade(row.grade);
                        return <tr key={`${course}-${row.title}-${index}`} className="border-t border-[#f0f2f6] hover:bg-[#fafbfe]">
                          <td className="max-w-[500px] px-7 py-3.5 text-[#788397]">{row.title || "Untitled assessment"}</td>
                          <td className="px-5 py-3.5"><span className={`inline-flex min-w-[48px] justify-center rounded-lg px-2.5 py-1.5 text-xs font-bold ${value === null ? "bg-[#f1f3f7] text-[#788397]" : value >= 7 ? "bg-[#e9f7ef] text-[#258451]" : value >= 5.5 ? "bg-[#fff5df] text-[#a87517]" : "bg-[#fff0ed] text-[#c45b49]"}`}>{row.grade || "—"}</span></td>
                          <td className="px-7 py-3.5 text-right text-xs font-medium text-[#788397]">{row.weight || "—"}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f5] bg-[#fcfcfd] px-5 py-3.5 text-[11px] text-[#9aa3b2] md:px-7"><span>Showing {filteredRows.length} of {rows.length} grades</span><span>Synced directly from Magister</span></div>
          </section>

          <section className="mt-8 rounded-2xl border border-[#e8ebf2] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(31,48,83,0.2)] md:p-7">
            <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5570b8]">Attendance overview</p><h2 className="mt-1 text-base font-semibold">Presence this school year</h2><p className="mt-1 text-xs text-[#929bad]">Based on Magister attendance registrations and lesson schedule.</p></div>
            {attendance && attendance.total_lessons > 0 ? <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-5xl font-semibold tracking-tight text-[#202b42] tabular-nums">{attendance.percentage}<span className="text-2xl text-[#8992a3]">%</span></p><p className="mt-2 text-sm text-[#788397]">Present out of 100</p></div>
                <div className="text-right text-xs text-[#929bad]">{attendance.present} of {attendance.total_lessons - attendance.excused} counted lessons attended</div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#f0f2f6]"><div className="h-full rounded-full bg-[#2fa66a] transition-all" style={{ width: `${attendance.percentage}%` }} /></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AttendanceStat icon={<CheckCircle2 size={17} />} label="Present" value={attendance.present} />
                <AttendanceStat icon={<UserX size={17} />} label="Absent" value={attendance.absent} />
                <AttendanceStat icon={<Clock3 size={17} />} label="Late" value={attendance.late} />
                <AttendanceStat icon={<CalendarDays size={17} />} label="Excused" value={attendance.excused} />
              </div>
              <p className="mt-4 text-xs text-[#929bad]">{attendance.sick} sick · {attendance.unauthorized} unauthorised absences · {attendance.total_lessons} scheduled lessons</p>
            </> : <p className="rounded-xl bg-[#f8f9fc] px-4 py-8 text-center text-sm text-[#929bad]">No attendance data was returned by Magister for this school year.</p>}
          </section>
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <p className="mt-6 text-center text-[11px] text-[#a4abba]">MagImp · Your results, at a glance</p>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#e8ebf2] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(31,48,83,0.2)] md:p-6"><div className="mb-5 flex items-center justify-between"><p className="text-xs font-semibold text-[#8992a3]">{label}</p><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf2ff] text-[#4565c1]">{icon}</div></div><p className="text-3xl font-semibold tracking-tight text-[#202b42]">{value}</p><p className="mt-2 text-xs text-[#a0a8b7]">{detail}</p></div>;
}
function AttendanceStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-xl bg-[#f8f9fc] p-4"><div className="flex items-center gap-2 text-xs font-medium text-[#8992a3]">{icon}{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums text-[#39445a]">{value}</p></div>;
}
