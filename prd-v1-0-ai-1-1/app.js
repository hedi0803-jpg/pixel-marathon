const STORAGE_KEY = "pixel-marathon-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const PRESET_DEFINITIONS = [
  { id: "days_100", name: "100天", days: 100, icon: "🎈" },
  { id: "days_200", name: "200天", days: 200, icon: "🍰" },
  { id: "days_300", name: "300天", days: 300, icon: "🎁" },
  { id: "year_1", name: "1周年", years: 1, icon: "🏆" },
  { id: "year_2", name: "2周年", years: 2, icon: "💍" },
  { id: "year_3", name: "3周年", years: 3, icon: "🌟" },
  { id: "year_4", name: "4周年", years: 4, icon: "💎" },
  { id: "year_5", name: "5周年", years: 5, icon: "👑" }
];

const DEFAULT_STATE = {
  version: 1,
  startDate: null,
  presetMilestones: {},
  customMilestones: [],
  stageReward: null,
  polaris: null
};

let state = loadState();
let pendingSharedState = readSharedStateFromHash();
let toastTimer = 0;
let celebrationTimer = 0;

const els = {
  todayLine: document.querySelector("#todayLine"),
  timerStatus: document.querySelector("#timerStatus"),
  yearsValue: document.querySelector("#yearsValue"),
  daysValue: document.querySelector("#daysValue"),
  hoursValue: document.querySelector("#hoursValue"),
  minutesValue: document.querySelector("#minutesValue"),
  secondsValue: document.querySelector("#secondsValue"),
  journeyLine: document.querySelector("#journeyLine"),
  startGuideButton: document.querySelector("#startGuideButton"),
  openStartButton: document.querySelector("#openStartButton"),
  settingsStartButton: document.querySelector("#settingsStartButton"),
  settingsStartValue: document.querySelector("#settingsStartValue"),
  shareTopButton: document.querySelector("#shareTopButton"),
  shareSettingsButton: document.querySelector("#shareSettingsButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  resetButton: document.querySelector("#resetButton"),
  upcomingList: document.querySelector("#upcomingList"),
  milestoneList: document.querySelector("#milestoneList"),
  addMilestoneButton: document.querySelector("#addMilestoneButton"),
  polarisHomeCard: document.querySelector("#polarisHomeCard"),
  polarisView: document.querySelector("#polarisView"),
  editPolarisButton: document.querySelector("#editPolarisButton"),
  startModal: document.querySelector("#startModal"),
  startForm: document.querySelector("#startForm"),
  startDateInput: document.querySelector("#startDateInput"),
  startDateNote: document.querySelector("#startDateNote"),
  milestoneModal: document.querySelector("#milestoneModal"),
  milestoneForm: document.querySelector("#milestoneForm"),
  milestoneModalTitle: document.querySelector("#milestoneModalTitle"),
  milestoneIdInput: document.querySelector("#milestoneIdInput"),
  milestoneNameInput: document.querySelector("#milestoneNameInput"),
  milestoneDateInput: document.querySelector("#milestoneDateInput"),
  milestoneNoteInput: document.querySelector("#milestoneNoteInput"),
  polarisModal: document.querySelector("#polarisModal"),
  polarisForm: document.querySelector("#polarisForm"),
  stageNameInput: document.querySelector("#stageNameInput"),
  stageRewardInput: document.querySelector("#stageRewardInput"),
  stageNoteInput: document.querySelector("#stageNoteInput"),
  shareImportModal: document.querySelector("#shareImportModal"),
  acceptSharedData: document.querySelector("#acceptSharedData"),
  dismissSharedData: document.querySelector("#dismissSharedData"),
  dismissSharedDataAlt: document.querySelector("#dismissSharedDataAlt"),
  celebration: document.querySelector("#celebration"),
  celebrationTitle: document.querySelector("#celebrationTitle"),
  celebrationPixels: document.querySelector("#celebrationPixels"),
  toast: document.querySelector("#toast")
};

boot();

function boot() {
  bindEvents();
  ensurePresetMilestones();
  checkAchievements({ show: true });
  render();
  setInterval(renderTimer, 1000);
  setInterval(() => checkAchievements({ show: true }), 60 * 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  if (pendingSharedState) {
    openModal("shareImportModal");
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  document.querySelectorAll("[data-tab-jump]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tabJump));
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  [els.openStartButton, els.startGuideButton, els.settingsStartButton].forEach((button) => {
    button.addEventListener("click", openStartDateModal);
  });

  [els.shareTopButton, els.shareSettingsButton].forEach((button) => {
    button.addEventListener("click", shareSnapshot);
  });

  els.exportButton.addEventListener("click", exportData);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importDataFromFile);
  els.resetButton.addEventListener("click", resetLocalData);
  els.addMilestoneButton.addEventListener("click", () => openMilestoneModal());
  els.editPolarisButton.addEventListener("click", openPolarisModal);

  els.startForm.addEventListener("submit", saveStartDate);
  els.milestoneForm.addEventListener("submit", saveMilestone);
  els.polarisForm.addEventListener("submit", savePolaris);

  els.milestoneList.addEventListener("click", handleMilestoneClick);
  els.polarisView.addEventListener("click", handlePolarisClick);
  els.polarisView.addEventListener("submit", completeStageReward);
  els.polarisHomeCard.addEventListener("click", handlePolarisClick);
  els.polarisHomeCard.addEventListener("submit", completeStageReward);

  els.acceptSharedData.addEventListener("click", acceptSharedState);
  els.dismissSharedData.addEventListener("click", dismissSharedState);
  els.dismissSharedDataAlt.addEventListener("click", dismissSharedState);
  els.celebration.addEventListener("click", hideCelebration);

  document.querySelectorAll(".modal-backdrop").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      checkAchievements({ show: true });
      render();
    }
  });

  window.addEventListener("hashchange", () => {
    const sharedState = readSharedStateFromHash();
    if (!sharedState) return;
    pendingSharedState = sharedState;
    openModal("shareImportModal");
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(DEFAULT_STATE);
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to load state", error);
    return structuredClone(DEFAULT_STATE);
  }
}

function normalizeState(input) {
  const safe = input && typeof input === "object" ? input : {};
  const next = {
    version: 1,
    startDate: isDateString(safe.startDate) ? safe.startDate : null,
    presetMilestones: safe.presetMilestones && typeof safe.presetMilestones === "object" ? safe.presetMilestones : {},
    customMilestones: Array.isArray(safe.customMilestones) ? safe.customMilestones : [],
    stageReward: normalizeStageReward(safe.stageReward || migratePolarisToStageReward(safe.polaris)),
    polaris: null
  };

  next.customMilestones = next.customMilestones
    .filter((item) => item && item.name && isDateString(item.date))
    .map((item) => ({
      id: String(item.id || cryptoId("m")),
      name: String(item.name).slice(0, 18),
      date: item.date,
      note: String(item.note || "").slice(0, 80),
      type: "custom",
      achieved: Boolean(item.achieved),
      hasShownCelebration: Boolean(item.hasShownCelebration)
    }));

  return next;
}

function normalizeStageReward(input) {
  if (!input || typeof input !== "object" || !input.name) return null;
  const achieved = Boolean(input.achieved);
  return {
    id: String(input.id || "stage_1"),
    name: String(input.name).slice(0, 22),
    reward: String(input.reward || "一起兑换一个奖励").slice(0, 24),
    note: String(input.note || "").slice(0, 90),
    createdAt: input.createdAt || todayString(),
    achieved,
    completedAt: achieved ? input.completedAt || todayString() : null,
    checkinText: String(input.checkinText || "").slice(0, 100),
    hasShownCelebration: Boolean(input.hasShownCelebration)
  };
}

function migratePolarisToStageReward(polaris) {
  if (!polaris || typeof polaris !== "object" || !polaris.name) return null;
  const unit = polaris.unit || "点";
  const achieved = Boolean(polaris.achieved);
  return {
    id: "stage_1",
    name: String(polaris.name),
    reward: "一起兑换一个奖励",
    note: `从旧版北极星迁移：${formatNumber(toNumber(polaris.currentValue))}/${formatNumber(toNumber(polaris.targetValue))}${unit}`,
    createdAt: polaris.createdAt || todayString(),
    achieved,
    completedAt: achieved ? todayString() : null,
    checkinText: achieved ? "旧版进度已达成，自动迁移为完成打卡。" : "",
    hasShownCelebration: Boolean(polaris.hasShownCelebration)
  };
}

function saveState() {
  ensurePresetMilestones();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensurePresetMilestones() {
  PRESET_DEFINITIONS.forEach((definition) => {
    if (!state.presetMilestones[definition.id]) {
      state.presetMilestones[definition.id] = {
        enabled: true,
        achieved: false,
        hasShownCelebration: false
      };
    }
    if (typeof state.presetMilestones[definition.id].enabled !== "boolean") {
      state.presetMilestones[definition.id].enabled = true;
    }
  });
}

function render() {
  renderTodayLine();
  renderTimer();
  renderMilestones();
  renderPolaris();
  renderSettings();
}

function renderTodayLine() {
  const date = new Date();
  els.todayLine.textContent = `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

function renderTimer() {
  const track = document.querySelector(".track-strip");
  if (!state.startDate) {
    setTimerValues("--", "--", "--", "--", "--");
    els.timerStatus.textContent = "等待起跑";
    els.journeyLine.textContent = "请先设置你们的第一天。";
    els.startGuideButton.hidden = false;
    setRunnerProgress(track, 0);
    return;
  }

  const start = parseDateOnly(state.startDate);
  const now = new Date();

  if (start.getTime() > now.getTime()) {
    const daysUntil = Math.ceil((start.getTime() - startOfDay(now).getTime()) / DAY_MS);
    setTimerValues("--", "--", "--", "--", "--");
    els.timerStatus.textContent = "还未开始";
    els.journeyLine.textContent = `你们的旅程将在 ${daysUntil} 天后开始。`;
    els.startGuideButton.hidden = true;
    setRunnerProgress(track, 0);
    return;
  }

  const diff = getElapsedParts(start, now);
  setTimerValues(pad2(diff.years), diff.days, pad2(diff.hours), pad2(diff.minutes), pad2(diff.seconds));
  els.timerStatus.textContent = "正在奔跑";
  els.journeyLine.textContent = `从 ${formatDateCN(state.startDate)} 开始，我们已经奔跑了 ${diff.totalDays} 天。`;
  els.startGuideButton.hidden = true;
  setRunnerProgress(track, getRunnerPosition());
}

function setTimerValues(years, days, hours, minutes, seconds) {
  els.yearsValue.textContent = years;
  els.daysValue.textContent = days;
  els.hoursValue.textContent = hours;
  els.minutesValue.textContent = minutes;
  els.secondsValue.textContent = seconds;
}

function renderMilestones() {
  const milestones = getAllMilestones();
  const upcoming = milestones
    .filter((item) => item.enabled && item.date && compareDateString(item.date, todayString()) >= 0)
    .sort(sortMilestones)
    .slice(0, 3);

  els.upcomingList.innerHTML = upcoming.length
    ? upcoming.map(renderMiniMilestone).join("")
    : renderEmptyMini("还没有下一站", "设置起点或添加自定义里程碑");

  els.milestoneList.innerHTML = milestones.length
    ? milestones.sort(sortMilestones).map(renderTimelineItem).join("")
    : `<div class="empty-state"><strong>赛道还空着</strong><button class="primary-button wide-button" type="button" id="emptyAddMilestone">添加里程碑</button></div>`;

  const emptyButton = document.querySelector("#emptyAddMilestone");
  if (emptyButton) {
    emptyButton.addEventListener("click", () => openMilestoneModal());
  }
}

function renderMiniMilestone(item) {
  const days = daysBetween(startOfDay(new Date()), parseDateOnly(item.date));
  const label = days === 0 ? "今天" : `${days} 天后`;
  return `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(item.icon)} ${escapeHtml(item.name)}</strong>
        <span>${formatDateCN(item.date)}</span>
      </div>
      <span>${label}</span>
    </div>
  `;
}

function renderEmptyMini(title, detail) {
  return `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
      <span>···</span>
    </div>
  `;
}

function renderTimelineItem(item) {
  const status = getMilestoneStatus(item);
  const progress = getMilestoneProgress(item);
  const classes = ["timeline-item"];
  if (item.achieved) classes.push("achieved");
  if (!item.enabled) classes.push("disabled");

  const note = item.note ? `<p class="timeline-note">${escapeHtml(item.note)}</p>` : "";
  const actions = item.type === "preset"
    ? `<button type="button" data-action="toggle-preset" data-id="${item.id}">${item.enabled ? "关闭" : "开启"}</button>`
    : `
      <button type="button" data-action="edit-custom" data-id="${item.id}">编辑</button>
      <button type="button" data-action="delete-custom" data-id="${item.id}">删除</button>
    `;

  return `
    <article class="${classes.join(" ")}">
      <div class="timeline-main">
        <span class="pixel-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
        <div>
          <div class="timeline-title">
            <h3>${escapeHtml(item.name)}</h3>
            <span class="badge">${escapeHtml(status)}</span>
          </div>
          <p class="timeline-meta">${item.date ? formatDateCN(item.date) : "设置起点后生成"}</p>
          ${note}
        </div>
      </div>
      <div class="progress-bar" aria-label="里程碑进度">
        <div class="progress-fill${item.achieved ? " gold" : ""}" style="--progress: ${progress}%"></div>
      </div>
      <div class="timeline-actions">${actions}</div>
    </article>
  `;
}

function renderPolaris() {
  const home = state.stageReward ? renderPolarisPanel({ compact: true }) : renderPolarisEmpty();
  const full = state.stageReward ? renderPolarisPanel({ compact: false }) : renderPolarisEmpty();
  els.polarisHomeCard.innerHTML = home;
  els.polarisView.innerHTML = full;
  els.editPolarisButton.textContent = state.stageReward ? "编辑" : "新建";
}

function renderPolarisEmpty() {
  return `
    <div class="empty-state">
      <strong>还没有阶段奖励</strong>
      <button class="primary-button wide-button" type="button" data-action="open-polaris">设置阶段</button>
    </div>
  `;
}

function renderPolarisPanel({ compact }) {
  const stage = state.stageReward;
  const percent = stage.achieved ? 100 : 0;
  const completion = stage.achieved ? renderStageCompletion(stage) : "";
  const checkin = compact || stage.achieved ? "" : renderStageCheckinForm();
  return `
    <section class="polaris-panel stage-panel ${stage.achieved ? "stage-achieved" : ""}">
      <div class="polaris-topline">
        <h3>${escapeHtml(stage.name)}</h3>
        <span class="badge">${stage.achieved ? "已解锁" : "待打卡"}</span>
      </div>
      <div class="stage-reward">
        <span>奖励</span>
        <strong>${escapeHtml(stage.reward)}</strong>
      </div>
      ${stage.note ? `<p class="stage-note">${escapeHtml(stage.note)}</p>` : ""}
      <div class="progress-bar stage-meter" aria-label="阶段奖励状态">
        <div class="progress-fill${stage.achieved ? " gold" : ""}" style="--progress: ${percent}%"></div>
      </div>
      <div class="polaris-values">
        <span>${stage.achieved ? `完成于 ${formatDateCN(stage.completedAt)}` : "完成后手动打卡"}</span>
        <span>${stage.achieved ? "奖励已解锁" : "提交记录即视作达成"}</span>
      </div>
      ${completion}
      ${checkin}
    </section>
  `;
}

function renderStageCompletion(stage) {
  return `
    <div class="stage-completion">
      <strong>打卡记录</strong>
      <p>${escapeHtml(stage.checkinText || "已经完成这个阶段。")}</p>
    </div>
  `;
}

function renderStageCheckinForm() {
  return `
    <form class="polaris-actions stage-checkin" data-action="complete-stage">
      <input name="checkin" type="text" maxlength="100" placeholder="写下完成记录，例如：今天一起跑完 5km" required />
      <button class="primary-button" type="submit">完成打卡</button>
    </form>
  `;
}

function renderSettings() {
  els.settingsStartValue.textContent = state.startDate ? formatDateCN(state.startDate) : "未设置";
}

function getAllMilestones() {
  const presets = PRESET_DEFINITIONS.map((definition) => {
    const pref = state.presetMilestones[definition.id] || {};
    const date = state.startDate ? getPresetDate(definition) : null;
    return {
      id: definition.id,
      type: "preset",
      name: definition.name,
      icon: definition.icon,
      date,
      enabled: pref.enabled !== false,
      achieved: Boolean(pref.achieved),
      hasShownCelebration: Boolean(pref.hasShownCelebration)
    };
  });

  const custom = state.customMilestones.map((item) => ({
    ...item,
    enabled: true,
    icon: "✦"
  }));

  return [...presets, ...custom];
}

function getPresetDate(definition) {
  const start = parseDateOnly(state.startDate);
  if (definition.days) {
    return toDateString(addDays(start, definition.days));
  }
  return toDateString(addYears(start, definition.years));
}

function getMilestoneStatus(item) {
  if (!item.enabled) return "已关闭";
  if (!item.date) return "待生成";
  const diff = compareDateString(item.date, todayString());
  if (diff < 0 || item.achieved) return "已达成 ✓";
  if (diff === 0) return "今日";
  return `${daysBetween(startOfDay(new Date()), parseDateOnly(item.date))} 天后`;
}

function getMilestoneProgress(item) {
  if (!item.enabled) return 0;
  if (!item.date) return 0;
  if (item.achieved || compareDateString(item.date, todayString()) <= 0) return 100;
  const start = state.startDate ? parseDateOnly(state.startDate) : startOfDay(new Date());
  const end = parseDateOnly(item.date);
  const total = Math.max(1, daysBetween(start, end));
  const elapsed = Math.max(0, daysBetween(start, startOfDay(new Date())));
  return Math.min(100, Math.round((elapsed / total) * 100));
}

function getRunnerPosition() {
  const upcoming = getAllMilestones()
    .filter((item) => item.enabled && item.date && compareDateString(item.date, todayString()) >= 0)
    .sort(sortMilestones)[0];

  if (!state.startDate || !upcoming) return 100;
  return Math.max(0, Math.min(100, getMilestoneProgress(upcoming)));
}

function setRunnerProgress(track, progress) {
  const points = [
    [8, 79],
    [25, 79],
    [25, 57],
    [48, 57],
    [48, 31],
    [72, 31],
    [72, 62],
    [90, 62]
  ];
  const clamped = Math.max(0, Math.min(100, progress));
  const segments = [];
  let total = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const length = Math.hypot(x2 - x1, y2 - y1);
    segments.push({ x1, y1, x2, y2, length });
    total += length;
  }

  let remaining = (clamped / 100) * total;
  let x = points[0][0];
  let y = points[0][1];

  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length ? remaining / segment.length : 0;
      x = segment.x1 + (segment.x2 - segment.x1) * ratio;
      y = segment.y1 + (segment.y2 - segment.y1) * ratio;
      break;
    }
    remaining -= segment.length;
    x = segment.x2;
    y = segment.y2;
  }

  track.style.setProperty("--runner-x", `${x}%`);
  track.style.setProperty("--runner-y", `${y}%`);
}

function checkAchievements({ show }) {
  ensurePresetMilestones();
  const today = todayString();
  const messages = [];
  let changed = false;

  if (state.startDate) {
    PRESET_DEFINITIONS.forEach((definition) => {
      const pref = state.presetMilestones[definition.id];
      const date = getPresetDate(definition);
      if (pref.enabled === false) return;

      if (compareDateString(date, today) <= 0 && !pref.achieved) {
        pref.achieved = true;
        changed = true;
      }

      if (compareDateString(date, today) === 0 && !pref.hasShownCelebration) {
        pref.hasShownCelebration = true;
        messages.push(`${definition.name} 达成！`);
        changed = true;
      }
    });
  }

  state.customMilestones.forEach((item) => {
    if (compareDateString(item.date, today) <= 0 && !item.achieved) {
      item.achieved = true;
      changed = true;
    }
    if (compareDateString(item.date, today) === 0 && !item.hasShownCelebration) {
      item.hasShownCelebration = true;
      messages.push(`${item.name} 达成！`);
      changed = true;
    }
  });

  if (changed) {
    saveState();
    render();
  }

  if (show && messages.length) {
    showCelebration(messages.join(" "));
  }
}

function activateTab(tab) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#view-${tab}`).classList.add("active");
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
}

function openStartDateModal() {
  els.startDateInput.value = state.startDate || todayString();
  updateStartDateNote();
  openModal("startModal");
}

function updateStartDateNote() {
  if (!els.startDateInput.value) return;
  const future = compareDateString(els.startDateInput.value, todayString()) > 0;
  els.startDateNote.textContent = future
    ? "这是未来日期，主页会显示旅程尚未开始。"
    : "修改后会重算预设里程碑，自定义里程碑会保留。";
}

els.startDateInput.addEventListener("change", updateStartDateNote);

function saveStartDate(event) {
  event.preventDefault();
  const value = els.startDateInput.value;
  if (!isDateString(value)) {
    showToast("请选择有效日期。");
    return;
  }

  if (compareDateString(value, "1970-01-01") < 0) {
    showToast("日期不能早于 1970-01-01。");
    return;
  }

  if (state.startDate && state.startDate !== value) {
    const ok = window.confirm("确认修改起点日期？预设里程碑达成状态会重置。");
    if (!ok) return;
  }

  state.startDate = value;
  PRESET_DEFINITIONS.forEach((definition) => {
    state.presetMilestones[definition.id] = {
      enabled: state.presetMilestones[definition.id]?.enabled !== false,
      achieved: false,
      hasShownCelebration: false
    };
  });
  saveState();
  closeModal("startModal");
  checkAchievements({ show: true });
  render();
  showToast("起点已设置。");
}

function openMilestoneModal(id) {
  const existing = id ? state.customMilestones.find((item) => item.id === id) : null;
  els.milestoneModalTitle.textContent = existing ? "编辑里程碑" : "添加里程碑";
  els.milestoneIdInput.value = existing?.id || "";
  els.milestoneNameInput.value = existing?.name || "";
  els.milestoneDateInput.value = existing?.date || todayString();
  els.milestoneNoteInput.value = existing?.note || "";
  openModal("milestoneModal");
}

function saveMilestone(event) {
  event.preventDefault();
  const id = els.milestoneIdInput.value;
  const name = els.milestoneNameInput.value.trim();
  const date = els.milestoneDateInput.value;
  const note = els.milestoneNoteInput.value.trim();

  if (!name || !isDateString(date)) {
    showToast("请填写名称和日期。");
    return;
  }

  if (id) {
    const target = state.customMilestones.find((item) => item.id === id);
    if (target) {
      target.name = name;
      target.date = date;
      target.note = note;
      target.achieved = compareDateString(date, todayString()) <= 0;
      target.hasShownCelebration = false;
    }
  } else {
    state.customMilestones.push({
      id: cryptoId("m"),
      name,
      date,
      note,
      type: "custom",
      achieved: false,
      hasShownCelebration: false
    });
  }

  saveState();
  closeModal("milestoneModal");
  checkAchievements({ show: true });
  render();
  showToast("里程碑已保存。");
}

function handleMilestoneClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === "toggle-preset") {
    const pref = state.presetMilestones[id];
    pref.enabled = !pref.enabled;
    saveState();
    render();
    showToast(pref.enabled ? "预设已开启。" : "预设已关闭。");
  }

  if (action === "edit-custom") {
    openMilestoneModal(id);
  }

  if (action === "delete-custom") {
    const target = state.customMilestones.find((item) => item.id === id);
    if (!target) return;
    const ok = window.confirm(`删除「${target.name}」？`);
    if (!ok) return;
    state.customMilestones = state.customMilestones.filter((item) => item.id !== id);
    saveState();
    render();
    showToast("里程碑已删除。");
  }
}

function openPolarisModal() {
  const stage = state.stageReward;
  els.stageNameInput.value = stage?.name || "";
  els.stageRewardInput.value = stage?.reward || "";
  els.stageNoteInput.value = stage?.note || "";
  openModal("polarisModal");
}

function savePolaris(event) {
  event.preventDefault();
  const name = els.stageNameInput.value.trim();
  const reward = els.stageRewardInput.value.trim();
  const note = els.stageNoteInput.value.trim();

  if (!name || !reward) {
    showToast("请填写共同目标和奖励。");
    return;
  }

  const changedCore = state.stageReward && (state.stageReward.name !== name || state.stageReward.reward !== reward);
  state.stageReward = {
    id: state.stageReward?.id || "stage_1",
    name,
    reward,
    note,
    createdAt: state.stageReward?.createdAt || todayString(),
    achieved: changedCore ? false : Boolean(state.stageReward?.achieved),
    completedAt: changedCore ? null : state.stageReward?.completedAt || null,
    checkinText: changedCore ? "" : state.stageReward?.checkinText || "",
    hasShownCelebration: changedCore ? false : Boolean(state.stageReward?.hasShownCelebration)
  };

  saveState();
  closeModal("polarisModal");
  render();
  showToast("阶段奖励已保存。");
}

function handlePolarisClick(event) {
  const button = event.target.closest("button[data-action='open-polaris']");
  if (button) {
    openPolarisModal();
  }
}

function completeStageReward(event) {
  if (!event.target.matches("form[data-action='complete-stage']")) return;
  event.preventDefault();
  if (!state.stageReward || state.stageReward.achieved) return;

  const input = event.target.elements.checkin;
  const checkinText = input.value.trim();
  if (!checkinText) {
    showToast("写一句完成记录再打卡。");
    return;
  }

  state.stageReward.achieved = true;
  state.stageReward.completedAt = todayString();
  state.stageReward.checkinText = checkinText;
  state.stageReward.hasShownCelebration = true;
  saveState();
  render();
  showCelebration(`${state.stageReward.name} 打卡完成！`);
  playChime();
}

async function shareSnapshot() {
  const url = makeShareUrl();
  const title = "像素马拉松";
  const text = "打开这份像素马拉松快照。";

  try {
    if (navigator.share && /^https?:/.test(location.protocol)) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (error) {
    if (error.name === "AbortError") return;
  }

  const copied = await copyText(url);
  if (copied) {
    showToast(/^file:/.test(location.protocol) ? "已复制快照链接。部署到网页地址后更适合跨设备打开。" : "快照链接已复制。");
  } else {
    window.prompt("复制分享链接", url);
  }
}

function makeShareUrl() {
  const payload = {
    app: "pixel-marathon",
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };
  const encoded = encodePayload(payload);
  const base = `${location.origin}${location.pathname}${location.search}`;
  return `${base}#data=${encoded}`;
}

function exportData() {
  const payload = {
    app: "pixel-marathon",
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pixel-marathon-${todayString()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("JSON 已导出。");
}

function importDataFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = parsed.state ? parsed.state : parsed;
      const next = normalizeState(imported);
      const ok = window.confirm("导入会覆盖当前本机数据，确认继续？");
      if (!ok) return;
      state = next;
      saveState();
      checkAchievements({ show: false });
      render();
      showToast("数据已导入。");
    } catch (error) {
      showToast("JSON 文件无法识别。");
    } finally {
      els.importFile.value = "";
    }
  };
  reader.readAsText(file);
}

function acceptSharedState() {
  if (!pendingSharedState) return;
  state = normalizeState(pendingSharedState);
  saveState();
  closeModal("shareImportModal");
  clearHashData();
  pendingSharedState = null;
  checkAchievements({ show: false });
  render();
  showToast("快照已导入。");
}

function dismissSharedState() {
  pendingSharedState = null;
  clearHashData();
  closeModal("shareImportModal");
}

function resetLocalData() {
  const ok = window.confirm("清空本机所有像素马拉松数据？");
  if (!ok) return;
  state = structuredClone(DEFAULT_STATE);
  ensurePresetMilestones();
  saveState();
  render();
  showToast("本机数据已清空。");
}

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  const firstInput = modal.querySelector("input, textarea, button");
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 0);
  }
}

function closeModal(id) {
  const modal = document.querySelector(`#${id}`);
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

function showCelebration(message) {
  window.clearTimeout(celebrationTimer);
  els.celebrationTitle.textContent = message;
  els.celebrationPixels.innerHTML = "";
  const colors = ["#ffbf3f", "#f25f5c", "#2ec4b6", "#3a86ff", "#f7d154"];

  for (let i = 0; i < 44; i += 1) {
    const spark = document.createElement("span");
    spark.className = "pixel-spark";
    spark.style.left = `${Math.random() * 100}%`;
    spark.style.top = `${Math.random() * 100}%`;
    spark.style.setProperty("--spark-color", colors[i % colors.length]);
    spark.style.animationDelay = `${Math.random() * 500}ms`;
    els.celebrationPixels.append(spark);
  }

  els.celebration.classList.add("active");
  els.celebration.setAttribute("aria-hidden", "false");
  playChime();
  celebrationTimer = window.setTimeout(hideCelebration, 3000);
}

function hideCelebration() {
  window.clearTimeout(celebrationTimer);
  els.celebration.classList.remove("active");
  els.celebration.setAttribute("aria-hidden", "true");
}

function playChime() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const context = new AudioContext();
    const now = context.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + index * 0.08 + 0.18);
    });
    setTimeout(() => context.close(), 650);
  } catch (error) {
    console.warn("Audio skipped", error);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("active");
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("active");
  }, 2800);
}

function getElapsedParts(start, now) {
  let years = now.getFullYear() - start.getFullYear();
  let anniversary = addYears(start, years);
  if (anniversary.getTime() > now.getTime()) {
    years -= 1;
    anniversary = addYears(start, years);
  }

  const remaining = now.getTime() - anniversary.getTime();
  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
  const totalDays = Math.floor((now.getTime() - start.getTime()) / DAY_MS);

  return { years, days, hours, minutes, seconds, totalDays };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayString() {
  return toDateString(new Date());
}

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = parseDateOnly(value);
  return toDateString(date) === value;
}

function formatDateCN(value) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function compareDateString(a, b) {
  return a.localeCompare(b);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function addYears(date, years) {
  const year = date.getFullYear() + years;
  const month = date.getMonth();
  const day = Math.min(date.getDate(), daysInMonth(year, month));
  return new Date(year, month, day);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

function sortMilestones(a, b) {
  if (!a.date && !b.date) return a.name.localeCompare(b.name, "zh-CN");
  if (!a.date) return 1;
  if (!b.date) return -1;
  const byDate = a.date.localeCompare(b.date);
  return byDate || a.name.localeCompare(b.name, "zh-CN");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function cryptoId(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodePayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodePayload(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function readSharedStateFromHash() {
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    const encoded = params.get("data");
    if (!encoded) return null;
    const payload = decodePayload(encoded);
    if (payload?.app !== "pixel-marathon") return null;
    return payload.state || null;
  } catch (error) {
    showToast("分享快照无法识别。");
    return null;
  }
}

function clearHashData() {
  if (!location.hash) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    console.warn("Clipboard API failed", error);
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-999px";
  document.body.append(textarea);
  textarea.select();

  try {
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch (error) {
    textarea.remove();
    return false;
  }
}
