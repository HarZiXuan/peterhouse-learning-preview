-- A learning area can be written in Chinese: its questions are asked in Chinese and its report paragraph is
-- written in Chinese. The Chinese area (华文) is the first.
ALTER TABLE domains ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'zh'));
UPDATE domains SET language = 'zh' WHERE key = 'chi';

-- The same skills, reworded in Chinese, so their keys (and scores) carry on.
CREATE TEMP TABLE zh_text (key text PRIMARY KEY, zh text NOT NULL) ON COMMIT DROP;
INSERT INTO zh_text (key, zh) VALUES
  ('chi_1', '{name}能听懂简单的华语指令。'),
  ('chi_2', '{name}会说简单的华语词语和短句。'),
  ('chi_3', '{name}会跟着唱华文儿歌、念童谣、听故事。'),
  ('chi_4', '{name}认得一些熟悉的汉字。'),
  ('chi_pg_1', '{name}能听懂简单的华语指令。'),
  ('chi_pg_2', '{name}会跟着唱华文儿歌和童谣。'),
  ('chi_pg_3', '{name}会说几个熟悉的华语词语。'),
  ('chi_n1_1', '{name}能用华语说出日常物品的名称。'),
  ('chi_n1_2', '{name}能用简短的华语回答简单的问题。'),
  ('chi_n1_3', '{name}能凭记忆唱华文儿歌和童谣。'),
  ('chi_n1_4', '{name}认得几个简单的汉字，例如“人”、“大”、“口”。'),
  ('chi_n2_1', '{name}能用简短的华语句子表达自己。'),
  ('chi_n2_2', '{name}认得大约五十个常用汉字。'),
  ('chi_n2_3', '{name}能正确地描写和书写基本笔画。'),
  ('chi_n2_4', '{name}能看图用华语复述简短的故事。'),
  ('chi_k1_1', '{name}能认读大约一百五十个常用汉字和短语。'),
  ('chi_k1_2', '{name}能按正确的笔顺书写简单的汉字。'),
  ('chi_k1_3', '{name}能认读汉语拼音的声母和韵母。'),
  ('chi_k1_4', '{name}能用完整的华语句子说出图画的内容。'),
  ('chi_k2_1', '{name}能阅读简短的华文短文和简单的故事书。'),
  ('chi_k2_2', '{name}能用华文书写词语和简短的句子。'),
  ('chi_k2_3', '{name}能借助汉语拼音认读不熟悉的汉字。'),
  ('chi_k2_4', '{name}能回答关于华文短文的问题。'),
  ('chi_k2_5', '{name}能用华语表达自己的想法和感受。');

-- The draft: the administrator publishes it as usual.
UPDATE questions q SET text_template = z.zh FROM zh_text z WHERE z.key = q.key;

-- Reviews not yet approved switch over now; approved reports keep exactly what was approved.
UPDATE reviews r SET rubric = jsonb_set(r.rubric, '{areas}', (
  SELECT jsonb_agg(
           CASE WHEN a ->> 'key' = 'chi' THEN a || jsonb_build_object('language', 'zh', 'skills', (
             SELECT coalesce(jsonb_agg(CASE WHEN z.zh IS NULL THEN s ELSE jsonb_set(s, '{text}', to_jsonb(z.zh)) END ORDER BY si), '[]'::jsonb)
               FROM jsonb_array_elements(a -> 'skills') WITH ORDINALITY x (s, si) LEFT JOIN zh_text z ON z.key = s ->> 'key'))
           ELSE a END ORDER BY ai)
    FROM jsonb_array_elements(r.rubric -> 'areas') WITH ORDINALITY y (a, ai)))
 WHERE r.status <> 'approved' AND jsonb_typeof(r.rubric -> 'areas') = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.rubric -> 'areas') a WHERE a ->> 'key' = 'chi');
