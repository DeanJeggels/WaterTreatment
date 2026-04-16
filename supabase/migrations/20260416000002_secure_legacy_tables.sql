-- C2: Secure legacy IoT tables that share this Supabase project
--
-- Two hex-named tables (air-quality sensor data from a separate IoT project)
-- exist in the public schema with RLS disabled. Any authenticated AquaSim
-- user can read them via PostgREST.
--
-- We can't DROP them without coordinating with the IoT project owner, so
-- we enable RLS with a blanket deny. This blocks all PostgREST access
-- while leaving the tables intact for the service_role to manage.

ALTER TABLE IF EXISTS public."644D3C43CA48" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."10933C43CA48" ENABLE ROW LEVEL SECURITY;

-- No policies = all queries denied for anon + authenticated.
-- Service_role bypasses RLS and can still read/write.

-- Note for the AquaSim operator:
-- The fdr_handle_new_user trigger on auth.users also creates rows in
-- public.fdr_profiles for every AquaSim signup. This is a cross-purpose
-- processing issue under POPI §15. To fix: DROP TRIGGER fdr_handle_new_user
-- ON auth.users — but coordinate with the FDR app owner first. That fix
-- is outside AquaSim's migration scope and is flagged as a manual follow-up.
