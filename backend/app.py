
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path=""
)

CORS(app)


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


def clean_number(value):
    if pd.isna(value):
        return None
    return float(value)


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]

        if not file.filename:
            return jsonify({"error": "No file selected"}), 400

        extension = Path(file.filename).suffix.lower()

        if extension == ".csv":
            df = pd.read_csv(file)
        elif extension in [".xlsx", ".xls"]:
            df = pd.read_excel(file)
        else:
            return jsonify({"error": "Upload CSV or Excel files only"}), 400

        if df.empty:
            return jsonify({"error": "The uploaded file is empty"}), 400

        numeric_df = df.select_dtypes(include=[np.number])
        statistics = {}

        for column in numeric_df.columns:
            values = numeric_df[column].dropna()

            if len(values) == 0:
                continue

            statistics[column] = {
                "mean": clean_number(values.mean()),
                "median": clean_number(values.median()),
                "minimum": clean_number(values.min()),
                "maximum": clean_number(values.max()),
                "std": clean_number(values.std()),
                "count": int(values.count())
            }

        histograms = {}

        for column in numeric_df.columns:
            values = numeric_df[column].dropna()

            if len(values) == 0:
                continue

            counts, edges = np.histogram(values, bins="auto")

            histograms[column] = {
                "labels": [
                    round(float(edges[i]), 4)
                    for i in range(len(edges) - 1)
                ],
                "values": [int(x) for x in counts]
            }

        numeric_data = {
            column: [
                clean_number(value)
                for value in numeric_df[column].tolist()
            ]
            for column in numeric_df.columns
        }

        return jsonify({
            "rows": int(df.shape[0]),
            "columns": int(df.shape[1]),
            "numeric_columns": list(numeric_df.columns),
            "statistics": statistics,
            "histograms": histograms,
            "numeric_data": numeric_data
        })

    except Exception as error:
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
