-- A child's profile: when they joined, who to call, and the staff's notes about them.
-- Parents and notes name real people and phone numbers, so they are encrypted like the name.
ALTER TABLE children
  ADD COLUMN joined_on date,                            -- the first day at school; added children default to the day they were added
  ADD COLUMN guardians text NOT NULL DEFAULT '',        -- ENC (JSON: [{ name, relationship, phone, email }])
  ADD COLUMN notes     text NOT NULL DEFAULT '';        -- ENC

UPDATE children SET joined_on = created_at::date;
ALTER TABLE children ALTER COLUMN joined_on SET NOT NULL, ALTER COLUMN joined_on SET DEFAULT CURRENT_DATE;
