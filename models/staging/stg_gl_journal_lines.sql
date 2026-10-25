-- One row per journal line. Amounts are in local currency, debit positive and credit negative.
select
    journal_id,
    line_number::integer                as line_number,
    entity_id,
    posting_date::date                  as posting_date,
    date_trunc('month', posting_date::date)::date as month_start,
    account_id::varchar                 as account_id,
    nullif(cost_centre_id, '')          as cost_centre_id,
    nullif(product_line_id, '')         as product_line_id,
    amount_lc::decimal(18, 2)           as amount_lc,
    source,
    nullif(vendor, '')                  as vendor,
    nullif(document_ref, '')            as document_ref
from read_csv('{{ var("raw_path") }}/gl_journal_lines.csv', header = true, all_varchar = true)
