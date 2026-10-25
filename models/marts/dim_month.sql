select
    m::date                                   as month_start,
    year(m)                                   as fiscal_year,
    'Q' || quarter(m)                         as fiscal_quarter,
    month(m)                                  as month_number,
    strftime(m, '%b %Y')                      as month_label,
    m <= '{{ var("last_closed_month") }}'::date as is_closed
from range('2024-01-01'::date, '2027-01-01'::date, interval 1 month) t(m)
