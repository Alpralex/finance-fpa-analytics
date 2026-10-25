-- Full-year landing for the current year: budget vs the 9+3 forecast vs prior year, by entity and P&L group.
select p.entity_id, a.pnl_group, a.pnl_subtotal, min(a.pnl_line_order) as line_order,
       sum(p.budget_eur) as budget_eur,
       sum(p.forecast_eur) as forecast_eur,
       sum(p.prior_year_eur) as prior_year_eur
from {{ ref('mart_pnl_monthly') }} p
join {{ ref('dim_account') }} a using (account_id)
where p.fiscal_year = {{ var('current_fy') }}
group by all
