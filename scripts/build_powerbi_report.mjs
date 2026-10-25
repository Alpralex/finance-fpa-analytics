// Generates the PBIR pages, visuals and "Atlantica FPA" theme for powerbi/AtlanticaFPA.Report.
// Run from the repo root: node scripts/build_powerbi_report.mjs
// The script owns every page listed below and the AtlanticaFPA theme; it rewrites them on each run.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const REPORT = path.resolve("powerbi/AtlanticaFPA.Report");
const DEF = path.join(REPORT, "definition");
const VISUAL_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

// Colours follow the web dashboard (web/index.html, light theme).
const C = {
  page: "#F7F8F9", card: "#FFFFFF", border: "#DCE0E5", text: "#1B2430", muted: "#5D6876", grid: "#ECEFF2",
  blue: "#2A78D6", orange: "#EB6834", green: "#1F7A35", amber: "#B25B00", grey: "#5D6876", red: "#B42318",
  greenSoft: "#E3F1E6", redSoft: "#FBE4E1", subtotal: "#EEF1F4",
};

// ---------- expression helpers ----------
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${s.replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const int = (n) => lit(`${n}L`);
const bool = (b) => lit(b ? "true" : "false");
const fill = (hex) => ({ solid: { color: lit(`'${hex}'`) } });
const col = (entity, prop) => ({ Column: { Expression: { SourceRef: { Entity: entity } }, Property: prop } });
const meas = (prop) => ({ Measure: { Expression: { SourceRef: { Entity: "_Measures" } }, Property: prop } });
const proj = (field) => {
  const f = field.Column || field.Measure;
  const entity = f.Expression.SourceRef.Entity;
  return { field, queryRef: `${entity}.${f.Property}`, nativeQueryRef: f.Property };
};
const named = (field, displayName) => ({ ...proj(field), displayName });
const ref = (field) => proj(field).queryRef;
const id = (...parts) => crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);
const filterId = (...parts) => "Filter" + crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 24);

// Basic visual-level filter: column IN (literals).
function inFilter(page, key, field, literals) {
  const c = field.Column;
  const entity = c.Expression.SourceRef.Entity;
  return {
    name: filterId(page, key),
    field,
    type: "Categorical",
    filter: {
      Version: 2,
      From: [{ Name: "f", Entity: entity, Type: 0 }],
      Where: [{
        Condition: {
          In: {
            Expressions: [{ Column: { Expression: { SourceRef: { Source: "f" } }, Property: c.Property } }],
            Values: literals.map((v) => [{ Literal: { Value: v } }]),
          },
        },
      }],
    },
    howCreated: "User",
  };
}

// Column NOT IN (literals).
function notInFilter(page, key, field, literals) {
  const f = inFilter(page, key, field, literals);
  f.filter.Where[0].Condition = { Not: { Expression: f.filter.Where[0].Condition } };
  return f;
}

// ---------- fields ----------
const F = {
  entity: col("dim_entity", "entity_name"),
  entityId: col("dim_entity", "entity_id"),
  year: col("dim_date", "fiscal_year"),
  month: col("dim_date", "month_start"),
  closed: col("dim_date", "is_closed"),
  line: col("pnl_layout", "line_label"),
  isSubtotal: col("pnl_layout", "is_subtotal"),
  step: col("mart_ebitda_bridge", "step"),
  pnlGroup: col("dim_account", "pnl_group"),
  pnlSubtotal: col("dim_account", "pnl_subtotal"),
  accountId: col("dim_account", "account_id"),
  accountName: col("dim_account", "account_name"),
  costCentre: col("dim_cost_centre", "cost_centre_name"),
  productLine: col("dim_product_line", "product_line_name"),
  jc: (name) => col("mart_journal_checks", name),
};

// ---------- visual builders ----------
let z = 0;
function container(page, key, pos, visual, extra = {}) {
  z += 1000;
  return {
    $schema: VISUAL_SCHEMA,
    name: id(page, key),
    position: { x: pos.x, y: pos.y, z, height: pos.h, width: pos.w, tabOrder: z },
    visual,
    ...extra,
  };
}

const vcoPadding = (p) => ({ properties: { top: num(p), bottom: num(p), left: num(p), right: num(p) } });

function chartVcos(title, alt, subtitle) {
  return {
    title: [{ properties: { show: bool(true), text: str(title) } }],
    general: [{ properties: { altText: str(alt) } }],
    padding: [vcoPadding(12)],
    // Without an explicit subtitle Desktop shows an auto-generated one in the UI language.
    subTitle: [{ properties: subtitle ? { show: bool(true), text: str(subtitle) } : { show: bool(false) } }],
  };
}

function textbox(page, key, pos, text, style) {
  return container(page, key, pos, {
    visualType: "textbox",
    objects: {
      general: [{
        properties: {
          paragraphs: [{ textRuns: [{ value: text, textStyle: style }], horizontalTextAlignment: "left" }],
        },
      }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(false) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: [vcoPadding(0)],
    },
  });
}

function header(page, title, subtitle) {
  return [
    textbox(page, "title", { x: 16, y: 16, w: 720, h: 40 }, title,
      { fontFamily: "Segoe UI Semibold", fontSize: "22px", color: C.text }),
    textbox(page, "subtitle", { x: 16, y: 58, w: 720, h: 40 }, subtitle,
      { fontFamily: "Segoe UI", fontSize: "13px", color: C.muted }),
  ];
}

// Entity (multi-select dropdown) and fiscal year (single select, preset to 2026), synced across pages.
function slicers(page) {
  const entity = container(page, "slicer_entity", { x: 752, y: 16, w: 248, h: 80 }, {
    visualType: "slicer",
    syncGroup: { groupName: "EntitySync", fieldChanges: true, filterChanges: true },
    query: { queryState: { Values: { projections: [proj(F.entity)] } } },
    objects: {
      data: [{ properties: { mode: str("Dropdown") } }],
      header: [{ properties: { show: bool(true), text: str("Entity") } }],
    },
    visualContainerObjects: {
      general: [{ properties: { altText: str("Entity filter dropdown. Applies to every page.") } }],
      padding: [vcoPadding(8)],
    },
  });
  const year = container(page, "slicer_year", { x: 1016, y: 16, w: 248, h: 80 }, {
    visualType: "slicer",
    syncGroup: { groupName: "YearSync", fieldChanges: true, filterChanges: true },
    query: { queryState: { Values: { projections: [proj(F.year)] } } },
    objects: {
      data: [{ properties: { mode: str("Dropdown") } }],
      selection: [{ properties: { singleSelect: bool(true), strictSingleSelect: bool(true) } }],
      header: [{ properties: { show: bool(true), text: str("Fiscal year") } }],
      general: [{
        properties: {
          filter: {
            filter: {
              Version: 2,
              From: [{ Name: "d", Entity: "dim_date", Type: 0 }],
              Where: [{
                Condition: {
                  In: {
                    Expressions: [{ Column: { Expression: { SourceRef: { Source: "d" } }, Property: "fiscal_year" } }],
                    Values: [[{ Literal: { Value: "2026L" } }]],
                  },
                },
              }],
            },
          },
        },
      }],
    },
    visualContainerObjects: {
      general: [{ properties: { altText: str("Fiscal year filter, set to 2026. Applies to every page.") } }],
      padding: [vcoPadding(8)],
    },
  });
  return [entity, year];
}

// Card with an optional reference label (a second measure shown under the value).
function card(page, key, pos, field, label, opts = {}) {
  const objects = {
    value: [{
      properties: {
        fontSize: num(20),
        ...(opts.units ? { labelDisplayUnits: str(opts.units) } : {}),
        ...(opts.precision !== undefined ? { labelPrecision: int(opts.precision) } : {}),
      },
      selector: { id: "default" },
    }],
    label: [{ properties: { show: bool(true), text: str(label), fontSize: num(11), fontColor: fill(C.muted) }, selector: { id: "default" } }],
    padding: [{ properties: { paddingUniform: num(8) }, selector: { id: "default" } }],
    layout: [{ properties: { paddingUniform: num(0) }, selector: { id: "default" } }],
    outline: [{ properties: { show: bool(false) }, selector: { id: "default" } }],
  };
  if (opts.reference) {
    const refId = id(page, key, "ref");
    const sel = { data: [{ dataViewWildcard: { matchingOption: 0 } }], metadata: ref(field), id: refId, order: 0 };
    const partSel = { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: ref(field), id: refId };
    objects.referenceLabel = [{ properties: { value: { expr: opts.reference.field } }, selector: sel }];
    const titleProps = { show: bool(true), titleContentType: str("custom"), titleText: str(opts.reference.title), titleFontColor: fill(C.muted) };
    objects.referenceLabelTitle = [
      { properties: titleProps, selector: { id: "default" } },
      { properties: titleProps, selector: partSel },
    ];
    const valueProps = { show: bool(true), valueFontColor: opts.reference.signColor ? signFont(opts.reference.field) : fill(C.text), valueBold: bool(true) };
    if (opts.reference.units) valueProps.valueDisplayUnits = str(opts.reference.units);
    objects.referenceLabelValue = [{ properties: valueProps, selector: partSel }];
  }
  return container(page, key, pos, {
    visualType: "cardVisual",
    query: { queryState: { Data: { projections: [proj(field)] } } },
    objects,
    visualContainerObjects: {
      title: [{ properties: { show: bool(false) } }],
      general: [{ properties: { altText: str(opts.alt || label) } }],
      padding: [vcoPadding(8)],
      spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: "default" } }],
    },
  });
}

// Green when the measure is above zero, red when below (the reporting sign makes > 0 favourable on every line).
function signCases(field, pos, neg) {
  return {
    expr: {
      Conditional: {
        Cases: [
          { Condition: { Comparison: { ComparisonKind: 1, Left: field, Right: { Literal: { Value: "0D" } } } }, Value: { Literal: { Value: `'${pos}'` } } },
          { Condition: { Comparison: { ComparisonKind: 3, Left: field, Right: { Literal: { Value: "0D" } } } }, Value: { Literal: { Value: `'${neg}'` } } },
        ],
      },
    },
  };
}
const signFont = (field) => ({ solid: { color: signCases(field, C.green, C.red) } });
const signBack = (field) => ({ solid: { color: signCases(field, C.greenSoft, C.redSoft) } });

const axisOn = { show: bool(true), fontSize: num(10), labelColor: fill(C.muted), showAxisTitle: bool(false) };
const legendTop = [{ properties: { show: bool(true), position: str("Top"), fontSize: num(10), labelColor: fill(C.muted) } }];

function lineChart(page, key, pos, category, series, title, alt, opts = {}) {
  return container(page, key, pos, {
    visualType: "lineChart",
    query: {
      queryState: {
        Category: { projections: [proj(category)] },
        Y: { projections: series.map((s) => named(s.field, s.name)) },
      },
    },
    objects: {
      dataPoint: series.map((s) => ({ properties: { fill: fill(s.color) }, selector: { metadata: ref(s.field) } })),
      lineStyles: [
        { properties: { strokeWidth: num(2), lineChartType: str("linear"), areaShow: bool(false) } },
        ...series.filter((s) => s.dashed).map((s) => ({ properties: { lineStyle: str("dashed") }, selector: { metadata: ref(s.field) } })),
      ],
      legend: legendTop,
      labels: [{ properties: { show: bool(false) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { ...axisOn, gridlineShow: bool(true), gridlineColor: fill(C.grid), labelDisplayUnits: str("1000") } }],
    },
    visualContainerObjects: chartVcos(title, alt, opts.subtitle),
  }, opts.filters ? { filterConfig: { filters: opts.filters } } : {});
}

// ---------- pages ----------
const PAGE_IDS = {
  pnl: "a1b2c3d4e5f6a7b8c901",
  bridge: "a1b2c3d4e5f6a7b8c902",
  pvm: "a1b2c3d4e5f6a7b8c903",
  checks: "a1b2c3d4e5f6a7b8c904",
};

function pnlPage() {
  const p = PAGE_IDS.pnl;
  z = 0;
  const cards = [
    card(p, "card_net_revenue", { x: 16, y: 112, w: 300, h: 96 }, meas("Net Revenue YTD"), "Net revenue YTD", {
      units: "1000000", precision: 2,
      reference: { field: meas("Net Revenue Var vs Budget YTD %"), title: "vs budget", signColor: true },
      alt: "Net revenue year to date, with the variance against budget in percent.",
    }),
    card(p, "card_gross_margin", { x: 332, y: 112, w: 300, h: 96 }, meas("Gross Margin % YTD"), "Gross margin % YTD", {
      reference: { field: meas("Gross Margin % Budget YTD"), title: "budget" },
      alt: "Gross margin percent year to date, with the budgeted gross margin percent.",
    }),
    card(p, "card_ebitda", { x: 648, y: 112, w: 300, h: 96 }, meas("EBITDA YTD"), "EBITDA YTD", {
      units: "1000000", precision: 2,
      reference: { field: meas("EBITDA Budget YTD"), title: "budget", units: "1000000" },
      alt: "EBITDA year to date, with budgeted EBITDA year to date.",
    }),
    card(p, "card_fy_ebitda", { x: 964, y: 112, w: 300, h: 96 }, meas("Full Year Forecast EBITDA"), "Full-year EBITDA forecast (9+3)", {
      units: "1000000", precision: 2,
      reference: { field: meas("Full Year Budget EBITDA"), title: "full-year budget", units: "1000000" },
      alt: "Full-year EBITDA forecast, actual January to September plus the October reforecast, with the full-year budget.",
    }),
  ];
  const values = [
    ["PL Actual YTD", "Actual YTD"], ["PL Budget YTD", "Budget YTD"], ["PL Var vs Budget YTD", "Var vs budget"],
    ["PL Var vs Budget YTD %", "Var %"], ["PL Prior Year YTD", "Prior year YTD"], ["PL % of Net Revenue YTD", "% of net revenue"],
    ["PL Full Year Budget", "FY budget"], ["PL Full Year Forecast", "FY forecast 9+3"],
  ];
  const subtotalRow = {
    Conditional: {
      Cases: [{
        Condition: { Comparison: { ComparisonKind: 0, Left: { Aggregation: { Expression: F.isSubtotal, Function: 4 } }, Right: { Literal: { Value: "1L" } } } },
        Value: { Literal: { Value: `'${C.subtotal}'` } },
      }],
    },
  };
  const matrix = container(p, "matrix_pnl", { x: 16, y: 224, w: 1248, h: 480 }, {
    visualType: "pivotTable",
    query: {
      queryState: {
        Rows: { projections: [named(F.line, "P&L line")] },
        Values: { projections: values.map(([m, n]) => named(meas(m), n)) },
      },
    },
    objects: {
      columnHeaders: [{ properties: { columnAdjustment: str("growToFit"), autoSizeColumnWidth: bool(true), alignment: str("Right") } }],
      subTotals: [{ properties: { rowSubtotals: bool(false), columnSubtotals: bool(false) } }],
      values: [
        ...values.map(([m]) => ({
          properties: { backColor: { solid: { color: { expr: subtotalRow } } } },
          selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: ref(meas(m)) },
        })),
        ...["PL Var vs Budget YTD", "PL Var vs Budget YTD %"].map((m) => ({
          properties: { fontColor: signFont(meas(m)) },
          selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: ref(meas(m)) },
        })),
      ],
      columnFormatting: values.filter(([m]) => !m.includes("%")).map(([m]) => ({
        properties: { labelDisplayUnits: str("1000"), labelPrecision: int(0) },
        selector: { metadata: ref(meas(m)) },
      })),
    },
    visualContainerObjects: chartVcos("P&L against budget, year to date",
      "Matrix of the P&L from net revenue to EBIT: actual and budget year to date, variance in euros and percent, prior year, percent of net revenue, and full-year budget and forecast. Variances are green when favourable and red when unfavourable; subtotal rows are shaded.",
      "€ thousands. Revenue positive, costs negative: a positive variance is favourable on every line. Shaded rows are subtotals"),
  });
  return {
    name: p, displayName: "P&L vs budget",
    visuals: [...header(p, "Is the group ahead of budget?", "Atlântica Components, budget vs actual, year to date to the last closed month (September 2026)"),
      ...slicers(p), ...cards, matrix],
  };
}

function bridgePage() {
  const p = PAGE_IDS.bridge;
  z = 0;
  const amount = meas("Bridge Amount");
  const waterfall = container(p, "waterfall_ebitda", { x: 16, y: 112, w: 832, h: 592 }, {
    visualType: "waterfallChart",
    query: {
      queryState: {
        Category: { projections: [named(F.step, "Step")] },
        Y: { projections: [named(amount, "EBITDA")] },
      },
      sortDefinition: { sort: [{ field: F.step, direction: "Ascending" }], isDefaultSort: true },
    },
    objects: {
      sentimentColors: [{ properties: { increaseFill: fill(C.green), decreaseFill: fill(C.red), totalFill: fill(C.grey) } }],
      labels: [{ properties: { show: bool(true), fontSize: num(10), color: fill(C.text), labelDisplayUnits: str("1000"), labelPrecision: int(0) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { ...axisOn, gridlineShow: bool(true), gridlineColor: fill(C.grid), labelDisplayUnits: str("1000000") } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: chartVcos("EBITDA bridge, budget to actual",
      "Waterfall from budget EBITDA through sales volume, mix, price, services and discounts, unit cost, freight, people, other opex and FX translation to actual EBITDA, which is the total bar.",
      "€ thousands, January to September 2026. The first bar is budget EBITDA, the total is actual EBITDA"),
  }, { filterConfig: { filters: [notInFilter(p, "not_actual", F.step, ["'Actual EBITDA'"])] } });

  const fx = container(p, "bar_fx_entity", { x: 864, y: 112, w: 400, h: 232 }, {
    visualType: "clusteredBarChart",
    query: {
      queryState: {
        Category: { projections: [named(F.entity, "Entity")] },
        Y: { projections: [named(amount, "FX translation")] },
      },
      sortDefinition: { sort: [{ field: amount, direction: "Ascending" }], isDefaultSort: true },
    },
    objects: {
      dataPoint: [{ properties: { fill: { solid: { color: signCases(amount, C.green, C.red) } } }, selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }] } }],
      labels: [{ properties: { show: bool(true), fontSize: num(10), color: fill(C.text), labelDisplayUnits: str("1000"), labelPrecision: int(0) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false), showAxisTitle: bool(false) } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: chartVcos("FX translation effect on EBITDA, by entity",
      "Bar chart of the FX translation step of the EBITDA bridge for each entity. Only the UK entity, which reports in pounds, has one.",
      "€ thousands. Only UK01 reports in GBP"),
  }, { filterConfig: { filters: [inFilter(p, "fx_step", F.step, ["'FX translation'"])] } });

  const uk = lineChart(p, "line_uk_revenue", { x: 864, y: 360, w: 400, h: 344 }, F.month, [
    { field: meas("Actual"), name: "At actual rates", color: C.blue },
    { field: meas("Actual at Budget FX"), name: "At budget rates", color: C.orange, dashed: true },
  ], "UK net revenue at actual and budget rates",
  "Line chart of the UK entity's monthly net revenue in euros at actual exchange rates (solid blue) and at budget rates (dashed orange); the gap is the cost of a weaker pound.",
  {
    subtitle: "€ thousands. The gap is the sterling translation effect",
    filters: [
      inFilter(p, "uk_entity", F.entityId, ["'UK01'"]),
      inFilter(p, "uk_net_revenue", F.pnlGroup, ["'Net revenue'"]),
      inFilter(p, "uk_closed", F.closed, ["true"]),
    ],
  });
  return {
    name: p, displayName: "EBITDA bridge",
    visuals: [...header(p, "What moved EBITDA away from budget?", "Budget EBITDA to actual EBITDA, January to September 2026"),
      ...slicers(p), waterfall, fx, uk],
  };
}

function pvmPage() {
  const p = PAGE_IDS.pvm;
  z = 0;
  const effects = [
    ["Volume Effect", "Volume", C.blue], ["Mix Effect", "Mix", C.grey], ["Price Effect", "Price", C.green],
    ["Unit Cost Effect", "Unit cost", C.orange], ["Margin FX Effect", "FX", C.amber],
  ];
  const stacked = container(p, "bar_pvm_entity", { x: 16, y: 112, w: 616, h: 320 }, {
    visualType: "barChart",
    query: {
      queryState: {
        Category: { projections: [named(F.entity, "Entity")] },
        Y: { projections: effects.map(([m, n]) => named(meas(m), n)) },
      },
    },
    objects: {
      dataPoint: effects.map(([m, , c]) => ({ properties: { fill: fill(c) }, selector: { metadata: ref(meas(m)) } })),
      legend: legendTop,
      labels: [{ properties: { show: bool(false) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { ...axisOn, gridlineShow: bool(true), gridlineColor: fill(C.grid), labelDisplayUnits: str("1000") } }],
    },
    visualContainerObjects: chartVcos("Product margin variance by driver and entity",
      "Stacked bar chart splitting each entity's product margin variance against budget into volume, mix, price, unit cost and FX effects.",
      "€ thousands, January to September 2026. Right of zero is favourable"),
  });
  const scatter = container(p, "scatter_volume_price", { x: 648, y: 112, w: 616, h: 320 }, {
    visualType: "scatterChart",
    query: {
      queryState: {
        Category: { projections: [named(F.productLine, "Product line")] },
        X: { projections: [named(meas("Units Var vs Budget %"), "Units vs budget %")] },
        Y: { projections: [named(meas("Price Effect"), "Price effect")] },
      },
    },
    objects: {
      dataPoint: [{ properties: { fill: fill(C.blue) } }],
      categoryLabels: [{ properties: { show: bool(true), fontSize: num(10), color: fill(C.text) } }],
      categoryAxis: [{ properties: { ...axisOn, showAxisTitle: bool(true), gridlineShow: bool(true), gridlineColor: fill(C.grid) } }],
      valueAxis: [{ properties: { ...axisOn, showAxisTitle: bool(true), gridlineShow: bool(true), gridlineColor: fill(C.grid), labelDisplayUnits: str("1000") } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: chartVcos("Volume against price, by product line",
      "Scatter plot with one point per product line: units against budget in percent on the horizontal axis and price effect in euros on the vertical axis.",
      "Units vs budget, closed months · price effect in € thousands"),
  }, { filterConfig: { filters: [inFilter(p, "scatter_closed", F.closed, ["true"])] } });
  const matrix = container(p, "matrix_pvm", { x: 16, y: 448, w: 1248, h: 256 }, {
    visualType: "pivotTable",
    query: {
      queryState: {
        Rows: { projections: [named(F.productLine, "Product line")] },
        Columns: { projections: [named(F.entity, "Entity")] },
        Values: { projections: [named(meas("Units Var vs Budget %"), "Units vs budget"), named(meas("Product Margin Var"), "Margin var")] },
      },
    },
    objects: {
      columnHeaders: [{ properties: { columnAdjustment: str("growToFit"), autoSizeColumnWidth: bool(true) } }],
      values: ["Units Var vs Budget %", "Product Margin Var"].map((m) => ({
        properties: { fontColor: signFont(meas(m)) },
        selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: ref(meas(m)) },
      })),
      columnFormatting: [{ properties: { labelDisplayUnits: str("1000"), labelPrecision: int(0) }, selector: { metadata: ref(meas("Product Margin Var")) } }],
    },
    visualContainerObjects: chartVcos("Units and product margin against budget, by product line and entity",
      "Matrix of product lines by entity with units against budget in percent and product margin variance in euros; green is favourable, red unfavourable.",
      "Closed months only. Margin variance in € thousands"),
  }, { filterConfig: { filters: [inFilter(p, "matrix_closed", F.closed, ["true"])] } });
  return {
    name: p, displayName: "Margin PVM",
    visuals: [...header(p, "Is margin growth coming from price or volume?", "Product margin, budget to actual, split into volume, mix, price, unit cost and FX"),
      ...slicers(p), stacked, scatter, matrix],
  };
}

function checksPage() {
  const p = PAGE_IDS.checks;
  z = 0;
  const varYtd = meas("Var vs Budget YTD");
  const ccMatrix = container(p, "matrix_cost_centres", { x: 16, y: 112, w: 752, h: 328 }, {
    visualType: "pivotTable",
    query: {
      queryState: {
        Rows: { projections: [named(F.costCentre, "Cost centre")] },
        Columns: { projections: [named(F.pnlGroup, "Cost group")] },
        Values: { projections: [named(varYtd, "Var vs budget YTD")] },
      },
    },
    objects: {
      columnHeaders: [{ properties: { columnAdjustment: str("growToFit"), autoSizeColumnWidth: bool(true) } }],
      values: [{
        properties: { backColor: signBack(varYtd) },
        selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: ref(varYtd) },
      }],
      columnFormatting: [{ properties: { labelDisplayUnits: str("1000"), labelPrecision: int(0) }, selector: { metadata: ref(varYtd) } }],
    },
    visualContainerObjects: chartVcos("Operating cost variance against budget, by cost centre",
      "Matrix of operating cost groups by cost centre with the variance against budget year to date; green cells are under budget, red cells over budget.",
      "€ thousands, year to date. Green: below budget (favourable). Red: above budget"),
  }, { filterConfig: { filters: [inFilter(p, "opex_only", F.pnlSubtotal, ["'EBITDA'"])] } });

  const freight = lineChart(p, "line_freight", { x: 784, y: 112, w: 480, h: 328 }, F.month, [
    { field: meas("Actual"), name: "Actual", color: C.blue },
    { field: meas("Budget"), name: "Budget", color: C.grey, dashed: true },
  ], "Portugal outbound freight, actual against budget",
  "Line chart of monthly outbound freight cost for the Portuguese entity, actual (solid blue) and budget (dashed grey); costs are negative, so a lower line is a higher cost.",
  {
    subtitle: "€ thousands, costs shown negative. New carrier from March 2026",
    filters: [
      inFilter(p, "freight_account", F.accountId, ["'5200'"]),
      inFilter(p, "freight_entity", F.entityId, ["'PT01'"]),
    ],
  });

  const dup = card(p, "card_duplicates", { x: 16, y: 456, w: 232, h: 120 }, meas("Duplicate Invoices"), "Duplicate invoices", {
    alt: "Number of invoices posted more than once.",
  });
  const exceptions = card(p, "card_exceptions", { x: 16, y: 592, w: 232, h: 112 }, meas("Journal Exceptions"), "Journal exceptions", {
    alt: "Number of ledger exceptions to clear: duplicate invoices and cost spikes.",
  });
  const table = container(p, "table_journal_checks", { x: 264, y: 456, w: 1000, h: 248 }, {
    visualType: "tableEx",
    query: {
      queryState: {
        Values: {
          projections: [
            named(F.jc("check_type"), "Check"),
            named(F.entityId, "Entity"),
            named(F.accountName, "Account"),
            named(F.jc("month_start"), "Month"),
            named(F.jc("vendor"), "Vendor"),
            named(F.jc("document_ref"), "Document"),
            named(F.jc("postings"), "Postings"),
            named(F.jc("amount_lc"), "Amount (LC)"),
            named(F.jc("change_vs_ly"), "Change vs LY"),
          ],
        },
      },
      sortDefinition: { sort: [{ field: F.jc("month_start"), direction: "Ascending" }], isDefaultSort: true },
    },
    objects: {
      columnHeaders: [{ properties: { columnAdjustment: str("growToFit"), autoSizeColumnWidth: bool(true) } }],
      total: [{ properties: { totals: bool(false) } }],
    },
    visualContainerObjects: chartVcos("Ledger exceptions to clear before close",
      "Table of ledger exceptions: duplicate invoices and cost spikes, with entity, account, month, vendor, document, number of postings, amount in local currency and change against last year.",
      "Filtered by the year slicer: the FR01 bonus spike is in December 2025"),
  });
  return {
    name: p, displayName: "Cost centres and checks",
    visuals: [...header(p, "Where are costs over budget, and what must be fixed before close?", "Operating costs by cost centre, outbound freight in Portugal and the ledger checks"),
      ...slicers(p), ccMatrix, freight, dup, exceptions, table],
  };
}

// ---------- theme ----------
function theme(name) {
  const axis = { gridlineColor: { solid: { color: C.grid } }, labelColor: { solid: { color: C.muted } } };
  return {
    $schema: "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.153.json",
    name,
    dataColors: [C.blue, C.orange, C.green, C.amber, C.grey],
    good: C.green, neutral: C.grey, bad: C.red,
    maximum: "#256ABF", center: "#79A6DD", minimum: "#CDE2FB", null: C.grey,
    foreground: C.text, foregroundNeutralSecondary: C.muted, foregroundNeutralTertiary: C.muted,
    background: C.card, backgroundLight: C.grid, backgroundNeutral: C.border, tableAccent: C.blue,
    textClasses: {
      callout: { fontSize: 20, fontFace: "Segoe UI Semibold", color: C.text },
      title: { fontSize: 12, fontFace: "Segoe UI Semibold", color: C.text },
      header: { fontSize: 12, fontFace: "Segoe UI Semibold", color: C.text },
      label: { fontSize: 10, fontFace: "Segoe UI", color: C.text },
    },
    visualStyles: {
      "*": {
        "*": {
          background: [{ show: true, color: { solid: { color: C.card } }, transparency: 0 }],
          border: [{ show: true, color: { solid: { color: C.border } }, radius: 6, width: 1 }],
          dropShadow: [{ show: false }],
          padding: [{ top: 8, bottom: 8, left: 8, right: 8 }],
          title: [{ show: true, fontFamily: "Segoe UI Semibold", fontSize: 12, fontColor: { solid: { color: C.text } } }],
          subTitle: [{ fontFamily: "Segoe UI", fontSize: 10, fontColor: { solid: { color: C.muted } } }],
          categoryAxis: [{ ...axis, gridlineStyle: "solid" }],
          valueAxis: [{ ...axis, gridlineStyle: "solid" }],
          legend: [{ labelColor: { solid: { color: C.muted } } }],
        },
      },
      textbox: { "*": { padding: [{ top: 0, bottom: 0, left: 0, right: 0 }], background: [{ show: false }], border: [{ show: false }] } },
      cardVisual: { "*": { value: [{ bold: true, $id: "default" }], label: [{ show: true, $id: "default" }], title: [{ show: false }] } },
      slicer: {
        "*": {
          header: [{ fontFamily: "Segoe UI Semibold", textSize: 10, fontColor: { solid: { color: C.text } }, outlineStyle: 0 }],
          items: [{ fontFamily: "Segoe UI", textSize: 10, fontColor: { solid: { color: C.text } }, outlineStyle: 0, padding: 2 }],
        },
      },
      tableEx: {
        "*": {
          columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: "growToFit", backColor: { solid: { color: C.page } }, fontColor: { solid: { color: C.text } }, bold: true }],
          values: [{ backColorPrimary: { solid: { color: C.card } }, backColorSecondary: { solid: { color: "#FAFBFC" } }, fontColorPrimary: { solid: { color: C.text } }, fontColorSecondary: { solid: { color: C.text } } }],
        },
      },
      pivotTable: {
        "*": {
          columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: "growToFit", backColor: { solid: { color: C.page } }, fontColor: { solid: { color: C.text } }, bold: true }],
          rowHeaders: [{ fontColor: { solid: { color: C.text } } }],
          values: [{ backColorPrimary: { solid: { color: C.card } }, backColorSecondary: { solid: { color: C.card } }, fontColorPrimary: { solid: { color: C.text } }, fontColorSecondary: { solid: { color: C.text } } }],
        },
      },
    },
  };
}

// ---------- write ----------
const write = (file, obj) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
};

const pages = [pnlPage(), bridgePage(), pvmPage(), checksPage()];
for (const page of pages) {
  const dir = path.join(DEF, "pages", page.name);
  fs.rmSync(path.join(dir, "visuals"), { recursive: true, force: true });
  write(path.join(dir, "page.json"), {
    $schema: PAGE_SCHEMA,
    name: page.name,
    displayName: page.displayName,
    displayOption: "FitToPage",
    height: 720,
    width: 1280,
    objects: {
      background: [{ properties: { color: fill(C.page), transparency: num(0) } }],
      outspace: [{ properties: { color: fill(C.page), transparency: num(0) } }],
    },
  });
  for (const v of page.visuals) write(path.join(dir, "visuals", v.name, "visual.json"), v);
}

const pagesJsonPath = path.join(DEF, "pages", "pages.json");
const pagesJson = JSON.parse(fs.readFileSync(pagesJsonPath, "utf8"));
pagesJson.pageOrder = pages.map((p) => p.name);
pagesJson.activePageName = pages[0].name;
write(pagesJsonPath, pagesJson);

// Theme: rotate the file name on every run so Desktop does not serve a cached copy.
const regDir = path.join(REPORT, "StaticResources", "RegisteredResources");
fs.mkdirSync(regDir, { recursive: true });
for (const f of fs.readdirSync(regDir)) if (/^AtlanticaFPA-[0-9a-f]+\.json$/.test(f)) fs.rmSync(path.join(regDir, f));
const themeName = `AtlanticaFPA-${crypto.randomBytes(4).toString("hex")}.json`;
write(path.join(regDir, themeName), theme(themeName));

const reportPath = path.join(DEF, "report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
report.themeCollection.customTheme = {
  name: themeName,
  reportVersionAtImport: report.themeCollection.baseTheme.reportVersionAtImport,
  type: "RegisteredResources",
};
report.resourcePackages = report.resourcePackages.filter((r) => r.type !== "RegisteredResources");
report.resourcePackages.push({
  name: "RegisteredResources",
  type: "RegisteredResources",
  items: [{ name: themeName, path: themeName, type: "CustomTheme" }],
});
write(reportPath, report);

console.log(`Wrote ${pages.length} pages, ${pages.reduce((n, p) => n + p.visuals.length, 0)} visuals, theme ${themeName}`);
