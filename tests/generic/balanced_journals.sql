{# Double entry: every journal must sum to zero in local currency. #}
{% test balanced_journals(model, journal_column, amount_column) %}
select {{ journal_column }}, sum({{ amount_column }}) as imbalance
from {{ model }}
group by 1
having abs(sum({{ amount_column }})) > 0.005
{% endtest %}
