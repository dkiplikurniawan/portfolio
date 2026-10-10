"""Rolling-origin backtest, error metrics and an illustrative buffer analysis."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .models import H, GlobalGBM, ets, seasonal_naive

ORIGINS = [pd.Timestamp(d) for d in ("2015-12-01", "2016-12-01", "2017-12-01")]
MODELS = ["Seasonal naive", "ETS", "Global GBM"]


def backtest(panel: pd.DataFrame) -> pd.DataFrame:
    """Forecast 12 months after each origin; return one row per forecast."""
    rows = []
    for origin in ORIGINS:
        gbm_fc = GlobalGBM().fit_predict(panel, origin)
        for key, g in panel.groupby("key", sort=True):
            train = g[g["Month"] <= origin]["Turnover"].to_numpy()
            test = g[(g["Month"] > origin)].head(H)
            assert len(test) == H, key
            # MASE scale: in-sample MAE of the seasonal naive on training data
            scale = np.mean(np.abs(train[12:] - train[:-12]))
            fcs = {"Seasonal naive": seasonal_naive(train), "ETS": ets(train),
                   "Global GBM": gbm_fc[key]}
            for model, fc in fcs.items():
                for i, (m, actual) in enumerate(zip(test["Month"], test["Turnover"])):
                    rows.append({
                        "origin": origin, "key": key, "State": g["State"].iat[0],
                        "Industry": g["Industry"].iat[0], "model": model,
                        "Month": m, "h": i + 1, "actual": actual,
                        "forecast": float(fc[i]), "scale": scale,
                    })
    return pd.DataFrame(rows)


def series_metrics(bt: pd.DataFrame) -> pd.DataFrame:
    """Metrics per (origin, series, model) over the 12-month horizon."""
    e = bt.assign(err=bt["forecast"] - bt["actual"])
    g = e.groupby(["origin", "key", "model"])
    out = pd.DataFrame({
        "MAE": g["err"].apply(lambda x: np.mean(np.abs(x))),
        "RMSE": g["err"].apply(lambda x: np.sqrt(np.mean(x ** 2))),
        "MAPE": g.apply(lambda d: 100 * np.mean(np.abs(d["err"]) / d["actual"]),
                        include_groups=False),
        "scale": g["scale"].first(),
    })
    out["MASE"] = out["MAE"] / out["scale"]
    return out.reset_index()


def summary(sm: pd.DataFrame) -> pd.DataFrame:
    base = sm[sm["model"] == "Seasonal naive"].set_index(["origin", "key"])["MASE"]
    rows = []
    for model, d in sm.groupby("model"):
        d = d.set_index(["origin", "key"])
        rows.append({
            "model": model,
            "mean_MASE": d["MASE"].mean(),
            "median_MASE": d["MASE"].median(),
            "median_MAPE_pct": d["MAPE"].median(),
            "share_beating_baseline_pct": 100 * (d["MASE"] < base.loc[d.index]).mean()
            if model != "Seasonal naive" else np.nan,
        })
    return pd.DataFrame(rows).set_index("model").loc[MODELS].reset_index()


def summary_by_origin(sm: pd.DataFrame) -> pd.DataFrame:
    t = sm.groupby(["origin", "model"])["MASE"].mean().unstack()[MODELS]
    t.index = t.index.year + 1  # label by forecast (test) year
    t.index.name = "test_year"
    return t


def buffer_scenario(bt: pd.DataFrame, model: str,
                    levels=(0.80, 0.90, 0.95)) -> pd.DataFrame:
    """Illustrative planning buffer, NOT an inventory model.

    The dataset contains turnover only: no stock levels, unit counts, lead
    times or costs. This answers a narrower question that the data *can*
    answer: if a planner adds a buffer on top of the forecast, sized from
    the forecast errors of the two earlier backtest years (2016-2017), how
    often does that buffer actually cover 2018 demand?
    """
    d = bt[bt["model"] == model].assign(ratio=lambda x: x["actual"] / x["forecast"])
    calib = d[d["origin"] < ORIGINS[-1]]
    test = d[d["origin"] == ORIGINS[-1]]
    rows = []
    for lvl in levels:
        q = calib.groupby("key")["ratio"].quantile(lvl).clip(lower=1.0)
        t = test.assign(q=test["key"].map(q))
        covered = t["actual"] <= t["forecast"] * t["q"]
        rows.append({
            "target_coverage_pct": 100 * lvl,
            "realised_coverage_2018_pct": 100 * covered.mean(),
            "median_buffer_pct_of_forecast": 100 * (q.median() - 1),
        })
    return pd.DataFrame(rows)
