// Normalized relational schema for Explore Rwanda (SQLite).
export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'traveler' CHECK (role IN ('traveler','organizer','admin')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0,
  preferred_language TEXT NOT NULL DEFAULT 'rw' CHECK (preferred_language IN ('rw','en')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS organizer_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_name TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  experience TEXT NOT NULL,
  location TEXT NOT NULL,
  supporting_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  review_note TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apps_status ON organizer_applications(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_apps_one_pending ON organizer_applications(user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS organizers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER REFERENCES organizer_applications(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  location TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_rw TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  description_rw TEXT NOT NULL,
  description_en TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  image_path TEXT,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS destination_categories (
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (destination_id, category_id)
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image TEXT,
  starting_location TEXT NOT NULL,
  meeting_point TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  trip_date TEXT NOT NULL,            -- YYYY-MM-DD (Africa/Kigali)
  start_time TEXT NOT NULL,           -- HH:MM
  duration_hours REAL,
  price INTEGER NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'RWF',
  included_services TEXT NOT NULL DEFAULT '[]',   -- JSON array
  excluded_services TEXT NOT NULL DEFAULT '[]',   -- JSON array
  transport_info TEXT,
  food_info TEXT,
  bring_items TEXT,
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','moderate','challenging')),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  registration_deadline TEXT NOT NULL, -- YYYY-MM-DDTHH:MM (Africa/Kigali)
  cancellation_policy TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','fully_booked','registration_closed','cancelled','completed')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_org ON trips(organizer_id);
CREATE INDEX IF NOT EXISTS idx_trips_dest ON trips(destination_id);
CREATE INDEX IF NOT EXISTS idx_trips_cat ON trips(category_id);

CREATE TABLE IF NOT EXISTS trip_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seats INTEGER NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 10),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','waitlisted')),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_active ON registrations(trip_id, user_id)
  WHERE status IN ('pending','approved','waitlisted');
CREATE INDEX IF NOT EXISTS idx_reg_trip ON registrations(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);

CREATE TABLE IF NOT EXISTS saved_trips (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, trip_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',   -- JSON params, translated on the client
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS support_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  admin_reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('review','trip','organizer')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cost_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  destination_id INTEGER REFERENCES destinations(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('package','transport','entry_fee','food','accommodation','activity','other')),
  label TEXT,
  amount INTEGER CHECK (amount IS NULL OR amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RWF',
  source_type TEXT NOT NULL CHECK (source_type IN ('organizer','official','community','system_estimate','unknown')),
  source_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (trip_id IS NOT NULL OR destination_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_cost_trip ON cost_records(trip_id);
CREATE INDEX IF NOT EXISTS idx_cost_dest ON cost_records(destination_id);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_rw TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_rw TEXT NOT NULL,
  body_en TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
