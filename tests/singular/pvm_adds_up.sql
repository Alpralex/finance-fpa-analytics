-- Volume + mix + price + unit cost + FX must explain the whole product-margin variance, per entity.
select entity_id, sum(actual_margin_eur - budget_margin_eur) as variance,
       sum(volume_eur + mix_eur + price_eur + cost_eur + fx_eur) as explained
from {{ ref('mart_margin_pvm') }}
group by 1
having abs(variance - explained) > 1
