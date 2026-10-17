// Privacy: the real draft pipeline runs against a stubbed AI service, and the test fails if anything
// identifying would leave the school: the child's name, a sibling, a teacher, a phone number or an email.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AreaAnswer, SessionUser } from "@peterhouse/shared";
import { setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
const sent: string[] = [];

beforeAll(async () => {
  t = await setupTestDb({ GEMINI_API_KEY: "test-key", AI_PROVIDER: "gemini" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(init.body);
      const reply = {
        opening: "[Child] has had a wonderful term.",
        areas: Object.fromEntries(JSON.parse(init.body).contents[0].parts[0].text.match(/\w+ = /g)?.map((m: string) => [m.replace(" = ", ""), "[Child] is growing."]) ?? []),
        closing: "[Child] will keep shining.",
        home_ideas: ["Count steps together.", "Sing a song."],
      };
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) };
    }),
  );
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await t.teardown();
});

describe("what is sent for writing", () => {
  it("never contains names, siblings, staff, phone numbers or emails", async () => {
    const U = await import("../src/domain/users");
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
    await W.workspace();
    const id = await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" });
    const teacher: SessionUser = { id, email: "lim@x.sg", name: "Ms Lim", role: "teacher", mustChangePassword: false };

    const reviewId = await W.addChild(teacher, "Aurelia Pemberton", "she", "2021-05-06");
    await W.addChild(teacher, "Barnaby", "he", "");
    const r = (await R.getReviewRow(reviewId))!;
    for (const a of r.rubric.areas) {
      const ans: AreaAnswer = {
        skills: Object.fromEntries(a.skills.map((s) => [s.key, { level: 4, touched: true }])),
        moments: [],
        note: "Aurelia played with Barnaby while Ms Lim watched. Call 9123 4567 or mum@example.com",
        visited: true,
      };
      await R.saveArea(teacher, reviewId, a.key, ans);
    }
    await R.saveHighlight(teacher, reviewId, "Aurelia Pemberton shared with Barnaby, NRIC S1234567D");
    await R.saveNote(teacher, reviewId, "friends", "Best friends with Barnaby; Pemberton family are lovely");

    const out = await R.writeDraft(teacher, reviewId);
    expect(out).toMatchObject({ ok: true, provider: "gemini" });
    expect(sent.length).toBeGreaterThan(0);
    const everything = sent.join("\n");
    for (const leak of ["Aurelia", "Pemberton", "Barnaby", "Ms Lim", "9123", "mum@example.com", "S1234567D", "2021-05-06"]) {
      expect(everything, `"${leak}" must not be sent to the AI service`).not.toContain(leak);
    }
    expect(everything).toContain("[Child]");
    // The name is put back on the school's own side.
    const draft = (await R.getReviewRow(reviewId))!.draft!;
    expect(draft.paragraphs[0].text).toContain("Aurelia");
  });
});
