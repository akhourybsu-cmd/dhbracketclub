INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments-private', 'chat-attachments-private', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users upload private chat attachments to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments-private'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Auth users read private chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments-private');

CREATE POLICY "Users delete own private chat attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments-private'
  AND (storage.foldername(name))[1] = auth.uid()::text
);