// Privacy: the real draft pipeline runs against a stubbed AI service, and the test fails if anything
// identifying would leave the school: the child's name, a sibling, a teacher, a phone number or an email.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AreaAnswer, SessionUser } from "@peterhouse/shared";
import { makeClass, setupTestDb } from "./helpers";

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

    const cls = await makeClass([id]);
    const dob = cls.birthday("05-06");
    const reviewId = await cls.add("Aurelia Pemberton", "she", dob, "陈美雅");
    await cls.add("Barnaby", "he", undefined, "林小明");
    const r = await R.openReview((await R.getReviewRow(reviewId))!);
    for (const a of r.rubric.areas) {
      const ans: AreaAnswer = {
        skills: Object.fromEntries(a.skills.map((s, i) => [s.key, { level: i === 3 ? 0 : 4, touched: true }])),
        note: a.key === "chi" ? "美雅和林小明一起唱歌" : "Aurelia played with Barnaby while Ms Lim watched. Call 9123 4567 or mum@example.com",
        visited: true,
        ...(a.love ? { love: "Aurelia Pemberton shared with Barnaby, NRIC S1234567D", home: [a.homeIdeas![0]] } : {}),
      };
      await R.saveArea(teacher, reviewId, a.key, ans);
    }

    const out = await R.writeDraft(teacher, reviewId);
    expect(out).toMatchObject({ ok: true, provider: "gemini" });
    expect(sent.length).toBeGreaterThan(0);
    const everything = sent.join("\n");
    for (const leak of ["Aurelia", "Pemberton", "Barnaby", "Ms Lim", "9123", "mum@example.com", "S1234567D", dob, "美雅", "陈", "林小明"]) {
      expect(everything, `"${leak}" must not be sent to the AI service`).not.toContain(leak);
    }
    expect(everything).toContain("[Child]");
    // Section 5's shape: domains, statements with scores, "not seen yet", the scrubbed comment.
    const body = JSON.parse(sent[0]).contents[0].parts[0].text as string;
    expect(body).toContain("pronoun: she");
    expect(body).toMatch(/semester: Semester [12]/);
    expect(body).toContain("domain: English\n- reads simple sentences and common sight words: 4");
    expect(body).toContain("- answers questions about a story read aloud: not seen yet");
    expect(body).toContain('comment (name-scrubbed): "[Child]和[Friend]一起唱歌"');
    // The name is put back on the school's own side.
    const draft = (await R.getReviewRow(reviewId))!.draft!;
    expect(draft.paragraphs[0].text).toContain("Aurelia");
  });
});
