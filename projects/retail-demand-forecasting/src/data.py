"""Data acquisition and validation for the retail demand forecasting project.

Source: Australian Bureau of Statistics (ABS), Retail Trade, Australia,
catalogue 8501.0, Table 11 (monthly turnover by state and industry), as
packaged in the `aus_retail` dataset of the tidyverts/tsibbledata R package.

The raw file is NOT committed. `download()` fetches it from a pinned commit
and verifies a SHA-256 checksum, so every run uses byte-identical input.
"""
from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

import pandas as pd

PINNED_COMMIT = "ccfcb321bb4f0e12b7287f5a8f752097e35a20a5"
RAW_URL = (
    "https://raw.githubusercontent.com/tidyverts/tsibbledata/"
    f"{PINNED_COMMIT}/data/aus_retail.rda"
)
SHA256 = "1826ec66b3d82edbde26c37d710f2fb5cf2c7044540f7f59c4480e1a987314cf"

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RAW_PATH = DATA_DIR / "aus_retail.rda"

# ABS publishes both aggregate industry groups and their sub-industries.
# Mixing both would double-count turnover, so the analysis uses only the
# lowest-level ("leaf") industries below.
LEAF_INDUSTRIES = [
    "Supermarket and grocery stores",
    "Liquor retailing",
    "Other specialised food retailing",
    "Furniture, floor coverings, houseware and textile goods retailing",
    "Electrical and electronic goods retailing",
    "Hardware, building and garden supplies retailing",
    "Clothing retailing",
    "Footwear and other personal accessory retailing",
    "Department stores",
    "Newspaper and book retailing",
    "Other recreational goods retailing",
    "Pharmaceutical, cosmetic and toiletry goods retailing",
    "Other retailing n.e.c.",
    "Cafes, restaurants and catering services",
    "Takeaway food services",
]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def download(force: bool = False) -> Path:
    """Download the pinned raw file (~137 KB) and verify its checksum."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if force or not RAW_PATH.exists():
        urllib.request.urlretrieve(RAW_URL, RAW_PATH)
    digest = _sha256(RAW_PATH)
    if digest != SHA256:
        raise ValueError(f"Checksum mismatch for {RAW_PATH}: {digest}")
    return RAW_PATH


def load_raw() -> pd.DataFrame:
    import pyreadr  # imported lazily: only needed to read the .rda file

    path = download()
    df = next(iter(pyreadr.read_r(str(path)).values()))
    # tsibble `yearmonth` is stored as days since 1970-01-01.
    df["Month"] = pd.to_datetime(df["Month"], unit="D")
    return df.rename(columns={"Series ID": "series_id"})


def validate(df: pd.DataFrame) -> dict:
    """Basic integrity checks. Raises on failure, returns a summary."""
    assert df["Turnover"].notna().all(), "missing turnover values"
    assert (df["Turnover"] > 0).all(), "non-positive turnover values"
    assert not df.duplicated(["State", "Industry", "Month"]).any(), "duplicate rows"
    assert (df["Month"].dt.day == 1).all(), "months not aligned to first day"
    return {
        "rows": int(len(df)),
        "series": int(df.groupby(["State", "Industry"]).ngroups),
        "first_month": df["Month"].min().strftime("%Y-%m"),
        "last_month": df["Month"].max().strftime("%Y-%m"),
    }


def prepare(df: pd.DataFrame, min_train_years: int = 10,
            first_origin: str = "2015-12-01") -> tuple[pd.DataFrame, dict]:
    """Select leaf industries and series that are complete and current.

    A series is kept when it (a) is a leaf industry, (b) runs to the last
    month in the data without gaps, and (c) has at least `min_train_years`
    of history before the first forecast origin.
    """
    last = df["Month"].max()
    origin = pd.Timestamp(first_origin)
    leaf = df[df["Industry"].isin(LEAF_INDUSTRIES)].copy()

    kept, dropped = [], []
    for key, g in leaf.groupby(["State", "Industry"]):
        g = g.sort_values("Month")
        expected = pd.date_range(g["Month"].min(), g["Month"].max(), freq="MS")
        complete = len(expected) == len(g)
        current = g["Month"].max() == last
        long_enough = (g["Month"] <= origin).sum() >= 12 * min_train_years
        (kept if (complete and current and long_enough) else dropped).append(key)

    out = leaf.set_index(["State", "Industry"]).loc[kept].reset_index()
    out["key"] = out["State"] + " | " + out["Industry"]
    info = {
        "leaf_series_total": len(kept) + len(dropped),
        "series_kept": len(kept),
        "series_dropped": [" | ".join(k) for k in dropped],
    }
    return out.sort_values(["key", "Month"]).reset_index(drop=True), info
