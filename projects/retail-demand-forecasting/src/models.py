"""Forecasting models.

All models receive only data up to the forecast origin and return a
12-month-ahead forecast. Nothing after the origin is visible to a model.

1. SeasonalNaive  - baseline: next year's month = this year's same month.
2. ETS            - per-series exponential smoothing on log turnover
                    (additive damped trend + additive seasonality).
3. GlobalGBM      - one gradient-boosted model shared by all series that
                    predicts year-over-year log growth from lagged features.
Hyperparameters are fixed in advance (not tuned on the test years).
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from statsmodels.tsa.holtwinters import ExponentialSmoothing

H = 12  # forecast horizon in months


def seasonal_naive(y: np.ndarray, h: int = H) -> np.ndarray:
    return np.array([y[len(y) - 12 + (i % 12)] for i in range(h)], dtype=float)


def ets(y: np.ndarray, h: int = H) -> np.ndarray:
    logy = np.log(y)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ExponentialSmoothing(
            logy, trend="add", damped_trend=True,
            seasonal="add", seasonal_periods=12,
            initialization_method="estimated",
        ).fit(optimized=True)
    return np.exp(fit.forecast(h))


# ---------------------------------------------------------------- global GBM
FEATURES = ["g_lag12", "g_origin", "g_origin3", "h", "month", "state", "industry"]
CATEGORICAL = ["month", "state", "industry"]


def _rows_for_series(L: np.ndarray, months: np.ndarray, targets: np.ndarray,
                     h_values: np.ndarray, state: int, industry: int) -> pd.DataFrame:
    """Build feature rows for target positions `targets` with horizons `h_values`.

    For a target month at position p and horizon h the origin is o = p - h.
    Every feature uses positions <= o, so it is known at forecast time.
    """
    p = targets
    o = p - h_values
    g_lag12 = L[p - 12] - L[p - 24]          # p-12 <= o because h <= 12
    g_origin = L[o] - L[o - 12]
    g_origin3 = (g_origin + (L[o - 1] - L[o - 13]) + (L[o - 2] - L[o - 14])) / 3
    return pd.DataFrame({
        "g_lag12": g_lag12, "g_origin": g_origin, "g_origin3": g_origin3,
        "h": h_values, "month": months[p], "state": state, "industry": industry,
    })


class GlobalGBM:
    def __init__(self, random_state: int = 0):
        self.model = HistGradientBoostingRegressor(
            max_iter=300, learning_rate=0.05, max_leaf_nodes=31,
            min_samples_leaf=50, l2_regularization=1.0,
            categorical_features=[FEATURES.index(c) for c in CATEGORICAL],
            random_state=random_state,
        )

    @staticmethod
    def _codes(panel: pd.DataFrame) -> tuple[dict, dict]:
        states = {s: i for i, s in enumerate(sorted(panel["State"].unique()))}
        inds = {s: i for i, s in enumerate(sorted(panel["Industry"].unique()))}
        return states, inds

    def fit_predict(self, panel: pd.DataFrame, origin: pd.Timestamp) -> dict[str, np.ndarray]:
        """Train on all (target, horizon) pairs whose target is <= origin,
        then forecast the 12 months after `origin` for every series."""
        states, inds = self._codes(panel)
        train_parts, pred_parts, pred_keys = [], [], []
        for key, g in panel.groupby("key", sort=True):
            g = g[g["Month"] <= origin]
            L = np.log(g["Turnover"].to_numpy())
            months = g["Month"].dt.month.to_numpy()
            n = len(L)
            s, ind = states[g["State"].iat[0]], inds[g["Industry"].iat[0]]
            # training rows: every target p <= n-1 and horizon h with enough history
            ps, hs = [], []
            for h in range(1, H + 1):
                p = np.arange(max(24, 14 + h), n)
                ps.append(p); hs.append(np.full(len(p), h))
            p, h = np.concatenate(ps), np.concatenate(hs)
            X = _rows_for_series(L, months, p, h, s, ind)
            X["y"] = L[p] - L[p - 12]
            train_parts.append(X)
            # forecast rows: extend arrays with placeholders for the future months
            L_ext = np.concatenate([L, np.full(H, np.nan)])
            fut_months = (np.arange(1, H + 1) + months[-1] - 1) % 12 + 1
            months_ext = np.concatenate([months, fut_months])
            p_f = np.arange(n, n + H)
            Xf = _rows_for_series(L_ext, months_ext, p_f, np.arange(1, H + 1), s, ind)
            Xf["base"] = L[p_f - 12]
            pred_parts.append(Xf); pred_keys.append(key)

        train = pd.concat(train_parts, ignore_index=True)
        self.model.fit(train[FEATURES], train["y"])
        out = {}
        for key, Xf in zip(pred_keys, pred_parts):
            growth = self.model.predict(Xf[FEATURES])
            out[key] = np.exp(Xf["base"].to_numpy() + growth)
        self.n_train_rows_ = len(train)
        return out
