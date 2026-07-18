-- Project 318 CRM identity migration tests
-- Run only in a disposable Supabase test database after customer-crm.sql.
-- The transaction rolls back every fixture and assertion-side mutation.

begin;

do $$
declare
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_digits text := lpad((floor(random() * 1000000))::bigint::text, 6, '0');
  v_email_a text;
  v_email_b text;
  v_phone_a text;
  v_phone_b text;
  v_company_a text;
  v_company_b text;
  v_a uuid;
  v_b uuid;
  v_result uuid;
  v_new uuid;
  v_customer_count bigint;
  v_quote_count bigint;
  v_a_before jsonb;
  v_b_before jsonb;
begin
  v_email_a := 'crm-a-' || v_suffix || '@example.invalid';
  v_email_b := 'crm-b-' || v_suffix || '@example.invalid';
  v_phone_a := '31855' || v_digits;
  v_phone_b := '31866' || v_digits;
  v_company_a := 'CRM Company A ' || v_suffix;
  v_company_b := 'CRM Company B ' || v_suffix;

  insert into public.customers(first_name, last_name, company, email, phone)
  values ('Identity', 'Alpha', v_company_a, v_email_a, v_phone_a)
  returning id into v_a;

  insert into public.customers(first_name, last_name, company, email, phone)
  values ('Identity', 'Beta', v_company_b, v_email_b, v_phone_b)
  returning id into v_b;

  -- Email and phone both identify the same customer.
  v_result := public.crm_find_or_create_customer_internal(
    'Identity', 'Alpha', v_company_a, v_email_a, v_phone_a, '', ''
  );
  if v_result <> v_a then raise exception 'same-customer identity assertion failed'; end if;

  -- One identifier matches; all other supplied identifiers are currently unused.
  v_result := public.crm_find_or_create_customer_internal(
    'Unused', 'Person', 'Unused ' || v_suffix, v_email_a, '31877' || v_digits, '', ''
  );
  if v_result <> v_a then raise exception 'single-match identity assertion failed'; end if;

  -- No identifier matches, so exactly one new customer is created.
  v_new := public.crm_find_or_create_customer_internal(
    'Brand', 'New', 'New ' || v_suffix,
    'crm-new-' || v_suffix || '@example.invalid', '31888' || v_digits, '', ''
  );
  if v_new is null or v_new in (v_a, v_b) then
    raise exception 'no-match creation assertion failed';
  end if;

  -- Email identifies A while phone identifies B.
  begin
    perform public.crm_find_or_create_customer_internal(
      'Conflict', 'Phone', '', v_email_a, v_phone_b, '', ''
    );
    raise exception 'email/phone conflict was not rejected';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'Customer identity conflict:%' then raise; end if;
  end;

  -- Name/company identifies B while email identifies A.
  begin
    perform public.crm_find_or_create_customer_internal(
      'Identity', 'Beta', v_company_b, v_email_a, '', '', ''
    );
    raise exception 'email/name-company conflict was not rejected';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'Customer identity conflict:%' then raise; end if;
  end;

  select count(*) into v_customer_count from public.customers;
  select count(*) into v_quote_count from public.leads;
  select to_jsonb(c) into v_a_before from public.customers c where c.id = v_a;
  select to_jsonb(c) into v_b_before from public.customers c where c.id = v_b;

  -- The anonymous-facing RPC returns only a generic conflict and its exception
  -- subtransaction leaves quotes and customers unchanged.
  begin
    perform public.submit_quote_with_customer(
      'Anonymous Conflict', '', v_email_a, v_phone_b, current_date, 25,
      'Taco Bar', 'Corporate', 500, 'Identity conflict test'
    );
    raise exception 'anonymous conflict submission was not rejected';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Unable to submit quote with the supplied contact information' then raise; end if;
  end;

  if (select count(*) from public.customers) <> v_customer_count then
    raise exception 'anonymous conflict mutated customers';
  end if;
  if (select count(*) from public.leads) <> v_quote_count then
    raise exception 'anonymous conflict inserted a quote';
  end if;
  if (select to_jsonb(c) from public.customers c where c.id = v_a) <> v_a_before
     or (select to_jsonb(c) from public.customers c where c.id = v_b) <> v_b_before then
    raise exception 'anonymous conflict modified an existing customer';
  end if;
end;
$$;

rollback;
