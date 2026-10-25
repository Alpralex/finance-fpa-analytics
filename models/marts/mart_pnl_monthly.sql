-- Management P&L by entity, account and month with actual, budget, latest forecast and prior year side by side.
-- forecast_eur = actual for closed months + reforecast for open months (the "9+3" view).
with act as (
    select entity_id, account_id, month_start, sum(amount_eur) as actual_eur, sum(amount_eur_bud_rate) as actual_eur_bud_rate
    from {{ ref('fct_actuals') }} group by all
),
bud as (
    select entity_id, account_id, month_start, sum(amount_eur) as budget_eur
    from {{ ref('fct_plan') }} where scenario like 'BUD%' group by all
),
fc as (
    select entity_id, account_id, month_start, sum(amount_eur) as reforecast_eur
    from {{ ref('fct_plan') }} where scenario = 'FC2026_9+3' group by all
),
grid as (
    select e.entity_id, a.account_id, m.month_start, m.fiscal_year, m.is_closed
    from {{ ref('dim_entity') }} e cross join {{ ref('dim_account') }} a cross join {{ ref('dim_month') }} m
)
select g.entity_id, g.account_id, g.month_start, g.fiscal_year, g.is_closed,
       act.actual_eur, act.actual_eur_bud_rate, bud.budget_eur,
       case when g.is_closed then act.actual_eur else fc.reforecast_eur end as forecast_eur,
       py.actual_eur as prior_year_eur
from grid g
left join act using (entity_id, account_id, month_start)
left join bud using (entity_id, account_id, month_start)
left join fc using (entity_id, account_id, month_start)
left join act py on py.entity_id = g.entity_id and py.account_id = g.account_id
                and py.month_start = g.month_start - interval 1 year
where act.actual_eur is not null or bud.budget_eur is not null or fc.reforecast_eur is not null
