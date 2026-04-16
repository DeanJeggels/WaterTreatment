-- C1 + H5: Fix broken flowsheets_shared_read RLS policy
--
-- The original policy had a bug: `sl.flowsheet_id = sl.id` (self-reference)
-- instead of `sl.flowsheet_id = flowsheets.id`. This made the shared-page
-- feature non-functional for anon users and introduced a privilege-escalation
-- path where an authenticated user could trigger a global anon read by
-- inserting a share_link with `id = flowsheet_id`.
--
-- Fix approach: drop the broken anon policy on flowsheets entirely, revoke
-- anon SELECT on share_links (prevents token enumeration — H5), and add a
-- SECURITY DEFINER function that returns only the columns the shared page
-- needs, gated by a valid token + is_active + expiry check.

-- 1. Drop the broken policy
DROP POLICY IF EXISTS flowsheets_shared_read ON flowsheets;

-- 2. Revoke anon SELECT on share_links (was allowing token enumeration)
REVOKE SELECT ON TABLE public.share_links FROM anon;

-- 3. Create the safe lookup function
CREATE OR REPLACE FUNCTION public.get_shared_flowsheet(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  graph_data jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f.id, f.name, f.graph_data
  FROM public.share_links sl
  JOIN public.flowsheets f ON f.id = sl.flowsheet_id
  WHERE sl.token = p_token
    AND sl.is_active = true
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  LIMIT 1;
$$;

-- 4. Grant anon EXECUTE on the function (replaces both broken policies)
GRANT EXECUTE ON FUNCTION public.get_shared_flowsheet(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_flowsheet(text) TO authenticated;

-- Note: proposal_data is intentionally excluded from the return — shared
-- views should not expose client PII (designer name, company, etc.).
