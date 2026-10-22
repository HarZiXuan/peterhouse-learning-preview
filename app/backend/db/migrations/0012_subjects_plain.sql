-- A subject is only a name and a colour for the timetable. Which areas of a review a teacher rates no longer depends on
-- the subjects they teach, so subjects are not tied to a learning area any more.
ALTER TABLE subjects DROP COLUMN area_key;
