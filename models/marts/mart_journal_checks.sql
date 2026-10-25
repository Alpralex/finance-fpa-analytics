-- Ledger exceptions a controller would review before close:
--   duplicate_invoice: same entity, vendor, document reference and amount posted more than once
--   spike: entity x account month that moved >25% against both its 3-month average and the same month last year
with lines as (
    select * from {{ ref('stg_gl_journal_lines') }} g
    where g.line_number = 1 and g.document_ref is not null
),
dups as (
    select 'duplicate_invoice' as check_type, entity_id, account_id, min(month_start) as month_start,
           vendor, document_ref, count(*) as postings, (sum(amount_lc) - min(amount_lc))::double as amount_lc,
           null::double as change_vs_ly
    from lines
    where amount_lc > 0
    group by entity_id, account_id, vendor, document_ref, amount_lc
    having count(*) > 1
),
monthly as (
    select entity_id, account_id, month_start, -sum(amount_lc) as amount_lc
    from {{ ref('stg_gl_journal_lines') }}
    where account_id in ('5100', '5200') or account_id like '6%'
    group by all
),
compared as (
    select *,
           avg(amount_lc) over (partition by entity_id, account_id order by month_start rows between 3 preceding and 1 preceding) as avg_3m,
           lag(amount_lc, 12) over (partition by entity_id, account_id order by month_start) as same_month_ly
    from monthly
),
spikes as (
    -- cost moved more than 25% against both the last three months and the same month last year,
    -- which ignores normal seasonality (trade fairs, audit) and January pay rises
    select 'spike' as check_type, entity_id, account_id, month_start, null as vendor, null as document_ref,
           null::bigint as postings, (amount_lc - same_month_ly)::double as amount_lc,
           amount_lc / same_month_ly - 1 as change_vs_ly
    from compared
    where same_month_ly is not null
      and abs(amount_lc / avg_3m - 1) > 0.25 and abs(amount_lc / same_month_ly - 1) > 0.25
      and abs(amount_lc - same_month_ly) > 2000
)
select * from dups
union all
select * from spikes
