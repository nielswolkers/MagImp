import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type GradeRow = { course: string; title: string; grade: string; weight: string };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Magister Grades" },
      { name: "description", content: "Log in with Magister and see all your grades in one table." },
      { property: "og:title", content: "Magister Grades" },
      { property: "og:description", content: "Log in with Magister and see all your grades in one table." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [rows, setRows] = useState<GradeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Magister Grades</h1>
      {!rows && (
        <div className="mt-8">
          <button
            onClick={login}
            disabled={loading}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Retrieving grades…" : "Login with Magister"}
          </button>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {rows && (
        <div className="mt-8 overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Course</th>
                <th className="px-4 py-2">Test title</th>
                <th className="px-4 py-2">Grade</th>
                <th className="px-4 py-2">Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No grades found.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">{r.course}</td>
                  <td className="px-4 py-2">{r.title}</td>
                  <td className="px-4 py-2 font-medium">{r.grade}</td>
                  <td className="px-4 py-2">{r.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
