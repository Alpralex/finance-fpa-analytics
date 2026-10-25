# Master items

Create these under **Master items** after the first reload. They mirror the Power BI measures one to one
(same names where possible). All amounts are EUR in reporting sign: revenue positive, costs negative,
so every subtotal is a plain sum and *actual − budget* > 0 is always favourable.

Two fields drive every expression:

- `FactType`: `GL` (ledger actuals and plan), `Volume` (units), `PVM` (margin bridge), `Check` (journal checks).
- `ScenarioType`: `Actual`, `Budget` (BUD2025 for 2025 months, BUD2026 for 2026 months), `Reforecast` (FC2026_9+3, Oct–Dec 2026).

`<Cal>` below stands for `Year=, Quarter=, Month=, YearMonth=, %Date=, [Month Status]=` (variable `vCal` in the script):
year-to-date and full-year measures ignore calendar selections and use the flags instead.
YTD (`_YTD`) is Jan–Sep 2026, the closed months of the current year; `_PYTD` is Jan–Sep 2025.

## Measures

### Base

| Name | Expression | Format |
|---|---|---|
| Actual | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}>} Amount)` | Money `€#,##0;-€#,##0` |
| Actual at Budget FX | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}>} AmountBudFX)` | Money |
| FX Effect | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}>} Amount) - Sum({<FactType={'GL'}, ScenarioType={'Actual'}>} AmountBudFX)` | Money |
| Budget | `Sum({<FactType={'GL'}, ScenarioType={'Budget'}>} Amount)` | Money |
| Reforecast | `Sum({<FactType={'GL'}, ScenarioType={'Reforecast'}>} Amount)` | Money |
| Forecast 9+3 | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _Closed*={1}>} Amount) + Sum({<FactType={'GL'}, ScenarioType={'Reforecast'}, _Closed*={0}>} Amount)` | Money |
| Prior Year | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, Year={$(=Max(Year)-1)}, YearMonth=, %Date=>} Amount)`: use with Month or Quarter as the dimension; for YTD use Prior Year YTD | Money |
| Var vs Budget | `If(Count({<FactType={'GL'}, ScenarioType={'Actual'}>} Amount) > 0, [Actual] - [Budget])`: in a chart, repeat the two expressions or use `$(vVarBudget)` | Money |
| Var vs Budget % | `$(vVarBudgetPct)`, i.e. (Actual − Budget) / Fabs(Budget) | `+0.0%;-0.0%` |
| Trading Var vs Budget | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}>} AmountBudFX) - Sum({<FactType={'GL'}, ScenarioType={'Budget'}>} Amount)` | Money |

The variance % divides by the absolute budget so that a cost overrun stays negative (unfavourable).

### Year to date and full year

| Name | Expression | Format |
|---|---|---|
| Actual YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>>} Amount)` | Money |
| Budget YTD | `Sum({<FactType={'GL'}, ScenarioType={'Budget'}, _YTD={1}, <Cal>>} Amount)` | Money |
| Prior Year YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _PYTD={1}, <Cal>>} Amount)` | Money |
| FX Effect YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>>} Amount - AmountBudFX)` | Money |
| Var vs Budget YTD | `[Actual YTD] - [Budget YTD]` (repeat the expressions) | Money |
| Var vs Budget YTD % | `(Actual YTD − Budget YTD) / Fabs(Budget YTD)` | `+0.0%;-0.0%` |
| Var vs PY YTD % | `(Actual YTD − Prior Year YTD) / Fabs(Prior Year YTD)` | `+0.0%;-0.0%` |
| Full Year Budget | `Sum({<FactType={'GL'}, ScenarioType={'Budget'}, _CY={1}, <Cal>>} Amount)` | Money |
| Full Year Forecast | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _CY={1}, _Closed={1}, <Cal>>} Amount) + Sum({<FactType={'GL'}, ScenarioType={'Reforecast'}, _CY={1}, _Closed={0}, <Cal>>} Amount)` | Money |

Power BI resolves the full year from the year in context; here it is the current fiscal year (`vCurrentFY` = 2026).

### KPIs

Add the account scope to any measure above. Scopes: net revenue `[P&L Group]={'Net revenue'}`,
gross margin `[P&L Subtotal]={'Gross margin'}`, EBITDA `[P&L Subtotal]={'Gross margin','EBITDA'}`.

| Name | Expression | Format |
|---|---|---|
| Net Revenue | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, [P&L Group]={'Net revenue'}>} Amount)` | Money |
| Net Revenue Budget | `Sum({<FactType={'GL'}, ScenarioType={'Budget'}, [P&L Group]={'Net revenue'}>} Amount)` | Money |
| Net Revenue YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>, [P&L Group]={'Net revenue'}>} Amount)` | Money |
| Net Revenue Budget YTD | `Sum({<FactType={'GL'}, ScenarioType={'Budget'}, _YTD={1}, <Cal>, [P&L Group]={'Net revenue'}>} Amount)` | Money |
| Net Revenue FX Effect YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>, [P&L Group]={'Net revenue'}>} Amount - AmountBudFX)` | Money |
| Gross Margin | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, [P&L Subtotal]={'Gross margin'}>} Amount)` | Money |
| Gross Margin % | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, [P&L Subtotal]={'Gross margin'}>} Amount) / Sum({<FactType={'GL'}, ScenarioType={'Actual'}, [P&L Group]={'Net revenue'}>} Amount)` | `0.0%` |
| Gross Margin % YTD | same as Gross Margin % with `_YTD={1}, <Cal>` in both sets | `0.0%` |
| Gross Margin % Budget YTD | same with `ScenarioType={'Budget'}, _YTD={1}, <Cal>` | `0.0%` |
| EBITDA | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, [P&L Subtotal]={'Gross margin','EBITDA'}>} Amount)` | Money |
| EBITDA Budget | `Sum({<FactType={'GL'}, ScenarioType={'Budget'}, [P&L Subtotal]={'Gross margin','EBITDA'}>} Amount)` | Money |
| EBITDA % | `EBITDA / Net Revenue` (repeat the expressions) | `0.0%` |
| EBITDA YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>, [P&L Subtotal]={'Gross margin','EBITDA'}>} Amount)` | Money |
| EBITDA Budget YTD | `Sum({<FactType={'GL'}, ScenarioType={'Budget'}, _YTD={1}, <Cal>, [P&L Subtotal]={'Gross margin','EBITDA'}>} Amount)` | Money |
| EBITDA FX Effect YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>, [P&L Subtotal]={'Gross margin','EBITDA'}>} Amount - AmountBudFX)` | Money |
| Full Year Forecast EBITDA | Full Year Forecast with `[P&L Subtotal]={'Gross margin','EBITDA'}` in both sets | Money |
| Full Year Budget EBITDA | Full Year Budget with `[P&L Subtotal]={'Gross margin','EBITDA'}` | Money |
| EBIT | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}>} Amount)` (all P&L accounts) | Money |

### P&L table

No special measures are needed. With `[P&L Line]` as the dimension (sorted by `[P&L Line No]`), the base
measures above return each group and the cumulative subtotals (Gross margin, EBITDA, EBIT), because the
`PnLStructure` table links every account to its group line and to each subtotal it belongs to.
Use **% of Net Revenue** as an extra column:

| Name | Expression | Format |
|---|---|---|
| % of Net Revenue YTD | `Sum({<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>>} Amount) / Sum(TOTAL {<FactType={'GL'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>, [P&L Line]={'Net revenue'}>} Amount)` | `0.0%` |

`TOTAL` makes the denominator ignore the row, so every line is divided by the net revenue of the selection.
On the Gross margin row this is the gross margin %, on the EBITDA row the EBITDA %.

### Volume, PVM, bridge and checks

| Name | Expression | Format |
|---|---|---|
| Units Actual | `Sum({<FactType={'Volume'}, ScenarioType={'Actual'}>} Units)` | `#,##0` |
| Units Budget | `Sum({<FactType={'Volume'}, ScenarioType={'Budget'}>} Units)` | `#,##0` |
| Units Var vs Budget % | `Units Actual / Units Budget - 1` (repeat the expressions) | `+0.0%;-0.0%` |
| Units Actual YTD | `Sum({<FactType={'Volume'}, ScenarioType={'Actual'}, _YTD={1}, <Cal>>} Units)` | `#,##0` |
| Units Budget YTD | `Sum({<FactType={'Volume'}, ScenarioType={'Budget'}, _YTD={1}, <Cal>>} Units)` | `#,##0` |
| Product Margin Budget | `Sum({<FactType={'PVM'}, <Cal>>} [PVM Budget Margin])` | Money |
| Product Margin Actual | `Sum({<FactType={'PVM'}, <Cal>>} [PVM Actual Margin])` | Money |
| Volume Effect | `Sum({<FactType={'PVM'}, <Cal>>} [PVM Volume])` | Money |
| Mix Effect | `Sum({<FactType={'PVM'}, <Cal>>} [PVM Mix])` | Money |
| Price Effect | `Sum({<FactType={'PVM'}, <Cal>>} [PVM Price])` | Money |
| Unit Cost Effect | `Sum({<FactType={'PVM'}, <Cal>>} [PVM Unit Cost])` | Money |
| Margin FX Effect | `Sum({<FactType={'PVM'}, <Cal>>} [PVM FX])` | Money |
| EBITDA Bridge | `Sum({<[Bridge Step No]={"<11"}>} [Bridge Amount])` (the waterfall adds the Actual EBITDA total) | Money |
| Journal Exceptions | `Count({<FactType={'Check'}>} [Check Type])` | `#,##0` |
| Duplicate Invoices | `Count({<FactType={'Check'}, [Check Type]={'duplicate_invoice'}>} [Check Type])` | `#,##0` |

PVM measures ignore the calendar because the margin bridge is already Jan–Sep 2026. The five effects add up
exactly to Product Margin Actual − Product Margin Budget.

## Dimensions

- **Entity** (drill-down): Region → Entity
- **Time** (drill-down): Year → Quarter → YearMonth
- **P&L** (drill-down): P&L Group → Account. For the subtotal view use `[P&L Line]`, sort by expression `[P&L Line No]`.
- **Cost Centre**: Function → Cost Centre
- Product Line, Scenario, Month Status, Bridge Step (sorted by `[Bridge Step No]`), Check Type

## Colours

Variance columns: green when > 0 (favourable), red when < 0. Because of the reporting sign this rule holds
for revenue and cost lines alike. Assign master colours to `Entity` (PT01, ES01, FR01, UK01) so every sheet uses the same ones.
