-- Sales sub-ledger: units and gross product revenue by entity, product line and month, for ACT and plan scenarios.
select
    scenario,
    entity_id,
    product_line_id,
    month_start::date                   as month_start,
    units::bigint                       as units,
    revenue_lc::decimal(18, 2)          as revenue_lc
from read_csv('{{ var("raw_path") }}/sales_volume.csv', header = true, all_varchar = true)
