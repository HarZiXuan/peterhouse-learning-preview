-- Each person with a sign-in can have a profile photo, set by themselves or by an administrator.
-- It lives in its own table so listing people never loads the image bytes.
CREATE TABLE user_photos (
  user_id    bigint PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data       bytea NOT NULL,                       -- ENC
  changed_at timestamptz NOT NULL DEFAULT now()
);
