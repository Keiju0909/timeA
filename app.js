const STORAGE_KEY = "timeARecords";
const ACTIVE_SESSION_KEY = "timeAActiveSession";

const todayTotalEl = document.getElementById("todayTotal");
const weekTotalEl = document.getElementById("weekTotal");
const pieBtn = document.getElementById("pieBtn");
const barBtn = document.getElementById("barBtn");
const seedBtn = document.getElementById("seedBtn");
const chartCanvas = document.getElementById("taskChart");
const taskInput = document.getElementById("taskInput");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const sessionStatus = document.getElementById("sessionStatus");
const activeTaskEl = document.getElementById("activeTask");
const activeDurationEl = document.getElementById("activeDuration");
const todayRecordsEl = document.getElementById("todayRecords");
const weekRecordsEl = document.getElementById("weekRecords");
const todayCountEl = document.getElementById("todayCount");
const weekCountEl = document.getElementById("weekCount");

let currentChartType = "pie";
let taskChart;
let timerHandle = null;

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
        startedAt: typeof item.startedAt === "string" ? item.startedAt : "",
        endedAt: typeof item.endedAt === "string" ? item.endedAt : "",
      }))
      .filter((item) => item.date && item.minutes > 0);
  } catch {
    return [];
  }
}

function parseActiveSession() {
  const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const task = typeof parsed.task === "string" ? parsed.task.trim() : "";
    const startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : "";

    if (!task || !startedAt) return null;

    return { task, startedAt };
  } catch {
    return null;
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

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateLabel(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatElapsedMinutes(startedAt) {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return "0分";

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
  return formatMinutes(elapsedMinutes);
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

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function updateTimerState() {
  const activeSession = parseActiveSession();
  const isRunning = Boolean(activeSession);

  startBtn.disabled = isRunning;
  stopBtn.disabled = !isRunning;

  if (!isRunning) {
    stopLiveTimer();
    sessionStatus.textContent = "未開始";
    activeTaskEl.textContent = "-";
    activeDurationEl.textContent = "0分";
    return;
  }

  if (!timerHandle) {
    startLiveTimer();
  }

  sessionStatus.textContent = "記録中";
  activeTaskEl.textContent = activeSession.task;
  activeDurationEl.textContent = formatElapsedMinutes(activeSession.startedAt);
}

function startLiveTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
  }

  timerHandle = window.setInterval(() => {
    updateTimerState();
  }, 1000);
}

function stopLiveTimer() {
  if (!timerHandle) return;

  clearInterval(timerHandle);
  timerHandle = null;
}

function renderRecordList(container, records, showDateGroup = false) {
  if (!records.length) {
    container.innerHTML = '<p class="empty-state">記録はまだありません。</p>';
    return;
  }

  if (!showDateGroup) {
    container.innerHTML = records
      .map((record) => {
        const timeRange = record.startedAt && record.endedAt ? `${formatDateTime(record.startedAt)} - ${formatDateTime(record.endedAt)}` : formatDateLabel(record.date);
        return `
          <article class="record-item">
            <div>
              <p class="record-task">${record.task}</p>
              <p class="record-meta">${timeRange}</p>
            </div>
            <p class="record-minutes">${formatMinutes(record.minutes)}</p>
          </article>
        `;
      })
      .join("");
    return;
  }

  const grouped = records.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort((left, right) => right.localeCompare(left));

  container.innerHTML = dates
    .map((date) => {
      const items = grouped[date]
        .map((record) => {
          const timeRange = record.startedAt && record.endedAt ? `${new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(record.startedAt))} - ${new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(record.endedAt))}` : "記録済み";
          return `
            <article class="record-item compact">
              <div>
                <p class="record-task">${record.task}</p>
                <p class="record-meta">${timeRange}</p>
              </div>
              <p class="record-minutes">${formatMinutes(record.minutes)}</p>
            </article>
          `;
        })
        .join("");

      return `
        <section class="record-group">
          <h3>${formatDateLabel(date)}</h3>
          <div class="record-group-list">${items}</div>
        </section>
      `;
    })
    .join("");
}

function refreshRecordLists(records) {
  const todayText = todayAsText();
  const weekStartText = dateKey(weekStartDate());

  const todayRecords = records
    .filter((record) => record.date === todayText)
    .sort((left, right) => {
      const leftTime = new Date(left.endedAt || left.startedAt || left.date).getTime();
      const rightTime = new Date(right.endedAt || right.startedAt || right.date).getTime();
      return rightTime - leftTime;
    });

  const weekRecords = records
    .filter((record) => record.date >= weekStartText && record.date <= todayText)
    .sort((left, right) => {
      const leftTime = new Date(left.endedAt || left.startedAt || left.date).getTime();
      const rightTime = new Date(right.endedAt || right.startedAt || right.date).getTime();
      return rightTime - leftTime;
    });

  todayCountEl.textContent = `${todayRecords.length}件`;
  weekCountEl.textContent = `${weekRecords.length}件`;

  renderRecordList(todayRecordsEl, todayRecords);
  renderRecordList(weekRecordsEl, weekRecords, true);
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
  const weekStartText = dateKey(weekStartDate());

  let todayMinutes = 0;
  let weekMinutes = 0;
  const weekRecords = [];

  for (const item of records) {
    if (item.date === todayText) {
      todayMinutes += item.minutes;
    }

    if (item.date >= weekStartText && item.date <= todayText) {
      weekMinutes += item.minutes;
      weekRecords.push(item);
    }
  }

  todayTotalEl.textContent = formatMinutes(todayMinutes);
  weekTotalEl.textContent = formatMinutes(weekMinutes);

  refreshRecordLists(records);

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

function startTracking() {
  const task = taskInput.value.trim();
  if (!task) {
    sessionStatus.textContent = "タスク名を入力してください";
    taskInput.focus();
    return;
  }

  localStorage.setItem(
    ACTIVE_SESSION_KEY,
    JSON.stringify({
      task,
      startedAt: new Date().toISOString(),
    }),
  );

  updateTimerState();
}

function stopTracking() {
  const activeSession = parseActiveSession();
  if (!activeSession) return;

  const startedAt = new Date(activeSession.startedAt);
  if (Number.isNaN(startedAt.getTime())) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    stopLiveTimer();
    refreshDashboard();
    updateTimerState();
    return;
  }

  const endedAt = new Date();
  const elapsedMinutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
  const record = {
    task: activeSession.task,
    minutes: elapsedMinutes,
    date: dateKey(endedAt),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  };

  const records = parseRecords();
  records.push(record);
  saveRecords(records);
  localStorage.removeItem(ACTIVE_SESSION_KEY);

  stopLiveTimer();
  refreshDashboard();
  updateTimerState();
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
    {
      task: "開発",
      minutes: 130,
      date: format(now),
      startedAt: new Date(now.getTime() - 130 * 60000).toISOString(),
      endedAt: now.toISOString(),
    },
    {
      task: "学習",
      minutes: 80,
      date: format(now),
      startedAt: new Date(now.getTime() - 200 * 60000).toISOString(),
      endedAt: new Date(now.getTime() - 120 * 60000).toISOString(),
    },
    {
      task: "運動",
      minutes: 45,
      date: format(new Date(now.getTime() - 86400000)),
      startedAt: new Date(now.getTime() - 86400000 - 45 * 60000).toISOString(),
      endedAt: new Date(now.getTime() - 86400000).toISOString(),
    },
    {
      task: "読書",
      minutes: 60,
      date: format(new Date(now.getTime() - 86400000 * 2)),
      startedAt: new Date(now.getTime() - 86400000 * 2 - 60 * 60000).toISOString(),
      endedAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
    },
    {
      task: "開発",
      minutes: 95,
      date: format(new Date(now.getTime() - 86400000 * 3)),
      startedAt: new Date(now.getTime() - 86400000 * 3 - 95 * 60000).toISOString(),
      endedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
    },
  ];

  saveRecords(sample);
  refreshDashboard();
  updateTimerState();
}

pieBtn.addEventListener("click", () => setChartType("pie"));
barBtn.addEventListener("click", () => setChartType("bar"));
seedBtn.addEventListener("click", seedSampleData);
startBtn.addEventListener("click", startTracking);
stopBtn.addEventListener("click", stopTracking);

updateTimerState();

refreshDashboard();
