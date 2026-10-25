-- EBITDA bridge, budget to actual, year to date, per entity. Trading effects at the budget rate, then FX.
-- Product margin (sales minus materials) is split into volume, mix, price and unit cost from mart_margin_pvm.
with v as (
    select p.entity_id, a.pnl_group, a.account_id,
           sum(p.budget_eur) as bud, sum(p.actual_eur_bud_rate) as act_bud_rate, sum(p.actual_eur) as act
    from {{ ref('mart_pnl_monthly') }} p
    join {{ ref('dim_account') }} a using (account_id)
    where p.fiscal_year = {{ var('current_fy') }} and p.is_closed and a.pnl_subtotal in ('Gross margin', 'EBITDA')
    group by all
),
pvm as (
    select entity_id, sum(volume_eur) as volume, sum(mix_eur) as mix, sum(price_eur) as price, sum(cost_eur) as unit_cost
    from {{ ref('mart_margin_pvm') }} group by all
),
steps as (
    select entity_id, 1 as step_order, 'Budget EBITDA' as step, sum(bud) as amount_eur from v group by all
    union all select entity_id, 2, 'Sales volume', volume from pvm
    union all select entity_id, 3, 'Sales mix', mix from pvm
    union all select entity_id, 4, 'Sales price', price from pvm
    union all select entity_id, 5, 'Services and discounts', sum(act_bud_rate - bud) from v where account_id in ('4100', '4900') group by all
    union all select entity_id, 6, 'Unit cost', unit_cost from pvm
    union all select entity_id, 7, 'Freight', sum(act_bud_rate - bud) from v where account_id in ('5100', '5200') group by all
    union all select entity_id, 8, 'People', sum(act_bud_rate - bud) from v where pnl_group = 'People' group by all
    union all select entity_id, 9, 'Other opex', sum(act_bud_rate - bud) from v where pnl_group in ('Facilities', 'IT', 'Commercial', 'General and admin') group by all
    union all select entity_id, 10, 'FX translation', sum(act - act_bud_rate) from v group by all
    union all select entity_id, 11, 'Actual EBITDA', sum(act) from v group by all
)
select entity_id, step_order, step, amount_eur from steps
