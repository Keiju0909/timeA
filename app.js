const STORAGE_KEY = "timeARecords";

const todayTotalEl = document.getElementById("todayTotal");
const weekTotalEl = document.getElementById("weekTotal");
const pieBtn = document.getElementById("pieBtn");
const barBtn = document.getElementById("barBtn");
const seedBtn = document.getElementById("seedBtn");
const chartCanvas = document.getElementById("taskChart");

let currentChartType = "pie";
let taskChart;

function parseRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        task: typeof item.task === "string" && item.task.trim() ? item.task.trim() : "未分類",
        minutes: Number.isFinite(Number(item.minutes)) ? Math.max(0, Number(item.minutes)) : 0,
        date: typeof item.date === "string" ? item.date : "",
      }))
      .filter((item) => item.date && item.minutes > 0);
  } catch {
    return [];
  }
}

function todayAsText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekStartDate() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}時間 ${mins}分`;
}

function minutesByTask(records) {
  return records.reduce((acc, item) => {
    acc[item.task] = (acc[item.task] || 0) + item.minutes;
    return acc;
  }, {});
}

function buildColor(index) {
  const palette = [
    "#c84c2a",
    "#146c94",
    "#f19a37",
    "#2d8744",
    "#9a3ea5",
    "#6151db",
    "#cd5b7f",
  ];
  return palette[index % palette.length];
}

function renderChart(taskMap) {
  const labels = Object.keys(taskMap);
  const values = Object.values(taskMap);
  const colors = labels.map((_, index) => buildColor(index));

  if (taskChart) {
    taskChart.destroy();
  }

  taskChart = new Chart(chartCanvas, {
    type: currentChartType,
    data: {
      labels,
      datasets: [
        {
          label: "作業割合（分）",
          data: values,
          backgroundColor: colors,
          borderColor: "#fffaf2",
          borderWidth: currentChartType === "pie" ? 2 : 0,
          borderRadius: currentChartType === "bar" ? 12 : 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label(context) {
              const total = values.reduce((sum, value) => sum + value, 0);
              const value = context.parsed;
              const ratio = total ? Math.round((value / total) * 100) : 0;
              return `${context.label}: ${value}分 (${ratio}%)`;
            },
          },
        },
      },
      scales:
        currentChartType === "bar"
          ? {
              y: {
                beginAtZero: true,
                ticks: {
                  callback(value) {
                    return `${value}分`;
                  },
                },
              },
            }
          : {},
    },
  });
}

function refreshDashboard() {
  const records = parseRecords();
  const todayText = todayAsText();
  const weekStart = weekStartDate();

  let todayMinutes = 0;
  let weekMinutes = 0;
  const weekRecords = [];

  for (const item of records) {
    const itemDate = new Date(item.date);
    if (Number.isNaN(itemDate.getTime())) continue;

    if (item.date === todayText) {
      todayMinutes += item.minutes;
    }

    if (itemDate >= weekStart) {
      weekMinutes += item.minutes;
      weekRecords.push(item);
    }
  }

  todayTotalEl.textContent = formatMinutes(todayMinutes);
  weekTotalEl.textContent = formatMinutes(weekMinutes);

  const taskMap = minutesByTask(weekRecords);
  const hasData = Object.keys(taskMap).length > 0;

  if (!hasData) {
    renderChart({ データなし: 1 });
    return;
  }

  renderChart(taskMap);
}

function setChartType(type) {
  currentChartType = type;
  pieBtn.classList.toggle("active", type === "pie");
  barBtn.classList.toggle("active", type === "bar");
  refreshDashboard();
}

function seedSampleData() {
  const now = new Date();
  const format = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const sample = [
    { task: "開発", minutes: 130, date: format(now) },
    { task: "学習", minutes: 80, date: format(now) },
    { task: "運動", minutes: 45, date: format(new Date(now.getTime() - 86400000)) },
    { task: "読書", minutes: 60, date: format(new Date(now.getTime() - 86400000 * 2)) },
    { task: "開発", minutes: 95, date: format(new Date(now.getTime() - 86400000 * 3)) },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
  refreshDashboard();
}

pieBtn.addEventListener("click", () => setChartType("pie"));
barBtn.addEventListener("click", () => setChartType("bar"));
seedBtn.addEventListener("click", seedSampleData);

refreshDashboard();
