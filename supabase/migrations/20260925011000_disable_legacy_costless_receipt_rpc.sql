-- A receipt must now include actual unit costs, receipt date, and any explicit
-- selling-price changes in the single atomic post_goods_receipt RPC.
revoke all on function public.receive_purchase(uuid,uuid,text,text,jsonb)
  from public, anon, authenticated;

grant execute on function public.post_goods_receipt(uuid,uuid,text,text,date,jsonb,jsonb)
  to authenticated;
