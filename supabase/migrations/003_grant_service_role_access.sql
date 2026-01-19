-- ============================================================================
-- Grant Service Role Access to lanpapp Schema
-- ============================================================================
-- The service role needs explicit grants to access custom schemas

-- Grant usage on the lanpapp schema
GRANT USAGE ON SCHEMA lanpapp TO service_role;
GRANT USAGE ON SCHEMA lanpapp TO authenticated;
GRANT USAGE ON SCHEMA lanpapp TO anon;

-- Grant all privileges on all tables in lanpapp schema to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA lanpapp TO service_role;

-- Grant all privileges on all sequences in lanpapp schema to service_role
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA lanpapp TO service_role;

-- Grant select, insert, update, delete on all tables to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lanpapp TO authenticated;

-- Grant select on all tables to anon users (for public viewing)
GRANT SELECT ON ALL TABLES IN SCHEMA lanpapp TO anon;

-- Ensure future tables also get these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA lanpapp GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lanpapp GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lanpapp GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA lanpapp GRANT SELECT ON TABLES TO anon;
