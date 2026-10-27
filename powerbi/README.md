# Atlântica FP&A in Power BI

**Live report (Publish to web):** https://app.powerbi.com/view?r=eyJrIjoiMjMwNTVhNGYtMmYzNi00ZmMwLTg3NTUtNjNhN2NiMjQzODhlIiwidCI6IjY2MDMwOWU1LWI1YWEtNDQzNS1iMDU2LTJhYmViOGZmNDZjNyJ9 (published from the public copy without RLS, see below).

The budget-vs-actual model as a Power BI project (PBIP). The semantic model is written in TMDL, so every
table, relationship, measure and security role is readable in Git. The data are the Parquet files that
`scripts/export.py` writes to `powerbi/data/` (the same files the Qlik app loads).

## Open it

1. Copy this repository to the Windows machine, for example `C:\finance-fpa-analytics`.
2. Open `powerbi/AtlanticaFPA.pbip` in Power BI Desktop. If Desktop asks, turn on the PBIP and TMDL preview
   features in *Options > Preview features*.
3. In *Transform data > Manage parameters*, set **DataFolder** to the folder that holds the Parquet files,
   with a trailing backslash, for example `C:\finance-fpa-analytics\powerbi\data\`.
4. Select **Refresh**. The model is small (about 11,000 fact rows) and loads in seconds.

If Desktop refuses the project, open a blank report instead, go to **TMDL view**, paste the whole of
`tmdl-view-script.tmdl` and select **Apply**. That creates the same parameter, tables, relationships,
measures and roles. Then set DataFolder and refresh.

## Model

Star schema. Every fact joins its dimensions many-to-one, single direction; facts that carry a month join
`dim_date` on `month_start → date_day` (facts sit on the first day of each month). `dim_date` is a daily
calendar marked as the date table (`dataCategory: Time`, key `date_day`), so `DATESYTD` and
`SAMEPERIODLASTYEAR` work.

```
                dim_date (daily, marked date table)
                    │ month_start → date_day
   ┌────────────────┼──────────────────┬───────────────────┐
fct_actuals      fct_plan        fct_sales_volume    mart_journal_checks
   │  entity, cost centre, account, product line  │ entity, product line │ entity, account
dim_entity · dim_cost_centre · dim_account · dim_product_line
   │
mart_margin_pvm (entity, product line)   mart_ebitda_bridge (entity)

pnl_layout (disconnected)   security_entity_access (no relationship, hidden)   _Measures (measure table)
```

| Table | Grain |
| --- | --- |
| fct_actuals | entity × cost centre × account × product line × month, Jan 2024 – Sep 2026; `amount_eur` at the monthly average rate, `amount_eur_bud_rate` at the budget rate |
| fct_plan | the same grain plus `scenario`: BUD2025, BUD2026 (budget rate) and FC2026_9+3 (Oct – Dec 2026, latest closed-month rate) |
| fct_sales_volume | units and product revenue by scenario (ACT, BUD*, FC*), entity, product line, month |
| mart_margin_pvm | product margin bridge budget → actual, YTD Sep 2026, by entity and product line |
| mart_ebitda_bridge | EBITDA bridge budget → actual, YTD Sep 2026, 11 steps per entity |
| mart_journal_checks | duplicate invoices and cost spikes found in the ledger |

Sign convention: reporting sign, revenue positive and costs negative. Every subtotal is a plain sum and
*actual − budget* > 0 is always favourable, on revenue and cost lines alike. Variance % divides by the
absolute budget so the sign keeps that meaning.

All amounts are in EUR. Product line is blank on accounts that are not product-specific (services, opex),
so those rows show under a blank product line.

## Measures

All measures live in the `_Measures` table (its single column is hidden, so Desktop shows it as a measure
table), in display folders:

| Folder | Measures |
| --- | --- |
| 1 Base | Actual, Actual at Budget FX, FX Effect, Budget, Reforecast, Forecast 9+3, Prior Year, Var vs Budget, Var vs Budget %, Trading Var vs Budget, Var vs PY, Var vs PY % |
| 2 YTD and full year | Actual YTD, Budget YTD, Prior Year YTD, Actual at Budget FX YTD, FX Effect YTD, Var vs Budget YTD, Var vs Budget YTD %, Var vs PY YTD %, Full Year Budget, Full Year Forecast, Full Year Forecast vs Budget, Full Year Forecast vs Budget % |
| 3 KPIs | Net Revenue (+ Budget, YTD, Budget YTD, Var vs Budget YTD %, Var vs PY YTD %, FX Effect YTD), Gross Margin, Gross Margin Budget, Gross Margin %, Gross Margin % Budget, Gross Margin YTD, Gross Margin Budget YTD, Gross Margin % YTD, Gross Margin % Budget YTD, EBITDA, EBITDA Budget, EBITDA %, EBITDA Forecast 9+3, EBITDA YTD, EBITDA Budget YTD, EBITDA Var vs Budget YTD, EBITDA % YTD, EBITDA FX Effect YTD, Full Year Forecast EBITDA, Full Year Budget EBITDA, EBIT |
| 4 P&L matrix | PL Actual, PL Budget, PL Forecast 9+3, PL Prior Year, PL Actual YTD, PL Budget YTD, PL Prior Year YTD, PL Full Year Budget, PL Full Year Forecast, PL Var vs Budget, PL Var vs Budget %, PL Var vs PY %, PL Var vs Budget YTD, PL Var vs Budget YTD %, PL Var vs PY YTD %, PL FY Forecast vs Budget, PL % of Net Revenue, PL % of Net Revenue YTD |
| 5 Volume and margin PVM | Units Actual, Units Budget, Units Var vs Budget %, Units Actual YTD, Units Budget YTD, Product Margin Budget, Product Margin Actual, Product Margin Var, Volume Effect, Mix Effect, Price Effect, Unit Cost Effect, Margin FX Effect |
| 6 Bridge and checks | Bridge Amount, Journal Exceptions, Duplicate Invoices, Exception Amount LC |

Key definitions:

| Measure | Definition |
| --- | --- |
| Actual | `SUM(fct_actuals[amount_eur])` |
| Budget | The budget of the year in context: for each `fiscal_year` it sums scenario `"BUD" & year`, so 2025 months read BUD2025 and 2026 months BUD2026 |
| Forecast 9+3 | Actual for closed months (`dim_date[is_closed]`) plus FC2026_9+3 for open months |
| Prior Year | `CALCULATE([Actual], SAMEPERIODLASTYEAR(dim_date[date_day]))` |
| … YTD | `CALCULATE(…, DATESYTD(dim_date[date_day]), dim_date[is_closed] = TRUE())`: year to date, stopping at the last closed month, so selecting the year 2026 compares Jan – Sep on both sides |
| Full Year Budget / Forecast | All twelve months of the latest year in context |
| FX Effect | Actual at the monthly rate minus actual at the budget rate (translation; only UK01 has GBP) |
| Trading Var vs Budget | Actual at budget FX minus budget: the variance without translation |
| Net Revenue / Gross Margin / EBITDA / EBIT | Account scopes on `dim_account`: pnl_group = Net revenue; pnl_subtotal = Gross margin; pnl_subtotal in (Gross margin, EBITDA); all P&L accounts |
| Units Actual | Not called *Units*: `fct_sales_volume` has a `units` column and Power BI names are case-insensitive, so a measure with a column's name breaks the model |

Time intelligence uses explicit measures, not a calculation group, so the model needs no
`discourageImplicitMeasures` setting and works in any Desktop version.

### P&L layout and subtotals

`dim_account` has the hierarchy `pnl_subtotal → pnl_group → account`, but a P&L shows cumulative subtotals
(Gross margin = net revenue + cost of sales; EBITDA = gross margin + opex; EBIT = EBITDA + D&A), which a
plain hierarchy cannot do. The model adds a small disconnected table, `pnl_layout`, with one row per
matrix line:

| line_order | line_label | line_type | pnl_group | max_line_order |
| ---: | --- | --- | --- | ---: |
| 1 | Net revenue | Group | Net revenue | |
| 2 | Cost of sales | Group | Cost of sales | |
| 3 | **Gross margin** | Subtotal | | 29 |
| 4–8 | People, Facilities, IT, Commercial, General and admin | Group | (same) | |
| 9 | **EBITDA** | Subtotal | | 49 |
| 10 | D&A | Group | D&A | |
| 11 | **EBIT** | Subtotal | | 99 |

Each `PL …` measure reads the row with `SELECTEDVALUE` and `SWITCH`es: a Group row filters
`dim_account[pnl_group]`; a Subtotal row sums every account with `pnl_line_order <= max_line_order`
(accounts are numbered 10–22 for gross margin, 30–45 for opex, 50 for D&A). Put `pnl_layout[line_label]`
on the matrix rows (it sorts by `line_order`), the `PL` measures as values, and turn off row totals:
the subtotal rows are the totals. `is_subtotal` = 1 can drive bold rows with conditional formatting.
`PL % of Net Revenue` turns the Gross margin and EBITDA rows into the gross margin % and EBITDA %.
For account detail use a second matrix with `dim_account[pnl_group]` → `account_name` and the plain measures.

## Row-level security

Two roles in `definition/roles/`:

- **Entity controller**: `dim_entity` is filtered to the entities listed for the signed-in user in
  `security_entity_access`:
  `[entity_id] IN CALCULATETABLE(VALUES(security_entity_access[entity_id]), security_entity_access[user_email] = USERPRINCIPALNAME())`.
  The filter flows from `dim_entity` to every fact and mart. The mapping table needs no relationship and is
  itself filtered to the user's own rows.
- **Group finance**: no filter, sees every entity.

Test it in Desktop with *Modeling > View as*, tick **Other user**, type one of the fictional users and tick
**Entity controller**:

| User | Sees | EBITDA YTD |
| --- | --- | ---: |
| group.controller@atlantica.example | PT01, ES01, FR01, UK01 | 4,408,553 |
| iberia.controller@atlantica.example | PT01, ES01 | 3,461,438 |
| uk.controller@atlantica.example | UK01 | 649,301 |
| anyone else | nothing | blank |

After publishing, add members to the roles in the Fabric workspace (dataset *Security*).

### Public copy without RLS

*Publish to web* does not accept a model with row-level security, so the public link on the portfolio comes from
`public/AtlanticaFPA_Public.pbip`: the same report, data and measures without the two roles and without
`security_entity_access`, which only serves them. It is generated, not edited: after changing the report or the model run
`node scripts/build_powerbi_report.mjs` and then `node scripts/make_powerbi_public_copy.mjs`. Publish the main project for
the RLS demonstration and this copy for the public link.

## Report to build (four pages, 1280 × 720)

The report scaffold has the four pages, empty. Common to all pages: slicers for `dim_entity[entity_name]`
and `dim_date[fiscal_year]` (default 2026) in a header row; amounts in € thousands; variance colours green
when > 0 and red when < 0 (the reporting sign makes that rule valid for every line).

1. **P&L vs budget**
   - Cards: Net Revenue YTD, Var vs Budget YTD % (as subtitle), Gross Margin % YTD against Gross Margin % Budget YTD,
     EBITDA YTD against EBITDA Budget YTD, Full Year Forecast EBITDA against Full Year Budget EBITDA.
   - Matrix: rows `pnl_layout[line_label]`; values PL Actual YTD, PL Budget YTD, PL Var vs Budget YTD,
     PL Var vs Budget YTD %, PL Prior Year YTD, PL % of Net Revenue YTD, PL Full Year Budget, PL Full Year Forecast.
     Row totals off; bold on `is_subtotal`.
   - Optional: the same matrix with `dim_entity[entity_name]` on columns and PL Var vs Budget YTD.
2. **EBITDA bridge**
   - Waterfall: category `mart_ebitda_bridge[step]` (sorted by `step_order`), value Bridge Amount, visual filter
     `step` is not *Actual EBITDA*; the waterfall total is then the actual EBITDA. Breakdown off.
   - Clustered bar: Bridge Amount by entity for step *FX translation* (only UK01).
   - Line chart: `dim_date[month_start]` 2026, Net Revenue and Actual at Budget FX (net revenue scope via a visual
     filter on `dim_account[pnl_group]`) for UK01: the gap is the sterling translation.
3. **Margin PVM**
   - Stacked bar: entity on the axis, Volume Effect, Mix Effect, Price Effect, Unit Cost Effect, Margin FX Effect.
   - Matrix: `dim_product_line[product_line_name]` rows, `dim_entity[entity_name]` columns, Units Var vs Budget % (YTD
     via the year slicer and a month filter Jan – Sep, or use Units Actual YTD and Units Budget YTD), Product Margin Var.
   - Scatter: product line, x = Units Var vs Budget %, y = Price Effect.
4. **Cost centres and checks**
   - Matrix: `dim_cost_centre[cost_centre_name]` rows, `dim_account[pnl_group]` columns filtered to
     pnl_subtotal = EBITDA (the opex groups), value Var vs Budget YTD with background colour by sign.
   - Line chart: `dim_date[month_start]`, Actual and Budget, filtered to account 5200 Outbound freight and PT01.
   - Table: `mart_journal_checks` check_type, entity, account, month_start, vendor, document_ref, postings,
     amount_lc, change_vs_ly. Card: Duplicate Invoices. Note that the year slicer filters this table too
     (the FR01 bonus spike is in December 2025).

Publish with *Publish to web* from your own Fabric workspace and put the link in the portfolio.

## Reference numbers

Computed with DuckDB from the Parquet files. EUR, reporting sign, YTD = Jan – Sep 2026 (select
fiscal_year 2026 and use the YTD measures), budget BUD2026, full-year forecast = actual Jan – Sep +
FC2026_9+3 Oct – Dec. The Qlik app must return the same values (see `../qlik/sheets.md`).

| Entity | Net Revenue YTD | Net Revenue Budget YTD | Var vs Budget YTD % | Gross Margin % YTD (budget) | EBITDA YTD | EBITDA Budget YTD | EBITDA % YTD | Net Revenue FX Effect YTD | EBITDA FX Effect YTD | Full Year Forecast EBITDA | Full Year Budget EBITDA |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| PT01 | 23,103,353 | 22,181,424 | +4.2% | 31.0% (29.9%) | 2,266,729 | 1,762,878 | 9.8% | 0 | 0 | 3,111,161 | 2,432,992 |
| ES01 | 16,298,141 | 16,636,068 | −2.0% | 28.6% (29.9%) | 1,194,708 | 1,366,294 | 7.3% | 0 | 0 | 1,651,030 | 1,883,592 |
| FR01 | 13,478,573 | 13,308,854 | +1.3% | 29.2% (29.9%) | 297,814 | 344,171 | 2.2% | 0 | 0 | 446,121 | 508,387 |
| UK01 | 9,931,729 | 10,152,267 | −2.2% | 29.2% (29.9%) | 649,301 | 698,240 | 6.5% | −366,999 | −23,902 | 895,353 | 968,741 |
| **Group** | **62,811,795** | **62,278,612** | **+0.9%** | **29.7% (29.9%)** | **4,408,553** | **4,171,583** | **7.0%** | **−366,999** | **−23,902** | **6,103,665** | **5,793,712** |

Other checks: EBIT YTD 2,704,269; Net Revenue Var vs PY YTD % +8.1%; full-year net revenue forecast
84,423,037 against a full-year budget of 83,795,624. In the bridge, *Budget EBITDA* and *Actual EBITDA*
equal EBITDA Budget YTD and EBITDA YTD for every entity, and the PVM effects add up to Product Margin Var
(group: volume +51,381, mix −173,225, price +868,077, unit cost −323,585, FX −115,963; total +306,685).

## On first open, check

- Refresh runs without errors once DataFolder points at the Parquet folder.
- The model view shows `_Measures` with the measure-table icon, and no inactive or bidirectional relationships.
- `dim_date` is marked as the date table (*Table tools > Mark as date table* shows `date_day`).
- With fiscal_year = 2026, the cards and the P&L matrix match the table above.
- *View as > Other user* with the three addresses returns the EBITDA YTD values in the RLS table.
