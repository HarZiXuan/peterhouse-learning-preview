import type { ReportData } from "@peterhouse/shared";
import type { SchoolDetails } from "@peterhouse/shared";
import { ageYearsMonths, levelWord, semesterLabel } from "@peterhouse/shared";
import type { Level } from "@peterhouse/shared";
import { AreaIcon, Sparkle, SunRays } from "./art";
import styles from "./report.module.css";

/*
  THESIS: the report is the child's keepsake storybook, photo-led and colourful, not a form.
  OWN-WORLD: crest red drenched cover, gold/sky/blush circles, polaroid photos with tape, round medallion icons per learning area, pill rows, rounded A4 cards.
  STORY: parents see their child first, then each area as a little scene, then a warm send-off.
  FIRST VIEWPORT: red cover, big circular photo with gold ring, gold term sticker, white opening card.
  FORM: photo storybook; seed n/a (scoped redesign of an existing surface).
*/

const TONES = ["sky", "blush", "gold"] as const;

function Dots({ level, tone }: { level: Level; tone: string }) {
  return (
    <span className={`${styles.dots} ${styles[`dots_${tone}`]}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= level ? styles.on : ""} />
      ))}
    </span>
  );
}

function Sheet({ children, footer, draft, className = "", sheetKey }: { children: React.ReactNode; footer: React.ReactNode; draft: boolean; className?: string; sheetKey?: string }) {
  return (
    <section className={`${styles.sheet} ${className}`} data-sheet={sheetKey}>
      {draft && (
        <div className={styles.watermark} aria-hidden>
          DRAFT
        </div>
      )}
      {children}
      <footer className={styles.footer}>{footer}</footer>
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

function Paragraph({ text, className = "", k, pick }: { text: string; className?: string; k?: string; pick?: Pick }) {
  const interactive = !!(k && pick?.onPick);
  return (
    <div
      data-key={k}
      className={`${interactive ? styles.pickable : ""} ${k && pick?.active === k ? styles.active : ""}`}
      onClick={interactive ? () => pick!.onPick!(k!) : undefined}
    >
      {text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={`${styles.body} ${className}`}>
            <Rich text={p} />
          </p>
        ))}
    </div>
  );
}

function Ring({ score }: { score: number }) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <div className={styles.ring} role="img" aria-label={`${score} out of 10`}>
      <svg viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(9,31,52,0.12)" strokeWidth="3.4" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="#ae1d25" strokeWidth="3.4" strokeLinecap="round" strokeDasharray={`${(score / 10) * c} ${c}`} transform="rotate(-90 18 18)" />
      </svg>
      <div>
        <strong>{score.toFixed(1)}</strong>
        <span>out of 10</span>
      </div>
    </div>
  );
}

function Photo({ id, className = "" }: { id: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/photos/${id}`} alt="" className={className} />;
}

/** Spreads m photos over n slots so they land on different pages. */
function spread(n: number, m: number): number[] {
  if (m <= 0 || n <= 0) return [];
  if (m === 1) return [Math.min(1, n - 1)];
  const k = Math.min(m, n);
  return Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)));
}

export function Report({
  data,
  school,
  isDraft,
  reportDate,
  edits,
  active,
  onPick,
}: {
  data: ReportData;
  school: SchoolDetails;
  isDraft: boolean;
  reportDate: Date;
  /** Live wording from the editor, keyed like the draft ("opening", "area:key", "closing", "home"). */
  edits?: Record<string, string>;
  active?: string;
  onPick?: (key: string) => void;
}) {
  const pick: Pick = { active, onPick };
  const T = (key: string, original: string) => edits?.[key] ?? original;
  const homeIdeas = edits?.home !== undefined ? edits.home.split("\n").map((x) => x.trim()).filter(Boolean) : data.homeIdeas;
  const pageCount = 1 + data.areas.length + 1;

  // Photo plan: first photo is the cover, a couple of spares go to the closing page, the rest are spread over the areas.
  const [coverPhoto, ...rest] = data.photoIds;
  const closingCount = rest.length >= 5 ? 2 : rest.length >= 3 ? 1 : 0;
  const closingPhotos = rest.slice(rest.length - closingCount);
  const areaPool = rest.slice(0, rest.length - closingCount);
  const areaPhoto = new Map<number, number>();
  spread(data.areas.length, areaPool.length).forEach((slot, i) => areaPhoto.set(slot, areaPool[i]));

  const footer = (page: number, light = false) => (
    <>
      <span className={light ? styles.footLight : undefined}>
        {school.name} · {data.childName} · {data.season} {data.year}
        {data.version > 1 ? ` · v${data.version}` : ""}
        {isDraft ? " · DRAFT" : ""}
      </span>
      <span className={light ? styles.footLight : undefined}>
        {page} / {pageCount}
      </span>
    </>
  );
  const teachers = [...data.leadTeachers, ...data.coTeachers];
  const age = data.dateOfBirth ? ageYearsMonths(data.dateOfBirth, reportDate) : "";

  return (
    <div className={styles.report}>
      {/* ── 1 · Cover ── */}
      <Sheet draft={isDraft} footer={footer(1, true)} className={styles.cover} sheetKey="opening">
        <div className={`${styles.disc} ${styles.discGold}`} />
        <div className={`${styles.disc} ${styles.discSky}`} />
        <div className={`${styles.disc} ${styles.discBlush}`} />
        <Sparkle className={`${styles.spark} ${styles.spark1}`} />
        <Sparkle className={`${styles.spark} ${styles.spark2}`} />
        <Sparkle className={`${styles.spark} ${styles.spark3}`} />

        <div className={styles.coverHead}>
          <div className={styles.crestBadge}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/peterhouse-shield.png" alt={school.name} />
          </div>
          <div className={styles.sticker}>
            <span>{data.season}</span>
            <strong>{data.year}</strong>
          </div>
        </div>
        <h1 className={styles.coverTitle}>
          Learning
          <br />
          Review
        </h1>

        <div className={styles.heroWrap}>
          <div className={styles.heroRing} />
          {coverPhoto ? (
            <Photo id={coverPhoto} className={styles.heroPhoto} />
          ) : (
            <div className={styles.heroInitial} aria-hidden>
              <span>{data.childInitial}</span>
            </div>
          )}
        </div>

        <div className={styles.nameBlock}>
          <h2 className={styles.childName}>{data.childName}</h2>
          <p className={styles.coverMeta}>{[data.className, age].filter(Boolean).join(" · ")}</p>
        </div>

        <div className={styles.openingCard}>
          <Paragraph text={T("opening", data.opening)} k="opening" pick={pick} />
        </div>
      </Sheet>

      {/* ── 2+ · One learning area per page ── */}
      {data.areas.map((a, idx) => {
        const tone = TONES[idx % TONES.length];
        const photo = areaPhoto.get(idx);
        const flip = idx % 2 === 1;
        return (
          <Sheet key={a.key} draft={isDraft} footer={footer(idx + 2)} className={`${styles.areaSheet} ${styles[`tone_${tone}`]}`} sheetKey={`area:${a.key}`}>
            <header className={styles.pageHead}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/peterhouse-shield.png" alt="" className={styles.miniCrest} />
              <span>{data.childName}’s learning journey · Cambridge Early Years</span>
            </header>
            <div className={styles.banner}>
              <div>
                <p className={styles.areaNo}>
                  Area {idx + 1} of {data.areas.length}
                </p>
                <h2 className={styles.areaTitle}>{a.name}</h2>
                {a.summary ? <p className={styles.overall}>{levelWord(a.summary)} overall</p> : null}
              </div>
              {a.score !== null ? (
                <Ring score={a.score} />
              ) : (
                photo && (
                  <div className={styles.medal}>
                    <AreaIcon k={a.key} />
                  </div>
                )
              )}
            </div>
            <div className={`${styles.areaBody} ${flip ? styles.flip : ""}`}>
              <div className={styles.scene}>
                {photo ? (
                  <div className={styles.polaroid} style={{ transform: `rotate(${flip ? 2.5 : -2.5}deg)` }}>
                    <i className={styles.tape} />
                    <Photo id={photo} />
                    <div className={styles.cornerMedal}>
                      <AreaIcon k={a.key} />
                    </div>
                  </div>
                ) : (
                  <div className={styles.bigMedal}>
                    <AreaIcon k={a.key} />
                  </div>
                )}
              </div>
              <ul className={styles.skills}>
                {a.skills.map((s) => (
                  <li key={s.name}>
                    <span className={styles.skillName}>{s.name}</span>
                    <span className={styles.skillLevel}>
                      {s.level > 0 ? (
                        <>
                          <Dots level={s.level} tone={tone} />
                          <span className={styles.levelWord}>{levelWord(s.level)}</span>
                          {s.up && data.previousSeason && <span className={styles.up}>↑ since {semesterLabel(data.previousSeason)}</span>}
                          {s.previous && data.previousSeason && (
                            <span className={styles.prev}>
                              {semesterLabel(data.previousSeason)}: {levelWord(s.previous)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={styles.notYet}>Getting to know</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.areaStory}>
              <Paragraph text={T(`area:${a.key}`, a.paragraph)} k={`area:${a.key}`} pick={pick} />
            </div>
          </Sheet>
        );
      })}

      {/* ── Last · Looking ahead ── */}
      <Sheet draft={isDraft} footer={footer(pageCount)} className={styles.closingSheet} sheetKey="closing">
        <div className={styles.closingTop}>
          {closingPhotos.length === 0 && <SunRays className={styles.sun} />}
          {closingPhotos.length > 0 && (
            <div className={styles.strip}>
              {closingPhotos.map((id, i) => (
                <div key={id} className={styles.polaroid} style={{ transform: `rotate(${i % 2 ? 2.5 : -2.5}deg)` }}>
                  <i className={styles.tape} />
                  <Photo id={id} />
                </div>
              ))}
            </div>
          )}
          <p className={styles.kickerLight}>Looking ahead</p>
          <h2 className={styles.closingTitle}>{data.childName}’s next chapter</h2>
        </div>
        <div className={styles.closingPage}>
          <div className={styles.closingCard}>
            <Paragraph text={T("closing", data.closing)} k="closing" pick={pick} />
          </div>

          {data.overallScore !== null && (
            <div className={styles.glance}>
              <div className={styles.glanceTotal}>
                <strong>{data.overallScore.toFixed(1)}</strong>
                <span>out of 10 overall</span>
              </div>
              <ul>
                {data.areas.map((a) =>
                  a.score === null ? null : (
                    <li key={a.key}>
                      <span>{a.name}</span>
                      <i>
                        <b style={{ width: `${a.score * 10}%` }} />
                      </i>
                      <em>{a.score.toFixed(1)}</em>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          <div className={styles.twoCol}>
            <div className={`${styles.listCard} ${styles.listGold}`}>
              <h3 className={styles.listTitle}>
                <Sparkle className={styles.listIcon} /> Shining this term
              </h3>
              <ul className={styles.list}>
                {data.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className={`${styles.listCard} ${styles.listSky}`}>
              <h3 className={styles.listTitle}>
                <span className={styles.arrow} aria-hidden>
                  →
                </span>{" "}
                Next steps
              </h3>
              <ul className={styles.list}>
                {data.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          {homeIdeas.length > 0 && (
            <div className={`${styles.home} ${styles.pickable} ${active === "home" ? styles.active : ""}`} data-key="home" onClick={onPick ? () => onPick("home") : undefined}>
              <h3 className={styles.homeTitle}>Ideas to try at home</h3>
              <ol className={styles.homeList}>
                {homeIdeas.map((h) => (
                  <li key={h}>
                    <Rich text={h} />
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className={styles.signoff}>
            <div>
              <p className={styles.signKicker}>With warm wishes from</p>
              <p className={styles.teachers}>{teachers.join(", ")}</p>
              <p className={styles.meta}>{[data.className, school.name].filter(Boolean).join(" · ")}</p>
            </div>
            <p className={styles.contact}>
              {[school.phone, school.email].filter(Boolean).join(" | ")}
              {school.address ? <><br />{school.address}</> : null}
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
