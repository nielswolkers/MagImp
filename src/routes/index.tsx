import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

type GradeRow = { course: string; title: string; grade: string; weight: string };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Magister Grades" },
      { name: "description", content: "Your grades, clearly organised." },
    ],
  }),
  component: Index,
});

function numericGrade(value: string): number | null {
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) && number <= 10 ? number : null;
}

function Index() {
  const [rows, setRows] = useState<GradeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortHigh, setSortHigh] = useState(true);

  async function login() {
    setLoading(true);
    setError(null);
    try {
      const { invoke, isTauri } = await import("@tauri-apps/api/core");
      if (!isTauri()) throw new Error("Open this in the Magister Grades desktop app to log in.");
      setRows(await invoke<GradeRow[]>("magister_login_and_fetch"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => !query || [row.course, row.title, row.grade].some((v) => v.toLowerCase().includes(query)))
      .sort((a, b) => {
        const av = numericGrade(a.grade);
        const bv = numericGrade(b.grade);
        if (av === null && bv === null) return a.course.localeCompare(b.course);
        if (av === null) return 1;
        if (bv === null) return -1;
        return sortHigh ? bv - av : av - bv;
      });
  }, [rows, search, sortHigh]);

  const average = useMemo(() => {
    if (!rows?.length) return null;
    const grades = rows.map((row) => numericGrade(row.grade)).filter((v): v is number => v !== null);
    return grades.length ? grades.reduce((sum, value) => sum + value, 0) / grades.length : null;
  }, [rows]);
  const courseCount = rows ? new Set(rows.map((row) => row.course).filter(Boolean)).size : 0;
  const strongGrades = rows?.filter((row) => (numericGrade(row.grade) ?? 0) >= 7).length ?? 0;

  if (!rows) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6 py-12 text-[#172033]">
        <div className="w-full max-w-lg rounded-3xl border border-[#e8ebf2] bg-white p-10 shadow-[0_24px_80px_-36px_rgba(31,48,83,0.25)]">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9efff] text-[#3159c9]">
            <GraduationCap size={28} strokeWidth={1.8} />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#5570b8]">Your academic overview</p>
          <h1 className="text-4xl font-semibold tracking-tight text-[#172033]">Magister Grades</h1>
          <p className="mt-4 max-w-sm text-[15px] leading-7 text-[#6d7689]">
            All your results in one clear view. Connect to Magister to see your grades, subjects and progress.
          </p>
          <button
            onClick={login}
            disabled={loading}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3159c9] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#2549b2] disabled:cursor-wait disabled:opacity-60"
          >
            <GraduationCap size={18} />
            {loading ? "Connecting to Magister…" : "Continue with Magister"}
          </button>
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <p className="mt-6 text-center text-xs text-[#9aa2b2]">Secure sign-in · Your grades stay on this device</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#172033]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[232px] flex-col border-r border-[#e9ecf2] bg-white px-5 py-7 md:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3159c9] text-white">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight">Magister Grades</p>
            <p className="text-[11px] text-[#929bad]">STUDENT DASHBOARD</p>
          </div>
        </div>
        <p className="mb-3 mt-12 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a0a8b7]">Workspace</p>
        <div className="flex items-center gap-3 rounded-xl bg-[#edf2ff] px-3 py-3 text-sm font-semibold text-[#3159c9]">
          <LayoutDashboard size={17} /> Overview
        </div>
        <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#7d8799]">
          <BookOpen size={17} /> All grades
        </div>
        <div className="mt-auto rounded-2xl bg-[#f6f8fc] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#52617c]"><Sparkles size={14} /> Stay on track</div>
          <p className="text-xs leading-5 text-[#8791a3]">Small steps add up. Keep an eye on your progress throughout the year.</p>
        </div>
      </aside>

      <main className="min-h-screen md:ml-[232px]">
        <header className="flex h-[76px] items-center justify-between border-b border-[#e9ecf2] bg-white/90 px-6 md:px-10">
          <div>
            <p className="text-xs font-medium text-[#929bad]">Workspace / Overview</p>
            <p className="mt-1 text-sm font-semibold">My academic dashboard</p>
          </div>
          <button onClick={login} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#e5e9f1] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#52617c] transition hover:bg-[#f7f8fb] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Syncing…" : "Refresh grades"}
          </button>
        </header>

        <div className="mx-auto max-w-[1320px] px-6 py-9 md:px-10 md:py-11">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5570b8]">Your overview</p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-[34px]">Good to see you.</h1>
              <p className="mt-2 text-sm text-[#8992a3]">Here’s how your grades are looking.</p>
            </div>
            <div className="rounded-full border border-[#e5e9f1] bg-white px-3.5 py-2 text-xs font-medium text-[#778297]">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Connected to Magister
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Grade average" value={average === null ? "—" : average.toFixed(1).replace(".", ",")} detail={average === null ? "No numeric grades available" : "Across all imported results"} icon={<TrendingUp size={19} />} />
            <StatCard label="Subjects" value={String(courseCount)} detail="With imported results" icon={<BookOpen size={19} />} />
            <StatCard label="Grades 7 or higher" value={String(strongGrades)} detail={rows.length ? `${Math.round((strongGrades / rows.length) * 100)}% of all results` : "No results yet"} icon={<Sparkles size={19} />} />
          </section>

          <section className="mt-9 overflow-hidden rounded-2xl border border-[#e8ebf2] bg-white shadow-[0_8px_30px_-24px_rgba(31,48,83,0.2)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f5] px-5 py-5 md:px-7">
              <div>
                <h2 className="text-base font-semibold">All grades</h2>
                <p className="mt-1 text-xs text-[#929bad]">{rows.length} imported results</p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a8b7]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subjects or tests…" className="h-10 w-full rounded-xl border border-[#e8ebf2] bg-[#fafbfc] pl-9 pr-3 text-xs outline-none transition placeholder:text-[#a0a8b7] focus:border-[#9aade8] focus:ring-2 focus:ring-[#3159c9]/10" />
                </label>
                <button onClick={() => setSortHigh((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e8ebf2] px-3 text-xs font-semibold text-[#68748a] hover:bg-[#f8f9fc]">
                  <ArrowDownUp size={14} /> {sortHigh ? "Highest first" : "Lowest first"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#fafbfc] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa3b2]">
                  <tr>
                    <th className="px-7 py-3.5">Subject</th>
                    <th className="px-5 py-3.5">Test / assignment</th>
                    <th className="px-5 py-3.5">Grade</th>
                    <th className="px-7 py-3.5 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={4} className="px-7 py-12 text-center text-sm text-[#929bad]">{search ? "No grades match your search." : "No grades found."}</td></tr>
                  )}
                  {filteredRows.map((row, index) => {
                    const value = numericGrade(row.grade);
                    return (
                      <tr key={`${row.course}-${row.title}-${index}`} className="border-t border-[#f0f2f6] transition hover:bg-[#fafbfe]">
                        <td className="px-7 py-4 font-semibold text-[#39445a]">{row.course || "—"}</td>
                        <td className="max-w-[420px] px-5 py-4 text-[#788397]">{row.title || "Untitled assessment"}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex min-w-[48px] justify-center rounded-lg px-2.5 py-1.5 text-xs font-bold ${value === null ? "bg-[#f1f3f7] text-[#788397]" : value >= 7 ? "bg-[#e9f7ef] text-[#258451]" : value >= 5.5 ? "bg-[#fff5df] text-[#a87517]" : "bg-[#fff0ed] text-[#c45b49]"}`}>{row.grade || "—"}</span>
                        </td>
                        <td className="px-7 py-4 text-right text-xs font-medium text-[#788397]">{row.weight || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f5] bg-[#fcfcfd] px-5 py-3.5 text-[11px] text-[#9aa3b2] md:px-7">
              <span>Showing {filteredRows.length} of {rows.length} results</span>
              <span>Synced directly from Magister</span>
            </div>
          </section>
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <p className="mt-6 text-center text-[11px] text-[#a4abba]">Magister Grades · Your results, at a glance</p>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e8ebf2] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(31,48,83,0.2)] md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-semibold text-[#8992a3]">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf2ff] text-[#4565c1]">{icon}</div>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-[#202b42]">{value}</p>
      <p className="mt-2 text-xs text-[#a0a8b7]">{detail}</p>
    </div>
  );
}
