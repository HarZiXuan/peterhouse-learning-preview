-- A child's first and last name are kept apart. preferred_name holds the first name (what the report calls the child),
-- last_name the family name, and legal_name the two together (what lists and the report cover show).
-- Children added before this keep their whole name as the first name until someone splits it.
ALTER TABLE children ADD COLUMN last_name text NOT NULL DEFAULT '';   -- ENC
