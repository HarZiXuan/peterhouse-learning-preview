-- A child is he or she. Questions write the pronoun as {he/she}, {him/her} and {his/her}; reviews frozen with the
-- older three-form tokens still read them (shared/src/calc.ts).
UPDATE questions SET text_template = replace(replace(replace(text_template, '{he/she/they}', '{he/she}'), '{his/her/their}', '{his/her}'), '{him/her/them}', '{him/her}')
 WHERE text_template LIKE '%/they}%' OR text_template LIKE '%/their}%' OR text_template LIKE '%/them}%';

-- New children are he or she. NOT VALID leaves any older row as it is rather than failing the upgrade.
ALTER TABLE children DROP CONSTRAINT IF EXISTS children_pronoun_check;
ALTER TABLE children ADD CONSTRAINT children_pronoun_check CHECK (pronoun IN ('she', 'he')) NOT VALID;
