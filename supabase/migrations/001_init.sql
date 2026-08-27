-- SafeMigrate schema — BUILD-SPEC §5.1
-- Run with: supabase db push  (or paste into the SQL editor)

create table if not exists sessions (
  id uuid primary key,
  created_at timestamptz default now(),
  device_label text
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  doc_type text not null check (doc_type in ('contract','demand_letter','receipt','other')),
  original_filename text,
  created_at timestamptz default now()
);

create table if not exists extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  provider text not null,
  raw_response jsonb not null,
  parsed jsonb not null,
  confidence numeric,
  language_detected text,
  created_at timestamptz default now()
);

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid references extractions(id) on delete cascade,
  findings jsonb not null,
  overall_risk text not null check (overall_risk in ('safe','caution','high','critical')),
  created_at timestamptz default now()
);

create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  analysis_id uuid references analyses(id),
  complainant_name text,
  complainant_phone text,
  complainant_district text,
  agency_name text,
  agency_rl text,
  amount_paid_bdt numeric,
  destination_country text,
  narrative text,
  generated_body text,
  created_at timestamptz default now()
);

create index if not exists documents_session_id_idx on documents(session_id);
create index if not exists extractions_document_id_idx on extractions(document_id);
create index if not exists analyses_extraction_id_idx on analyses(extraction_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — BUILD-SPEC §5.1
--
-- There is no authentication in v1. Session isolation is best-effort: a client
-- presents an opaque session UUID and may only touch rows carrying it. Anyone
-- holding another user's UUID could read their rows.
--
-- This is documented in README.md under "Known limitations". Enabling RLS with
-- deny-by-default still matters: it stops the anon key from reading the whole
-- table, which is the failure that actually leaks contracts.
-- ---------------------------------------------------------------------------

alter table sessions   enable row level security;
alter table documents  enable row level security;
alter table extractions enable row level security;
alter table analyses   enable row level security;
alter table complaints enable row level security;

-- No permissive policies are defined for the anon role. All access goes through
-- server routes using the service-role key, which bypasses RLS. This keeps the
-- browser and the APK unable to query these tables directly at all.
