-- Migration idempotente : table user_stats (gamification)
-- Exécuter manuellement via psql ou Supabase SQL editor si nécessaire.
-- En production, la table est créée automatiquement au démarrage FastAPI
-- via SQLAlchemy Base.metadata.create_all().

CREATE TABLE IF NOT EXISTS user_stats (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp               INTEGER NOT NULL DEFAULT 0,
    niveau           INTEGER NOT NULL DEFAULT 1,
    streak_jours     INTEGER NOT NULL DEFAULT 0,
    derniere_session DATE,
    badges           JSONB NOT NULL DEFAULT '[]',
    total_sessions   INTEGER NOT NULL DEFAULT 0,
    total_exercices  INTEGER NOT NULL DEFAULT 0,
    total_corrects   INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_stats_updated_at'
    ) THEN
        CREATE TRIGGER update_user_stats_updated_at
            BEFORE UPDATE ON user_stats
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;
