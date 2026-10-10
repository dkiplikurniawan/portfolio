"""End-to-end pipeline: data -> validation -> EDA -> backtest -> reports.

Usage (from the project root):
    python -m src.run_pipeline

Writes:
    reports/metrics.json          every number shown on the results page
    reports/series_metrics.csv    per-series, per-origin, per-model errors
    reports/figures/*.svg         charts
    index.html                    static results page (GitHub Pages friendly)
"""
from __future__ import annotations

import json
import warnings
from html import escape
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from .data import PINNED_COMMIT, RAW_URL, SHA256, load_raw, prepare, validate
from .evaluate import (MODELS, ORIGINS, backtest, buffer_scenario,
                       series_metrics, summary, summary_by_origin)

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
FIG = REPORTS / "figures"
EXAMPLE_SERIES = "New South Wales | Supermarket and grocery stores"
EDA_CUTOFF = ORIGINS[0]  # EDA uses only data up to the first forecast origin

# Validated reference palette (categorical slots 1-2) + neutral ink.
INK, INK2, GRID = "#0b0b0b", "#52514e", "#e4e2dc"
C_ACTUAL, C_ETS, C_GBM, C_NAIVE = "#2a78d6", "#eb6834", "#1baf7a", "#8a8984"
MODEL_COLOR = {"Seasonal naive": C_NAIVE, "ETS": C_ETS, "Global GBM": C_GBM}

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": GRID,
    "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
    "axes.titleweight": "bold", "axes.titlesize": 11, "axes.titlecolor": INK,
    "axes.titlelocation": "left", "svg.fonttype": "none",
})


def _save(fig, name: str) -> str:
    FIG.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(FIG / name, format="svg")
    plt.close(fig)
    return f"reports/figures/{name}"


# ------------------------------------------------------------------ EDA
def eda(panel: pd.DataFrame) -> dict:
    hist = panel[panel["Month"] <= EDA_CUTOFF]
    total = hist.groupby("Month")["Turnover"].sum() / 1000  # $ billion

    fig, ax = plt.subplots(figsize=(8, 3.2))
    ax.plot(total.index, total.values, color=C_ACTUAL, lw=1.5)
    ax.set_title("Total monthly turnover, 110 series (A$ billion)")
    ax.set_ylabel("A$ bn")
    f1 = _save(fig, "eda_total.svg")

    # Seasonal index: turnover / centred 12-month moving average, 2006-2015
    def idx(g):
        ma = g.rolling(12, center=True).mean().rolling(2).mean().shift(-1)
        return g / ma
    tot = hist.groupby("Month")["Turnover"].sum()
    si = idx(tot).loc["2006-01-01":].groupby(lambda d: d.month).mean()
    labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    fig, ax = plt.subplots(figsize=(8, 3.0))
    ax.bar(labels, (si.values - 1) * 100, color=C_ACTUAL, width=0.6)
    ax.axhline(0, color=INK2, lw=0.8)
    ax.set_title("Seasonal effect by month, 2006-2015 (% vs trend)")
    ax.set_ylabel("% vs trend")
    f2 = _save(fig, "eda_seasonality.svg")

    # Industry growth 2005 -> 2015 (national annual totals)
    ann = hist.assign(year=hist["Month"].dt.year)
    ann = ann[ann["year"].isin([2005, 2015])].groupby(["Industry", "year"])["Turnover"].sum().unstack()
    cagr = ((ann[2015] / ann[2005]) ** (1 / 10) - 1).mul(100).sort_values()
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh([s if len(s) < 42 else s[:40] + "..." for s in cagr.index],
            cagr.values, color=C_ACTUAL, height=0.6)
    ax.set_title("Annual growth rate by industry, 2005-2015 (CAGR, %)")
    ax.set_xlabel("% per year")
    ax.grid(axis="y", visible=False)
    f3 = _save(fig, "eda_industry_growth.svg")

    peak = labels[int(np.argmax(si.values))]
    return {
        "figures": [f1, f2, f3],
        "peak_month": peak,
        "peak_month_effect_pct": round(float(si.max() - 1) * 100, 1),
        "lowest_month": labels[int(np.argmin(si.values))],
        "lowest_month_effect_pct": round(float(si.min() - 1) * 100, 1),
        "fastest_industry": cagr.index[-1], "fastest_cagr_pct": round(float(cagr.iloc[-1]), 1),
        "slowest_industry": cagr.index[0], "slowest_cagr_pct": round(float(cagr.iloc[0]), 1),
        "cagr_table": {k: round(float(v), 2) for k, v in cagr.items()},
    }


# ------------------------------------------------------------------ charts
def chart_example(panel, bt) -> str:
    g = panel[(panel["key"] == EXAMPLE_SERIES) & (panel["Month"] >= "2014-01-01")]
    d = bt[(bt["key"] == EXAMPLE_SERIES) & (bt["origin"] == ORIGINS[-1])]
    fig, ax = plt.subplots(figsize=(8, 3.4))
    ax.plot(g["Month"], g["Turnover"], color=C_ACTUAL, lw=2, label="Actual")
    for m in MODELS:
        dm = d[d["model"] == m]
        ax.plot(dm["Month"], dm["forecast"], color=MODEL_COLOR[m], lw=1.6,
                ls="--" if m == "Seasonal naive" else "-", label=m)
    ax.axvline(ORIGINS[-1], color=INK2, lw=0.8, ls=":")
    ax.set_title("NSW supermarkets: 2018 forecasts made at Dec 2017 (A$ million)")
    ax.set_ylabel("A$ m")
    ax.legend(frameon=False, ncol=4, loc="upper left", fontsize=9)
    return _save(fig, "forecast_example.svg")


def chart_mase(by_origin: pd.DataFrame) -> str:
    fig, ax = plt.subplots(figsize=(8, 3.2))
    x = np.arange(len(by_origin.index))
    w = 0.26
    for i, m in enumerate(MODELS):
        ax.bar(x + (i - 1) * w, by_origin[m].values, width=w - 0.02,
               color=MODEL_COLOR[m], label=m)
    ax.axhline(1, color=INK2, lw=0.8, ls=":")
    ax.set_xticks(x, [str(y) for y in by_origin.index])
    ax.set_title("Mean MASE by test year (lower is better)")
    ax.set_ylabel("MASE")
    ax.legend(frameon=False, ncol=3, loc="upper right", fontsize=9)
    ax.grid(axis="x", visible=False)
    return _save(fig, "mase_by_year.svg")


# ------------------------------------------------------------------ page
def _fmt(x, nd=2):
    return "–" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x:.{nd}f}"


def write_page(m: dict) -> None:
    s = {r["model"]: r for r in m["summary"]}
    best = min(MODELS[1:], key=lambda k: s[k]["mean_MASE"])
    rel = 100 * (1 - s[best]["mean_MASE"] / s["Seasonal naive"]["mean_MASE"])
    rows = "".join(
        f"<tr><th scope='row'>{escape(k)}</th><td>{_fmt(s[k]['mean_MASE'])}</td>"
        f"<td>{_fmt(s[k]['median_MASE'])}</td><td>{_fmt(s[k]['median_MAPE_pct'], 1)}%</td>"
        f"<td>{_fmt(s[k]['share_beating_baseline_pct'], 0)}{'%' if k != 'Seasonal naive' else ''}</td></tr>"
        for k in MODELS)
    yrows = "".join(
        f"<tr><th scope='row'>{y}</th>" + "".join(
            f"<td>{_fmt(v)}</td>" for v in vals.values()) + "</tr>"
        for y, vals in m["mase_by_test_year"].items())
    buf = m["buffer_scenario"]
    brows = "".join(
        f"<tr><th scope='row'>{r['target_coverage_pct']:.0f}%</th>"
        f"<td>{r['realised_coverage_2018_pct']:.1f}%</td>"
        f"<td>{r['median_buffer_pct_of_forecast']:.1f}%</td></tr>" for r in buf["rows"])
    e = m["eda"]
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Retail Demand Forecasting — Dul Kipli Kurniawan</title>
<meta name="description" content="Reproducible monthly retail turnover forecasting on 110 Australian state-by-industry series: seasonal-naive baseline vs ETS vs a global gradient-boosted model, with rolling-origin evaluation."/>
<link rel="canonical" href="https://dkiplikurniawan.github.io/portfolio/projects/retail-demand-forecasting/"/>
<link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml"/>
<link rel="stylesheet" href="../../assets/case-study.css"/>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar"><div class="wrap"><a href="../../index.html#projects">← Back to portfolio</a></div></header>
<main id="main" class="wrap prose">
<p class="eyebrow">Data science project · Status: completed first version</p>
<h1>Retail Demand Forecasting &amp; Planning Buffers</h1>
<p class="lede">Forecasting 12 months of retail turnover for {m['data']['series_kept']} Australian state-by-industry series, and testing whether a forecast-error buffer actually delivers the coverage it promises.</p>

<dl class="facts">
<div><dt>Data</dt><dd>ABS Retail Trade, cat. 8501.0, table 11 (via tsibbledata), {m['data']['first_month']} to {m['data']['last_month']}</dd></div>
<div><dt>Evaluation</dt><dd>Rolling origin: Dec 2015, Dec 2016, Dec 2017 → next 12 months</dd></div>
<div><dt>Stack</dt><dd>Python, pandas, statsmodels, scikit-learn, matplotlib</dd></div>
<div><dt>Code</dt><dd><a href="https://github.com/dkiplikurniawan/portfolio/tree/main/projects/retail-demand-forecasting">Source and README on GitHub</a></dd></div>
</dl>

<h2>Result in one line</h2>
<p><strong>{escape(best)}</strong> had the lowest mean MASE ({_fmt(s[best]['mean_MASE'])} vs {_fmt(s['Seasonal naive']['mean_MASE'])} for the seasonal-naive baseline, {rel:.0f}% lower) and beat the baseline on {_fmt(s[best]['share_beating_baseline_pct'], 0)}% of series-years. That is a modest, honest improvement: the seasonal-naive baseline is strong for stable retail series.</p>

<h2>1. Problem</h2>
<p>A retailer or supplier planning stock, staffing or purchasing needs to know next year's demand by month. The questions here: how much better than "same month last year" can simple, well-evaluated models do, and how large a buffer above the forecast is needed to cover demand a chosen share of the time?</p>

<h2>2. Data</h2>
<p>Monthly retail turnover (A$ million, current prices) published by the Australian Bureau of Statistics. ABS publishes both industry groups and their sub-industries, so only the {len(m['data']['leaf_industries'])} lowest-level industries are used to avoid double counting. Of {m['data']['leaf_series_total']} leaf series, {m['data']['series_kept']} are complete through {m['data']['last_month']}; {len(m['data']['series_dropped'])} discontinued series were excluded. Validation checks found no missing, duplicate or non-positive values.</p>
<p class="note"><strong>What this data is not:</strong> it is turnover in dollars, not unit sales, and it contains no stock levels, prices, promotions, lead times or costs.</p>

<h2>3. Exploratory analysis</h2>
<p class="small">EDA uses data up to Dec 2015 only, so nothing from the test years informed modelling choices.</p>
<figure><img src="{e['figures'][0]}" width="800" height="320" alt="Line chart of total monthly turnover across 110 series from 1982 to 2015, rising steadily with a sharp spike every December." loading="lazy"/><figcaption>Long-run growth with a strong yearly cycle.</figcaption></figure>
<figure><img src="{e['figures'][1]}" width="800" height="300" alt="Bar chart of the seasonal effect by month. {e['peak_month']} is highest at {e['peak_month_effect_pct']:+.1f}% versus trend; {e['lowest_month']} is lowest at {e['lowest_month_effect_pct']:+.1f}%." loading="lazy"/><figcaption>{e['peak_month']} runs {e['peak_month_effect_pct']:+.1f}% above trend; {e['lowest_month']} {e['lowest_month_effect_pct']:+.1f}%.</figcaption></figure>
<figure><img src="{e['figures'][2]}" width="800" height="500" alt="Horizontal bar chart of annual growth by industry from 2005 to 2015. Fastest: {escape(e['fastest_industry'])} at {e['fastest_cagr_pct']}% per year. Slowest: {escape(e['slowest_industry'])} at {e['slowest_cagr_pct']}% per year." loading="lazy"/><figcaption>Industries grow at very different rates ({escape(e['slowest_industry'])}: {e['slowest_cagr_pct']}%/yr; {escape(e['fastest_industry'])}: {e['fastest_cagr_pct']}%/yr), so a single growth assumption would not fit all series.</figcaption></figure>

<h2>4. Models</h2>
<ul>
<li><strong>Seasonal naive (baseline):</strong> each month next year equals the same month this year.</li>
<li><strong>ETS:</strong> one exponential smoothing model per series on log turnover, with additive damped trend and additive seasonality.</li>
<li><strong>Global GBM:</strong> one gradient-boosted tree model trained across all series to predict year-over-year log growth from lagged growth, horizon, month, state and industry. Every feature is computed from data available at the forecast origin.</li>
</ul>
<p>Hyperparameters were fixed before evaluation and not tuned on the test years.</p>

<h2>5. Evaluation</h2>
<p>Each model forecasts 12 months ahead from three origins (Dec 2015, 2016, 2017) using only data up to the origin, giving {m['n_forecasts']:,} forecasts per model. Series range from under A$1m to over A$2bn a month, so the headline metric is <abbr title="Mean Absolute Scaled Error">MASE</abbr>: MAE divided by the in-sample MAE of the seasonal naive, so 1.0 means "as good as last year's seasonal pattern was historically". MAPE is reported as a secondary metric; the data has no zeros, but small series inflate percentage errors.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Accuracy table"><table>
<caption>Accuracy across {m['data']['series_kept']} series × 3 test years</caption>
<thead><tr><th scope="col">Model</th><th scope="col">Mean MASE</th><th scope="col">Median MASE</th><th scope="col">Median MAPE</th><th scope="col">Series-years beating baseline</th></tr></thead>
<tbody>{rows}</tbody></table></div>
<figure><img src="reports/figures/mase_by_year.svg" width="800" height="320" alt="Grouped bar chart of mean MASE by test year for the three models. ETS is lowest in every year; the seasonal naive baseline is highest." loading="lazy"/></figure>
<div class="table-wrap" tabindex="0" role="region" aria-label="Accuracy by test year table"><table>
<caption>Mean MASE by test year</caption>
<thead><tr><th scope="col">Test year</th>{''.join(f'<th scope="col">{escape(k)}</th>' for k in MODELS)}</tr></thead>
<tbody>{yrows}</tbody></table></div>
<figure><img src="reports/figures/forecast_example.svg" width="800" height="340" alt="Line chart of New South Wales supermarket turnover from 2014 to 2018 with three 2018 forecasts overlaid; all three follow the seasonal pattern closely." loading="lazy"/><figcaption>One example series. Illustrative only; aggregate results are in the tables above.</figcaption></figure>

<h2>6. Planning-buffer scenario</h2>
<p class="note"><strong>Scenario, not an inventory model.</strong> Without stock, unit or lead-time data, true reorder points cannot be computed. Instead: size a per-series buffer above the {escape(buf['model'])} forecast from its 2016–2017 errors, then check how often that buffer would have covered actual 2018 turnover.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Buffer calibration table"><table>
<caption>Buffer calibration, {escape(buf['model'])} forecasts, evaluated on 2018</caption>
<thead><tr><th scope="col">Target coverage</th><th scope="col">Realised coverage 2018</th><th scope="col">Median buffer (% of forecast)</th></tr></thead>
<tbody>{brows}</tbody></table></div>
<p>{escape(buf['interpretation'])}</p>

<h2>7. Limitations</h2>
<ul>
<li>Turnover is in current dollars, so it mixes price inflation with volume; it is a demand proxy, not unit demand.</li>
<li>Only three test years; results could differ in shock periods (the data ends before 2020).</li>
<li>Buffers are calibrated from just 24 monthly errors per series, which is a small sample for tail quantiles.</li>
<li>No exogenous drivers (prices, promotions, holidays moving between months, macro data).</li>
<li>No prediction intervals from the models themselves; the buffer analysis uses empirical errors instead.</li>
</ul>

<h2>8. Next steps</h2>
<ul>
<li>Apply the same pipeline to a unit-level dataset with stock data (for example a store-item sales dataset) to compute real reorder points.</li>
<li>Add hierarchical reconciliation so state and industry forecasts add up to national totals.</li>
<li>Compare against a tuned global model using a separate validation year.</li>
</ul>

<h2>Reproduce</h2>
<pre tabindex="0" aria-label="Reproduction commands"><code>pip install -r requirements.txt
python -m src.run_pipeline</code></pre>
<p class="small">Data file pinned to tsibbledata commit <code>{PINNED_COMMIT[:12]}</code>, SHA-256 <code>{SHA256[:16]}…</code>. All numbers on this page are written by <code>src/run_pipeline.py</code> into <code>reports/metrics.json</code>.</p>
</main>
<footer class="wrap small foot">Data: © Commonwealth of Australia (Australian Bureau of Statistics), CC BY 4.0, via the tsibbledata R package (GPL-3). Analysis by Dul Kipli Kurniawan.</footer>
</body>
</html>
"""
    (ROOT / "index.html").write_text(html, encoding="utf-8")


def main() -> dict:
    warnings.filterwarnings("ignore")
    raw = load_raw()
    checks = validate(raw)
    panel, info = prepare(raw)
    eda_out = eda(panel)

    bt = backtest(panel)
    sm = series_metrics(bt)
    summ = summary(sm)
    by_origin = summary_by_origin(sm)
    best = summ.iloc[1:].sort_values("mean_MASE")["model"].iat[0]
    buf = buffer_scenario(bt, best)

    fig_ex = chart_example(panel, bt)
    fig_mase = chart_mase(by_origin)

    r90 = buf[buf["target_coverage_pct"] == 90].iloc[0]
    gap = r90["realised_coverage_2018_pct"] - 90
    interp = (
        f"At a 90% target the buffer covered {r90['realised_coverage_2018_pct']:.1f}% of 2018 "
        f"series-months ({'above' if gap >= 0 else 'below'} target by {abs(gap):.1f} points). "
        + ("Coverage close to target suggests the buffers are reasonably calibrated for this year."
           if abs(gap) <= 5 else
           "The gap shows that buffers sized from two years of errors do not transfer reliably to the next year.")
    )

    REPORTS.mkdir(exist_ok=True)
    sm.assign(origin=sm["origin"].dt.strftime("%Y-%m")).round(4).to_csv(
        REPORTS / "series_metrics.csv", index=False)
    from .data import LEAF_INDUSTRIES
    metrics = {
        "data": {**checks, **info, "source_url": RAW_URL, "sha256": SHA256,
                 "leaf_industries": LEAF_INDUSTRIES},
        "eda": eda_out,
        "origins": [o.strftime("%Y-%m") for o in ORIGINS],
        "n_forecasts": int(len(bt) / len(MODELS)),
        "summary": summ.round(4).replace({np.nan: None}).to_dict("records"),
        "mase_by_test_year": {int(k): {m: round(float(v), 4) for m, v in r.items()}
                              for k, r in by_origin.iterrows()},
        "buffer_scenario": {"model": best, "interpretation": interp,
                            "rows": buf.round(2).to_dict("records")},
        "figures": eda_out["figures"] + [fig_ex, fig_mase],
    }
    (REPORTS / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    write_page(metrics)
    return metrics


if __name__ == "__main__":
    out = main()
    print(json.dumps({k: out[k] for k in ("summary", "mase_by_test_year", "buffer_scenario")}, indent=2))
