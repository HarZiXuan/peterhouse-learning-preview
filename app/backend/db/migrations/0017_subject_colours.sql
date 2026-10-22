-- Subjects are deleted rather than hidden, and each has its own colour.
UPDATE subjects SET active = true WHERE NOT active;

-- Subjects that share a colour keep it only for the first one; the others take a colour nobody uses yet.
WITH palette (color, pos) AS (
  SELECT * FROM unnest(ARRAY['sky', 'ocean', 'indigo', 'lilac', 'plum', 'berry', 'blush', 'rose', 'red', 'coral', 'peach', 'amber',
                             'sun', 'lime', 'olive', 'leaf', 'forest', 'teal', 'sand', 'stone', 'slate', 'cocoa']) WITH ORDINALITY
),
dupes AS (
  SELECT id, row_number() OVER (ORDER BY position, id) AS n
    FROM (SELECT id, position, row_number() OVER (PARTITION BY color ORDER BY position, id) AS k FROM subjects) s
   WHERE k > 1
),
free AS (
  SELECT color, row_number() OVER (ORDER BY pos) AS n FROM palette p WHERE NOT EXISTS (SELECT 1 FROM subjects s WHERE s.color = p.color)
)
UPDATE subjects s SET color = f.color FROM dupes d JOIN free f ON f.n = d.n WHERE s.id = d.id;

CREATE UNIQUE INDEX subjects_color_key ON subjects (color);
