-- ============================================================================
-- LanpApp Initial Schema Migration
-- ============================================================================
-- This migration creates the complete database schema for LanpApp
-- including all tables, enums, indexes, and RLS policies.
-- ============================================================================

-- Create the lanpapp schema
CREATE SCHEMA IF NOT EXISTS lanpapp;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Status of a lanpa (LAN party)
CREATE TYPE lanpapp.lanpa_status AS ENUM (
    'draft',           -- Initial state, being set up
    'voting_games',    -- Members voting on games
    'voting_active',   -- Active voting phase
    'in_progress',     -- Event is happening
    'completed'        -- Event has ended
);

-- Status of a member in a lanpa
CREATE TYPE lanpapp.member_status AS ENUM (
    'invited',         -- Invited but hasn't responded
    'confirmed',       -- Confirmed attendance
    'declined',        -- Declined invitation
    'attended'         -- Actually attended the event
);

-- Type of rating between users
CREATE TYPE lanpapp.rating_type AS ENUM (
    'admin_to_member', -- Admin rating a member
    'member_to_admin', -- Member rating the admin
    'member_to_member' -- Members rating each other
);

-- Severity level of punishments
CREATE TYPE lanpapp.punishment_severity AS ENUM (
    'warning',         -- Minor infraction
    'penalty',         -- Moderate infraction
    'suspension'       -- Severe infraction
);

-- Status of punishment nominations
CREATE TYPE lanpapp.nomination_status AS ENUM (
    'pending',         -- Awaiting votes
    'approved',        -- Nomination approved
    'rejected'         -- Nomination rejected
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Users table - extends Supabase auth.users
CREATE TABLE lanpapp.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    locale TEXT DEFAULT 'es',
    notification_preferences JSONB DEFAULT '{"push": true, "email": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lanpapp.users IS 'User profiles extending Supabase auth.users';

-- 2. Lanpas (LAN parties) table
CREATE TABLE lanpapp.lanpas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    admin_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    status lanpapp.lanpa_status DEFAULT 'draft',
    scheduled_date TIMESTAMPTZ,
    actual_date TIMESTAMPTZ,
    is_historical BOOLEAN DEFAULT FALSE,
    selected_game_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lanpapp.lanpas IS 'LAN party events organized by users';

-- 3. Lanpa members junction table
CREATE TABLE lanpapp.lanpa_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lanpa_id UUID NOT NULL REFERENCES lanpapp.lanpas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    status lanpapp.member_status DEFAULT 'invited',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lanpa_id, user_id)
);

COMMENT ON TABLE lanpapp.lanpa_members IS 'Members participating in lanpas';

-- 4. Lanpa invitations with shareable tokens
CREATE TABLE lanpapp.lanpa_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lanpa_id UUID NOT NULL REFERENCES lanpapp.lanpas(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    max_uses INTEGER DEFAULT NULL,
    uses INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lanpapp.lanpa_invitations IS 'Shareable invitation links for lanpas';

-- 5. Games catalog
CREATE TABLE lanpapp.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    genre TEXT,
    min_players INTEGER DEFAULT 1,
    max_players INTEGER,
    created_by UUID REFERENCES lanpapp.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lanpapp.games IS 'Games available for lanpa events';

-- Add foreign key for selected_game_id in lanpas (deferred to avoid circular reference)
ALTER TABLE lanpapp.lanpas
    ADD CONSTRAINT fk_lanpas_selected_game
    FOREIGN KEY (selected_game_id)
    REFERENCES lanpapp.games(id)
    ON DELETE SET NULL;

-- 6. Game suggestions for lanpas
CREATE TABLE lanpapp.game_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lanpa_id UUID NOT NULL REFERENCES lanpapp.lanpas(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES lanpapp.games(id) ON DELETE CASCADE,
    suggested_by UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lanpa_id, game_id)
);

COMMENT ON TABLE lanpapp.game_suggestions IS 'Games suggested for voting in a lanpa';

-- 7. Game votes
CREATE TABLE lanpapp.game_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lanpa_id UUID NOT NULL REFERENCES lanpapp.lanpas(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES lanpapp.games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lanpa_id, user_id)
);

COMMENT ON TABLE lanpapp.game_votes IS 'User votes for games in a lanpa';

-- 8. User-to-user ratings within a lanpa
CREATE TABLE lanpapp.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lanpa_id UUID NOT NULL REFERENCES lanpapp.lanpas(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    rating_type lanpapp.rating_type NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lanpa_id, from_user_id, to_user_id),
    CHECK (from_user_id != to_user_id)
);

COMMENT ON TABLE lanpapp.ratings IS 'Ratings between users after a lanpa event';

-- 9. Lanpa ratings (rating the event itself)
CREATE TABLE lanpapp.lanpa_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lanpa_id UUID NOT NULL REFERENCES lanpapp.lanpas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lanpa_id, user_id)
);

COMMENT ON TABLE lanpapp.lanpa_ratings IS 'Ratings for lanpa events themselves';

-- 10. Punishments catalog
CREATE TABLE lanpapp.punishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    severity lanpapp.punishment_severity NOT NULL,
    point_impact INTEGER DEFAULT 0,
    created_by UUID REFERENCES lanpapp.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lanpapp.punishments IS 'Available punishments for rule violations';

-- 11. Punishment nominations
CREATE TABLE lanpapp.punishment_nominations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lanpa_id UUID NOT NULL REFERENCES lanpapp.lanpas(id) ON DELETE CASCADE,
    punishment_id UUID NOT NULL REFERENCES lanpapp.punishments(id) ON DELETE CASCADE,
    nominated_user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    nominated_by UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    reason TEXT,
    status lanpapp.nomination_status DEFAULT 'pending',
    voting_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (nominated_user_id != nominated_by)
);

COMMENT ON TABLE lanpapp.punishment_nominations IS 'Nominations for applying punishments to users';

-- 12. Punishment votes
CREATE TABLE lanpapp.punishment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomination_id UUID NOT NULL REFERENCES lanpapp.punishment_nominations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    vote BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nomination_id, user_id)
);

COMMENT ON TABLE lanpapp.punishment_votes IS 'Votes on punishment nominations';

-- 13. Applied user punishments
CREATE TABLE lanpapp.user_punishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    punishment_id UUID NOT NULL REFERENCES lanpapp.punishments(id) ON DELETE CASCADE,
    lanpa_id UUID REFERENCES lanpapp.lanpas(id) ON DELETE SET NULL,
    nomination_id UUID REFERENCES lanpapp.punishment_nominations(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

COMMENT ON TABLE lanpapp.user_punishments IS 'Record of punishments applied to users';

-- 14. Notifications
CREATE TABLE lanpapp.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lanpapp.notifications IS 'In-app notifications for users';

-- 15. Push subscriptions for web push notifications
CREATE TABLE lanpapp.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lanpapp.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lanpapp.push_subscriptions IS 'Web push notification subscriptions';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_username ON lanpapp.users(username);

-- Lanpas indexes
CREATE INDEX idx_lanpas_admin_id ON lanpapp.lanpas(admin_id);
CREATE INDEX idx_lanpas_status ON lanpapp.lanpas(status);
CREATE INDEX idx_lanpas_scheduled_date ON lanpapp.lanpas(scheduled_date);
CREATE INDEX idx_lanpas_is_historical ON lanpapp.lanpas(is_historical);

-- Lanpa members indexes
CREATE INDEX idx_lanpa_members_lanpa_id ON lanpapp.lanpa_members(lanpa_id);
CREATE INDEX idx_lanpa_members_user_id ON lanpapp.lanpa_members(user_id);
CREATE INDEX idx_lanpa_members_status ON lanpapp.lanpa_members(status);

-- Lanpa invitations indexes
CREATE INDEX idx_lanpa_invitations_lanpa_id ON lanpapp.lanpa_invitations(lanpa_id);
CREATE INDEX idx_lanpa_invitations_token ON lanpapp.lanpa_invitations(token);
CREATE INDEX idx_lanpa_invitations_expires_at ON lanpapp.lanpa_invitations(expires_at);

-- Games indexes
CREATE INDEX idx_games_name ON lanpapp.games(name);
CREATE INDEX idx_games_genre ON lanpapp.games(genre);
CREATE INDEX idx_games_created_by ON lanpapp.games(created_by);

-- Game suggestions indexes
CREATE INDEX idx_game_suggestions_lanpa_id ON lanpapp.game_suggestions(lanpa_id);
CREATE INDEX idx_game_suggestions_game_id ON lanpapp.game_suggestions(game_id);

-- Game votes indexes
CREATE INDEX idx_game_votes_lanpa_id ON lanpapp.game_votes(lanpa_id);
CREATE INDEX idx_game_votes_game_id ON lanpapp.game_votes(game_id);
CREATE INDEX idx_game_votes_user_id ON lanpapp.game_votes(user_id);

-- Ratings indexes
CREATE INDEX idx_ratings_lanpa_id ON lanpapp.ratings(lanpa_id);
CREATE INDEX idx_ratings_from_user_id ON lanpapp.ratings(from_user_id);
CREATE INDEX idx_ratings_to_user_id ON lanpapp.ratings(to_user_id);

-- Lanpa ratings indexes
CREATE INDEX idx_lanpa_ratings_lanpa_id ON lanpapp.lanpa_ratings(lanpa_id);
CREATE INDEX idx_lanpa_ratings_user_id ON lanpapp.lanpa_ratings(user_id);

-- Punishments indexes
CREATE INDEX idx_punishments_severity ON lanpapp.punishments(severity);
CREATE INDEX idx_punishments_created_by ON lanpapp.punishments(created_by);

-- Punishment nominations indexes
CREATE INDEX idx_punishment_nominations_lanpa_id ON lanpapp.punishment_nominations(lanpa_id);
CREATE INDEX idx_punishment_nominations_nominated_user_id ON lanpapp.punishment_nominations(nominated_user_id);
CREATE INDEX idx_punishment_nominations_status ON lanpapp.punishment_nominations(status);

-- Punishment votes indexes
CREATE INDEX idx_punishment_votes_nomination_id ON lanpapp.punishment_votes(nomination_id);
CREATE INDEX idx_punishment_votes_user_id ON lanpapp.punishment_votes(user_id);

-- User punishments indexes
CREATE INDEX idx_user_punishments_user_id ON lanpapp.user_punishments(user_id);
CREATE INDEX idx_user_punishments_lanpa_id ON lanpapp.user_punishments(lanpa_id);
CREATE INDEX idx_user_punishments_applied_at ON lanpapp.user_punishments(applied_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON lanpapp.notifications(user_id);
CREATE INDEX idx_notifications_read ON lanpapp.notifications(read);
CREATE INDEX idx_notifications_created_at ON lanpapp.notifications(created_at DESC);

-- Push subscriptions indexes
CREATE INDEX idx_push_subscriptions_user_id ON lanpapp.push_subscriptions(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE lanpapp.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.lanpas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.lanpa_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.lanpa_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.game_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.game_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.lanpa_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.punishment_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.punishment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.user_punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lanpapp.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Helper function to check if user is a member of a lanpa
CREATE OR REPLACE FUNCTION lanpapp.is_lanpa_member(lanpa_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM lanpapp.lanpa_members
        WHERE lanpa_members.lanpa_id = is_lanpa_member.lanpa_id
        AND lanpa_members.user_id = is_lanpa_member.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin of a lanpa
CREATE OR REPLACE FUNCTION lanpapp.is_lanpa_admin(lanpa_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM lanpapp.lanpas
        WHERE lanpas.id = is_lanpa_admin.lanpa_id
        AND lanpas.admin_id = is_lanpa_admin.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users can view all profiles"
    ON lanpapp.users FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can insert own profile"
    ON lanpapp.users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON lanpapp.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Lanpas policies
CREATE POLICY "Users can view lanpas they are member of or admin"
    ON lanpapp.lanpas FOR SELECT
    USING (
        admin_id = auth.uid()
        OR lanpapp.is_lanpa_member(id, auth.uid())
    );

CREATE POLICY "Users can create lanpas"
    ON lanpapp.lanpas FOR INSERT
    WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can update their lanpas"
    ON lanpapp.lanpas FOR UPDATE
    USING (admin_id = auth.uid())
    WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can delete their lanpas"
    ON lanpapp.lanpas FOR DELETE
    USING (admin_id = auth.uid());

-- Lanpa members policies
CREATE POLICY "Members can view other members in same lanpa"
    ON lanpapp.lanpa_members FOR SELECT
    USING (
        lanpapp.is_lanpa_member(lanpa_id, auth.uid())
        OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

CREATE POLICY "Admins can add members"
    ON lanpapp.lanpa_members FOR INSERT
    WITH CHECK (lanpapp.is_lanpa_admin(lanpa_id, auth.uid()));

CREATE POLICY "Admins can update member status"
    ON lanpapp.lanpa_members FOR UPDATE
    USING (lanpapp.is_lanpa_admin(lanpa_id, auth.uid()));

CREATE POLICY "Users can update own membership status"
    ON lanpapp.lanpa_members FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can remove members"
    ON lanpapp.lanpa_members FOR DELETE
    USING (lanpapp.is_lanpa_admin(lanpa_id, auth.uid()));

CREATE POLICY "Users can leave lanpa"
    ON lanpapp.lanpa_members FOR DELETE
    USING (user_id = auth.uid());

-- Lanpa invitations policies
CREATE POLICY "Anyone can view invitations by token"
    ON lanpapp.lanpa_invitations FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins can create invitations"
    ON lanpapp.lanpa_invitations FOR INSERT
    WITH CHECK (lanpapp.is_lanpa_admin(lanpa_id, auth.uid()));

CREATE POLICY "Admins can delete invitations"
    ON lanpapp.lanpa_invitations FOR DELETE
    USING (lanpapp.is_lanpa_admin(lanpa_id, auth.uid()));

CREATE POLICY "Anyone can use invitation (increment uses)"
    ON lanpapp.lanpa_invitations FOR UPDATE
    USING (TRUE)
    WITH CHECK (TRUE);

-- Games policies
CREATE POLICY "Anyone can view games"
    ON lanpapp.games FOR SELECT
    USING (TRUE);

CREATE POLICY "Authenticated users can create games"
    ON lanpapp.games FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update their games"
    ON lanpapp.games FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Game suggestions policies
CREATE POLICY "Members can view suggestions in their lanpas"
    ON lanpapp.game_suggestions FOR SELECT
    USING (
        lanpapp.is_lanpa_member(lanpa_id, auth.uid())
        OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

CREATE POLICY "Members can suggest games"
    ON lanpapp.game_suggestions FOR INSERT
    WITH CHECK (
        suggested_by = auth.uid()
        AND (
            lanpapp.is_lanpa_member(lanpa_id, auth.uid())
            OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
        )
    );

CREATE POLICY "Admins can remove suggestions"
    ON lanpapp.game_suggestions FOR DELETE
    USING (lanpapp.is_lanpa_admin(lanpa_id, auth.uid()));

-- Game votes policies
CREATE POLICY "Members can view votes in their lanpas"
    ON lanpapp.game_votes FOR SELECT
    USING (
        lanpapp.is_lanpa_member(lanpa_id, auth.uid())
        OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

CREATE POLICY "Members can vote"
    ON lanpapp.game_votes FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            lanpapp.is_lanpa_member(lanpa_id, auth.uid())
            OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
        )
    );

CREATE POLICY "Users can change their vote"
    ON lanpapp.game_votes FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their vote"
    ON lanpapp.game_votes FOR DELETE
    USING (user_id = auth.uid());

-- Ratings policies
CREATE POLICY "Members can view ratings in their lanpas"
    ON lanpapp.ratings FOR SELECT
    USING (
        lanpapp.is_lanpa_member(lanpa_id, auth.uid())
        OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

CREATE POLICY "Members can rate other members"
    ON lanpapp.ratings FOR INSERT
    WITH CHECK (
        from_user_id = auth.uid()
        AND (
            lanpapp.is_lanpa_member(lanpa_id, auth.uid())
            OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
        )
    );

CREATE POLICY "Users can update their ratings"
    ON lanpapp.ratings FOR UPDATE
    USING (from_user_id = auth.uid())
    WITH CHECK (from_user_id = auth.uid());

-- Lanpa ratings policies
CREATE POLICY "Members can view lanpa ratings"
    ON lanpapp.lanpa_ratings FOR SELECT
    USING (
        lanpapp.is_lanpa_member(lanpa_id, auth.uid())
        OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

CREATE POLICY "Members can rate lanpas"
    ON lanpapp.lanpa_ratings FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            lanpapp.is_lanpa_member(lanpa_id, auth.uid())
            OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
        )
    );

CREATE POLICY "Users can update their lanpa ratings"
    ON lanpapp.lanpa_ratings FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Punishments policies
CREATE POLICY "Anyone can view punishments"
    ON lanpapp.punishments FOR SELECT
    USING (TRUE);

CREATE POLICY "Authenticated users can create punishments"
    ON lanpapp.punishments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Creators can update punishments"
    ON lanpapp.punishments FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Punishment nominations policies
CREATE POLICY "Members can view nominations in their lanpas"
    ON lanpapp.punishment_nominations FOR SELECT
    USING (
        lanpapp.is_lanpa_member(lanpa_id, auth.uid())
        OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

CREATE POLICY "Members can create nominations"
    ON lanpapp.punishment_nominations FOR INSERT
    WITH CHECK (
        nominated_by = auth.uid()
        AND (
            lanpapp.is_lanpa_member(lanpa_id, auth.uid())
            OR lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
        )
    );

CREATE POLICY "Admins can update nomination status"
    ON lanpapp.punishment_nominations FOR UPDATE
    USING (lanpapp.is_lanpa_admin(lanpa_id, auth.uid()));

-- Punishment votes policies
CREATE POLICY "Members can view votes"
    ON lanpapp.punishment_votes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM lanpapp.punishment_nominations pn
            WHERE pn.id = nomination_id
            AND (
                lanpapp.is_lanpa_member(pn.lanpa_id, auth.uid())
                OR lanpapp.is_lanpa_admin(pn.lanpa_id, auth.uid())
            )
        )
    );

CREATE POLICY "Members can vote on nominations"
    ON lanpapp.punishment_votes FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM lanpapp.punishment_nominations pn
            WHERE pn.id = nomination_id
            AND (
                lanpapp.is_lanpa_member(pn.lanpa_id, auth.uid())
                OR lanpapp.is_lanpa_admin(pn.lanpa_id, auth.uid())
            )
        )
    );

-- User punishments policies
CREATE POLICY "Users can view their own punishments"
    ON lanpapp.user_punishments FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view punishments in their lanpas"
    ON lanpapp.user_punishments FOR SELECT
    USING (
        lanpa_id IS NOT NULL
        AND lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

CREATE POLICY "Admins can apply punishments"
    ON lanpapp.user_punishments FOR INSERT
    WITH CHECK (
        lanpa_id IS NOT NULL
        AND lanpapp.is_lanpa_admin(lanpa_id, auth.uid())
    );

-- Notifications policies
CREATE POLICY "Users can view their notifications"
    ON lanpapp.notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
    ON lanpapp.notifications FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Users can update their notifications (mark as read)"
    ON lanpapp.notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their notifications"
    ON lanpapp.notifications FOR DELETE
    USING (user_id = auth.uid());

-- Push subscriptions policies
CREATE POLICY "Users can view their subscriptions"
    ON lanpapp.push_subscriptions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their subscriptions"
    ON lanpapp.push_subscriptions FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their subscriptions"
    ON lanpapp.push_subscriptions FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION lanpapp.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON lanpapp.users
    FOR EACH ROW
    EXECUTE FUNCTION lanpapp.update_updated_at_column();

CREATE TRIGGER update_lanpas_updated_at
    BEFORE UPDATE ON lanpapp.lanpas
    FOR EACH ROW
    EXECUTE FUNCTION lanpapp.update_updated_at_column();

CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON lanpapp.games
    FOR EACH ROW
    EXECUTE FUNCTION lanpapp.update_updated_at_column();

CREATE TRIGGER update_punishments_updated_at
    BEFORE UPDATE ON lanpapp.punishments
    FOR EACH ROW
    EXECUTE FUNCTION lanpapp.update_updated_at_column();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
