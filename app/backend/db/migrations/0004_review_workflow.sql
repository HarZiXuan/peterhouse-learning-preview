-- Teachers own the report; the administrator reviews it (CHANGES-TO-MAKE changes 1 and 3).
-- Draft → Ready → Written → Submitted → Approved, or back to the teacher as Changes requested.

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_status_check
  CHECK (status IN ('not_started', 'draft', 'ready', 'written', 'submitted', 'changes_requested', 'approved'));

ALTER TABLE reviews
  ADD COLUMN submitted_by   bigint REFERENCES users (id),
  ADD COLUMN submitted_at   timestamptz,
  -- The administrator's note when sending a report back. It may name the child, so it is encrypted.
  ADD COLUMN change_note    text NOT NULL DEFAULT '',          -- ENC
  ADD COLUMN change_note_by bigint REFERENCES users (id),
  ADD COLUMN change_note_at timestamptz,
  -- Set while an administrator has taken the report over (the teacher cannot edit it meanwhile).
  ADD COLUMN taken_over_by  bigint REFERENCES users (id),
  ADD COLUMN taken_over_at  timestamptz,
  -- Shown to staff only: an administrator changed the wording or ratings.
  ADD COLUMN admin_edited   boolean NOT NULL DEFAULT false;

-- Each "Submit for review" freezes the report as a numbered version, and records what the administrator decided.
CREATE TABLE report_versions (
  id           bigserial PRIMARY KEY,
  review_id    bigint NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  version      integer NOT NULL,
  draft        text NOT NULL,                                   -- ENC (JSON of the report as submitted)
  submitted_by bigint REFERENCES users (id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decision     text CHECK (decision IN ('approved', 'changes_requested', 'taken_back')),
  decided_by   bigint REFERENCES users (id),
  decided_at   timestamptz,
  note         text NOT NULL DEFAULT '',                        -- ENC
  UNIQUE (review_id, version)
);
CREATE INDEX idx_report_versions_review ON report_versions (review_id);
