-- Management P&L accounts only. Balance-sheet accounts stay in the ledger for the balancing test.
select account_id, account_name, pnl_group, pnl_subtotal, pnl_line_order,
       account_id like '4%' as is_revenue
from {{ ref('accounts') }}
where account_type = 'P&L'
