-- Item #3: Create Scoped Public/Application Database Role (Least Privilege, Non-Superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eue_app_public') THEN
    CREATE ROLE eue_app_public LOGIN PASSWORD 'change_in_production_env';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE eue_schedule_db TO eue_app_public;
GRANT USAGE ON SCHEMA public TO eue_app_public;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eue_app_public;

-- Item #4: Enable Row-Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Schedules RLS Policy: Users can only modify their own schedules, and only read schedules of accepted friends
CREATE POLICY schedules_owner_all ON schedules
    FOR ALL
    TO eue_app_public
    USING (user_id = current_setting('app.current_user_id', true));

-- Friend Requests RLS Policy: Users can only view or modify requests where they are sender or receiver
CREATE POLICY friend_requests_participant ON friend_requests
    FOR ALL
    TO eue_app_public
    USING (
        sender_id = current_setting('app.current_user_id', true)
        OR receiver_id = current_setting('app.current_user_id', true)
    );
