-- Classes managed by the administrator (CHANGES-TO-MAKE change 4).
-- Five levels set by the year a child turns 2, 3, 4, 5 or 6. A level can have several classes, and a child is only
-- ever in a class of their own level (checked in backend/src/domain/classes.ts, since birthdays are encrypted).

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_level_check;
UPDATE classes SET level = 'N2' WHERE level = 'Nursery';
ALTER TABLE classes ADD CONSTRAINT classes_level_check CHECK (level IN ('PG', 'N1', 'N2', 'K1', 'K2'));

-- The one automatic class was called "Class"; the class name printed on reports lived in the settings. Keep it.
UPDATE classes k SET name = s.value ->> 'className'
  FROM settings s
 WHERE s.key = 'school' AND k.name = 'Class' AND coalesce(trim(s.value ->> 'className'), '') <> ''
   AND NOT EXISTS (SELECT 1 FROM classes o WHERE o.term_id = k.term_id AND o.name = s.value ->> 'className');

-- At most one lead teacher per class; any number of co-teachers. Until now every teacher joined as lead, so the
-- longest-standing one stays lead and the rest become co-teachers.
UPDATE class_staff s SET role = 'co'
 WHERE role = 'lead' AND user_id <> (SELECT min(user_id) FROM class_staff x WHERE x.class_id = s.class_id AND x.role = 'lead');
CREATE UNIQUE INDEX idx_class_one_lead ON class_staff (class_id) WHERE role = 'lead';
