-- Budget EBITDA plus every bridge step must land exactly on actual EBITDA.
select entity_id,
       sum(case when step_order < 11 then amount_eur end) as bridged,
       sum(case when step_order = 11 then amount_eur end) as actual
from {{ ref('mart_ebitda_bridge') }}
group by 1
having abs(bridged - actual) > 1
