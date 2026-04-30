UPDATE auth.users
SET email = 'steve.carone@gmail.com',
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', 'steve.carone@gmail.com')
WHERE id = 'af6cbf3c-b686-49df-9431-1d25427e5534'
  AND email = 'stevecarone@gmail.com';

UPDATE auth.identities
SET identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', 'steve.carone@gmail.com')
WHERE user_id = 'af6cbf3c-b686-49df-9431-1d25427e5534'
  AND provider = 'email';