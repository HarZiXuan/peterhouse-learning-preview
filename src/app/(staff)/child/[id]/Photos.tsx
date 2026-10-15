"use client";

import { useRef, useState, useTransition } from "react";
import { deletePhotoAction, setPhotoConsentAction } from "../../actions";

type P = { id: number };

export function Photos({ reviewId, childName, initialPhotos, initialConsent, max }: { reviewId: number; childName: string; initialPhotos: P[]; initialConsent: boolean; max: number }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [consent, setConsent] = useState(initialConsent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    let list = photos;
    for (const f of Array.from(files)) {
      if (list.length >= max) {
        setError(`Up to ${max} photos per report.`);
        break;
      }
      const fd = new FormData();
      fd.append("photo", f);
      const res = await fetch(`/api/reviews/${reviewId}/photos`, { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { photos?: P[]; consent?: boolean; error?: string };
      if (!res.ok || !json.photos) {
        setError(json.error ?? "Could not upload that photo.");
        break;
      }
      list = json.photos;
      if (json.consent) setConsent(true);
      setPhotos(list);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <aside className="side-card">
      <h2>{childName}’s photos</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Add 3–6 from this term. The first becomes the cover. Photos stay on this computer.
      </p>
      <label className="row" style={{ marginBottom: 14, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            start(() => setPhotoConsentAction(reviewId, e.target.checked));
          }}
        />
        <span className="small">{childName}’s parents have agreed to photos in the report</span>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, marginBottom: 12 }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${p.id}`} alt={`Photo ${i + 1}`} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", opacity: consent ? 1 : 0.5 }} />
            {i === 0 && <span className="status status-ready" style={{ position: "absolute", left: 4, top: 4 }}>Cover</span>}
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              style={{ position: "absolute", right: 4, bottom: 4, background: "#fff" }}
              onClick={() => start(async () => setPhotos((await deletePhotoAction(reviewId, p.id)).photos))}
              aria-label={`Remove photo ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {!consent && photos.length > 0 && <p className="notice-gold small" style={{ marginBottom: 12 }}>Photos are hidden from the report because parents’ consent is not ticked above.</p>}
      {error && <p className="error" style={{ marginBottom: 8 }}>{error}</p>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <button type="button" className="btn" disabled={busy || photos.length >= max} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : photos.length ? "Add more photos" : "Add photos"}
      </button>
    </aside>
  );
}
