-- ============================================================================
-- LanpApp Storage Buckets Migration
-- ============================================================================
-- This migration creates storage buckets for user avatars and game covers
-- with appropriate RLS policies for secure access.
-- ============================================================================

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create avatars bucket for user profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    TRUE,  -- Public bucket - avatars are publicly viewable
    5242880,  -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create game-covers bucket for game cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'game-covers',
    'game-covers',
    TRUE,  -- Public bucket - game covers are publicly viewable
    10485760,  -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

-- Enable RLS on storage.objects (if not already enabled)
-- Note: This should already be enabled by Supabase

-- ----------------------------------------------------------------------------
-- AVATARS BUCKET POLICIES
-- ----------------------------------------------------------------------------

-- Policy: Anyone can view avatars (public bucket)
CREATE POLICY "Avatars are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- Policy: Users can upload their own avatar
-- File path should be: {user_id}/{filename}
CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ----------------------------------------------------------------------------
-- GAME COVERS BUCKET POLICIES
-- ----------------------------------------------------------------------------

-- Policy: Anyone can view game covers (public bucket)
CREATE POLICY "Game covers are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'game-covers');

-- Policy: Authenticated users can upload game covers
-- File path should be: {user_id}/{game_id}/{filename} or {game_id}/{filename}
CREATE POLICY "Authenticated users can upload game covers"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'game-covers'
        AND auth.uid() IS NOT NULL
    );

-- Policy: Users can update game covers they uploaded
-- Check if the user is the creator by verifying the first folder matches their user_id
CREATE POLICY "Users can update game covers they uploaded"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'game-covers'
        AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'game-covers'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can delete game covers they uploaded
CREATE POLICY "Users can delete game covers they uploaded"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'game-covers'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================================================
-- HELPER FUNCTIONS FOR STORAGE
-- ============================================================================

-- Function to get the public URL for an avatar
CREATE OR REPLACE FUNCTION lanpapp.get_avatar_url(user_id UUID, filename TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN 'avatars/' || user_id::text || '/' || filename;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get the public URL for a game cover
CREATE OR REPLACE FUNCTION lanpapp.get_game_cover_url(uploader_id UUID, game_id UUID, filename TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN 'game-covers/' || uploader_id::text || '/' || game_id::text || '/' || filename;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
