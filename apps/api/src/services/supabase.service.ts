import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Admin client with service role key (bypasses RLS)
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create a client for a specific user (respects RLS)
export const createUserClient = (accessToken: string): SupabaseClient => {
  return createClient(config.supabase.url, config.supabase.anonKey, {
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
