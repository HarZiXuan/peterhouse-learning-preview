-- Different review questions for different ages (CHANGES-TO-MAKE change 8). Each question is ticked for the levels
-- it is asked at; a review freezes only its level's questions. Set A (PG, N1) follows Singapore's EYDF for under-fours,
-- Set B (N2, K1, K2) follows MOE's NEL for ages 4 to 6. The wording is a placeholder for a Peterhouse teacher.
--
-- These are changes to the DRAFT: an administrator publishes them on the Questions page, as with any other change.
-- On a new database the question bank is empty here and the app seeds the same questions itself.

ALTER TABLE questions ADD COLUMN levels text[] NOT NULL DEFAULT '{PG,N1,N2,K1,K2}';

-- The original questions suit ages 4 to 6, except the ones a two-year-old can do too.
UPDATE questions SET levels = '{N2,K1,K2}'
 WHERE key IN ('eng_1', 'eng_2', 'eng_3', 'eng_4', 'chi_2', 'chi_4', 'mat_1', 'mat_2', 'mat_3', 'mat_4', 'sed_2', 'sed_3', 'sed_4', 'enr_2');

-- Set A, plus one curiosity question for Set B. Keys with a letter never clash with the numbered ones the editor adds.
INSERT INTO questions (domain_id, key, text_template, position, levels)
SELECT d.id, q.key, q.text, q.pos, q.levels::text[]
  FROM (VALUES
    ('eng', 'eng_a1', '{name} follows simple directions, such as putting away a toy.', -4, '{PG,N1}'),
    ('eng', 'eng_a2', '{name} uses 2 to 3 words to say what is happening.', -3, '{PG,N1}'),
    ('eng', 'eng_a3', '{name} asks for favourite stories, songs or rhymes.', -2, '{PG,N1}'),
    ('eng', 'eng_a4', '{name} responds to simple “who”, “what” and “where” questions.', -1, '{N1}'),
    ('chi', 'chi_a1', '{name} says familiar Chinese words.', 50, '{PG,N1}'),
    ('mat', 'mat_a1', '{name} sorts, stacks and fits objects together.', -3, '{PG,N1}'),
    ('mat', 'mat_a2', '{name} notices “more” and “bigger”.', -2, '{PG,N1}'),
    ('mat', 'mat_a3', '{name} finds a hidden object under 2 or 3 covers.', -1, '{PG,N1}'),
    ('sed', 'sed_a1', '{name} shows {his/her/their} feelings and takes comfort from adults.', 50, '{PG,N1}'),
    ('sed', 'sed_a2', '{name} plays alongside friends and begins to take turns.', 51, '{PG,N1}'),
    ('enr', 'enr_a1', '{name} explores messy play, paint and play dough.', 50, '{PG,N1}'),
    ('enr', 'enr_b1', '{name} asks why and explores new things.', 51, '{N2,K1,K2}')
  ) AS q (domain, key, text, pos, levels)
  JOIN domains d ON d.key = q.domain
 WHERE NOT EXISTS (SELECT 1 FROM questions x WHERE x.key = q.key);
