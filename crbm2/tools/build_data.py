from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "assets" / "data.js"

CATEGORY_ORDER = [
    "熟料",
    "水泥",
    "混凝土砌块",
    "再生砖",
    "混凝土",
    "路面基层混合料",
    "再生沥青",
    "再生骨料",
    "砂浆",
    "石膏砌块",
]


def clean_number(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (int, float)):
        return round(float(value), 6)
    return value


def records(df: pd.DataFrame):
    return [
        {str(k): clean_number(v) for k, v in row.items()}
        for row in df.to_dict(orient="records")
    ]


def main() -> None:
    sankey = pd.read_excel(ROOT / "80个产品2.xlsx")
    process = pd.read_csv(ROOT / "过程数据2.csv")
    compare = pd.read_excel(ROOT / "各建材传统、再生碳足迹-80个产品.xlsx")
    provinces = pd.read_csv(ROOT / "tableData1.csv")

    sankey["value"] = pd.to_numeric(sankey["value"], errors="coerce").fillna(0.0)
    process["gcdt"] = pd.to_numeric(process["gcdt"], errors="coerce").fillna(0.0)
    compare["再生"] = pd.to_numeric(compare["再生"], errors="coerce").fillna(0.0)
    compare["传统"] = pd.to_numeric(compare["传统"], errors="coerce").fillna(0.0)
    compare["red-c"] = compare["传统"] - compare["再生"]

    categories = []
    products = {}

    compare_sorted = compare.assign(
        type_order=compare["type"].map(lambda x: CATEGORY_ORDER.index(x) if x in CATEGORY_ORDER else 999)
    ).sort_values(["type_order", "type", "nms"])

    for type_name in CATEGORY_ORDER:
        names = compare_sorted.loc[compare_sorted["type"] == type_name, "nms"].tolist()
        if names:
            categories.append({"name": type_name, "products": names})

    for row in records(compare_sorted.drop(columns=["type_order"])):
        name = row["nms"]
        recycled = row["再生"]
        traditional = row["传统"]
        reduction = row["red-c"]
        reduction_rate = round(reduction / traditional * 100, 2) if traditional else 0
        products[name] = {
            "name": name,
            "type": row["type"],
            "compare": {
                "recycled": recycled,
                "traditional": traditional,
                "reduction": round(reduction, 6),
                "reductionRate": reduction_rate,
            },
            "processes": [],
            "links": [],
            "provinces": [],
        }

    for name, df in process.groupby("nms", sort=False):
        if name in products:
            ordered = df.sort_values("gcdt", ascending=False)
            products[name]["processes"] = [
                {"target": r["target"], "value": clean_number(r["gcdt"])}
                for r in records(ordered)
            ]

    for name, df in sankey.groupby("nms", sort=False):
        if name in products:
            ordered = df.sort_values("value", ascending=False)
            products[name]["links"] = [
                {
                    "source": r["source"],
                    "target": r["target"],
                    "value": clean_number(r["value"]),
                    "materialType": r.get("type"),
                }
                for r in records(ordered)
            ]

    province_cols = {
        "省份": "province",
        "碳足迹(kgCO2/t)": "footprint",
        "固废利用率(%)": "solidWasteRate",
        "碳减排量(MtCO2)": "reductionMt",
    }
    for name, df in provinces.groupby("nms", sort=False):
        if name in products:
            renamed = df.rename(columns=province_cols)
            renamed = renamed.sort_values("footprint", ascending=False)
            products[name]["provinces"] = [
                {
                    "province": r["province"],
                    "footprint": clean_number(r["footprint"]),
                    "solidWasteRate": clean_number(r["solidWasteRate"]),
                    "reductionMt": clean_number(r["reductionMt"]),
                }
                for r in records(renamed[province_cols.values()])
            ]

    compare_for_top = compare_sorted.copy()
    compare_for_top["reductionRate"] = compare_for_top.apply(
        lambda r: (r["red-c"] / r["传统"] * 100) if r["传统"] else 0,
        axis=1,
    )

    data = {
        "meta": {
            "title": "中国固废再生材料碳足迹数据库",
            "subtitle": "China Recycled Building Materials Database",
            "sourceFiles": [
                "80个产品2.xlsx",
                "过程数据2.csv",
                "各建材传统、再生碳足迹-80个产品.xlsx",
                "tableData1.csv",
            ],
            "productCount": len(products),
            "linkCount": int(len(sankey)),
            "processCount": int(len(process)),
            "provinceProductCount": int(provinces["nms"].nunique()),
        },
        "categories": categories,
        "products": products,
        "insights": {
            "topReduction": [
                {
                    "name": r["nms"],
                    "type": r["type"],
                    "reductionRate": round(float(r["reductionRate"]), 2),
                    "reduction": round(float(r["red-c"]), 2),
                }
                for _, r in compare_for_top.sort_values("reductionRate", ascending=False).head(8).iterrows()
            ],
            "categoryStats": [
                {
                    "type": type_name,
                    "count": int(len(group)),
                    "avgRecycled": round(float(group["再生"].mean()), 2),
                    "avgTraditional": round(float(group["传统"].mean()), 2),
                    "avgReductionRate": round(float(((group["传统"] - group["再生"]) / group["传统"]).mean() * 100), 2),
                }
                for type_name, group in compare_sorted.groupby("type", sort=False)
            ],
        },
    }

    OUT.write_text(
        "window.CRBM_DATA = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
