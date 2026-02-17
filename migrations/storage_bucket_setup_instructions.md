## Supabase Storage Bucket Setup Instructions

Please create the following storage buckets in your Supabase project:

1.  **`voice_messages`**
    *   **Public Access:** Off (or configure RLS policies as needed)
    *   **Allowed MIME Types:** `audio/*`

2.  **`file_attachments`**
    *   **Public Access:** Off (or configure RLS policies as needed)
    *   **Allowed MIME Types:** `image/*`, `application/pdf`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/zip`, `application/x-zip-compressed`

### Recommended RLS Policies for Storage Buckets:

For both `voice_messages` and `file_attachments` buckets, it is highly recommended to implement Row Level Security (RLS) policies to control access. Here are example policies you might consider:

**Policy for `voice_messages` bucket (allowing authenticated users to upload and read their own files, and read files from other users in channels they have access to):**

```sql
-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to upload their own voice messages
CREATE POLICY "Allow authenticated upload of voice messages" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'voice_messages' AND auth.uid() = owner);

-- Policy for authenticated users to view their own voice messages
CREATE POLICY "Allow authenticated read of own voice messages" ON storage.objects FOR SELECT USING (bucket_id = 'voice_messages' AND auth.uid() = owner);

-- Policy for authenticated users to view voice messages in accessible channels (more complex, might require a custom function or view)
-- This would typically involve checking if the user is a member of the channel associated with the message.
-- For simplicity, a basic policy allowing all authenticated users to read all voice messages in the bucket is shown below.
-- You may need to refine this based on your application's specific access control logic.
CREATE POLICY "Allow authenticated read of all voice messages" ON storage.objects FOR SELECT USING (bucket_id = 'voice_messages' AND auth.role() = 'authenticated');

-- Policy for authenticated users to delete their own voice messages
CREATE POLICY "Allow authenticated delete of own voice messages" ON storage.objects FOR DELETE USING (bucket_id = 'voice_messages' AND auth.uid() = owner);
```

**Policy for `file_attachments` bucket (similar to voice messages):**

```sql
-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to upload their own file attachments
CREATE POLICY "Allow authenticated upload of file attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'file_attachments' AND auth.uid() = owner);

-- Policy for authenticated users to view their own file attachments
CREATE POLICY "Allow authenticated read of own file attachments" ON storage.objects FOR SELECT USING (bucket_id = 'file_attachments' AND auth.uid() = owner);

-- Policy for authenticated users to view file attachments in accessible channels
CREATE POLICY "Allow authenticated read of all file attachments" ON storage.objects FOR SELECT USING (bucket_id = 'file_attachments' AND auth.role() = 'authenticated');

-- Policy for authenticated users to delete their own file attachments
CREATE POLICY "Allow authenticated delete of own file attachments" ON storage.objects FOR DELETE USING (bucket_id = 'file_attachments' AND auth.uid() = owner);
```

**Important:** These RLS policies are examples. You should adjust them to precisely match your application's security requirements and access control logic. For instance, you might want to ensure that users can only access files associated with messages in channels they are members of. This would require more complex RLS policies involving joins or custom Supabase functions.
