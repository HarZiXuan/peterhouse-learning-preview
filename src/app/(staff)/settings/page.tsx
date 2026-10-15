import Link from "next/link";
import { getSchool } from "@/lib/school";
import { getReportPeriod } from "@/lib/workspace";
import { saveSettingsAction } from "../actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const school = getSchool();
  const period = getReportPeriod();
  return (
    <main className="board board-narrow">
      <p className="crumbs">
        <Link href="/">← All children</Link>
      </p>
      <h1>Settings</h1>
      <div className="rule" />
      {saved && <p className="notice-ok" style={{ marginBottom: 16 }}>Saved.</p>}
      <form action={saveSettingsAction} className="stack-lg">
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
                <option>June</option>
                <option>December</option>
              </select>
            </label>
            <label className="field">
              <span>Year</span>
              <input className="input" name="year" type="number" defaultValue={period.year} style={{ width: 110 }} />
            </label>
          </div>
        </section>
        <button className="btn btn-primary">Save settings</button>
      </form>
    </main>
  );
}
