-- Redevelopment Phase 1: retain quotation history and workflow code, but stop
-- unauthenticated visitors from inserting new public quotation requests.
-- The application-level PUBLIC_WEBSITE_ENABLED switch gates the old routes;
-- this closes the corresponding anonymous write APIs as well.
revoke execute on function
  public.submit_quotation(text,text,text,text,uuid,uuid,numeric,uuid,text,public.quotation_source,text),
  public.submit_quotation_request(text,text,text,text,jsonb,uuid,text,text)
from anon;
