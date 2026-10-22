-- Each learning area of a class's reports has one teacher: they rate it, have its paragraph written, check it and
-- send it to the lead teacher. The lead brings the parts together and sends the report for review.
-- No row means the class's lead teacher.
CREATE TABLE class_area_teachers (
  class_id bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  area_key text   NOT NULL,
  user_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, area_key)
);

-- One child's part: the paragraph its teacher checked, and when they sent it to the lead.
ALTER TABLE review_areas
  ADD COLUMN paragraph text,                                   -- ENC
  ADD COLUMN done_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN done_at   timestamptz;
