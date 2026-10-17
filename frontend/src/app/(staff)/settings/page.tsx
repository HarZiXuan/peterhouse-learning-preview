import Link from "next/link";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { saveSettingsAction, startNextSemesterAction } from "../actions";
import { StartSemester } from "./StartSemester";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const { school, period, user } = await apiGet<WorkspaceInfo>("/workspace");
  const admin = user.role === "admin";
  return (
    <main className="board board-narrow">
      <p className="crumbs">
        <Link href="/">← All children</Link>
      </p>
      <h1>Settings</h1>
      <div className="rule" />
      {saved && <p className="notice-ok" style={{ marginBottom: 16 }}>Saved.</p>}
      {error && <p className="error" style={{ marginBottom: 16 }}>{error === "1" ? "Those settings could not be saved." : error}</p>}
      {!admin && <p className="notice-gold" style={{ marginBottom: 16 }}>Only an administrator can change these. Ask them if something printed on the reports needs updating.</p>}
      <form action={saveSettingsAction} className="stack-lg">
        <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0 }}>
          <section className="stack panel">
            <h2>Printed on every report</h2>
            <label className="field">
              <span>School name</span>
              <input className="input" name="school" defaultValue={school.name} />
            </label>
            <label className="field">
              <span>Teacher name(s)</span>
              <input className="input" name="teachers" defaultValue={school.teachers} placeholder="e.g. Ms Lim, Ms Tan" />
            </label>
            <label className="field">
              <span>Class name</span>
              <input className="input" name="className" defaultValue={school.className} placeholder="e.g. K1 Sunflower" />
            </label>
            <div className="row">
              <label className="field">
                <span>Reports for</span>
                <select className="input" name="season" defaultValue={period.season}>
                  <option value="June">Semester 1 (June)</option>
                  <option value="December">Semester 2 (December)</option>
                </select>
              </label>
              <label className="field">
                <span>Year</span>
                <input className="input" name="year" type="number" defaultValue={period.year} style={{ width: 110 }} />
              </label>
            </div>
          </section>
        </fieldset>
        {admin && <button className="btn btn-primary">Save settings</button>}
      </form>
      {admin && (
        <section className="stack panel" style={{ marginTop: 24 }}>
          <h2>Start the next semester</h2>
          <p className="small muted">
            Closes {period.season === "June" ? "Semester 1" : "Semester 2"} {period.year} and opens {period.season === "June" ? `Semester 2 ${period.year}` : `Semester 1 ${period.year + 1}`}. Every child keeps all of this semester’s ratings, comments and report. The new report shows them beside the new ratings, so progress is visible.
          </p>
          <StartSemester action={startNextSemesterAction} />
        </section>
      )}
      {admin && (
        <p className="small muted" style={{ marginTop: 24 }}>
          <Link href="/settings/people">Manage people and sign-ins</Link> · <Link href="/settings/activity">Activity log</Link>
        </p>
      )}
    </main>
  );
}
