-- Units and gross product revenue (account 4000) by scenario, entity, product line and month.
select s.scenario, s.entity_id, s.product_line_id, s.month_start, s.units, s.revenue_lc::double as revenue_lc,
       s.revenue_lc::double * case when s.scenario = 'ACT' then fx.avg_rate_eur
                           when s.scenario like 'BUD%' then fx.budget_rate_eur
                           else fx.avg_rate_eur end as revenue_eur,
       s.revenue_lc::double * fx.budget_rate_eur as revenue_eur_bud_rate
from {{ ref('stg_sales_volume') }} s
join {{ ref('dim_entity') }} e using (entity_id)
join {{ ref('stg_fx_rates') }} fx on fx.currency = e.currency and fx.month_start = s.month_start
