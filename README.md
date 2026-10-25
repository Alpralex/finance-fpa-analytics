# Why is the group ahead of budget, and is it the good kind of ahead?

An FP&A project on a synthetic group ledger: budget vs actual, the October 9+3 reforecast, an EBITDA bridge,
a price-volume-mix split of product margin and the ledger exceptions to clear before close. The data are
modelled in SQL with dbt on DuckDB and tested. The same marts feed a web dashboard, a Power BI model and a Qlik Sense app.

**Live dashboard:** https://guilhermerigonato.com/finance-fpa-analytics/ · **Power BI:** [`powerbi/`](powerbi/) · **Qlik Sense:** [`qlik/`](qlik/)
**Stack:** Python (data generator), SQL, dbt, DuckDB, Power BI (PBIP/TMDL, DAX, row-level security), Qlik Sense (load script, set analysis, section access)

## The company

Atlântica Components is fictional: a B2B distributor of industrial parts (bearings, fasteners, hydraulics,
pneumatics, tools) with four legal entities. Portugal is the head office; Spain and France report in euros and the
UK in pounds. Group revenue is about €80M a year. The ledger runs from January 2024 to September 2026, the last closed month.

## Findings (January–September 2026)

1. **The group beats budget only because Portugal raised prices.** EBITDA is €4.41M against €4.17M budgeted (+5.7%).
   Portugal's 4% list-price rise adds €0.87M; without it the group would be €0.63M (15%) below budget.
2. **Spain's hiring savings hide a larger miss.** Late sales hires keep salaries €0.14M under budget, but Hydraulics
   volume and service revenue fall short and Spain's EBITDA is 12.6% below budget.
3. **The UK sells more in pounds and less in euros.** Product sales are 1.6% above budget at the budget rate and 2.0%
   below in euros: sterling averaged about 1.15 against a budget rate of 1.19, which cost €0.36M of sales.
4. **Two cost leaks.** A steel surcharge on bearings from May costs €0.32M of margin, and Portugal's new outbound
   carrier (from March) €0.17M. The ledger checks also catch a CloudSuite invoice posted twice in the UK in June.

These come from eight stories written into the generator on purpose (listed in its docstring), so anyone can
check that the dashboard finds them. They are not findings about a real company.

## Model

```
seeds (master data)            staging (views)            marts (tables)
entities, accounts,            stg_gl_journal_lines ──┬─▶ fct_actuals        entity × cost centre × account × product × month
cost_centres, product_lines    stg_plan_lines ────────┼─▶ fct_plan           BUD2025, BUD2026, FC2026_9+3
                               stg_sales_volume ──────┼─▶ fct_sales_volume   units and sales (sub-ledger)
                               stg_fx_rates ──────────┘   dim_entity, dim_account, dim_cost_centre, dim_product_line, dim_month
                                                          mart_pnl_monthly     actual, budget, 9+3 forecast, prior year
                                                          mart_margin_pvm      volume, mix, price, unit cost, FX by product line
                                                          mart_ebitda_bridge   budget EBITDA → actual EBITDA, 11 steps
                                                          mart_journal_checks  duplicate invoices, cost spikes
                                                          mart_fy_landing      full-year budget vs 9+3 vs prior year
```

- 18 models and 67 tests. Besides unique, not-null, relationships and accepted values, four tests check the accounting:
  every journal balances to zero, the sales sub-ledger agrees with account 4000 to the cent per entity and month, and
  both bridges add up exactly to the variance they explain.
- **Sign convention:** marts use reporting sign (revenue positive, costs negative), so every subtotal is a plain sum
  and actual − budget > 0 is always favourable.
- **FX:** actuals are translated at the monthly average rate and again at the budget rate; the difference is the FX
  translation effect. Budgets use the budget rate, the reforecast the last closed month's rate.
- **Price-volume-mix:** product lines sell in very different units, so volume is measured as actual units at budget
  prices. Volume, mix, price and unit cost are valued at budget rates, then FX, so the five effects reconcile exactly.
- **Exceptions:** a cost is flagged when it moves more than 25% against both its three-month average and the same month
  last year, which ignores normal seasonality such as trade fairs, the audit and January pay rises.

## Run it

```bash
pip install dbt-duckdb==1.9.1 numpy
python generator/generate.py        # writes data/raw/*.csv in about a second
dbt build --profiles-dir .          # 18 models, 67 tests
python scripts/export.py            # powerbi/data/*.parquet and web/data/*.json
```

Open `web/index.html` through any static server (`python -m http.server` in `web/`).
The Power BI and Qlik versions read the Parquet files in `powerbi/data/`; see their folders for the steps.

## Files

```
generator/generate.py      synthetic ledger, budgets, reforecast, FX; the planted stories are in the docstring
seeds/                     entities, chart of accounts with the P&L hierarchy, cost centres, product lines
models/                    dbt staging and marts
tests/                     generic tests (balanced journals, unique combination) and singular reconciliation tests
scripts/export.py          Parquet for Power BI and Qlik, JSON for the web page
web/                       static dashboard
powerbi/                   PBIP project: TMDL model, DAX measures, roles
qlik/                      load script, master items, sheets
```
