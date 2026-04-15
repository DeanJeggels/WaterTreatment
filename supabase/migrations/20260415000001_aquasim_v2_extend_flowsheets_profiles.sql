-- AquaSim v2 — Migration 1: Extend flowsheets + profiles for proposal generation
--
-- Adds:
--   flowsheets.proposal_data  — client, designer, exec summary, design basis, disclaimer
--   profiles.company_logo_url — shown in proposal header
--   profiles.designer_title   — e.g. "Pr.Eng, Process Engineer"
--
-- Does NOT add company_name — the existing profiles.company column is reused.
--
-- Idempotent: uses IF NOT EXISTS where possible.

-- ---------- flowsheets ----------
ALTER TABLE public.flowsheets
  ADD COLUMN IF NOT EXISTS proposal_data jsonb;

COMMENT ON COLUMN public.flowsheets.proposal_data IS
'AquaSim v2 proposal metadata: { client: {name, project_code, location}, designer: {name, title, date}, executive_summary, design_basis, disclaimer }';

-- ---------- profiles ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_logo_url text;

COMMENT ON COLUMN public.profiles.company_logo_url IS
'URL to the company logo rendered in the proposal cover page';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS designer_title text;

COMMENT ON COLUMN public.profiles.designer_title IS
'Professional title shown in the proposal designer block, e.g. "Pr.Eng, Process Engineer"';
