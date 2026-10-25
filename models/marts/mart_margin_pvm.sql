-- Product gross-margin bridge (sales minus cost of materials), budget to actual, current year to date,
-- per entity and product line. Product lines sell in very different units (a fastener is not a pump), so
-- volume is measured as actual units at budget price, which gives every line a common unit:
--   volume = change in sales at budget prices x the entity's budget average margin rate
--   mix    = the same change valued at each line's own budget margin rate, minus the volume effect
--   price  = actual units x (actual price - budget price)
--   cost   = actual units x (budget unit cost - actual unit cost)
--   fx     = actual margin at the actual rate - actual margin at the budget rate
-- Trading effects are at the budget rate, so the five effects add up exactly to the margin variance.
with s as (
    select scenario, entity_id, product_line_id, sum(units) as units,
           sum(revenue_eur) as rev_eur, sum(revenue_eur_bud_rate) as rev_bud_rate
    from {{ ref('fct_sales_volume') }}
    where year(month_start) = {{ var('current_fy') }} and month_start <= '{{ var("last_closed_month") }}'::date
      and scenario in ('ACT', 'BUD{{ var("current_fy") }}')
    group by all
),
c_act as (
    select entity_id, product_line_id, -sum(amount_eur) as cost_eur, -sum(amount_eur_bud_rate) as cost_bud_rate
    from {{ ref('fct_actuals') }}
    where account_id = '5000' and year(month_start) = {{ var('current_fy') }}
    group by all
),
c_bud as (
    select entity_id, product_line_id, -sum(amount_eur) as cost_eur
    from {{ ref('fct_plan') }}
    where account_id = '5000' and scenario = 'BUD{{ var("current_fy") }}'
      and month_start <= '{{ var("last_closed_month") }}'::date
    group by all
),
l as (
    select a.entity_id, a.product_line_id,
           a.units as act_units, b.units as bud_units,
           b.rev_eur as bud_rev, a.rev_bud_rate as act_rev_bud_rate, a.rev_eur as act_rev,
           cb.cost_eur as bud_cost, ca.cost_bud_rate as act_cost_bud_rate, ca.cost_eur as act_cost,
           b.rev_eur / b.units as bud_price, cb.cost_eur / b.units as bud_unit_cost,
           (b.rev_eur - cb.cost_eur) / b.rev_eur as bud_margin_rate,
           a.units * b.rev_eur / b.units as act_units_at_bud_price
    from s a
    join s b on b.entity_id = a.entity_id and b.product_line_id = a.product_line_id and b.scenario like 'BUD%'
    join c_act ca on ca.entity_id = a.entity_id and ca.product_line_id = a.product_line_id
    join c_bud cb on cb.entity_id = a.entity_id and cb.product_line_id = a.product_line_id
    where a.scenario = 'ACT'
),
e as (
    select *, sum(bud_rev - bud_cost) over (partition by entity_id) / sum(bud_rev) over (partition by entity_id) as ent_margin_rate
    from l
)
select entity_id, product_line_id, act_units, bud_units,
       bud_rev as budget_sales_eur, act_rev as actual_sales_eur,
       bud_rev - bud_cost as budget_margin_eur, act_rev - act_cost as actual_margin_eur,
       act_units_at_bud_price - bud_rev                                   as sales_volume_eur,
       act_rev_bud_rate - act_units_at_bud_price                          as sales_price_eur,
       act_rev - act_rev_bud_rate                                         as sales_fx_eur,
       (act_units_at_bud_price - bud_rev) * ent_margin_rate               as volume_eur,
       (act_units_at_bud_price - bud_rev) * (bud_margin_rate - ent_margin_rate) as mix_eur,
       act_rev_bud_rate - act_units_at_bud_price                          as price_eur,
       act_units * bud_unit_cost - act_cost_bud_rate                      as cost_eur,
       (act_rev - act_cost) - (act_rev_bud_rate - act_cost_bud_rate)      as fx_eur
from e
