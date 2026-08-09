-- Project 318 Release 5: seed the Business Brain with verified public website facts.
-- This does not overwrite owner-customized values on rerun.
begin;

do $$
begin
  if to_regclass('public.marketing_ai_brand_brain') is null then
    raise exception 'Release 5 AI Marketing Autopilot is required';
  end if;
end $$;

update public.marketing_ai_brand_brain
set business_facts = jsonb_build_object(
      'business_name','318 Food Co.',
      'business_type','Catering company',
      'primary_service','Event catering',
      'service_areas',jsonb_build_array('Shreveport','Bossier City','Northwest Louisiana'),
      'cuisine_categories',jsonb_build_array('American','Pizza','Barbecue','Mexican','Italian'),
      'public_site','https://www.318foodco.com',
      'primary_conversion','Request a catering quote'
    ),
    voice_preferences = jsonb_build_object(
      'objective','Drive qualified, profitable catering demand while remaining useful, truthful, local, and specific.',
      'style','Clear, confident, appetizing, helpful, conversational-professional.',
      'avoid',jsonb_build_array('generic hype','fabricated urgency','unsupported superlatives','spammy keyword stuffing','invented pricing or availability'),
      'local_relevance','Use Shreveport, Bossier City, and Northwest Louisiana naturally when relevant; never force location keywords.'
    ),
    seasonal_rules = jsonb_build_object(
      'strategy','Anticipate real catering occasions early enough for customers to plan; create drafts rather than inventing promotions.',
      'promotion_rule','Never invent a discount, price, deadline, availability promise, or menu item. Recommend an offer for owner approval when evidence supports one.'
    ),
    updated_at=now()
where id=1
  and business_facts='{}'::jsonb
  and voice_preferences='{}'::jsonb
  and seasonal_rules='{}'::jsonb;

commit;
