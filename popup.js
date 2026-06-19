// popup.js — v2
// Flow: content.js (scrape) → Groq API → validator → display insights → Salesforce

const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── STATE ──────────────────────────────────────────────────────
let allMessages = [];
let filteredMessages = [];
let contactName = "";
let contactPhone = "";
let aiResult = null; // validated result

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const { sfUrl, geminiApiKey } = await chrome.storage.local.get(["sfUrl", "geminiApiKey"]);
  if (!sfUrl || !geminiApiKey) { showScreen("setup"); return; }
  showScreen("main");
  await loadConversation();
  setupListeners();
});

// ── SETUP SCREEN ───────────────────────────────────────────────
document.getElementById("save-setup-btn").addEventListener("click", async () => {
  const sfUrl = document.getElementById("sf-url-input").value.trim();
  const geminiApiKey = document.getElementById("api-key-input").value.trim();
  if (!sfUrl || !geminiApiKey) { alert("Please fill in both fields."); return; }
  await chrome.storage.local.set({ sfUrl, geminiApiKey });
  showScreen("main");
  await loadConversation();
  setupListeners();
});

// ── LOAD CONVERSATION ──────────────────────────────────────────
async function loadConversation() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url.includes("web.whatsapp.com")) {
    setStatus("Please open a WhatsApp conversation first.", "error");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: "getConversation" }, (response) => {
    if (!response) {
      setStatus("Could not read WhatsApp. Refresh the page.", "error");
      return;
    }
    allMessages = response.messages || [];
    contactName = response.contactName || "Unknown";
    contactPhone = response.phoneNumber || "";

    document.getElementById("contact-name").textContent = contactName;
    document.getElementById("contact-phone").textContent = contactPhone || "";
    document.getElementById("contact-avatar").textContent = getInitials(contactName);

    // Fill phone field if detected, else prompt the agent
    const phoneInput = document.getElementById("case-phone");
    const phoneLabel = document.getElementById("phone-label");
    if (contactPhone) {
      phoneInput.value = contactPhone;
      phoneLabel.textContent = "Phone number ✓ (auto-detected)";
      phoneLabel.style.color = "#2e7d32";
    } else {
      phoneInput.value = "";
      phoneLabel.textContent = "Phone number ⚠️ (please enter)";
      phoneLabel.style.color = "#e65100";
    }
    updateCreateButtonState();

    const today = toDateInputValue(new Date());
    document.getElementById("date-from").value = today;
    document.getElementById("date-to").value = today;
    applyDateFilter();
  });
}

// ── LISTENERS ──────────────────────────────────────────────────
function setupListeners() {
  document.getElementById("date-from").addEventListener("change", applyDateFilter);
  document.getElementById("date-to").addEventListener("change", applyDateFilter);

  document.getElementById("analyze-btn").addEventListener("click", () => {
    if (filteredMessages.length === 0) {
      setStatus("Pick a date range with messages first.", "error");
      return;
    }
    runAIAnalysis();
  });

  document.getElementById("more-toggle").addEventListener("click", () => {
    const more = document.getElementById("more-details");
    const btn = document.getElementById("more-toggle");
    more.classList.toggle("hidden");
    btn.textContent = more.classList.contains("hidden") ? "Show more ▾" : "Show less ▴";
  });

  // Enable/disable Create button as phone is typed
  document.getElementById("case-phone").addEventListener("input", updateCreateButtonState);
}

// ── DATE FILTER ────────────────────────────────────────────────
function applyDateFilter() {
  const fromVal = document.getElementById("date-from").value;
  const toVal = document.getElementById("date-to").value;
  if (!fromVal || !toVal) return;

  const from = new Date(fromVal);
  const to = new Date(toVal);
  to.setHours(23, 59, 59);

  filteredMessages = allMessages.filter((m) => {
    if (!m.date) return false;
    const msgDate = new Date(m.date);
    const msgStr = msgDate.toISOString().split("T")[0];
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];
    return msgStr >= fromStr && msgStr <= toStr;
  });

  document.getElementById("msg-count").textContent = filteredMessages.length;
  renderPreview();
  resetAI();
}

// ── PREVIEW ────────────────────────────────────────────────────
function renderPreview() {
  const c = document.getElementById("preview-body");
  if (filteredMessages.length === 0) {
    c.innerHTML = `<span class="preview-empty">No messages in this date range</span>`;
    return;
  }
  c.innerHTML = filteredMessages.map((m) => {
    const cls = m.sender === "Agent" ? "msg-agent" : "msg-customer";
    const time = m.time ? `[${m.time}] ` : "";
    return `<div class="${cls}">${time}<strong>${m.sender}:</strong> ${escapeHtml(m.text)}</div>`;
  }).join("");
}

// ── AI ANALYSIS ────────────────────────────────────────────────
async function runAIAnalysis() {
  showAIState("loading");
  const { geminiApiKey } = await chrome.storage.local.get("geminiApiKey");

  const transcript = filteredMessages
    .map((m) => `[${m.time || ""}] ${m.sender}: ${m.text}`)
    .join("\n");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${geminiApiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        messages: [{ role: "user", content: buildPrompt(transcript) }],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) {
      setStatus(`AI error: ${data.error.message}`, "error");
      showAIState("idle");
      return;
    }

    // Parse → validate (THE KEY STEP)
    const raw = JSON.parse(data.choices[0].message.content);
    aiResult = validateAIResult(raw);

    console.log("Validation issues:", aiResult._validationIssues);

    renderInsights(aiResult);
    populateCaseFields(aiResult);
    updateCreateButtonState();

  } catch (err) {
    console.error("AI analysis failed:", err);
    showAIState("idle");
    setStatus("AI analysis failed. Fill fields manually if needed.", "error");
  }
}

// ── RENDER INSIGHTS ────────────────────────────────────────────
function renderInsights(r) {
  // Review banner
  document.getElementById("review-banner").classList.toggle("hidden", !r.needsReview);

  // Key insights
  setInsight("r-category", r.case_management.category);
  setInsight("r-subcategory", r.case_management.sub_category);

  // Mood trend with arrow
  const moodArrow = { Improving: "📈", Worsening: "📉", Stable: "➡️" }[r.mood.mood_trend.value] || "";
  document.getElementById("r-mood").innerHTML =
    `${r.mood.mood_start} → ${r.mood.mood_end} ${moodArrow} ${confBadge(r.mood.mood_trend.confidence)}`;

  setInsight("r-resolution", r.resolution.status);

  // Escalation (boolean)
  const esc = r.follow_up.escalation_required;
  document.getElementById("r-escalation").innerHTML =
    `${esc.value ? "🚨 Yes" : "No"} ${confBadge(esc.confidence)}`;

  // More details
  setInsight("r-owner", r.follow_up.action_owner);
  document.getElementById("r-pending").textContent = r.follow_up.pending_information;
  setInsight("r-priority", r.priority);

  // Tags
  document.getElementById("r-tags").innerHTML = r.customer_insights.tags.length
    ? r.customer_insights.tags.map(t => `<span class="tag">${t.value}</span>`).join("")
    : "<span style='color:#aaa;font-size:11px;'>None detected</span>";

  showAIState("result");
}

// Helper: render value + confidence badge
function setInsight(elId, insight) {
  const val = insight.value !== null ? insight.value : "—";
  document.getElementById(elId).innerHTML = `${val} ${confBadge(insight.confidence)}`;
}

// Helper: confidence badge HTML
function confBadge(conf) {
  if (conf == null) return "";
  const pct = Math.round(conf * 100);
  let cls = "conf-low";
  if (conf >= 0.85) cls = "conf-high";
  else if (conf >= 0.7) cls = "conf-mid";
  return `<span class="conf-badge ${cls}">${pct}%</span>`;
}

// ── POPULATE CASE FIELDS ───────────────────────────────────────
function populateCaseFields(r) {
  document.getElementById("case-subject").value = r.summary.subject || "";

  // Build the structured transcript
  const transcript = filteredMessages
    .map((m) => `[${m.time || ""}] ${m.sender}: ${m.text}`)
    .join("\n");

  const desc = [
    `═══════════════════════`,
    `SUMMARY`,
    `═══════════════════════`,
    `ISSUE\n${r.summary.issue}`,
    `ACTION TAKEN\n${r.summary.action_taken}`,
    `OUTCOME\n${r.summary.outcome}`,
    ``,
    `───────────────────────`,
    `CASE DETAILS`,
    `───────────────────────`,
    `Category: ${r.case_management.category.value} → ${r.case_management.sub_category.value}`,
    `Resolution: ${r.resolution.status.value}`,
    `Action Owner: ${r.follow_up.action_owner.value}`,
    `Escalation: ${r.follow_up.escalation_required.value ? "Yes" : "No"}`,
    `Pending Info: ${r.follow_up.pending_information}`,
    `Mood: ${r.mood.mood_start} → ${r.mood.mood_end} (${r.mood.mood_trend.value})`,
    ``,
    `───────────────────────`,
    `CONTACT`,
    `───────────────────────`,
    `Name: ${contactName}${contactPhone ? `\nPhone: ${contactPhone}` : ""}`,
    `Date range: ${document.getElementById("date-from").value} → ${document.getElementById("date-to").value}`,
    ``,
    `═══════════════════════`,
    `FULL TRANSCRIPT`,
    `═══════════════════════`,
    transcript
  ].join("\n");

  document.getElementById("case-description").value = desc;
}

// ── CREATE CASE ────────────────────────────────────────────────
document.getElementById("create-btn").addEventListener("click", async () => {
  const phone = document.getElementById("case-phone").value.trim();

  if (!phone) {
    setStatus("⚠️ Please enter the customer's phone number first.", "error");
    document.getElementById("case-phone").focus();
    return;
  }

  const { sfUrl } = await chrome.storage.local.get("sfUrl");

  // Inject the latest phone into the description
  const finalDescription = document.getElementById("case-description").value
    .replace(/Phone:.*$/m, `Phone: ${phone}`);

  const caseData = {
    subject: document.getElementById("case-subject").value,
    priority: aiResult?.priority?.value || "Medium",
    category: aiResult?.case_management?.category?.value || "",
    description: finalDescription,
    contactName,
    contactPhone: phone,
    sfUrl
  };

  chrome.runtime.sendMessage({ action: "createCase", caseData }, (response) => {
    if (response?.success) {
      setStatus("✅ Case ready — switch to Salesforce when you're done here.", "success");
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

function updateCreateButtonState() {
  const phone = document.getElementById("case-phone").value.trim();
  const hasAnalysis = aiResult !== null;
  document.getElementById("create-btn").disabled = !(phone && hasAnalysis);
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