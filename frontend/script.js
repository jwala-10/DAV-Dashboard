
let currentData = null;
let charts = {};

const HISTORY_KEY = "automaticAnalyticsHistory";
const MAX_HISTORY = 8;

const chartNames = {
    averageChart: "Mean Comparison",
    distributionChart: "Mean vs Median",
    rangeChart: "Minimum vs Maximum",
    histogramChart: "Histogram",
    scatterChart: "Scatter Plot",
    boxPlotChart: "Box Plot"
};

// ---------------- HELPERS ----------------

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function formatNumber(value) {
    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "N/A";
    }

    return Number(value).toLocaleString(undefined, {
        maximumFractionDigits: 8
    });
}

function showStatus(message) {
    const status = document.getElementById("status");
    if (status) status.textContent = message;
}

function destroyChart(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}

function getStat(column, key) {
    const value = currentData?.statistics?.[column]?.[key];
    return Number(value);
}

function getNumericColumns() {
    return currentData?.numeric_columns || [];
}

function getStatColumns() {
    return getNumericColumns().filter(
        column => currentData?.statistics?.[column]
    );
}

function getNumericValues(column) {
    return (currentData?.numeric_data || [])
        .map(row => row[column])
        .filter(value =>
            value !== null &&
            value !== undefined &&
            value !== "" &&
            Number.isFinite(Number(value))
        )
        .map(Number);
}

function scaleColumnValue(column, value) {
    const min = getStat(column, "minimum");
    const max = getStat(column, "maximum");

    if (max === min) return 50;

    return ((value - min) / (max - min)) * 100;
}

function getCommonOptions(xTitle, yTitle) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
            padding: {
                left: 12,
                right: 18,
                top: 8,
                bottom: 8
            }
        },
        plugins: {
            legend: {
                labels: { color: "#e2e8f0" }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: xTitle,
                    color: "#c7d2fe"
                },
                ticks: {
                    color: "#d4dcec",
                    maxRotation: 35,
                    autoSkip: true
                },
                grid: {
                    color: "rgba(255,255,255,0.07)"
                }
            },
            y: {
                title: {
                    display: true,
                    text: yTitle,
                    color: "#c7d2fe"
                },
                ticks: { color: "#d4dcec" },
                grid: {
                    color: "rgba(255,255,255,0.07)"
                }
            }
        }
    };
}

function makeChart(id, config) {
    destroyChart(id);

    const canvas = document.getElementById(id);

    if (!canvas || typeof Chart === "undefined") return;

    charts[id] = new Chart(canvas, config);
}

// ---------------- ANALYSE FILE ----------------

async function analyzeFile() {
    const file = document.getElementById("fileInput")?.files[0];

    if (!file) {
        showStatus("Please select a CSV or Excel file first.");
        return;
    }

    const button = document.getElementById("analyzeBtn");
    const formData = new FormData();

    formData.append("file", file);

    if (button) button.disabled = true;

    showStatus("Analysing your dataset. Please wait...");

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Analysis failed.");
        }

        currentData = data;

        renderAnalysis(data);
        saveAnalysisHistory(data);

        showStatus("Analysis completed successfully!");

    } catch (error) {
        showStatus("Error: " + error.message);

    } finally {
        if (button) button.disabled = false;
    }
}

// ---------------- RENDER ----------------

function renderAnalysis(data) {
    currentData = data;

    const results = document.getElementById("results");

    if (results) {
        results.style.display = "block";
    }

    const summary = document.getElementById("summary");

    if (summary) {
        summary.innerHTML = `
            <p><strong>File:</strong> ${escapeHTML(data.filename)}</p>
            <p><strong>Total Rows:</strong> ${formatNumber(data.rows)}</p>
            <p><strong>Total Columns:</strong> ${formatNumber(data.columns)}</p>
            <p><strong>Missing Values:</strong> ${formatNumber(data.missing)}</p>
            <p><strong>Duplicate Rows:</strong> ${formatNumber(data.duplicates)}</p>
            <p><strong>Numeric Columns:</strong> ${formatNumber(data.numeric_columns?.length || 0)}</p>
        `;
    }

    renderStatistics(data);
    fillDropdowns();

    createBasicCharts();
    createHistogram();
    createScatterChart();
    createBoxPlot();

    results?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ---------------- STATISTICS ----------------

function renderStatistics(data) {
    const container = document.getElementById("statistics");

    if (!container) return;

    const columns = data.numeric_columns || [];
    const statistics = data.statistics || {};

    if (!columns.length) {
        container.innerHTML = "<p>No numeric columns found.</p>";
        return;
    }

    let html = `
        <div class="table-wrap">
        <table>
        <thead>
            <tr>
                <th>Column</th>
                <th>Mean</th>
                <th>Median</th>
                <th>Minimum</th>
                <th>Maximum</th>
                <th>Standard Deviation</th>
            </tr>
        </thead>
        <tbody>
    `;

    columns.forEach(column => {
        const s = statistics[column];

        if (!s) return;

        html += `
            <tr>
                <td>${escapeHTML(column)}</td>
                <td>${formatNumber(s.mean)}</td>
                <td>${formatNumber(s.median)}</td>
                <td>${formatNumber(s.minimum)}</td>
                <td>${formatNumber(s.maximum)}</td>
                <td>${formatNumber(s.std)}</td>
            </tr>
        `;
    });

    container.innerHTML = html + "</tbody></table></div>";
}

// ---------------- DROPDOWNS ----------------

function fillDropdowns() {
    const columns = getNumericColumns();

    const options = columns.map(column =>
        `<option value="${escapeHTML(column)}">${escapeHTML(column)}</option>`
    ).join("");

    const histogram = document.getElementById("histogramSelect");
    const scatterX = document.getElementById("scatterX");
    const scatterY = document.getElementById("scatterY");

    if (histogram) histogram.innerHTML = options;
    if (scatterX) scatterX.innerHTML = options;
    if (scatterY) scatterY.innerHTML = options;

    if (columns.length > 1 && scatterY) {
        scatterY.selectedIndex = 1;
    }
}

// ---------------- BASIC CHARTS ----------------

function createBasicCharts() {
    const columns = getStatColumns();

    if (!columns.length) {
        ["averageChart", "distributionChart", "rangeChart"].forEach(destroyChart);
        return;
    }

    const relativeOptions = {
        min: 0,
        max: 100,
        title: {
            display: true,
            text: "Relative Scale (0–100)",
            color: "#c7d2fe"
        },
        ticks: { color: "#d4dcec" },
        grid: {
            color: "rgba(255,255,255,0.07)"
        }
    };

    // MEAN COMPARISON

    makeChart("averageChart", {
        type: "bar",
        data: {
            labels: columns,
            datasets: [{
                label: "Mean",
                data: columns.map(column =>
                    scaleColumnValue(column, getStat(column, "mean"))
                ),
                originalValues: columns.map(column =>
                    getStat(column, "mean")
                ),
                backgroundColor: "#818cf8"
            }]
        },
        options: {
            ...getCommonOptions("Numeric Columns", "Relative Scale (0–100)"),
            scales: {
                y: { ...relativeOptions }
            },
            plugins: {
                legend: {
                    labels: { color: "#e2e8f0" }
                },
                tooltip: {
                    callbacks: {
                        label: ctx =>
                            `Mean: ${formatNumber(ctx.dataset.originalValues[ctx.dataIndex])}`
                    }
                }
            }
        }
    });

    // MEAN VS MEDIAN

    makeChart("distributionChart", {
        type: "bar",
        data: {
            labels: columns,
            datasets: [
                {
                    label: "Mean",
                    data: columns.map(column =>
                        scaleColumnValue(column, getStat(column, "mean"))
                    ),
                    originalValues: columns.map(column =>
                        getStat(column, "mean")
                    ),
                    backgroundColor: "#818cf8"
                },
                {
                    label: "Median",
                    data: columns.map(column =>
                        scaleColumnValue(column, getStat(column, "median"))
                    ),
                    originalValues: columns.map(column =>
                        getStat(column, "median")
                    ),
                    backgroundColor: "#34d399"
                }
            ]
        },
        options: {
            ...getCommonOptions("Numeric Columns", "Relative Scale (0–100)"),
            scales: {
                y: { ...relativeOptions }
            },
            plugins: {
                legend: {
                    labels: { color: "#e2e8f0" }
                },
                tooltip: {
                    callbacks: {
                        label: ctx =>
                            `${ctx.dataset.label}: ${formatNumber(ctx.dataset.originalValues[ctx.dataIndex])}`
                    }
                }
            }
        }
    });

    // MINIMUM VS MAXIMUM

    const minimums = columns.map(column =>
        getStat(column, "minimum")
    );

    const maximums = columns.map(column =>
        getStat(column, "maximum")
    );

    const allValues = [...minimums, ...maximums]
        .filter(Number.isFinite);

    const smallest = Math.min(...allValues);
    const largest = Math.max(...allValues);

    const difference = largest - smallest;

    const padding = difference === 0
        ? Math.max(Math.abs(largest) * 0.1, 1)
        : difference * 0.08;

    makeChart("rangeChart", {
        type: "bar",
        data: {
            labels: columns,
            datasets: [
                {
                    label: "Minimum",
                    data: minimums,
                    backgroundColor: "#60a5fa",
                    minBarLength: 8
                },
                {
                    label: "Maximum",
                    data: maximums,
                    backgroundColor: "#f59e0b",
                    minBarLength: 3
                }
            ]
        },
        options: {
            ...getCommonOptions("Numeric Columns", "Actual Values"),
            scales: {
                x: {
                    ticks: {
                        color: "#d4dcec",
                        autoSkip: false,
                        maxRotation: 35
                    },
                    grid: { display: false }
                },
                y: {
                    min: Math.min(0, smallest - padding),
                    max: largest + padding,
                    ticks: {
                        color: "#d4dcec",
                        callback: value => formatNumber(value)
                    },
                    title: {
                        display: true,
                        text: "Actual Values",
                        color: "#c7d2fe"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.07)"
                    }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#e2e8f0" }
                },
                tooltip: {
                    callbacks: {
                        label: ctx =>
                            `${ctx.dataset.label}: ${formatNumber(ctx.raw)}`
                    }
                }
            }
        }
    });
}

// ---------------- HISTOGRAM ----------------

function createHistogram() {
    destroyChart("histogramChart");

    const column = document.getElementById("histogramSelect")?.value;
    const histogram = currentData?.histograms?.[column];

    if (!histogram) return;

    makeChart("histogramChart", {
        type: "bar",
        data: {
            labels: histogram.labels,
            datasets: [{
                label: `Frequency (${column})`,
                data: histogram.counts,
                backgroundColor: "#a78bfa",
                borderColor: "#c4b5fd",
                borderWidth: 1,
                barPercentage: 1,
                categoryPercentage: 1
            }]
        },
        options: {
            ...getCommonOptions("Value Range", "Frequency"),
            scales: {
                x: {
                    ticks: {
                        color: "#d4dcec",
                        maxRotation: 40,
                        autoSkip: true
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#d4dcec" }
                }
            }
        }
    });
}

// ---------------- SCATTER PLOT ----------------

function createScatterChart() {
    destroyChart("scatterChart");

    const xColumn = document.getElementById("scatterX")?.value;
    const yColumn = document.getElementById("scatterY")?.value;

    if (!xColumn || !yColumn) return;

    const points = (currentData.numeric_data || [])
        .filter(row =>
            row[xColumn] !== null &&
            row[xColumn] !== undefined &&
            row[yColumn] !== null &&
            row[yColumn] !== undefined &&
            row[xColumn] !== "" &&
            row[yColumn] !== ""
        )
        .map(row => ({
            x: Number(row[xColumn]),
            y: Number(row[yColumn])
        }))
        .filter(point =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
        );

    if (!points.length) return;

    makeChart("scatterChart", {
        type: "scatter",
        data: {
            datasets: [{
                label: `${xColumn} vs ${yColumn}`,
                data: points,
                backgroundColor: "#34d399",
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            layout: {
                padding: {
                    left: 18,
                    right: 25,
                    top: 15,
                    bottom: 18
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#e2e8f0" }
                },
                tooltip: {
                    callbacks: {
                        label: ctx =>
                            `X: ${formatNumber(ctx.parsed.x)}, Y: ${formatNumber(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    type: "linear",
                    title: {
                        display: true,
                        text: xColumn,
                        color: "#c7d2fe",
                        padding: 10
                    },
                    ticks: {
                        color: "#d4dcec",
                        maxTicksLimit: 8,
                        callback: formatNumber
                    },
                    grid: {
                        color: "rgba(255,255,255,0.07)"
                    }
                },
                y: {
                    type: "linear",
                    title: {
                        display: true,
                        text: yColumn,
                        color: "#c7d2fe",
                        padding: 10
                    },
                    ticks: {
                        color: "#d4dcec",
                        maxTicksLimit: 8,
                        callback: formatNumber
                    },
                    grid: {
                        color: "rgba(255,255,255,0.07)"
                    }
                }
            }
        }
    });
}

// ---------------- BOX PLOT ----------------

function calculateBoxSummary(values) {
    if (!values.length) return null;

    const sorted = [...values].sort((a, b) => a - b);

    function percentile(array, p) {
        const position = (array.length - 1) * p;
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        const fraction = position - lower;

        return array[lower] +
            (array[upper] - array[lower]) * fraction;
    }

    const q1 = percentile(sorted, 0.25);
    const median = percentile(sorted, 0.5);
    const q3 = percentile(sorted, 0.75);

    const iqr = q3 - q1;

    const normal = sorted.filter(value =>
        value >= q1 - 1.5 * iqr &&
        value <= q3 + 1.5 * iqr
    );

    return {
        q1,
        median,
        q3,
        lowerWhisker: normal[0],
        upperWhisker: normal[normal.length - 1],
        outliers: sorted.filter(value =>
            value < q1 - 1.5 * iqr ||
            value > q3 + 1.5 * iqr
        )
    };
}

const boxPlotPlugin = {
    id: "customVerticalBoxPlot",

    afterDraw(chart) {
        const summaries = chart.$boxSummaries || [];

        if (!summaries.length) return;

        const { ctx, scales: { x, y } } = chart;

        ctx.save();

        summaries.forEach((item, index) => {
            const xp = x.getPixelForValue(index);
            const width = Math.min(
                36,
                x.width / summaries.length * 0.4
            );

            const top = y.getPixelForValue(item.upperWhisker);
            const bottom = y.getPixelForValue(item.lowerWhisker);
            const q3 = y.getPixelForValue(item.q3);
            const q1 = y.getPixelForValue(item.q1);
            const median = y.getPixelForValue(item.median);

            ctx.strokeStyle = "#a78bfa";
            ctx.fillStyle = "rgba(129,140,248,0.45)";
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(xp, top);
            ctx.lineTo(xp, bottom);

            ctx.moveTo(xp - width / 2, top);
            ctx.lineTo(xp + width / 2, top);

            ctx.moveTo(xp - width / 2, bottom);
            ctx.lineTo(xp + width / 2, bottom);

            ctx.stroke();

            ctx.fillRect(
                xp - width / 2,
                q3,
                width,
                q1 - q3
            );

            ctx.strokeRect(
                xp - width / 2,
                q3,
                width,
                q1 - q3
            );

            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.moveTo(xp - width / 2, median);
            ctx.lineTo(xp + width / 2, median);
            ctx.stroke();

            ctx.fillStyle = "#fb7185";

            item.outliers.forEach(value => {
                ctx.beginPath();
                ctx.arc(
                    xp,
                    y.getPixelForValue(value),
                    3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            });
        });

        ctx.restore();
    }
};

if (typeof Chart !== "undefined") {
    Chart.register(boxPlotPlugin);
}

function createBoxPlot() {
    destroyChart("boxPlotChart");

    const columns = getStatColumns();

    const summaries = columns.map(column => {
        const raw = calculateBoxSummary(
            getNumericValues(column)
        );

        if (!raw) return null;

        const scale = value =>
            scaleColumnValue(column, value);

        return {
            column,
            q1: scale(raw.q1),
            median: scale(raw.median),
            q3: scale(raw.q3),
            lowerWhisker: scale(raw.lowerWhisker),
            upperWhisker: scale(raw.upperWhisker),
            outliers: raw.outliers.map(scale)
        };
    }).filter(Boolean);

    if (!summaries.length) return;

    makeChart("boxPlotChart", {
        type: "bar",
        data: {
            labels: summaries.map(item => item.column),
            datasets: [{
                label: "Relative Value Distribution",
                data: summaries.map(() => 50),
                backgroundColor: "rgba(0,0,0,0)",
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            layout: {
                padding: {
                    left: 12,
                    right: 18,
                    top: 8,
                    bottom: 8
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#d4dcec",
                        maxRotation: 35,
                        autoSkip: true
                    },
                    grid: { display: false }
                },
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: "Relative Scale (0–100)",
                        color: "#c7d2fe"
                    },
                    ticks: { color: "#d4dcec" }
                }
            }
        }
    });

    charts.boxPlotChart.$boxSummaries = summaries;
    charts.boxPlotChart.update();
}

// ---------------- COMPLETE REPORT DOWNLOAD ----------------

async function downloadCompleteReport() {
    if (!currentData) {
        showStatus("Analyse a dataset first.");
        return;
    }

    if (typeof JSZip === "undefined") {
        showStatus("ZIP library unavailable. Refresh the page.");
        return;
    }

    try {
        const zip = new JSZip();
        const graphFolder = zip.folder("Graphs");
        const images = [];

        Object.entries(chartNames).forEach(([id, name]) => {
            const chart = charts[id];

            if (!chart) return;

            const filename =
                name.replace(/[^a-z0-9]/gi, "_") + ".png";

            const base64 = chart.toBase64Image().split(",")[1];

            graphFolder.file(filename, base64, {
                base64: true
            });

            images.push({
                name,
                filename
            });
        });

        const columns = getStatColumns();

        let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Complete Analytics Report</title>
<style>
body {
    font-family: Arial, sans-serif;
    padding: 25px;
    color: #222;
}
h1, h2 {
    color: #3730a3;
}
table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 25px;
}
th, td {
    border: 1px solid #ccc;
    padding: 9px;
    text-align: left;
}
th {
    background: #e0e7ff;
}
img {
    max-width: 100%;
    height: auto;
    margin: 15px 0 30px;
}
.chart {
    page-break-inside: avoid;
    margin-bottom: 25px;
}
</style>
</head>
<body>

<h1>Complete Automatic Data Analysis Report</h1>

<h2>Dataset Summary</h2>

<p><b>File:</b> ${escapeHTML(currentData.filename)}</p>
<p><b>Total Rows:</b> ${formatNumber(currentData.rows)}</p>
<p><b>Total Columns:</b> ${formatNumber(currentData.columns)}</p>
<p><b>Missing Values:</b> ${formatNumber(currentData.missing)}</p>
<p><b>Duplicate Rows:</b> ${formatNumber(currentData.duplicates)}</p>
<p><b>Numeric Columns:</b> ${columns.length}</p>

<h2>Column Statistics</h2>

<table>
<tr>
<th>Column</th>
<th>Mean</th>
<th>Median</th>
<th>Minimum</th>
<th>Maximum</th>
<th>Standard Deviation</th>
</tr>`;

        columns.forEach(column => {
            const s = currentData.statistics[column];

            html += `
<tr>
<td>${escapeHTML(column)}</td>
<td>${formatNumber(s.mean)}</td>
<td>${formatNumber(s.median)}</td>
<td>${formatNumber(s.minimum)}</td>
<td>${formatNumber(s.maximum)}</td>
<td>${formatNumber(s.std)}</td>
</tr>`;
        });

        html += `</table><h2>Data Visualisations</h2>`;

        images.forEach(item => {
            html += `
<div class="chart">
<h3>${escapeHTML(item.name)}</h3>
<img src="Graphs/${item.filename}" alt="${escapeHTML(item.name)}">
</div>`;
        });

        html += "</body></html>";

        zip.file("Complete_Analytics_Report.html", html);

        const blob = await zip.generateAsync({
            type: "blob"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "Complete_Analytics_Report.zip";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 2000);

        showStatus("Complete report downloaded successfully!");

    } catch (error) {
        showStatus("Report download failed: " + error.message);
    }
}

// ---------------- HISTORY ----------------

function getHistory() {
    try {
        return JSON.parse(
            localStorage.getItem(HISTORY_KEY)
        ) || [];
    } catch {
        return [];
    }
}

function saveAnalysisHistory(data) {
    const history = getHistory();

    const savedData = {
        filename: data.filename,
        date: new Date().toLocaleString(),
        rows: data.rows,
        columns: data.columns,
        missing: data.missing,
        duplicates: data.duplicates,
        numeric_columns: data.numeric_columns,
        statistics: data.statistics,
        histograms: data.histograms,
        numeric_data: data.numeric_data || []
    };

    const updated = [
        savedData,
        ...history
    ].slice(0, MAX_HISTORY);

    try {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(updated)
        );

        renderHistory();

    } catch {
        try {
            const smaller = updated.map((item, index) => ({
                ...item,
                numeric_data: (item.numeric_data || []).slice(
                    0,
                    index === 0 ? 500 : 200
                )
            }));

            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(smaller)
            );

            renderHistory();

            showStatus(
                "History saved with smaller data samples due to storage limits."
            );

        } catch {
            showStatus(
                "Browser storage is full. Clear old history to save this analysis."
            );
        }
    }
}

function renderHistory() {
    const container = document.getElementById("historyList");

    if (!container) return;

    const history = getHistory();

    if (!history.length) {
        container.innerHTML = "<p>No previous analyses yet.</p>";
        return;
    }

    container.innerHTML = history.map((item, index) => `
        <div class="history-item">
            <div>
                <p><strong>${escapeHTML(item.filename)}</strong></p>
                <p>${escapeHTML(item.date)}</p>
                <p>${formatNumber(item.rows)} rows · ${formatNumber(item.columns)} columns</p>
            </div>

            <button onclick="restoreHistory(${index})">
                Open Analysis
            </button>
        </div>
    `).join("");
}

function restoreHistory(index) {
    const item = getHistory()[index];

    if (!item) {
        showStatus("Saved analysis not found.");
        return;
    }

    currentData = item;

    renderAnalysis(item);

    showStatus("Previous analysis restored successfully!");
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);

    renderHistory();

    showStatus("Analysis history cleared.");
}

// ---------------- INITIALISE ----------------

document.addEventListener("DOMContentLoaded", () => {
    renderHistory();

    document.getElementById("histogramSelect")?.addEventListener(
        "change",
        createHistogram
    );

    document.getElementById("scatterX")?.addEventListener(
        "change",
        createScatterChart
    );

    document.getElementById("scatterY")?.addEventListener(
        "change",
        createScatterChart
    );
});
