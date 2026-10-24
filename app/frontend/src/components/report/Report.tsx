import type { Level, ReportData, SchoolDetails } from "@peterhouse/shared";
import { ageYearsMonths, levelWord } from "@peterhouse/shared";
import { House, Illustration, Pencil, Star, SunFace } from "./art";
import { FitNote } from "./FitNote";
import styles from "./report.module.css";

/*
  THESIS: the report is the child's picture-book keepsake, not a form: warm paper, one colour per learning area, a rainbow arch for
  the cover, star stickers instead of scores, and the child's own words in handwriting.
  OWN-WORLD: cream paper, rainbow arch, wavy colour bands, hand-drawn crayon pictures per area, speech bubbles, lined exercise-book note.
  STORY: parents meet their child on the cover, then each area is a page with its own colour and picture, then a sunny send-off.
  FORM: fixed A4 sheets (794 x 1123 px), one learning area per page.
*/

/** Each learning area has its colour (the timetable uses the same ones); areas added later take the next spare colour. */
const TONE_OF: Record<string, string> = { eng: "sky", chi: "rose", mat: "sun", sed: "leaf", enr: "peach" };
const SPARE = ["lilac", "sky", "rose", "sun", "leaf", "peach"];

function Stars({ level, size }: { level: number; size?: number }) {
  return (
    <span className={styles.stars} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} on={i <= level} size={size} />
      ))}
    </span>
  );
}

/** The area as one ring: how full it is follows the average of the teacher's ratings, out of five. */
function ScoreRing({ levels, name, small }: { levels: number[]; name: string; small?: boolean }) {
  const seen = levels.filter((l) => l > 0);
  if (!seen.length) return <p className={styles.notYet}>Still getting to know {name}</p>;
  const avg = seen.reduce((a, b) => a + b, 0) / seen.length;
  const R = 92;
  const C = 2 * Math.PI * R;
  return (
    <div className={`${styles.ring} ${small ? styles.ringSmall : ""}`}>
      <svg viewBox="0 0 220 220" aria-hidden>
        <circle cx="110" cy="110" r={R} className={styles.ringTrack} />
        <circle cx="110" cy="110" r={R} className={styles.ringFill} strokeDasharray={`${(avg / 5) * C} ${C}`} transform="rotate(-90 110 110)" />
      </svg>
      <div className={styles.ringText}>
        <Stars level={Math.round(avg)} size={small ? 12 : 18} />
        <strong>{levelWord(Math.round(avg) as Level)}</strong>
      </div>
    </div>
  );
}

/** One rating in the comparison: stars and its word, or a dash when the skill was not asked that semester. */
function Rated({ level }: { level: Level | null }) {
  if (level === null) return <span className={styles.notAsked}>–</span>;
  return (
    <>
      {level > 0 && <Stars level={level} size={10} />}
      <span className={styles.ratedWord}>{levelWord(level)}</span>
    </>
  );
}

/** The second semester beside the first: each statement with both ratings, lined up by the question's permanent key. */
function Compare({ skills, before, now }: { skills: ReportData["areas"][number]["skills"]; before: string; now: string }) {
  return (
    <table className={styles.compare}>
      <thead>
        <tr>
          <th />
          <th scope="col">{before}</th>
          <th scope="col">{now}</th>
        </tr>
      </thead>
      <tbody>
        {skills.map((s) => (
          <tr key={s.key}>
            <th scope="row">{s.text}</th>
            <td>
              <Rated level={s.previous} />
            </td>
            <td>
              <Rated level={s.level} />
              {s.previous !== null && s.previous > 0 && s.level > s.previous && <span className={styles.upMark} aria-label={`up since ${before}`}>↑</span>}
              {s.previous !== null && s.level > 0 && s.level < s.previous && <span className={styles.downMark} aria-label={`down since ${before}`}>↓</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Sheet({ children, footer, draft, className = "", sheetKey, only }: { children: React.ReactNode; footer: React.ReactNode; draft: boolean; className?: string; sheetKey?: string; only?: string }) {
  // One page on its own (a teacher checking their part): the other pages are left out.
  if (only && sheetKey !== only) return null;
  return (
    <section className={`${styles.sheet} ${className}`} data-sheet={sheetKey}>
      {draft && (
        <div className={styles.watermark} aria-hidden>
          DRAFT
        </div>
      )}
      {children}
      {footer}
    </section>
  );
}

/** Renders **bold** keywords from the writer. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part.replace(/\*\*/g, "")}</span>,
      )}
    </>
  );
}

type Pick = { active?: string; onPick?: (key: string) => void };

function Paragraph({ text, k, pick }: { text: string; k?: string; pick?: Pick }) {
  const interactive = !!(k && pick?.onPick);
  return (
    <div data-key={k} className={`${interactive ? styles.pickable : ""} ${k && pick?.active === k ? styles.active : ""}`} onClick={interactive ? () => pick!.onPick!(k!) : undefined}>
      {text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={styles.p}>
            <Rich text={p} />
          </p>
        ))}
    </div>
  );
}

function Photo({ id }: { id: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/photos/${id}`} alt="" />;
}

/** Longer wording gets a smaller type size so a page never overflows: "" (short), "mid" or "long". */
const fit = (chars: number, mid: number, long: number) => (chars > long ? styles.long : chars > mid ? styles.mid : "");

/** Spreads m photos over n slots so they land on different pages. */
function spread(n: number, m: number): number[] {
  if (m <= 0 || n <= 0) return [];
  if (m === 1) return [Math.min(1, n - 1)];
  const k = Math.min(m, n);
  return Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)));
}

const names = (list: string[]) => (list.length <= 2 ? list.join(" & ") : `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`);

export function Report({
  data,
  school,
  isDraft,
  reportDate,
  edits,
  active,
  onPick,
  only,
}: {
  data: ReportData;
  school: SchoolDetails;
  isDraft: boolean;
  reportDate: Date;
  /** Live wording from the editor, keyed like the draft ("opening", "area:key", "closing", "home"). */
  edits?: Record<string, string>;
  active?: string;
  onPick?: (key: string) => void;
  /** Show only this page ("area:mat"), e.g. for the teacher who writes it. */
  only?: string;
}) {
  const pick: Pick = { active, onPick };
  const T = (key: string, original: string) => edits?.[key] ?? original;
  const homeIdeas = edits?.home !== undefined ? edits.home.split("\n").map((x) => x.trim()).filter(Boolean) : data.homeIdeas;
  const pageCount = 1 + data.areas.length + 1;

  // Photo plan: the cover photo is chosen on its own; each area shows its own photo; older photos that belong to no area
  // fill areas without one, then up to two go to the closing page.
  const coverPhoto = data.coverPhoto;
  const used = new Set<number>();
  const areaPhoto = new Map<number, number>();
  data.areas.forEach((a, i) => {
    const own = a.photoIds.find((id) => !used.has(id));
    if (own) {
      areaPhoto.set(i, own);
      used.add(own);
    }
  });
  const spare = data.photoIds.filter((id) => !used.has(id));
  const empty = data.areas.map((_, i) => i).filter((i) => !areaPhoto.has(i));
  const closingCount = spare.length > empty.length ? Math.min(2, spare.length - empty.length) : 0;
  const closingPhotos = spare.slice(spare.length - closingCount);
  const areaPool = spare.slice(0, spare.length - closingCount);
  spread(empty.length, areaPool.length).forEach((slot, i) => areaPhoto.set(empty[slot], areaPool[i]));

  const footer = (page: number) => (
    <footer className={styles.footer}>
      <span className={styles.footText}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/peterhouse-shield.png" alt="" />
        {school.name} · {data.childName} · {data.season} {data.year}
        {data.version > 1 ? ` · v${data.version}` : ""}
        {isDraft ? " · DRAFT" : ""}
      </span>
      <span className={styles.pageNo}>{page}</span>
    </footer>
  );
  const teachers = [...data.leadTeachers, ...data.coTeachers];
  const age = data.dateOfBirth ? ageYearsMonths(data.dateOfBirth, reportDate) : "";
  const opening = T("opening", data.opening);
  const closing = T("closing", data.closing);
  let spareTone = 0;

  return (
    <div className={styles.report}>
      {/* ── 1 · Cover ── */}
      <Sheet only={only} draft={isDraft} footer={footer(1)} className={`${styles.cover} ${styles.tone_sun}`} sheetKey="opening">
        <svg className={styles.decor} viewBox="0 0 794 1123" aria-hidden>
          <path d="M60 250c0-18 14-30 32-30 6-16 24-26 42-22 10-14 34-16 46-2 20-4 38 10 38 28 0 14-12 26-28 26H92c-18 0-32-1-32 0z" fill="#e4f2fb" />
          <path d="M560 330c0-14 12-24 26-24 6-12 20-20 34-16 8-10 26-12 36-2 16-2 30 8 30 22 0 12-10 20-22 20H588c-16 0-28 0-28 0z" fill="#e4f2fb" />
          <path d="M90 560l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z" fill="#fdcb40" />
          <path d="M700 520l5 11 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2z" fill="#f5ccce" />
          <path d="M650 770l5 12 13 2-10 9 3 13-11-7-11 7 3-13-10-9 13-2z" fill="#94cae5" />
          <path d="M120 800l4 10 11 1-8 8 2 11-9-6-9 6 2-11-8-8 11-1z" fill="#ae1d25" />
          <circle cx="700" cy="620" r="7" fill="#fdcb40" />
          <circle cx="72" cy="690" r="6" fill="#94cae5" />
          <circle cx="740" cy="880" r="5" fill="#ae1d25" />
        </svg>

        <div className={styles.coverHead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/peterhouse-shield.png" alt={school.name} />
          <div>
            <b>{school.name}</b>
            <span>Learning Review</span>
          </div>
        </div>
        <div className={styles.sticker}>
          <span>{data.season}</span>
          <strong>{data.year}</strong>
        </div>
        <h1 className={styles.coverTitle}>
          My Learning
          <br />
          <em>Journey</em>
        </h1>

        <div className={styles.arch}>
          <i className={styles.a1} />
          <i className={styles.a2} />
          <i className={styles.a3} />
          <i className={styles.a4} />
          <div className={styles.archIn}>{coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPhoto} alt="" />
          ) : (
            <span aria-hidden>{data.childInitial}</span>
          )}</div>
        </div>
        <div className={styles.ground} />

        <div className={styles.nameBlock}>
          <h2 className={styles.childName}>{data.childName}</h2>
          {data.chineseName && <span className={styles.childHan}>{data.chineseName}</span>}
          <span className={styles.coverMeta}>{[data.className, age].filter(Boolean).join(" · ")}</span>
        </div>

        <div className={`${styles.openCard} ${fit(opening.length, 420, 560)}`}>
          <Paragraph text={opening} k="opening" pick={pick} />
        </div>
      </Sheet>

      {/* ── 2+ · One learning area per page ── */}
      {data.areas.map((a, idx) => {
        const tone = TONE_OF[a.key] ?? SPARE[spareTone++ % SPARE.length];
        const photo = areaPhoto.get(idx);
        const story = T(`area:${a.key}`, a.paragraph);
        const picture = a.icon ?? a.key;
        const loveLong = (a.love?.answer.length ?? 0) > 70;
        return (
          <Sheet only={only} key={a.key} draft={isDraft} footer={footer(idx + 2)} className={styles[`tone_${tone}`]} sheetKey={`area:${a.key}`}>
            <div className={styles.band}>
              <svg className={styles.wave} viewBox="0 0 794 262" preserveAspectRatio="none" aria-hidden>
                <path d="M0 0H794V212C730 246 650 190 560 218C470 246 390 192 300 216C210 240 110 198 0 224Z" />
              </svg>
              <div className={styles.bandText}>
                <span className={styles.pill}>
                  Learning area {idx + 1} of {data.areas.length}
                </span>
                <h1 className={`${styles.title} ${fit(a.name.length, 12, 22)}`}>
                  {a.name}
                  {a.subName && <span className={styles.titleHan}>{a.subName}</span>}
                </h1>
                {a.summary ? (
                  <div className={styles.overall}>
                    <Stars level={a.summary} size={22} />
                    <span>{levelWord(a.summary)}, overall</span>
                  </div>
                ) : null}
              </div>
              {photo && <Illustration k={picture} className={styles.bandArt} />}
            </div>

            <div className={styles.areaMain}>
              <div className={styles.side}>
                <div className={styles.photoFrame}>{photo ? <Photo id={photo} /> : <Illustration k={picture} />}</div>
                {a.love && (
                  <div className={styles.bubble}>
                    <span className={styles.bubbleLabel}>{a.love.question}</span>
                    <p className={`${styles.bubbleQuote} ${loveLong ? styles.long : ""}`}>“{a.love.answer}”</p>
                  </div>
                )}
              </div>
              <section className={styles.skillsBox} aria-label={`How ${data.firstName} is doing in ${a.name}`}>
                <h2>{a.language === "zh" ? `${data.firstName}的${a.subName ?? a.name}` : `${data.firstName} in ${a.name}`}</h2>
                {data.previousSeason && a.skills.some((s) => s.previous !== null) ? (
                  <>
                    <ScoreRing levels={a.skills.map((s) => s.level)} name={data.firstName} small />
                    <Compare skills={a.skills} before={data.previousSeason} now={data.season} />
                  </>
                ) : (
                  <ScoreRing levels={a.skills.map((s) => s.level)} name={data.firstName} />
                )}
              </section>
            </div>

            <FitNote className={`${styles.note} ${styles.lined} ${fit(story.length, 520, 760)}`} text={story}>
              <div className={styles.noteHead}>
                <Pencil />
                <h2>{a.language === "zh" ? "老师的话" : `A note from ${data.firstName}’s teachers`}</h2>
              </div>
              <Paragraph text={story} k={`area:${a.key}`} pick={pick} />
            </FitNote>
          </Sheet>
        );
      })}

      {/* ── Last · Looking ahead ── */}
      <Sheet only={only} draft={isDraft} footer={footer(pageCount)} sheetKey="closing">
        <div className={styles.cband}>
          <svg className={styles.scene} viewBox="0 0 794 250" preserveAspectRatio="none" aria-hidden>
            <path d="M0 0H794V204C720 238 640 188 548 216C456 244 380 196 290 220C200 244 100 206 0 230Z" fill="#c7e9fa" />
            <ellipse cx="120" cy="236" rx="260" ry="40" fill="#cfe8cf" />
            <ellipse cx="640" cy="240" rx="300" ry="44" fill="#b9dcb8" />
            <path d="M0 250V228C110 202 180 224 300 220C440 216 520 194 640 212C700 220 750 214 794 202V250Z" fill="#fffaf0" />
          </svg>
          <div className={styles.cText}>
            <span className={styles.pill} style={{ ["--deep" as string]: "#0a3a57" }}>
              Looking ahead
            </span>
            <h1 className={styles.cTitle}>
              {data.firstName}’s next <em>chapter</em>
            </h1>
          </div>
          {closingPhotos.length > 0 ? (
            <div className={styles.cPhotos}>
              {closingPhotos.map((id) => (
                <div key={id}>
                  <Photo id={id} />
                </div>
              ))}
            </div>
          ) : (
            <SunFace className={styles.sun} />
          )}
        </div>

        <div className={styles.cBody}>
          <div className={`${styles.cCard} ${fit(closing.length, 380, 560)}`}>
            <Paragraph text={closing} k="closing" pick={pick} />
          </div>

          <div className={styles.two}>
            <section className={`${styles.box} ${styles.boxSun}`} aria-label="Shining this semester">
              <h2>Shining this semester</h2>
              <ul className={styles.bullets}>
                {data.strengths.map((s) => (
                  <li key={s}>
                    <Star on size={22} />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className={`${styles.box} ${styles.boxSky}`} aria-label="Next steps">
              <h2>Next steps</h2>
              <ol className={styles.bullets}>
                {data.nextSteps.map((s, i) => (
                  <li key={s}>
                    <span className={styles.num}>{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {homeIdeas.length > 0 && (
            <section className={`${styles.homeBox} ${styles.pickable} ${active === "home" ? styles.active : ""}`} data-key="home" onClick={onPick ? () => onPick("home") : undefined}>
              <h2>
                <House /> Ideas to try at home
              </h2>
              <div className={styles.ideas}>
                {homeIdeas.map((h, i) => (
                  <div key={h} className={styles.idea}>
                    <b>{i + 1}</b>
                    <Rich text={h} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className={styles.signoff}>
            <div>
              <span className={styles.signKicker}>With warm wishes from</span>
              <span className={styles.signNames}>{names(teachers)}</span>
              <span className={styles.signMeta}>{[data.className, school.name].filter(Boolean).join(" · ")}</span>
            </div>
            <p className={styles.contact}>
              {[school.phone, school.email].filter(Boolean).join(" | ")}
              {school.address ? (
                <>
                  <br />
                  {school.address}
                </>
              ) : null}
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
