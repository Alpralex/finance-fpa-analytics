# Sheet guide

Four sheets, mirroring the four Power BI pages. Each answers one question a group controller asks
at the September close. Build them after the master items; each takes 20 to 40 minutes.

## 1. P&L vs budget: "Where do we stand after nine months?"
- KPIs: Net Revenue YTD, Var vs Budget YTD % (net revenue scope), Gross Margin % YTD, EBITDA YTD, EBITDA Budget YTD, Full Year Forecast EBITDA.
- Straight table: dimension `[P&L Line]` (sort by expression `[P&L Line No]`, ascending), measures
  Actual YTD, Budget YTD, Var vs Budget YTD, Var vs Budget YTD %, Prior Year YTD, % of Net Revenue YTD,
  Full Year Budget, Full Year Forecast. Text style bold when `[P&L Is Subtotal] = 1`;
  green/red text on the variance columns (> 0 green). Turn totals off: the subtotal rows are the totals.
- Pivot table for drill-down: `[P&L Group]` → `Account` in rows, `Entity` in columns, Var vs Budget YTD.
- Filter pane: Entity, Cost Centre, Product Line. Leave the year selection empty: YTD measures use the flags.

## 2. EBITDA bridge: "How did we get from budget to actual?"
- Waterfall: dimension `[Bridge Step]` (sorted by `[Bridge Step No]`), measure EBITDA Bridge;
  first bar Budget EBITDA as a subtotal, then the nine effects, subtotal at the end labelled Actual EBITDA.
- Bar chart: EBITDA Bridge by Entity for `[Bridge Step] = FX translation`. **Only UK01 has one (−€23,902).**
- KPI: Net Revenue FX Effect YTD. **Sterling's fall costs −€366,999 of UK revenue in euros**: UK sales in pounds
  are close to budget, so most of the UK revenue miss (−€220,538) is translation, not trading.
- Line chart by YearMonth for UK01: Actual and Actual at Budget FX (net revenue scope), year 2026.

## 3. Margin PVM: "Is the margin story price, volume or mix?"
- Stacked bar by Entity: Volume Effect, Mix Effect, Price Effect, Unit Cost Effect, Margin FX Effect.
  **PT01: +€862,382 price effect (the 4% list-price increase sticks), while Fasteners units are 6.8% below budget.**
- Table by Product Line: Units Actual YTD, Units Budget YTD, Units Var vs Budget %, Product Margin Actual,
  Product Margin Budget and the five effects.
  **Tools grows about 15% above budget in units in every entity, worth +€431,078 of volume but −€158,693 of mix:
  the lowest-margin line dilutes the group gross margin (29.7% vs 29.9% budget).**
  **Bearings: −€323,520 unit cost, the 6% steel surcharge from May 2026.**
- Filter: Entity = ES01, Product Line = Hydraulics shows **units −11.7% vs budget** (the late sales hires).

## 4. Cost centres and checks: "Which costs moved, and is the ledger clean?"
- Pivot: `Cost Centre` in rows, `[P&L Group]` in columns (EBITDA-scope opex only: `[P&L Subtotal]={'EBITDA'}`),
  Var vs Budget YTD as the value, background colour by sign.
  **ES01 salaries (account 6000) are 5.6% below budget, a favourable +€105,237: the sales hires arrived late.**
- Line chart by YearMonth, `Account = 5200 Outbound freight`, Entity = PT01: Actual and Budget.
  **PT01 outbound freight is 33.5% above budget YTD (−€642,071 vs −€480,780) after the new carrier contract in March.**
- Straight table on `FactType = Check`: Check Type, Entity, Account, YearMonth, Vendor, Document Ref, Postings,
  `Sum([Check Amount LC])`, `Sum([Check Change vs LY])`. Seven exceptions:
  the **CloudSuite Ltd duplicate in UK01, June 2026 (4,266.89 GBP)**, the UK01 software spike and reversal
  (June and August), PT01 outbound freight spikes (March, April, August 2026) and the **FR01 bonus true-up in December 2025**.

## Bookmarks for the demo video
1. "UK is FX": Entity = Atlantica UK Ltd on the bridge sheet.
2. "Portugal price vs freight": Entity = Atlântica Portugal on the PVM sheet, then the freight line chart.
3. "Spain hiring": Entity = Atlántica España, Product Line = Hydraulics on the PVM sheet.
4. "Tools dilution": Product Line = Tools on the PVM sheet.
5. "Duplicate invoice": Check Type = duplicate_invoice on the checks sheet.
6. "France bonus": Entity = Atlantique France, YearMonth = Dec 2025, Account = 6020 Bonuses on the P&L sheet.

## Reference numbers (check after the first reload)

Computed with DuckDB from the Parquet files (EUR, reporting sign, YTD = Jan–Sep 2026, budget BUD2026,
full-year forecast = actual Jan–Sep + FC2026_9+3 Oct–Dec). Power BI must return the same values
(see `../powerbi/README.md`).

| Entity | Net revenue actual YTD | Net revenue budget YTD | Var % | Gross margin % YTD (budget) | EBITDA actual YTD | EBITDA budget YTD | EBITDA % YTD | FX effect YTD, net revenue | FX effect YTD, EBITDA | Full-year forecast EBITDA | Full-year budget EBITDA |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| PT01 | 23,103,353 | 22,181,424 | +4.2% | 31.0% (29.9%) | 2,266,729 | 1,762,878 | 9.8% | 0 | 0 | 3,111,161 | 2,432,992 |
| ES01 | 16,298,141 | 16,636,068 | −2.0% | 28.6% (29.9%) | 1,194,708 | 1,366,294 | 7.3% | 0 | 0 | 1,651,030 | 1,883,592 |
| FR01 | 13,478,573 | 13,308,854 | +1.3% | 29.2% (29.9%) | 297,814 | 344,171 | 2.2% | 0 | 0 | 446,121 | 508,387 |
| UK01 | 9,931,729 | 10,152,267 | −2.2% | 29.2% (29.9%) | 649,301 | 698,240 | 6.5% | −366,999 | −23,902 | 895,353 | 968,741 |
| **Group** | **62,811,795** | **62,278,612** | **+0.9%** | **29.7% (29.9%)** | **4,408,553** | **4,171,583** | **7.0%** | **−366,999** | **−23,902** | **6,103,665** | **5,793,712** |

Other checks: Group EBIT YTD 2,704,269; group net revenue vs prior year YTD +8.1%; full-year net revenue
forecast 84,423,037 vs budget 83,795,624. EBITDA bridge: Budget EBITDA and Actual EBITDA steps equal the
budget and actual EBITDA YTD above, entity by entity. With Section Access on, IBERIA.CONTROLLER@ATLANTICA.EXAMPLE
sees PT01 + ES01 only (EBITDA YTD 3,461,438) and UK.CONTROLLER@ATLANTICA.EXAMPLE sees UK01 only.
