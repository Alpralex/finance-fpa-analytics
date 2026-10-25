"""Export the marts: Parquet files for Power BI and Qlik (powerbi/data/) and compact JSON for the web page (web/data/)."""
import json
import os
import duckdb

DB = os.environ.get("FPA_DB_PATH", "data/fpa.duckdb")
con = duckdb.connect(DB, read_only=True)
os.makedirs("powerbi/data", exist_ok=True)
os.makedirs("web/data", exist_ok=True)

tables = {
    "dim_entity": "select * from dim_entity",
    "dim_account": "select * from dim_account",
    "dim_cost_centre": "select * from dim_cost_centre",
    "dim_product_line": "select * from dim_product_line",
    # daily calendar so DAX time intelligence works; facts sit on the first day of each month
    "dim_date": """
        select d::date as date_day, date_trunc('month', d)::date as month_start, year(d) as fiscal_year,
               'Q' || quarter(d) as fiscal_quarter, month(d) as month_number, strftime(d, '%b') as month_name,
               date_trunc('month', d) <= '2026-09-01'::date as is_closed
        from range('2024-01-01'::date, '2027-01-01'::date, interval 1 day) t(d)""",
    "fct_actuals": "select * from fct_actuals",
    "fct_plan": "select * from fct_plan",
    "fct_sales_volume": "select * from fct_sales_volume",
    "mart_margin_pvm": "select * from mart_margin_pvm",
    "mart_ebitda_bridge": "select * from mart_ebitda_bridge",
    "mart_journal_checks": "select * from mart_journal_checks",
    # row-level security demo: which controller sees which entity (fictional addresses)
    "security_entity_access": """
        select * from (values
            ('group.controller@atlantica.example', 'PT01'), ('group.controller@atlantica.example', 'ES01'),
            ('group.controller@atlantica.example', 'FR01'), ('group.controller@atlantica.example', 'UK01'),
            ('iberia.controller@atlantica.example', 'PT01'), ('iberia.controller@atlantica.example', 'ES01'),
            ('uk.controller@atlantica.example', 'UK01')) t(user_email, entity_id)""",
}
for name, sql in tables.items():
    con.execute(f"copy ({sql}) to 'powerbi/data/{name}.parquet' (format parquet, compression zstd)")
    n = con.execute(f"select count(*) from 'powerbi/data/{name}.parquet'").fetchone()[0]
    print(f"powerbi/data/{name}.parquet: {n:,} rows")


def rows(sql):
    return [[float(v) if hasattr(v, "as_tuple") else v for v in r] for r in con.execute(sql).fetchall()]


web = {
    # month, entity, account, actual, budget, forecast (9+3), prior year — EUR, reporting sign
    "pnl": """
        select strftime(month_start, '%Y-%m'), entity_id, account_id,
               round(actual_eur), round(budget_eur), round(forecast_eur), round(prior_year_eur)
        from mart_pnl_monthly order by 1, 2, 3""",
    # entity, account, actual at budget rate (YTD, current year) for the FX split
    "fx": """
        select entity_id, account_id, round(sum(actual_eur_bud_rate)), round(sum(actual_eur))
        from mart_pnl_monthly where fiscal_year = 2026 and is_closed group by all order by 1, 2""",
    "bridge": "select entity_id, step_order, step, round(amount_eur) from mart_ebitda_bridge order by 1, 2",
    "pvm": """
        select entity_id, product_line_id, act_units, bud_units, round(budget_sales_eur), round(actual_sales_eur),
               round(budget_margin_eur), round(actual_margin_eur), round(sales_volume_eur), round(sales_price_eur),
               round(sales_fx_eur), round(volume_eur), round(mix_eur), round(price_eur), round(cost_eur), round(fx_eur)
        from mart_margin_pvm order by 1, 2""",
    # entity, cost centre, P&L group, actual YTD, budget YTD (EUR)
    "opex": """
        select f.entity_id, f.cost_centre_id, a.pnl_group, round(sum(f.amount_eur)),
               round((select sum(p.amount_eur) from fct_plan p
                      where p.scenario = 'BUD2026' and p.entity_id = f.entity_id and p.cost_centre_id = f.cost_centre_id
                        and p.month_start <= '2026-09-01' and p.account_id in (select account_id from dim_account d2 where d2.pnl_group = a.pnl_group)))
        from fct_actuals f join dim_account a using (account_id)
        where year(f.month_start) = 2026 and a.pnl_subtotal = 'EBITDA'
        group by f.entity_id, f.cost_centre_id, a.pnl_group order by 1, 2, 3""",
    "checks": """
        select check_type, entity_id, account_id, strftime(month_start, '%Y-%m'), vendor, document_ref, postings,
               round(amount_lc), round(change_vs_ly, 3)
        from mart_journal_checks order by month_start, entity_id""",
}
for name, sql in web.items():
    data = rows(sql)
    with open(f"web/data/{name}.json", "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"web/data/{name}.json: {len(data):,} rows")

meta = {
    "entities": rows("select entity_id, entity_name, country, currency from dim_entity order by sort_order"),
    "accounts": rows("select account_id, account_name, pnl_group, pnl_subtotal, pnl_line_order from dim_account order by pnl_line_order"),
    "cost_centres": rows("select cost_centre_id, cost_centre_name from dim_cost_centre"),
    "product_lines": rows("select product_line_id, product_line_name from dim_product_line"),
    "fx": rows("select strftime(month_start, '%Y-%m'), avg_rate_eur, budget_rate_eur from stg_fx_rates where currency = 'GBP' and is_closed order by 1"),
    "last_closed": "2026-09",
}
with open("web/data/meta.json", "w") as f:
    json.dump(meta, f, separators=(",", ":"), ensure_ascii=False)
print("meta ok")
