-- The DPOLens Cloud waitlist: one row for each email address, kept until Cloud opens or is
-- dropped, and deleted sooner when its owner asks.
CREATE TABLE waitlist (
  email TEXT PRIMARY KEY,
  use_for TEXT,
  joined_at TEXT NOT NULL
) STRICT;
