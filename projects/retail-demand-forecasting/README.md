# Retail Demand Forecasting & Planning Buffers

Reproducible 12-month forecasting of monthly retail turnover for 110 Australian state-by-industry series, comparing a seasonal-naive baseline with ETS and a global gradient-boosted model under rolling-origin evaluation, plus a test of whether forecast-error buffers deliver the coverage they target.

**Status:** completed first version. All numbers below are produced by `python -m src.run_pipeline` and stored in `reports/metrics.json`.

**Results page:** `index.html` in this folder (published at `https://dkiplikurniawan.github.io/portfolio/projects/retail-demand-forecasting/` once pushed).

## Problem

Planning stock, staff and purchasing requires a monthly demand forecast for the next year. Two questions:

1. How much better than "same month last year" can simple, properly evaluated models do?
2. If a planner adds a buffer above the forecast to cover demand X% of the time, does that buffer actually achieve X% the following year?

## Dataset and licence

| Item | Value |
|---|---|
| Source | Australian Bureau of Statistics, *Retail Trade, Australia*, cat. 8501.0, table 11 |
| Packaged by | `aus_retail` in [tidyverts/tsibbledata](https://github.com/tidyverts/tsibbledata) (R package, GPL-3) |
| Pinned file | commit `ccfcb321bb4f0e12b7287f5a8f752097e35a20a5`, `data/aus_retail.rda`, SHA-256 `1826ec66…314cf` |
| Licence of the underlying data | ABS material is published under Creative Commons Attribution 4.0 |
| Coverage | Apr 1982 – Dec 2018, monthly, 152 series (8 states/territories × 20 industry categories) |
| Measure | Turnover, A$ million, current prices |

The raw file is **not committed**. `src/data.py` downloads it from the pinned commit and verifies the checksum.

**What the data is not:** turnover in dollars, not unit sales. There are no stock levels, prices, promotions, lead times or costs.

### Preparation

- ABS publishes industry groups *and* their sub-industries. Only the 15 lowest-level industries are used, to avoid double counting.
- Of 114 leaf series, 110 are complete and current to Dec 2018. Four discontinued series (Queensland and Tasmania liquor / other specialised food) are dropped.
- Validation: no missing, duplicate or non-positive values; all months aligned.

## Architecture

```
src/data.py          download (pinned + checksum) → load → validate → select leaf series
src/models.py        SeasonalNaive · ETS (per series) · GlobalGBM (one model, all series)
src/evaluate.py      rolling-origin backtest → MAE/RMSE/MAPE/MASE → buffer scenario
src/run_pipeline.py  EDA figures → backtest → reports/metrics.json → index.html
notebooks/walkthrough.ipynb   step-by-step version of the same pipeline (executed)
```

## Methodology

**Models**

- **Seasonal naive (baseline):** forecast for each month = same month one year earlier.
- **ETS:** per-series exponential smoothing on log turnover; additive damped trend, additive seasonality (period 12).
- **Global GBM:** scikit-learn `HistGradientBoostingRegressor` trained across all series to predict year-over-year log growth. Features: growth at lag 12, latest growth at the origin (1- and 3-month), horizon, calendar month, state, industry. Each training row is built so its features use only data available at its own (pseudo-)origin.

Hyperparameters were fixed in advance and not tuned on test years.

**Evaluation (time-aware, no shuffling)**

- Origins: Dec 2015, Dec 2016, Dec 2017. Each model sees data up to the origin only and forecasts the next 12 months.
- 110 series × 3 origins × 12 months = 3,960 forecasts per model.
- Primary metric: **MASE** (MAE ÷ in-sample MAE of the seasonal naive on the training window). Series span from under A$1m to over A$2bn a month, so scale-free comparison matters.
- Secondary: MAPE (valid here because there are no zeros; small series inflate it), MAE and RMSE per series in `reports/series_metrics.csv`.
- EDA used data up to Dec 2015 only.

## Results

| Model | Mean MASE | Median MASE | Median MAPE | Series-years beating baseline |
|---|---|---|---|---|
| Seasonal naive | 1.212 | 1.013 | 5.76% | – |
| **ETS** | **1.058** | **0.893** | **4.84%** | 62.4% |
| Global GBM | 1.119 | 0.964 | 5.08% | 57.6% |

Mean MASE by test year:

| Test year | Seasonal naive | ETS | Global GBM |
|---|---|---|---|
| 2016 | 1.348 | 1.135 | 1.172 |
| 2017 | 1.126 | 1.020 | 1.161 |
| 2018 | 1.163 | 1.019 | 1.023 |

ETS reduced mean MASE by about 13% against the baseline and was the best model in every test year. The improvement is real but modest; seasonal naive is a strong baseline for stable retail series.

**EDA highlights (to Dec 2015):** December runs +29.1% above trend and February −11.5%. Ten-year growth (2005–2015) ranged from −2.5%/yr (newspaper and book retailing) to +6.9%/yr (cafes, restaurants and catering).

### Planning-buffer scenario (illustrative)

Not an inventory model: without stock, unit or lead-time data, true reorder points cannot be computed. Instead, a per-series buffer above the ETS forecast is sized from that series' 2016–2017 forecast errors (empirical quantile of actual ÷ forecast), then checked on 2018.

| Target coverage | Realised coverage in 2018 | Median buffer (% of forecast) |
|---|---|---|
| 80% | 76.4% | 4.1% |
| 90% | 82.4% | 6.0% |
| 95% | 87.7% | 8.0% |

Buffers sized from two years of errors under-covered the following year by 4–8 points. In practice that argues for longer error histories, pooled or shrunk quantiles, or explicit safety margins.

## Reproduce

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m src.run_pipeline          # about 1 minute; writes reports/ and index.html
jupyter notebook notebooks/walkthrough.ipynb   # optional
```

Tested with Python 3.12+, pandas 3.0.5, numpy 2.5.3, scikit-learn 1.9.1, statsmodels 0.15.0, matplotlib 3.11.2, pyreadr 0.5.7. Results may shift slightly with other library versions.

## Limitations

- Turnover in current dollars mixes price inflation with volume; it is a demand proxy.
- Three test years only, all before 2020; behaviour under shocks is untested.
- Buffers use 24 errors per series, a small sample for tail quantiles.
- No exogenous drivers (prices, promotions, moving holidays, macro indicators).
- Models produce point forecasts; uncertainty comes only from the empirical buffer analysis.

## Future work

- Repeat on unit-level sales with stock data to compute real reorder points and service levels.
- Hierarchical reconciliation so state and industry forecasts add up to national totals.
- Tune the global model on a separate validation year and add prediction intervals.

## Author

Dul Kipli Kurniawan · [Portfolio](https://dkiplikurniawan.github.io/portfolio/) · [GitHub](https://github.com/dkiplikurniawan)

Data © Commonwealth of Australia (Australian Bureau of Statistics), CC BY 4.0.
