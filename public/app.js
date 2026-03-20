const state = {
  threadId: "",
  cwd: "",
  processing: false,
  messages: [],
};

const ui = {
  collapsedThinking: new Set(),
  collapsedToolGroups: new Set(),
};

const elements = {
  threadId: document.getElementById("threadId"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  messages: document.getElementById("messages"),
  emptyState: document.getElementById("emptyState"),
  form: document.getElementById("composerForm"),
  input: document.getElementById("input"),
  sendButton: document.getElementById("sendButton"),
  cwdForm: document.getElementById("cwdForm"),
  cwdInput: document.getElementById("cwdInput"),
  cwdButton: document.getElementById("cwdButton"),
  error: document.getElementById("error"),
};

function applySnapshot(snapshot) {
  state.threadId = snapshot.threadId;
  state.cwd = snapshot.cwd;
  state.processing = snapshot.processing;
  state.messages = snapshot.messages;
}

function upsertMessage(message) {
  const index = state.messages.findIndex((item) => item.id === message.id);
  if (index === -1) state.messages.push(message);
  else state.messages[index] = message;
}

function kindLabel(message) {
  switch (message.kind) {
    case "thinking": return "thinking";
    case "tool-call": return "tool call";
    case "tool-result": return "tool result";
    default: return message.role;
  }
}

function messageClass(message) {
  if (message.kind === "thinking") return "message-thinking";
  if (message.kind === "tool-call") return "message-tool-call";
  if (message.kind === "tool-result") return "message-tool-result";
  return `message-${message.role}`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInline(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

function renderRichContent(content) {
  const blockPattern = /```([\w-]+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let html = "";
  let match;

  while ((match = blockPattern.exec(content)) !== null) {
    const [full, language = "", code = ""] = match;
    const before = content.slice(lastIndex, match.index);
    html += renderParagraphs(before);
    const lang = language ? `<div class="badge">${escapeHtml(language)}</div>` : "";
    html += `${lang}<pre><code>${escapeHtml(code)}</code></pre>`;
    lastIndex = match.index + full.length;
  }

  html += renderParagraphs(content.slice(lastIndex));
  return html || "<p></p>";
}

function renderParagraphs(text) {
  const trimmed = text.replace(/^\n+|\n+$/g, "");
  if (!trimmed) return "";
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${formatInline(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderSingleMessage(message) {
  const article = document.createElement("article");
  article.className = `message ${messageClass(message)}`;
  article.dataset.id = message.id;

  const header = document.createElement("div");
  header.className = "message-header";

  const title = document.createElement("div");
  title.className = "message-title";
  const titleText = document.createElement("span");
  titleText.textContent = message.title || message.role;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = kindLabel(message);
  title.append(titleText, badge);

  const time = document.createElement("span");
  time.textContent = new Date(message.createdAt).toLocaleTimeString();
  header.append(title, time);
  article.append(header);

  if (message.kind === "thinking") {
    const details = document.createElement("details");
    details.open = !ui.collapsedThinking.has(message.id);
    details.addEventListener("toggle", () => {
      if (details.open) ui.collapsedThinking.delete(message.id);
      else ui.collapsedThinking.add(message.id);
    });

    const summary = document.createElement("summary");
    summary.className = "hint";
    summary.textContent = details.open ? "Hide thinking" : "Show thinking";
    details.append(summary);

    const body = document.createElement("div");
    body.className = "content";
    body.innerHTML = renderRichContent(message.content);
    details.append(body);
    article.append(details);
    return article;
  }

  const body = document.createElement("div");
  body.className = "content";
  body.innerHTML = renderRichContent(message.content);
  article.append(body);
  return article;
}

function renderToolGroup(messages) {
  const groupId = messages[0].groupId || messages[0].id;
  const call = messages.find((message) => message.kind === "tool-call") || messages[0];
  const result = messages.find((message) => message.kind === "tool-result");

  const wrapper = document.createElement("section");
  wrapper.className = "tool-group";

  const details = document.createElement("details");
  details.open = !ui.collapsedToolGroups.has(groupId);
  details.addEventListener("toggle", () => {
    if (details.open) ui.collapsedToolGroups.delete(groupId);
    else ui.collapsedToolGroups.add(groupId);
  });

  const summary = document.createElement("summary");
  summary.className = "tool-summary";

  const left = document.createElement("div");
  left.className = "tool-summary-title";
  const title = document.createElement("span");
  title.textContent = call.title || "Tool";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = result ? "completed" : "running";
  left.append(title, badge);

  const right = document.createElement("div");
  right.className = "tool-summary-meta";
  const count = document.createElement("span");
  count.textContent = `${messages.length} item${messages.length > 1 ? "s" : ""}`;
  const time = document.createElement("span");
  time.textContent = new Date(call.createdAt).toLocaleTimeString();
  right.append(count, time);

  summary.append(left, right);
  details.append(summary);

  const body = document.createElement("div");
  body.className = "tool-group-body";
  for (const message of messages) {
    body.append(renderSingleMessage(message));
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

    items.push({ type: "message", message });
  }

  return items;
}

function render() {
  elements.threadId.textContent = `Thread: ${state.threadId || "-"}`;
  elements.statusText.textContent = state.processing ? "Streaming" : "Idle";
  elements.statusDot.classList.toggle("busy", state.processing);
  elements.emptyState.style.display = state.messages.length ? "none" : "block";

  if (document.activeElement !== elements.cwdInput) {
    elements.cwdInput.value = state.cwd || "";
  }

  const scrollBottomGap = elements.messages.scrollHeight - elements.messages.scrollTop - elements.messages.clientHeight;
  const shouldStickToBottom = scrollBottomGap < 80;

  elements.messages.querySelectorAll(".message, .tool-group").forEach((node) => node.remove());

  for (const item of createRenderItems()) {
    if (item.type === "tool-group") {
      elements.messages.append(renderToolGroup(item.messages));
    } else {
      elements.messages.append(renderSingleMessage(item.message));
    }
  }

  if (shouldStickToBottom) {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }
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
  if (text.trim() === "/reset") {
    await resetConversation();
    return;
  }

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
    try {
      await loadSnapshot();
    } catch {}
    setTimeout(connectEvents, 1000);
  };
}

elements.cwdForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const cwd = elements.cwdInput.value.trim();
  if (!cwd) return;

  elements.error.textContent = "";
  elements.cwdButton.disabled = true;

  try {
    await updateCWD(cwd);
  } catch (error) {
    elements.error.textContent = error.message || String(error);
  } finally {
    elements.cwdButton.disabled = false;
  }
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = elements.input.value.trim();
  if (!text) return;

  elements.error.textContent = "";
  elements.sendButton.disabled = true;

  try {
    await sendMessage(text);
    elements.input.value = "";
  } catch (error) {
    elements.error.textContent = error.message || String(error);
  } finally {
    elements.sendButton.disabled = false;
    elements.input.focus();
  }
});

loadSnapshot().then(connectEvents).catch((error) => {
  elements.error.textContent = error.message || String(error);
});
