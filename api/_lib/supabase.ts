import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Admin client with service role key (bypasses RLS)
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create a client for a specific user (respects RLS)
export const createUserClient = (accessToken: string): SupabaseClient => {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Schema helper - always use lanpapp schema
export const db = (): ReturnType<SupabaseClient['schema']> => supabaseAdmin.schema('lanpapp');

// Storage bucket names
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  GAME_COVERS: 'game-covers',
} as const;

// Helper to get public URL for storage items
export const getPublicUrl = (bucket: string, path: string): string => {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};
