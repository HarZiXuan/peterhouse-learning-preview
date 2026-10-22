-- Each child has one profile photo, set by the administrator or the child's teachers, and kept across semesters.
-- It is the cover photo of the child's report.
ALTER TABLE children ADD COLUMN photo    bytea;        -- ENC
ALTER TABLE children ADD COLUMN photo_at timestamptz;

-- The newest cover photo a teacher added becomes the child's profile photo.
UPDATE children c SET photo = p.data, photo_at = p.added_at
  FROM (SELECT DISTINCT ON (r.child_id) r.child_id, p.data, p.added_at
          FROM review_photos p JOIN reviews r ON r.id = p.review_id
         WHERE p.area_key = 'cover'
         ORDER BY r.child_id, p.added_at DESC) p
 WHERE p.child_id = c.id;

-- Approved reports keep the cover they were approved with; the others now use the profile photo.
DELETE FROM review_photos p USING reviews r WHERE r.id = p.review_id AND p.area_key = 'cover' AND r.status <> 'approved';
