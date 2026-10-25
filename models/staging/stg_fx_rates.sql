-- Monthly average and budget rates, expressed as EUR per one unit of the currency.
select
    currency,
    month_start::date                   as month_start,
    avg_rate_eur::double                as avg_rate_eur,
    budget_rate_eur::double             as budget_rate_eur,
    is_closed::integer = 1              as is_closed
from read_csv('{{ var("raw_path") }}/fx_rates.csv', header = true, all_varchar = true)
