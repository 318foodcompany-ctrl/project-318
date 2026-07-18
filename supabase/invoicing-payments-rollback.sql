-- Non-destructive feature-disable rollback for Project 318 invoicing.
-- Accounting tables and records are intentionally preserved.
begin;

revoke execute on function public.invoicing_create_invoice(uuid,bigint,bigint,date,numeric,numeric,numeric,text,text,text,jsonb) from authenticated;
revoke execute on function public.invoicing_update_draft(uuid,integer,date,numeric,numeric,numeric,text,text,text,jsonb) from authenticated;
revoke execute on function public.invoicing_issue_invoice(uuid,date,date) from authenticated;
revoke execute on function public.invoicing_void_invoice(uuid,text) from authenticated;
revoke execute on function public.invoicing_record_payment(uuid,numeric,date,text,text,text,text) from authenticated;
revoke execute on function public.invoicing_reverse_payment(uuid,text) from authenticated;
revoke execute on function public.invoicing_dashboard(text,text,boolean,text,integer,integer) from authenticated;
revoke execute on function public.invoicing_customer_summary(uuid) from authenticated;
revoke execute on function public.invoicing_summary() from authenticated;

drop policy if exists "Invoice administrators can read invoices" on public.invoices;
drop policy if exists "Invoice administrators can read line items" on public.invoice_line_items;
drop policy if exists "Invoice administrators can read payments" on public.payments;

revoke all on public.invoice_number_sequences,public.invoices,public.invoice_line_items,public.payments from anon,authenticated;

commit;
