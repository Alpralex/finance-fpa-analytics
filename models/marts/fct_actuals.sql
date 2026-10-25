-- Closed-month actuals at entity x cost centre x account x product line x month.
-- Reporting sign: revenue positive, costs negative, so any subtotal is a plain sum.
-- Translated at the monthly average rate (amount_eur) and at the budget rate of the year (amount_eur_bud_rate),
-- so the difference between the two is the FX translation effect.
with gl as (
    select g.entity_id, g.cost_centre_id, g.account_id, g.product_line_id, g.month_start,
           (-sum(g.amount_lc))::double as amount_lc
    from {{ ref('stg_gl_journal_lines') }} g
    join {{ ref('dim_account') }} a using (account_id)
    group by all
)
select gl.*,
       gl.amount_lc * fx.avg_rate_eur    as amount_eur,
       gl.amount_lc * fx.budget_rate_eur as amount_eur_bud_rate
from gl
join {{ ref('dim_entity') }} e using (entity_id)
join {{ ref('stg_fx_rates') }} fx on fx.currency = e.currency and fx.month_start = gl.month_start
