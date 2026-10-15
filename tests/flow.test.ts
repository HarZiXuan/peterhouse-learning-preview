// The whole teacher journey: add a child, answer the questions, create the report.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AreaAnswer, Draft } from "@/lib/types";

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lr-flow-"));
  process.env.DATA_DIR = dir;
  process.env.DB_FILE = path.join(dir, "t.db");
});
afterAll(async () => {
  (await import("@/lib/db")).closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("teacher journey", () => {
  it("goes from a new child to a written report", async () => {
    const W = await import("@/lib/workspace");
    const R = await import("@/lib/reviews");
    const id = W.addChild("Mia", "she", "");
    expect(W.listChildren()).toMatchObject([{ name: "Mia", answered: 0, hasReport: false }]);

    const user = W.workspace().user;
    const r0 = R.getReviewRow(id)!;
    const rubric = R.reviewRubric(r0);
    expect(R.getReviewRow(id)!.status).toBe("draft");

    // Writing before answering is refused.
    expect((await R.writeDraft(user, id)).ok).toBe(false);

    for (const a of rubric.areas) {
      const ans: AreaAnswer = { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level: 4, touched: true }])), moments: [], note: "", visited: true };
      R.saveArea(user, id, a.key, ans, null, true);
    }
    expect(R.getReviewRow(id)!.status).toBe("ready");
    expect(W.listChildren()[0].answered).toBe(W.listChildren()[0].total);

    const out = await R.writeDraft(user, id);
    expect(out.ok).toBe(true);
    const draft = JSON.parse(R.getReviewRow(id)!.draft!) as Draft;
    expect(draft.paragraphs.length).toBe(rubric.areas.length + 2);
    expect(draft.paragraphs[0].text).toContain("Mia");
    expect(R.reportDataFor(R.getReviewRow(id)!).data.childName).toBe("Mia");
  });
});
