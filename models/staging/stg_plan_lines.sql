-- Budgets and reforecast at entity x cost centre x account x month, local currency, GL sign (debit +).
select
    scenario,
    entity_id,
    cost_centre_id,
    account_id::varchar                 as account_id,
    nullif(product_line_id, '')         as product_line_id,
    month_start::date                   as month_start,
    amount_lc::decimal(18, 2)           as amount_lc
from read_csv('{{ var("raw_path") }}/plan_lines.csv', header = true, all_varchar = true)
