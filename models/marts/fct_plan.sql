-- Budgets (BUD2025, BUD2026) and the October reforecast (FC2026_9+3, open months only), reporting sign.
-- Budgets translate at the budget rate; the reforecast at the latest closed-month rate, the usual practice.
select p.scenario, p.entity_id, p.cost_centre_id, p.account_id, p.product_line_id, p.month_start,
       (-p.amount_lc)::double as amount_lc,
       (-p.amount_lc)::double * case when p.scenario like 'BUD%' then fx.budget_rate_eur else fx.avg_rate_eur end as amount_eur,
       (-p.amount_lc)::double * fx.budget_rate_eur as amount_eur_bud_rate
from {{ ref('stg_plan_lines') }} p
join {{ ref('dim_entity') }} e using (entity_id)
join {{ ref('stg_fx_rates') }} fx on fx.currency = e.currency and fx.month_start = p.month_start
