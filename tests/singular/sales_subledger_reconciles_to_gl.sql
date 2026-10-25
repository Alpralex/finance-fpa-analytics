-- The sales sub-ledger must agree with product sales (account 4000) in the GL, per entity and month, to the cent.
with gl as (
    select entity_id, month_start, -sum(amount_lc) as gl_revenue
    from {{ ref('stg_gl_journal_lines') }} where account_id = '4000' group by all
),
sl as (
    select entity_id, month_start, sum(revenue_lc) as sl_revenue
    from {{ ref('stg_sales_volume') }} where scenario = 'ACT' group by all
)
select * from gl full join sl using (entity_id, month_start)
where abs(coalesce(gl_revenue, 0) - coalesce(sl_revenue, 0)) > 0.01
