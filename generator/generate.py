"""Generate the synthetic finance data for Atlântica Components, a fictional B2B distributor of industrial parts.

Four legal entities (Portugal HQ, Spain, France, United Kingdom), January 2024 to September 2026 closed,
with a double-entry general ledger, a sales sub-ledger with units, monthly FX rates, the FY2025 and FY2026
budgets and the October 2026 reforecast (9 months actual + 3 months forecast).

The business stories below are planted on purpose so the dashboard has something real to find.
They are documented in the README so nobody mistakes them for real findings about a real company.

  1. UK: sterling weakens through 2026 (budget rate 1.19 EUR/GBP, about 1.12 by September). UK sales in
     pounds are close to budget, so most of the UK miss in euros is FX translation, not trading.
  2. PT: a new outbound carrier contract from March 2026 lifts outbound freight about 35% above budget.
  3. ES: six budgeted sales hires arrive four to five months late. Salaries are under budget (favourable),
     but Hydraulics volume in Spain falls about 12% short of budget.
  4. PT: a 4% list-price increase in January 2026 sticks, while Fasteners volume in Portugal drops about 6%.
  5. Group: Tools, the lowest-margin line, grows well above budget, diluting the gross margin.
  6. UK: a software invoice from CloudSuite Ltd is posted twice in June 2026 and reversed in August.
  7. FR: the year-end bonus true-up in December 2025 is booked in one month, a seasonal spike to explain.
  8. Group: the bearings supplier adds a 6% steel surcharge from May 2026 that was not in the budget.

Run: python generator/generate.py  (writes data/raw/*.csv, about 10 s)
"""
import csv
import os
from datetime import date, timedelta

import numpy as np

SEED = 20261025
rng = np.random.default_rng(SEED)
OUT = os.environ.get("FPA_RAW_PATH", "data/raw")
os.makedirs(OUT, exist_ok=True)

FIRST = date(2024, 1, 1)
LAST_CLOSED = date(2026, 9, 1)  # month start of the last closed month
FC_END = date(2026, 12, 1)

ENTITIES = {  # entity: currency, base monthly units multiplier, social security rate
    "PT01": ("EUR", 1.00, 0.2375),
    "ES01": ("EUR", 0.75, 0.30),
    "FR01": ("EUR", 0.60, 0.42),
    "UK01": ("GBP", 0.45, 0.138),
}
# product line: budget unit price (EUR, UK price in GBP derived), unit cost share, base units/month (PT)
PRODUCTS = {
    "BRG": ("Bearings", 38.0, 0.62, 15000),
    "FST": ("Fasteners", 4.2, 0.66, 110000),
    "HYD": ("Hydraulics", 145.0, 0.69, 3400),
    "PNE": ("Pneumatics", 88.0, 0.67, 3900),
    "TLS": ("Tools", 62.0, 0.80, 5000),
}
SEASON = np.array([0.88, 0.95, 1.07, 1.04, 1.06, 1.03, 0.97, 0.72, 1.05, 1.10, 1.07, 0.86])
GROWTH = {2024: 1.00, 2025: 1.05, 2026: 1.09}
BUDGET_GROWTH = {2025: 1.06, 2026: 1.10}
BUDGET_FX = {2024: 1.17, 2025: 1.17, 2026: 1.19}  # EUR per GBP


def months(start, end):
    d = start
    while d <= end:
        yield d
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def actual_fx(m):
    """Monthly average EUR per GBP: stable around 1.17-1.19 until 2025, then sterling weakens in 2026."""
    i = (m.year - 2024) * 12 + m.month - 1
    if m.year < 2026:
        return round(1.175 + 0.01 * np.sin(i / 2.5), 4)
    return round(1.185 - 0.0075 * m.month, 4)


def workdays(m):
    nxt = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
    d, out = m, []
    while d < nxt:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


# Headcount plan: entity -> cost centre -> heads, monthly salary (local currency)
HEADCOUNT = {
    "PT01": {"SAL": (24, 3100), "MKT": (6, 3000), "OPS": (38, 1700), "FIN": (9, 3300), "IT": (7, 3600), "HR": (4, 2900), "MGT": (4, 8500)},
    "ES01": {"SAL": (18, 3500), "MKT": (3, 3300), "OPS": (26, 2100), "FIN": (5, 3600), "IT": (3, 3800), "HR": (2, 3100), "MGT": (2, 9000)},
    "FR01": {"SAL": (14, 4300), "MKT": (3, 4000), "OPS": (19, 2800), "FIN": (4, 4400), "IT": (2, 4700), "HR": (2, 3900), "MGT": (2, 10500)},
    "UK01": {"SAL": (10, 3900), "MKT": (2, 3600), "OPS": (13, 2500), "FIN": (3, 4100), "IT": (2, 4500), "HR": (1, 3500), "MGT": (1, 9800)},
}
VENDORS = {  # opex account: vendors
    "6100": ["Imo Parques SA", "Logis Real Estate"],
    "6200": ["CloudSuite Ltd", "DataBridge SaaS", "NorthNet Telecom"],
    "6300": ["Expense claims"],
    "6400": ["Brightline Media", "TradeFair Events"],
    "6500": ["Mendes & Ross Audit", "Lex Partners"],
    "6600": ["Office supplies", "Insurance broker"],
}
MONTHLY_OPEX = {  # account -> monthly cost per entity before scaling (local currency at PT scale)
    "6100": 52000, "6200": 31000, "6400": 26000, "6500": 14000, "6600": 11000, "7000": 64000,
}

journals, plan, sales = [], [], []
jid = 0


def post(entity, day, account, cost_centre, amount, offset_account, source, vendor="", doc_ref="", product=""):
    """Append one balanced journal: amount on the P&L account (debit +, credit -), the opposite on the offset."""
    global jid
    jid += 1
    j = f"J{jid:07d}"
    amt = round(float(amount), 2)
    journals.append([j, 1, entity, day.isoformat(), account, cost_centre, product, amt, source, vendor, doc_ref])
    journals.append([j, 2, entity, day.isoformat(), offset_account, "", "", -amt, source, vendor, doc_ref])


def price_factor(entity, product, m):
    f = 1.0 + 0.02 * (m.year - 2024)
    if entity == "PT01" and m.year == 2026:
        f *= 1.04  # story 4: list-price increase that sticks
    return f


def volume_story(entity, product, m):
    f = 1.0
    if m.year == 2026:
        if entity == "ES01" and product == "HYD":
            f *= 0.88  # story 3: late sales hires
        if entity == "PT01" and product == "FST":
            f *= 0.94  # story 4: volume reacts to price
        if product == "TLS":
            f *= 1.16  # story 5: low-margin line outgrows plan
    return f


def budget_units(entity, product, m):
    base = PRODUCTS[product][3] * ENTITIES[entity][1] * SEASON[m.month - 1]
    return base * BUDGET_GROWTH.get(m.year, 1.0)


def local_price(entity, product, m, budget=False):
    p = PRODUCTS[product][1]
    if entity == "UK01":
        p = p / 1.17
    if budget:
        return p * (1.0 + 0.02 * (m.year - 2024))
    return p * price_factor(entity, product, m)


# ---------- actuals ----------
for m in months(FIRST, LAST_CLOSED):
    days = workdays(m)
    for e, (cur, scale, ss_rate) in ENTITIES.items():
        # revenue and cost of materials by product line, posted as daily invoices
        rev_total = 0.0
        for p, (_, _, cost_share, base) in PRODUCTS.items():
            units = base * scale * SEASON[m.month - 1] * GROWTH[m.year] * volume_story(e, p, m)
            units *= rng.normal(1.0, 0.03)
            price = local_price(e, p, m) * rng.normal(1.0, 0.005)
            units = int(round(units))
            revenue = units * price
            sales.append(["ACT", e, p, m.isoformat(), units, round(revenue, 2)])
            weights = rng.dirichlet(np.ones(len(days)) * 8)
            alloc = np.round(weights * revenue, 2)
            alloc[-1] = round(revenue - alloc[:-1].sum(), 2)
            unit_cost = PRODUCTS[p][1] * cost_share * (1 / 1.17 if e == "UK01" else 1) * (1 + 0.015 * (m.year - 2024))
            if p == "BRG" and m >= date(2026, 5, 1):
                unit_cost *= 1.06  # story 8: steel surcharge from the bearings supplier
            for d, a in zip(days, alloc):
                post(e, d, "4000", "SAL", -a, "1100", "AR", doc_ref=f"INV-{e}-{d:%y%m%d}-{p}", product=p)
                post(e, d, "5000", "OPS", a / price * unit_cost, "1300", "INV", product=p)
            rev_total += revenue
        # discounts, services, freight
        post(e, m + timedelta(days=27), "4900", "SAL", rev_total * rng.normal(0.031, 0.002), "1100", "AR")
        heads_sal = HEADCOUNT[e]["SAL"][0]
        svc = rev_total * 0.045
        if e == "ES01" and m.year == 2026:
            svc *= 0.85
        post(e, m + timedelta(days=27), "4100", "SAL", -svc * rng.normal(1, 0.04), "1100", "AR")
        post(e, m + timedelta(days=20), "5100", "OPS", rev_total * 0.018 * rng.normal(1, 0.05), "2100", "AP", "Iberlog Freight")
        out_rate = 0.022
        if e == "PT01" and m >= date(2026, 3, 1):
            out_rate *= 1.35  # story 2
        for wk in range(4):
            post(e, days[min(len(days) - 1, wk * 5 + 2)], "5200", "OPS", rev_total * out_rate / 4 * rng.normal(1, 0.04),
                 "2100", "AP", "TransAtlas Carriers" if (e == "PT01" and m >= date(2026, 3, 1)) else "Rodo Express",
                 f"TA-{e}-{m:%y%m}-{wk}")
        # payroll
        pay_day = days[-1]
        for cc, (heads, salary) in HEADCOUNT[e].items():
            h = heads * (1 + 0.04 * (m.year - 2024))
            if e == "ES01" and cc == "SAL" and m.year == 2026:
                h -= 6 if m.month <= 4 else (3 if m.month == 5 else 0)  # story 3
            sal_cost = h * salary * (1 + 0.03 * (m.year - 2024)) * rng.normal(1, 0.01)
            post(e, pay_day, "6000", cc, sal_cost, "2300", "PAY")
            post(e, pay_day, "6010", cc, sal_cost * ss_rate, "2300", "PAY")
            bonus = sal_cost * 0.06
            if e == "FR01" and m == date(2025, 12, 1):
                bonus = sal_cost * 0.06 * 12 * 0.55  # story 7: year-end true-up booked at once
            post(e, pay_day, "6020", cc, bonus, "2200", "ACCR")
        # travel: many small claims tied to sales heads
        n_claims = int(heads_sal * 3)
        for _ in range(n_claims):
            d = days[rng.integers(len(days))]
            post(e, d, "6300", "SAL", rng.gamma(2.0, 95.0) * (1.25 if e in ("FR01", "UK01") else 1), "2100", "AP", "Expense claims")
        # other opex by vendor invoice
        for acct, monthly in MONTHLY_OPEX.items():
            amt = monthly * scale * (1 + 0.03 * (m.year - 2024))
            if e == "UK01":
                amt /= 1.17
            if acct == "6400":
                amt *= {3: 1.8, 4: 1.4, 10: 1.7}.get(m.month, 0.8)  # trade-fair season
            if acct == "6500" and m.month in (2, 3):
                amt *= 2.2  # audit fieldwork
            if acct == "7000":
                post(e, days[-1], "7000", "FIN", amt, "1500", "FA")
                continue
            vendors = VENDORS[acct]
            for i, v in enumerate(vendors):
                share = 1 / len(vendors)
                cc = {"6100": "OPS", "6200": "IT", "6400": "MKT", "6500": "FIN", "6600": "MGT"}[acct]
                ref = f"{v[:3].upper()}-{e}-{m:%y%m}-{i}"
                inv_amt = round(amt * share * rng.normal(1, 0.03), 2)
                post(e, days[4 + i], acct, cc, inv_amt, "2100", "AP", v, ref)
                if e == "UK01" and v == "CloudSuite Ltd" and m == date(2026, 6, 1):
                    post(e, days[9], acct, cc, inv_amt, "2100", "AP", v, ref)  # story 6: duplicate posting
                    dup_amt = inv_amt
        if e == "UK01" and m == date(2026, 8, 1):
            post(e, days[3], "6200", "IT", -dup_amt, "2100", "AP", "CloudSuite Ltd", "REV-CLO-UK01-2606")

# ---------- budgets (FY2025, FY2026) and the October 2026 reforecast ----------
def plan_lines(scenario, m, factor=None):
    """Budget at entity x cost centre x account x month, local currency, reporting sign as in the GL (debit +)."""
    rows = []
    for e, (cur, scale, ss_rate) in ENTITIES.items():
        rev_total = 0.0
        for p, (_, _, cost_share, base) in PRODUCTS.items():
            units = budget_units(e, p, m)
            price = local_price(e, p, m, budget=True)
            rev = units * price
            unit_cost = PRODUCTS[p][1] * cost_share * (1 / 1.17 if e == "UK01" else 1) * (1 + 0.015 * (m.year - 2024))
            sales.append([scenario, e, p, m.isoformat(), int(round(units)), round(rev, 2)])
            rows.append([scenario, e, "SAL", "4000", p, m, -rev])
            rows.append([scenario, e, "OPS", "5000", p, m, units * unit_cost])
            rev_total += rev
        rows.append([scenario, e, "SAL", "4900", "", m, rev_total * 0.030])
        rows.append([scenario, e, "SAL", "4100", "", m, -rev_total * 0.045])
        rows.append([scenario, e, "OPS", "5100", "", m, rev_total * 0.018])
        rows.append([scenario, e, "OPS", "5200", "", m, rev_total * 0.022])
        for cc, (heads, salary) in HEADCOUNT[e].items():
            h = heads * (1 + 0.04 * (m.year - 2024))
            sal = h * salary * (1 + 0.03 * (m.year - 2024))
            rows.append([scenario, e, cc, "6000", "", m, sal])
            rows.append([scenario, e, cc, "6010", "", m, sal * ss_rate])
            rows.append([scenario, e, cc, "6020", "", m, sal * 0.06])
        rows.append([scenario, e, "SAL", "6300", "", m, HEADCOUNT[e]["SAL"][0] * 3 * 190 * (1.25 if e in ("FR01", "UK01") else 1)])
        for acct, monthly in MONTHLY_OPEX.items():
            amt = monthly * scale * (1 + 0.03 * (m.year - 2024))
            if e == "UK01":
                amt /= 1.17
            if acct == "6400":
                amt *= {3: 1.8, 4: 1.4, 10: 1.7}.get(m.month, 0.8)
            if acct == "6500" and m.month in (2, 3):
                amt *= 2.2
            cc = {"6100": "OPS", "6200": "IT", "6400": "MKT", "6500": "FIN", "6600": "MGT", "7000": "FIN"}[acct]
            rows.append([scenario, e, cc, acct, "", m, amt])
    return rows


for m in months(date(2025, 1, 1), date(2025, 12, 1)):
    plan.extend(plan_lines("BUD2025", m))
for m in months(date(2026, 1, 1), FC_END):
    plan.extend(plan_lines("BUD2026", m))

# Reforecast 9+3: closed months are left to actuals; Oct-Dec = budget x year-to-date run-rate per entity, account
ytd_act, ytd_bud = {}, {}
for j in journals:
    _, line, e, d, acct, cc, prod, amt, *_ = j
    if acct[0] in "4567" and d >= "2026-01-01":
        ytd_act[(e, acct)] = ytd_act.get((e, acct), 0) + amt
for r in plan:
    if r[0] == "BUD2026" and r[5] <= LAST_CLOSED:
        ytd_bud[(r[1], r[3])] = ytd_bud.get((r[1], r[3]), 0) + r[6]
for r in [r for r in plan if r[0] == "BUD2026" and r[5] > LAST_CLOSED]:
    k = (r[1], r[3])
    ratio = ytd_act.get(k, 0) / ytd_bud[k] if ytd_bud.get(k) else 1.0
    if r[3] == "6200" and r[1] == "UK01":
        ratio = 1.0  # the duplicate invoice was reversed; do not carry it forward
    if r[3] == "6020" and r[1] == "FR01":
        ratio = 1.0
    plan.append(["FC2026_9+3", r[1], r[2], r[3], r[4], r[5], r[6] * ratio])
for s in [s for s in sales if s[0] == "BUD2026" and s[3] > LAST_CLOSED.isoformat()]:
    act = sum(x[4] for x in sales if x[0] == "ACT" and x[1] == s[1] and x[2] == s[2] and x[3] >= "2026-01-01")
    bud = sum(x[4] for x in sales if x[0] == "BUD2026" and x[1] == s[1] and x[2] == s[2] and x[3] <= LAST_CLOSED.isoformat())
    act_rev = sum(x[5] for x in sales if x[0] == "ACT" and x[1] == s[1] and x[2] == s[2] and x[3] >= "2026-01-01")
    bud_rev = sum(x[5] for x in sales if x[0] == "BUD2026" and x[1] == s[1] and x[2] == s[2] and x[3] <= LAST_CLOSED.isoformat())
    sales.append(["FC2026_9+3", s[1], s[2], s[3], int(round(s[4] * act / bud)), round(s[5] * act_rev / bud_rev, 2)])

# ---------- FX ----------
fx = []
for m in months(FIRST, FC_END):
    act = actual_fx(m) if m <= LAST_CLOSED else actual_fx(LAST_CLOSED)
    fx.append(["GBP", m.isoformat(), act, BUDGET_FX[m.year], int(m <= LAST_CLOSED)])
    fx.append(["EUR", m.isoformat(), 1.0, 1.0, int(m <= LAST_CLOSED)])


def write(name, header, rows):
    with open(os.path.join(OUT, name), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows):,} rows")


write("gl_journal_lines.csv",
      ["journal_id", "line_number", "entity_id", "posting_date", "account_id", "cost_centre_id", "product_line_id",
       "amount_lc", "source", "vendor", "document_ref"], journals)
write("plan_lines.csv", ["scenario", "entity_id", "cost_centre_id", "account_id", "product_line_id", "month_start", "amount_lc"],
      [[r[0], r[1], r[2], r[3], r[4], r[5].isoformat(), round(r[6], 2)] for r in plan])
write("sales_volume.csv", ["scenario", "entity_id", "product_line_id", "month_start", "units", "revenue_lc"], sales)
write("fx_rates.csv", ["currency", "month_start", "avg_rate_eur", "budget_rate_eur", "is_closed"], fx)
