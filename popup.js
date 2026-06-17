// popup.js
// Wires together: content.js (scrape) → Claude API (analyze) → sf-strategy.js (create case)

const CLAUDE_MODEL = "claude-sonnet-4-6";

// ── STATE ──────────────────────────────────────────────────────
let allMessages = [];
let filteredMessages = [];
let contactName = "";
let contactPhone = "";
let aiResult = null;

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const { sfUrl, claudeApiKey } = await chrome.storage.local.get(["sfUrl", "claudeApiKey"]);

  if (!sfUrl || !claudeApiKey) {
    showScreen("setup");
    return;
  }

  showScreen("main");
  await loadConversation();
  setupDateListeners();
});

// ── SETUP SCREEN ───────────────────────────────────────────────
document.getElementById("save-setup-btn").addEventListener("click", async () => {
  const sfUrl = document.getElementById("sf-url-input").value.trim();
  const claudeApiKey = document.getElementById("api-key-input").value.trim();

  if (!sfUrl || !claudeApiKey) {
    alert("Please fill in both fields.");
    return;
  }

  await chrome.storage.local.set({ sfUrl, claudeApiKey });
  showScreen("main");
  await loadConversation();
  setupDateListeners();
});

// ── LOAD CONVERSATION FROM WHATSAPP ───────────────────────────
async function loadConversation() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes("web.whatsapp.com")) {
    setStatus("Please open a WhatsApp conversation first.", "error");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "getConversation" }, (response) => {
    if (!response) {
      setStatus("Could not read WhatsApp. Try refreshing the page.", "error");
      return;
    }

    allMessages = response.messages || [];
    contactName = response.contactName || "Unknown";
    contactPhone = response.phoneNumber || "";

    // Update header
    document.getElementById("contact-name").textContent = contactName;
    document.getElementById("contact-phone").textContent = contactPhone;
    document.getElementById("contact-avatar").textContent = getInitials(contactName);

    // Set default date range to today
    const today = toDateInputValue(new Date());
    document.getElementById("date-from").value = today;
    document.getElementById("date-to").value = today;

    // Trigger initial filter
    applyDateFilter();
  });
}

// ── DATE FILTER ────────────────────────────────────────────────
function setupDateListeners() {
  document.getElementById("date-from").addEventListener("change", applyDateFilter);
  document.getElementById("date-to").addEventListener("change", applyDateFilter);
}

function applyDateFilter() {
  const fromVal = document.getElementById("date-from").value;
  const toVal = document.getElementById("date-to").value;

  if (!fromVal || !toVal) return;

  const from = new Date(fromVal);
  const to = new Date(toVal);
  to.setHours(23, 59, 59); // include full end day

  filteredMessages = allMessages.filter((m) => {
    if (!m.date) return false;
    const msgDate = new Date(m.date);
    return msgDate >= from && msgDate <= to;
  });

  document.getElementById("msg-count").textContent = filteredMessages.length;
  renderPreview();

  if (filteredMessages.length > 0) {
    runAIAnalysis();
  } else {
    resetAI();
  }
}

// ── CONVERSATION PREVIEW ───────────────────────────────────────
function renderPreview() {
  const container = document.getElementById("preview-body");

  if (filteredMessages.length === 0) {
    container.innerHTML = `<span class="preview-empty">No messages in this date range</span>`;
    return;
  }

  container.innerHTML = filteredMessages.map((m) => {
    const cls = m.sender === "Agent" ? "msg-agent" : "msg-customer";
    const time = m.time ? `[${m.time}] ` : "";
    return `<div class="${cls}">${time}<strong>${m.sender}:</strong> ${escapeHtml(m.text)}</div>`;
  }).join("");
}

// ── AI ANALYSIS ────────────────────────────────────────────────
async function runAIAnalysis() {
  showAIState("loading");

  const { claudeApiKey } = await chrome.storage.local.get("claudeApiKey");

  const transcript = filteredMessages
    .map((m) => `[${m.time || ""}] ${m.sender}: ${m.text}`)
    .join("\n");

  const prompt = `You are a CX assistant. Analyze this WhatsApp support conversation and return ONLY a JSON object with no extra text.

Conversation:
${transcript}

Return this exact JSON structure:
{
  "subject": "short case subject line (max 80 chars)",
  "category": "one of: Login / Access, Billing, Technical Issue, Account Update, Onboarding, Scam / Fraud, General Enquiry",
  "priority": "High, Medium, or Low",
  "sentiment": "positive, neutral, or negative",
  "language": "detected language name e.g. English, Bahasa Malaysia",
  "issue": "1-2 sentences describing the customer's problem",
  "action_taken": "1-2 sentences describing what the agent did",
  "outcome": "1-2 sentences describing how it was resolved or current status",
  "next_action": "suggested next step for the agent",
  "escalation_needed": true or false,
  "escalation_reason": "why escalation is needed, or empty string if not needed"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const raw = data.content[0].text.trim();

    // Strip markdown code fences if present
    const clean = raw.replace(/```json|```/g, "").trim();
    aiResult = JSON.parse(clean);

    renderAIResult(aiResult);
    populateCaseFields(aiResult);
    document.getElementById("create-btn").disabled = false;

  } catch (err) {
    console.error("AI analysis failed:", err);
    showAIState("idle");
    setStatus("AI analysis failed. You can still fill in the fields manually.", "error");
    document.getElementById("create-btn").disabled = false;
  }
}

function renderAIResult(ai) {
  // Sentiment badge
  const badge = document.getElementById("sentiment-badge");
  badge.textContent = `${sentimentEmoji(ai.sentiment)} ${capitalize(ai.sentiment)}`;
  badge.className = `sentiment-badge sentiment-${ai.sentiment}`;

  // Language
  document.getElementById("lang-badge").textContent = ai.language ? `🌐 ${ai.language}` : "";

  // Escalation flag
  const flagEl = document.getElementById("escalation-flag");
  if (ai.escalation_needed) {
    document.getElementById("escalation-reason").textContent = ai.escalation_reason;
    flagEl.classList.remove("hidden");
  } else {
    flagEl.classList.add("hidden");
  }

  // Issue / Action / Outcome
  document.getElementById("ai-issue").textContent = ai.issue || "—";
  document.getElementById("ai-action").textContent = ai.action_taken || "—";
  document.getElementById("ai-outcome").textContent = ai.outcome || "—";

  // Next action
  document.getElementById("ai-next-action").textContent = ai.next_action || "—";

  showAIState("result");
}

function populateCaseFields(ai) {
  document.getElementById("case-subject").value = ai.subject || "";
  document.getElementById("case-priority").value = ai.priority || "Medium";

  // Match category to dropdown
  const categorySelect = document.getElementById("case-category");
  const options = Array.from(categorySelect.options).map(o => o.value);
  if (options.includes(ai.category)) {
    categorySelect.value = ai.category;
  }

  // Build structured description
  const description = [
    `ISSUE\n${ai.issue}`,
    `ACTION TAKEN\n${ai.action_taken}`,
    `OUTCOME\n${ai.outcome}`,
    `---`,
    `WhatsApp conversation: ${document.getElementById("date-from").value} → ${document.getElementById("date-to").value}`,
    `Contact: ${contactName}${contactPhone ? ` (${contactPhone})` : ""}`
  ].join("\n\n");

  document.getElementById("case-description").value = description;
}

// ── CREATE CASE ────────────────────────────────────────────────
document.getElementById("create-btn").addEventListener("click", async () => {
  const { sfUrl } = await chrome.storage.local.get("sfUrl");

  const caseData = {
    subject: document.getElementById("case-subject").value,
    priority: document.getElementById("case-priority").value,
    category: document.getElementById("case-category").value,
    description: document.getElementById("case-description").value,
    contactName,
    contactPhone,
    sfUrl
  };

  // Send to background.js which opens Salesforce
  chrome.runtime.sendMessage({ action: "createCase", caseData }, (response) => {
    if (response?.success) {
      setStatus("✅ Case opened in Salesforce — review and save!", "success");
    } else {
      setStatus("Something went wrong. Try again.", "error");
    }
  });
});

// ── HELPERS ────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("setup-screen").classList.toggle("hidden", name !== "setup");
  document.getElementById("main-screen").classList.toggle("hidden", name !== "main");
}

function showAIState(state) {
  document.getElementById("ai-idle").classList.toggle("hidden", state !== "idle");
  document.getElementById("ai-loading").classList.toggle("hidden", state !== "loading");
  document.getElementById("ai-result").classList.toggle("hidden", state !== "result");
}

function resetAI() {
  showAIState("idle");
  aiResult = null;
  document.getElementById("create-btn").disabled = true;
}

function setStatus(msg, type) {
  const el = document.getElementById("status-msg");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
}

function getInitials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function toDateInputValue(date) {
  return date.toISOString().split("T")[0];
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sentimentEmoji(s) {
  return { positive: "😊", neutral: "😐", negative: "😟" }[s] || "😐";
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}