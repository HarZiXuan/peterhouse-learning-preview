-- A child marked as left because K2 ended: the term they finished in. Lets the administrator move the report period
-- back and forth without losing track of who had graduated at that point.
ALTER TABLE children ADD COLUMN graduated_after bigint REFERENCES terms (id) ON DELETE SET NULL;
