-- CongressTracker schema
-- Run this entire file in the Supabase SQL editor before writing any app code.

-- Members of Congress
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,                    -- bioguide ID (e.g. P000197)
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  party TEXT,                             -- full party name
  party_code TEXT CHECK (party_code IN ('D', 'R', 'I')),
  chamber TEXT CHECK (chamber IN ('House', 'Senate')),
  state TEXT,
  district TEXT,                          -- NULL for senators
  photo_url TEXT,
  years_served INTEGER DEFAULT 0,
  contact_url TEXT,
  -- Cached stats derived from Congress.gov votes
  attendance_pct FLOAT,
  party_loyalty_pct FLOAT,
  total_votes INTEGER,
  bills_sponsored INTEGER,
  -- Full-text search
  search_vector tsvector,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS members_search_idx ON members USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS members_state_chamber_idx ON members(state, chamber);

-- Auto-update search vector
CREATE OR REPLACE FUNCTION update_member_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.full_name, '') || ' ' || COALESCE(NEW.state, '') || ' ' || COALESCE(NEW.party_code, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS member_search_vector_trigger ON members;
CREATE TRIGGER member_search_vector_trigger
BEFORE INSERT OR UPDATE ON members
FOR EACH ROW EXECUTE FUNCTION update_member_search_vector();

-- Votes cast by each member
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  vote_date DATE NOT NULL,
  bill_id TEXT,
  bill_title_raw TEXT,
  bill_title_plain TEXT NOT NULL DEFAULT '',
  bill_category TEXT DEFAULT 'Other',
  vote_position TEXT CHECK (vote_position IN ('Yes', 'No', 'Not Voting', 'Present')),
  voted_with_party BOOLEAN,
  congress INTEGER,
  session INTEGER,
  roll_call INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, congress, session, roll_call)
);

CREATE INDEX IF NOT EXISTS votes_member_date_idx ON votes(member_id, vote_date DESC);
CREATE INDEX IF NOT EXISTS votes_member_category_idx ON votes(member_id, bill_category);
-- Global vote_date index for the homepage "recent activity" feed
CREATE INDEX IF NOT EXISTS votes_vote_date_idx ON votes(vote_date DESC);

-- Bills sponsored or cosponsored by each member
CREATE TABLE IF NOT EXISTS bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  bill_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  introduced_date DATE,
  status TEXT DEFAULT 'Introduced',
  became_law BOOLEAN DEFAULT FALSE,
  role TEXT CHECK (role IN ('sponsor', 'cosponsor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, bill_id, role)
);

CREATE INDEX IF NOT EXISTS bills_member_idx ON bills(member_id);
CREATE INDEX IF NOT EXISTS bills_member_status_idx ON bills(member_id, status);

-- Zip code → representative IDs cache
CREATE TABLE IF NOT EXISTS zip_reps (
  zip_code TEXT PRIMARY KEY,
  member_ids TEXT[] NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache log: tracks when each resource was last fetched
CREATE TABLE IF NOT EXISTS cache_log (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (resource_type, resource_id)
);

-- Row Level Security
-- Browser clients can read public congressional data, but writes stay server-only
-- through SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read members" ON members;
CREATE POLICY "Public read members"
ON members FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public read votes" ON votes;
CREATE POLICY "Public read votes"
ON votes FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public read bills" ON bills;
CREATE POLICY "Public read bills"
ON bills FOR SELECT
TO anon, authenticated
USING (true);

-- Invalidates stale cache entries so they get re-fetched on next request
CREATE OR REPLACE FUNCTION invalidate_stale_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache_log
  WHERE (resource_type IN ('member', 'votes') AND fetched_at < NOW() - INTERVAL '24 hours')
     OR (resource_type = 'bills'             AND fetched_at < NOW() - INTERVAL '48 hours')
     OR (resource_type = 'zip_reps'          AND fetched_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;
