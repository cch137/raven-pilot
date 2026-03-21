const DEFAULT_MODEL_SETTINGS = {
  model: "@anthropic/claude-sonnet-4-6",
  reasoningEffort: "high",
  verbosity: "low",
};

const COMPOSER_MIN_HEIGHT = 40;
const COMPOSER_MAX_HEIGHT = 128;
const CUSTOM_SELECT_MENU_MAX_HEIGHT = 256;
const CUSTOM_SELECT_MENU_GAP = 6;
const CUSTOM_SELECT_VIEWPORT_PADDING = 12;

const state = {
  threadId: "",
  cwd: "",
  modelSettings: { ...DEFAULT_MODEL_SETTINGS },
  processing: false,
  messages: [],
};

const ui = {
  expandedPanels: new Set(),
  expandedToolGroups: new Set(),
  connectionLost: false,
};

const elements = {
  threadId: document.getElementById("threadId"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  messages: document.getElementById("messages"),
  messageList: document.getElementById("messageList"),
  emptyState: document.getElementById("emptyState"),
  form: document.getElementById("composerForm"),
  input: document.getElementById("input"),
  sendButton: document.getElementById("sendButton"),
  modelForm: document.getElementById("modelForm"),
  modelInput: document.getElementById("modelInput"),
  reasoningEffortSelectRoot: document.getElementById("reasoningEffortSelectRoot"),
  reasoningEffortSelect: document.getElementById("reasoningEffortSelect"),
  verbositySelectRoot: document.getElementById("verbositySelectRoot"),
  verbositySelect: document.getElementById("verbositySelect"),
  modelButton: document.getElementById("modelButton"),
  cwdForm: document.getElementById("cwdForm"),
  cwdInput: document.getElementById("cwdInput"),
  cwdButton: document.getElementById("cwdButton"),
  resetButton: document.getElementById("resetButton"),
  toastStack: document.getElementById("toastStack"),
};

const toastTimers = new WeakMap();
const customSelects = new Map();
let activeCustomSelect = null;

function autoResizeInput() {
  const styles = window.getComputedStyle(elements.input);
  const borderSize =
    Number.parseFloat(styles.borderTopWidth || "0") + Number.parseFloat(styles.borderBottomWidth || "0");

  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(
    Math.max(elements.input.scrollHeight + borderSize, COMPOSER_MIN_HEIGHT),
    COMPOSER_MAX_HEIGHT,
  )}px`;
}

function isCustomSelectActive(root) {
  return Boolean(root && (root.dataset.open === "true" || root.contains(document.activeElement)));
}

function getCustomSelect(id) {
  return customSelects.get(id) || null;
}

function syncCustomSelect(select) {
  if (!select) return;

  const selected =
    select.options.find((option) => option.value === select.input.value) || select.options[0] || null;

  if (!selected) return;

  select.input.value = selected.value;
  select.valueLabel.textContent = selected.label;
  select.trigger.title = selected.label;

  for (const option of select.options) {
    const isSelected = option.value === selected.value;
    option.element.setAttribute("aria-selected", String(isSelected));
    option.element.tabIndex = isSelected ? 0 : -1;
  }
}

function closeCustomSelect(select, { restoreFocus = false } = {}) {
  if (!select || select.root.dataset.open !== "true") return;

  select.root.dataset.open = "false";
  select.trigger.setAttribute("aria-expanded", "false");
  select.menu.hidden = true;

  if (activeCustomSelect === select) {
    activeCustomSelect = null;
  }

  if (restoreFocus) {
    select.trigger.focus();
  }
}

function focusCustomSelectOption(select, index) {
  const boundedIndex = Math.max(0, Math.min(index, select.options.length - 1));
  const target = select.options[boundedIndex];
  if (!target) return;

  for (const option of select.options) {
    option.element.tabIndex = option === target ? 0 : -1;
  }

  target.element.focus();
  target.element.scrollIntoView({ block: "nearest" });
}

function updateCustomSelectPlacement(select) {
  if (!select || select.root.dataset.open !== "true") return;

  const triggerRect = select.trigger.getBoundingClientRect();
  const menuHeight = Math.min(select.menu.scrollHeight, CUSTOM_SELECT_MENU_MAX_HEIGHT);
  const spaceAbove = Math.max(triggerRect.top - CUSTOM_SELECT_VIEWPORT_PADDING - CUSTOM_SELECT_MENU_GAP, 0);
  const spaceBelow = Math.max(
    window.innerHeight - triggerRect.bottom - CUSTOM_SELECT_VIEWPORT_PADDING - CUSTOM_SELECT_MENU_GAP,
    0,
  );
  const shouldOpenUpward =
    spaceBelow < menuHeight && (spaceAbove >= menuHeight || spaceAbove > spaceBelow);
  const availableHeight = shouldOpenUpward ? spaceAbove : spaceBelow;

  select.root.dataset.placement = shouldOpenUpward ? "top" : "bottom";
  select.menu.style.maxHeight = `${Math.min(availableHeight > 0 ? availableHeight : menuHeight, CUSTOM_SELECT_MENU_MAX_HEIGHT)}px`;
}

function openCustomSelect(select, { focusSelected = false } = {}) {
  if (!select) return;

  if (activeCustomSelect && activeCustomSelect !== select) {
    closeCustomSelect(activeCustomSelect);
  }

  syncCustomSelect(select);
  select.root.dataset.open = "true";
  select.trigger.setAttribute("aria-expanded", "true");
  select.menu.hidden = false;
  activeCustomSelect = select;
  updateCustomSelectPlacement(select);

  if (focusSelected) {
    const selectedIndex = select.options.findIndex((option) => option.value === select.input.value);
    requestAnimationFrame(() => focusCustomSelectOption(select, selectedIndex === -1 ? 0 : selectedIndex));
  }
}

function setCustomSelectValue(select, value, { dispatch = true, restoreFocus = false } = {}) {
  if (!select) return;

  const option = select.options.find((item) => item.value === value);
  if (!option) return;

  select.input.value = option.value;
  syncCustomSelect(select);
  closeCustomSelect(select, { restoreFocus });

  if (dispatch) {
    select.input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function syncCustomSelectValue(id, value) {
  const select = getCustomSelect(id);
  if (!select) return;

  select.input.value = value;
  syncCustomSelect(select);
}

function initializeCustomSelect(root) {
  if (!root) return;

  const input = root.querySelector('input[type="hidden"]');
  const trigger = root.querySelector("[data-select-trigger]");
  const valueLabel = root.querySelector("[data-select-value]");
  const menu = root.querySelector("[data-select-menu]");
  const options = [...root.querySelectorAll("[data-select-option]")].map((element) => ({
    element,
    value: element.dataset.value || "",
    label: element.textContent.trim(),
  }));

  if (!input || !trigger || !valueLabel || !menu || options.length === 0) return;

  const select = { root, input, trigger, valueLabel, menu, options };
  customSelects.set(input.id, select);

  trigger.addEventListener("click", () => {
    if (root.dataset.open === "true") {
      closeCustomSelect(select);
      return;
    }

    openCustomSelect(select);
  });

  trigger.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        openCustomSelect(select, { focusSelected: true });
        break;
      case "ArrowUp":
        event.preventDefault();
        openCustomSelect(select, { focusSelected: true });
        requestAnimationFrame(() => focusCustomSelectOption(select, select.options.length - 1));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (root.dataset.open === "true") closeCustomSelect(select);
        else openCustomSelect(select, { focusSelected: true });
        break;
      case "Escape":
        if (root.dataset.open === "true") {
          event.preventDefault();
          closeCustomSelect(select, { restoreFocus: true });
        }
        break;
    }
  });

  options.forEach((option, index) => {
    option.element.setAttribute("role", "option");

    option.element.addEventListener("click", () => {
      setCustomSelectValue(select, option.value, { restoreFocus: true });
    });

    option.element.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          focusCustomSelectOption(select, index + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusCustomSelectOption(select, index - 1);
          break;
        case "Home":
          event.preventDefault();
          focusCustomSelectOption(select, 0);
          break;
        case "End":
          event.preventDefault();
          focusCustomSelectOption(select, select.options.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          setCustomSelectValue(select, option.value, { restoreFocus: true });
          break;
        case "Escape":
          event.preventDefault();
          closeCustomSelect(select, { restoreFocus: true });
          break;
        case "Tab":
          closeCustomSelect(select);
          break;
      }
    });
  });

  root.dataset.open = "false";
  root.dataset.placement = "bottom";
  syncCustomSelect(select);
}

function normalizeModelSettings(settings = {}) {
  return {
    model:
      typeof settings.model === "string" && settings.model.trim()
        ? settings.model.trim()
        : DEFAULT_MODEL_SETTINGS.model,
    reasoningEffort:
      typeof settings.reasoningEffort === "string"
        ? settings.reasoningEffort
        : DEFAULT_MODEL_SETTINGS.reasoningEffort,
    verbosity:
      typeof settings.verbosity === "string"
        ? settings.verbosity
        : DEFAULT_MODEL_SETTINGS.verbosity,
  };
}

function readModelSettingsForm() {
  return normalizeModelSettings({
    model: elements.modelInput.value,
    reasoningEffort: elements.reasoningEffortSelect.value,
    verbosity: elements.verbositySelect.value,
  });
}

function sameModelSettings(left, right) {
  return (
    left.model === right.model &&
    left.reasoningEffort === right.reasoningEffort &&
    left.verbosity === right.verbosity
  );
}

function isEditingModelSettings() {
  return (
    document.activeElement === elements.modelInput ||
    isCustomSelectActive(elements.reasoningEffortSelectRoot) ||
    isCustomSelectActive(elements.verbositySelectRoot)
  );
}

function applySnapshot(snapshot) {
  state.threadId = snapshot.threadId || "";
  state.cwd = snapshot.cwd || "";
  state.modelSettings = normalizeModelSettings(snapshot.modelSettings);
  state.processing = Boolean(snapshot.processing);
  state.messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
}

function upsertMessage(message) {
  const index = state.messages.findIndex((item) => item.id === message.id);
  if (index === -1) state.messages.push(message);
  else state.messages[index] = message;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarkdown(content) {
  const text = String(content ?? "");

  try {
    if (window.marked && window.DOMPurify) {
      const raw = window.marked.parse(text, { gfm: true, breaks: true });
      const sanitized = window.DOMPurify.sanitize(raw);
      const template = document.createElement("template");
      template.innerHTML = sanitized;

      template.content.querySelectorAll("a").forEach((anchor) => {
        anchor.target = "_blank";
        anchor.rel = "noreferrer noopener";
      });

      return template.innerHTML || `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
    }
  } catch {}

  return `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
}

function icon(name, classes = "h-4 w-4") {
  return `<i data-lucide="${name}" class="${classes}" aria-hidden="true"></i>`;
}

function toastTone(type = "info") {
  switch (type) {
    case "success":
      return {
        icon: "check",
        title: "Success",
        wrapperClass: "border-emerald-500/25 bg-zinc-900/95",
        iconClass: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20",
      };
    case "warning":
      return {
        icon: "triangle-alert",
        title: "Warning",
        wrapperClass: "border-amber-500/25 bg-zinc-900/95",
        iconClass: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20",
      };
    case "error":
      return {
        icon: "circle-alert",
        title: "Error",
        wrapperClass: "border-rose-500/25 bg-zinc-900/95",
        iconClass: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/20",
      };
    default:
      return {
        icon: "info",
        title: "Notice",
        wrapperClass: "border-white/10 bg-zinc-900/95",
        iconClass: "bg-zinc-800 text-zinc-200 ring-1 ring-white/10",
      };
  }
}

function dismissToast(toast) {
  if (!toast || toast.dataset.closing === "true") return;

  toast.dataset.closing = "true";

  const timer = toastTimers.get(toast);
  if (timer) clearTimeout(timer);

  toast.classList.remove("opacity-100", "translate-y-0", "scale-100");
  toast.classList.add("opacity-0", "translate-y-2", "scale-[0.98]");

  const removeToast = () => toast.remove();
  toast.addEventListener("transitionend", removeToast, { once: true });
  setTimeout(removeToast, 220);
}

function showToast(message, { type = "info", title, duration } = {}) {
  const text = String(message ?? "").trim();
  if (!text || !elements.toastStack) return;

  const tone = toastTone(type);
  const timeout =
    typeof duration === "number" ? duration : type === "error" || type === "warning" ? 5200 : 2800;

  if (elements.toastStack.childElementCount >= 4) {
    elements.toastStack.firstElementChild?.remove();
  }

  const toast = document.createElement("section");
  toast.className = `pointer-events-auto overflow-hidden rounded-2xl border ${tone.wrapperClass} shadow-panel backdrop-blur transition-all duration-200 ease-out opacity-0 translate-y-2 scale-[0.98]`;
  toast.setAttribute("role", type === "error" || type === "warning" ? "alert" : "status");

  const body = document.createElement("div");
  body.className = "flex items-start gap-3 px-4 py-3.5";

  const iconWrap = document.createElement("div");
  iconWrap.className = `mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.iconClass}`;
  iconWrap.innerHTML = icon(tone.icon, "h-4 w-4");

  const copy = document.createElement("div");
  copy.className = "min-w-0 flex-1";

  const titleElement = document.createElement("p");
  titleElement.className = "text-sm font-medium text-zinc-50";
  titleElement.textContent = title || tone.title;

  const messageElement = document.createElement("p");
  messageElement.className = "mt-1 text-sm leading-6 text-zinc-300";
  messageElement.textContent = text;

  copy.append(titleElement, messageElement);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200";
  closeButton.setAttribute("aria-label", "Dismiss notification");
  closeButton.innerHTML = icon("x", "h-4 w-4");
  closeButton.addEventListener("click", () => dismissToast(toast));

  body.append(iconWrap, copy, closeButton);
  toast.append(body);
  elements.toastStack.append(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2", "scale-[0.98]");
    toast.classList.add("opacity-100", "translate-y-0", "scale-100");
  });

  if (timeout > 0) {
    toastTimers.set(toast, setTimeout(() => dismissToast(toast), timeout));
  }

  refreshIcons();
}

function showErrorToast(error, title) {
  showToast(error?.message || String(error), { type: "error", title });
}

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindLabel(message) {
  switch (message.kind) {
    case "thinking":
      return "thinking";
    case "tool-call":
      return "tool call";
    case "tool-result":
      return "tool result";
    default:
      return message.role || "message";
  }
}

function messageLabel(message) {
  if (message.title) return message.title;

  switch (message.kind) {
    case "thinking":
      return "Thinking";
    case "tool-call":
      return "Tool call";
    case "tool-result":
      return "Tool result";
    default:
      switch (message.role) {
        case "user":
          return "You";
        case "assistant":
          return "Assistant";
        case "system":
          return "System";
        default:
          return "Message";
      }
  }
}

function messageIcon(message) {
  switch (message.kind) {
    case "thinking":
      return "lightbulb";
    case "tool-call":
      return "wrench";
    case "tool-result":
      return "terminal";
    default:
      switch (message.role) {
        case "user":
          return "user";
        case "assistant":
          return "bot";
        case "system":
          return "shield";
        default:
          return "message-square";
      }
  }
}

function isCollapsibleMessage(message) {
  return ["thinking", "tool-call", "tool-result"].includes(message.kind);
}

function createBadge(text) {
  const badge = document.createElement("span");
  badge.className =
    "inline-flex items-center rounded-full border border-white/10 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400";
  badge.textContent = text;
  return badge;
}

function createMarkdownBody(content, compact = false) {
  const body = document.createElement("div");
  body.className = compact
    ? "markdown-body prose prose-invert prose-zinc max-w-none text-sm leading-6"
    : "markdown-body prose prose-invert prose-zinc max-w-none text-sm leading-6";
  body.innerHTML = renderMarkdown(content);
  return body;
}

function bindPanelState(details, key, store) {
  details.open = store.has(key);
  details.addEventListener("toggle", () => {
    if (details.open) store.add(key);
    else store.delete(key);
  });
}

function createSummary({
  iconName,
  titleText,
  badgeText,
  timeText,
  metaText,
  compact = false,
}) {
  const summary = document.createElement("summary");
  summary.className = compact
    ? "flex cursor-pointer list-none items-center justify-between gap-3 px-2.5 py-2.5"
    : "flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5";

  const left = document.createElement("div");
  left.className = "flex min-w-0 items-center gap-2.5";

  const iconWrap = document.createElement("span");
  iconWrap.className =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-zinc-800/70 text-zinc-300 ring-1 ring-white/10";
  iconWrap.innerHTML = icon(iconName, "h-4 w-4");

  const textWrap = document.createElement("div");
  textWrap.className = "min-w-0";

  const titleRow = document.createElement("div");
  titleRow.className = "flex flex-wrap items-center gap-1.5";

  const title = document.createElement("p");
  title.className = "text-sm font-medium text-zinc-100";
  title.textContent = titleText;
  titleRow.append(title);

  if (badgeText) {
    titleRow.append(createBadge(badgeText));
  }

  textWrap.append(titleRow);

  if (metaText) {
    const meta = document.createElement("p");
    meta.className = "mt-0.5 text-[11px] text-zinc-500";
    meta.textContent = metaText;
    textWrap.append(meta);
  }

  left.append(iconWrap, textWrap);

  const right = document.createElement("div");
  right.className = "flex shrink-0 items-center gap-2 pl-2 text-[11px] text-zinc-500";

  if (timeText) {
    const time = document.createElement("time");
    time.textContent = timeText;
    right.append(time);
  }

  const chevron = document.createElement("span");
  chevron.className = "chevron transition-transform duration-200";
  chevron.innerHTML = icon("chevron-down", "h-4 w-4");
  right.append(chevron);

  summary.append(left, right);
  return summary;
}

function renderStandardMessage(message) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const article = document.createElement("article");
  article.className = isUser
    ? "ml-auto w-full max-w-[min(100%,42rem)]"
    : "w-full max-w-[min(100%,48rem)]";

  const meta = document.createElement("div");
  meta.className = isUser
    ? "mb-1.5 flex items-center justify-end gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500"
    : "mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500";

  const label = document.createElement("span");
  label.textContent = messageLabel(message);
  meta.append(label);

  const timeText = timeLabel(message.createdAt);
  if (timeText) {
    const divider = document.createElement("span");
    divider.className = "text-zinc-700";
    divider.textContent = "•";

    const time = document.createElement("time");
    time.textContent = timeText;
    meta.append(divider, time);
  }

  const shell = document.createElement("div");
  shell.className = isUser
    ? "rounded-2xl bg-zinc-900/90 px-4 py-3 ring-1 ring-white/10"
    : isSystem
      ? "rounded-xl bg-zinc-900/65 px-3 py-2.5 ring-1 ring-white/10"
      : "px-1";

  shell.append(createMarkdownBody(message.content));
  article.append(meta, shell);
  return article;
}

function renderCollapsibleMessage(message, { compact = false } = {}) {
  const article = document.createElement("article");
  article.className = compact
    ? "rounded-xl bg-zinc-900/30 ring-1 ring-white/5"
    : "w-full max-w-[min(100%,48rem)] rounded-xl bg-zinc-900/30 ring-1 ring-white/5";

  const details = document.createElement("details");
  details.className = "group";
  bindPanelState(details, message.id, ui.expandedPanels);

  details.append(
    createSummary({
      iconName: messageIcon(message),
      titleText: messageLabel(message),
      badgeText: kindLabel(message),
      timeText: timeLabel(message.createdAt),
      compact,
    }),
  );

  const body = document.createElement("div");
  body.className = compact
    ? "border-t border-white/10 px-2.5 py-2.5"
    : "border-t border-white/10 px-3 py-3";
  body.append(createMarkdownBody(message.content, compact));

  details.append(body);
  article.append(details);
  return article;
}

function renderToolGroup(messages) {
  const groupId = messages[0].groupId || messages[0].id;
  const call = messages.find((message) => message.kind === "tool-call") || messages[0];
  const result = messages.find((message) => message.kind === "tool-result");

  const wrapper = document.createElement("section");
  wrapper.className = "w-full max-w-[min(100%,48rem)] rounded-xl bg-zinc-900/30 ring-1 ring-white/5";

  const details = document.createElement("details");
  details.className = "group";
  bindPanelState(details, groupId, ui.expandedToolGroups);

  details.append(
    createSummary({
      iconName: "wrench",
      titleText: call.title || "Tool activity",
      badgeText: result ? "completed" : "running",
      timeText: timeLabel(call.createdAt),
      metaText: `${messages.length} item${messages.length > 1 ? "s" : ""}`,
    }),
  );

  const body = document.createElement("div");
  body.className = "space-y-2 border-t border-white/10 px-3 py-3";
  for (const message of messages) {
    body.append(renderCollapsibleMessage(message, { compact: true }));
  }

  details.append(body);
  wrapper.append(details);
  return wrapper;
}

function createRenderItems() {
  const items = [];

  for (let index = 0; index < state.messages.length; index += 1) {
    const message = state.messages[index];

    if (message.groupId && (message.kind === "tool-call" || message.kind === "tool-result")) {
      const grouped = [message];
      let cursor = index + 1;

      while (cursor < state.messages.length) {
        const next = state.messages[cursor];
        if (next.groupId !== message.groupId) break;
        grouped.push(next);
        cursor += 1;
      }

      items.push({ type: "tool-group", messages: grouped });
      index = cursor - 1;
      continue;
    }

    items.push({ type: isCollapsibleMessage(message) ? "collapsible" : "message", message });
  }

  return items;
}

function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons({ attrs: { "stroke-width": 1.75 } });
  }
}

function syncControls() {
  const hasText = elements.input.value.trim().length > 0;
  const hasCwd = elements.cwdInput.value.trim().length > 0;
  const hasModel = elements.modelInput.value.trim().length > 0;
  const modelChanged = !sameModelSettings(readModelSettingsForm(), state.modelSettings);

  elements.sendButton.disabled = state.processing || !hasText;
  elements.resetButton.disabled = state.processing;
  elements.modelButton.disabled = state.processing || !hasModel || !modelChanged;
  elements.cwdButton.disabled = state.processing || !hasCwd;
}

function render() {
  elements.threadId.textContent = state.threadId || "-";
  elements.statusText.textContent = state.processing ? "Streaming" : "Idle";

  elements.statusDot.classList.remove("bg-zinc-400", "bg-amber-300", "animate-pulse");
  elements.statusDot.classList.add(state.processing ? "bg-amber-300" : "bg-zinc-400");
  if (state.processing) elements.statusDot.classList.add("animate-pulse");

  if (!isEditingModelSettings()) {
    elements.modelInput.value = state.modelSettings.model || "";
    syncCustomSelectValue(
      "reasoningEffortSelect",
      state.modelSettings.reasoningEffort || DEFAULT_MODEL_SETTINGS.reasoningEffort,
    );
    syncCustomSelectValue(
      "verbositySelect",
      state.modelSettings.verbosity || DEFAULT_MODEL_SETTINGS.verbosity,
    );
  }

  if (document.activeElement !== elements.cwdInput) {
    elements.cwdInput.value = state.cwd || "";
  }

  const scrollBottomGap =
    elements.messages.scrollHeight - elements.messages.scrollTop - elements.messages.clientHeight;
  const shouldStickToBottom = scrollBottomGap < 80;

  elements.messageList.innerHTML = "";

  for (const item of createRenderItems()) {
    if (item.type === "tool-group") {
      elements.messageList.append(renderToolGroup(item.messages));
    } else if (item.type === "collapsible") {
      elements.messageList.append(renderCollapsibleMessage(item.message));
    } else {
      elements.messageList.append(renderStandardMessage(item.message));
    }
  }

  const hasMessages = state.messages.length > 0;
  elements.emptyState.classList.toggle("hidden", hasMessages);

  if (shouldStickToBottom) {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  syncControls();
  refreshIcons();
}

async function loadSnapshot() {
  const response = await fetch("/api/conversation", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load conversation.");
  applySnapshot(await response.json());
  render();
}

async function updateCWD(cwd) {
  const response = await fetch("/api/cwd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Failed to update CWD.");
  }

  if (body.snapshot) {
    applySnapshot(body.snapshot);
    render();
    elements.cwdInput.value = state.cwd;
  }
}

async function updateModelSettings(modelSettings) {
  const response = await fetch("/api/model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(modelSettings),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Failed to update model settings.");
  }

  if (body.snapshot) {
    applySnapshot(body.snapshot);
    render();
  }
}

async function resetConversation() {
  const response = await fetch("/api/reset", { method: "POST" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Failed to reset conversation.");

  if (body.snapshot) {
    applySnapshot(body.snapshot);
    render();
  }
}

async function sendMessage(text) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, cwd: elements.cwdInput.value || state.cwd }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Failed to send message.");
  }

  if (body.snapshot) {
    applySnapshot(body.snapshot);
    render();
  }
}

function connectEvents() {
  const source = new EventSource("/api/events");

  source.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    if (ui.connectionLost) {
      ui.connectionLost = false;
      showToast("Live updates restored.", { type: "success", title: "Reconnected", duration: 2200 });
    }

    switch (payload.type) {
      case "snapshot":
      case "conversation-reset":
        applySnapshot(payload.data);
        break;
      case "message-added":
      case "message-updated":
        upsertMessage(payload.data);
        break;
      case "processing":
        state.processing = payload.data.processing;
        break;
    }

    render();
  };

  source.onerror = async () => {
    source.close();

    if (!ui.connectionLost) {
      ui.connectionLost = true;
      showToast("Connection lost. Reconnecting…", { type: "warning", title: "Offline" });
    }

    try {
      await loadSnapshot();
    } catch {}

    setTimeout(connectEvents, 1000);
  };
}

initializeCustomSelect(elements.reasoningEffortSelectRoot);
initializeCustomSelect(elements.verbositySelectRoot);

document.addEventListener("pointerdown", (event) => {
  if (!activeCustomSelect) return;
  if (!(event.target instanceof Node)) return;
  if (activeCustomSelect.root.contains(event.target)) return;

  closeCustomSelect(activeCustomSelect);
});

document.addEventListener("focusin", (event) => {
  if (!activeCustomSelect) return;
  if (!(event.target instanceof Node)) return;
  if (activeCustomSelect.root.contains(event.target)) return;

  closeCustomSelect(activeCustomSelect);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeCustomSelect) {
    closeCustomSelect(activeCustomSelect, { restoreFocus: true });
  }
});

window.addEventListener("resize", () => {
  updateCustomSelectPlacement(activeCustomSelect);
});

window.addEventListener(
  "scroll",
  () => {
    updateCustomSelectPlacement(activeCustomSelect);
  },
  true,
);

elements.modelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const modelSettings = readModelSettingsForm();
  if (!elements.modelInput.value.trim()) return;

  elements.modelButton.disabled = true;

  try {
    await updateModelSettings(modelSettings);
    showToast("Model settings updated.", { type: "success", title: "Ready", duration: 2200 });
  } catch (error) {
    showErrorToast(error, "Model update failed");
  } finally {
    syncControls();
  }
});

elements.cwdForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const cwd = elements.cwdInput.value.trim();
  if (!cwd) return;

  elements.cwdButton.disabled = true;

  try {
    await updateCWD(cwd);
    showToast("Workspace updated.", { type: "success", title: "Ready", duration: 2200 });
  } catch (error) {
    showErrorToast(error, "Workspace update failed");
  } finally {
    syncControls();
  }
});

elements.resetButton.addEventListener("click", async () => {
  elements.resetButton.disabled = true;

  try {
    await resetConversation();
    showToast("Conversation reset.", { type: "success", title: "Done", duration: 2200 });
  } catch (error) {
    showErrorToast(error, "Reset failed");
  } finally {
    syncControls();
  }
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (state.processing) {
    syncControls();
    return;
  }

  const text = elements.input.value.trim();
  if (!text) return;

  elements.sendButton.disabled = true;

  try {
    await sendMessage(text);
    elements.input.value = "";
    autoResizeInput();
  } catch (error) {
    showErrorToast(error, "Message failed");
  } finally {
    syncControls();
    elements.input.focus();
  }
});

elements.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (state.processing) return;
    elements.form.requestSubmit();
  }
});

elements.input.addEventListener("input", () => {
  autoResizeInput();
  syncControls();
});

elements.modelInput.addEventListener("input", syncControls);

elements.reasoningEffortSelect.addEventListener("change", syncControls);

elements.verbositySelect.addEventListener("change", syncControls);

elements.cwdInput.addEventListener("input", syncControls);

loadSnapshot()
  .then(() => {
    autoResizeInput();
    refreshIcons();
    connectEvents();
    syncControls();
  })
  .catch((error) => {
    showErrorToast(error, "Unable to load conversation");
    autoResizeInput();
    refreshIcons();
    syncControls();
  });
