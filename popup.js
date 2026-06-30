// popup.js — v3
// Flow: SSO check → Verify → Main
// API key and SF URL come from config.js (baked in at build time)

// ── STATE ──────────────────────────────────────────────────────
let allMessages      = [];
let filteredMessages = [];
let contactName      = "";
let contactPhone     = "";
let aiResult         = null;

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const token = await getValidToken();
  if (!token) {
    showScreen("sso");
    return;
  }
  await loadConversation();
  setupListeners();
});

// ── SSO SCREEN ─────────────────────────────────────────────────
document.getElementById("sso-login-btn").addEventListener("click", async () => {
  const btn   = document.getElementById("sso-login-btn");
  const errEl = document.getElementById("sso-error");

  btn.disabled    = true;
  btn.textContent = "Signing in...";
  errEl.textContent = "";

  const result = await microsoftLogin();

  if (!result.success) {
    errEl.textContent = result.error || "Login failed. Please try again.";
    btn.disabled    = false;
    btn.textContent = "Sign in with Microsoft";
    return;
  }

  await loadConversation();
  setupListeners();
});

// ── LOGOUT ─────────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", async () => {
  await logout();
  showScreen("sso");
  document.getElementById("sso-login-btn").disabled    = false;
  document.getElementById("sso-login-btn").textContent = "Sign in with Microsoft";
  document.getElementById("sso-error").textContent     = "";
});

document.getElementById("v-name").addEventListener("input", updateContinueButtonState);
document.getElementById("v-phone").addEventListener("input", updateContinueButtonState);

document.getElementById("v-continue-btn").addEventListener("click", async () => {
  contactName = document.getElementById("v-name").value.trim();
  contactPhone = document.getElementById("v-phone").value.trim();

  await chrome.storage.local.set({
    [`verified:${contactName}`]: { name: contactName, phone: contactPhone, savedAt: Date.now() }
  });


  document.getElementById("contact-name").textContent = contactName;
  document.getElementById("contact-phone").textContent = contactPhone;
  document.getElementById("contact-avatar").textContent = getInitials(contactName);
  document.getElementById("case-phone").value = contactPhone;

  showScreen("main");

  const today = toDateInputValue(new Date());
  document.getElementById("date-from").value = today;
  document.getElementById("date-to").value = today;
  applyDateFilter();
});

function updateContinueButtonState() {
  const name = document.getElementById("v-name").value.trim();
  const phone = document.getElementById("v-phone").value.trim();
  document.getElementById("v-continue-btn").disabled = !(name && phone);
}


async function loadConversation() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.url?.includes("web.whatsapp.com")) {
    setStatus("Please open a WhatsApp conversation first.", "error");
    return;
  }

  function tryConnect(tabId, retries = 5, delay = 800) {
    chrome.tabs.sendMessage(tabId, { action: "getConversation" }, async (response) => {
      if (chrome.runtime.lastError || !response) {
        if (retries > 0) {
          setTimeout(() => tryConnect(tabId, retries - 1, delay), delay);
        } else {
          setStatus("Could not read WhatsApp. Refresh the page.", "error");
        }
        return;
      }

      allMessages = response.messages || [];
      contactName = response.contactName || "";
      contactPhone = response.phoneNumber || "";

      document.getElementById("v-avatar").textContent = getInitials(contactName || "?");

      const vName = document.getElementById("v-name");
      const vNameLabel = document.getElementById("v-name-label");
      if (contactName) {
        vName.value = contactName;
        vNameLabel.innerHTML = "Name ✓ (auto-detected)";
        vNameLabel.style.color = "#2e7d32";
      } else {
        vName.value = "";
        vNameLabel.innerHTML = "Name ⚠️ (please enter)";
        vNameLabel.style.color = "#e65100";
      }

      const vPhone = document.getElementById("v-phone");
      const vPhoneLabel = document.getElementById("v-phone-label");
      if (contactPhone) {
        vPhone.value = contactPhone;
        vPhoneLabel.innerHTML = "Phone number ✓ (auto-detected)";
        vPhoneLabel.style.color = "#2e7d32";
      } else {
        vPhone.value = "";
        vPhoneLabel.innerHTML = "Phone number ⚠️ (please enter)";
        vPhoneLabel.style.color = "#e65100";
      }

      const vData = await chrome.storage.local.get(`verified:${contactName}`);
      const vEntry = vData[`verified:${contactName}`];

      if (vEntry && (Date.now() - vEntry.savedAt) < CACHE_TTL_MS) {
        contactName = vEntry.name;
        contactPhone = vEntry.phone;
        document.getElementById("contact-name").textContent = contactName;
        document.getElementById("contact-phone").textContent = contactPhone;
        document.getElementById("contact-avatar").textContent = getInitials(contactName);
        document.getElementById("case-phone").value = contactPhone;
        showScreen("main");
        const today = toDateInputValue(new Date());
        const saved = await chrome.storage.local.get(["lastDateFrom", "lastDateTo"]);
        document.getElementById("date-from").value = saved.lastDateFrom || today;
        document.getElementById("date-to").value = saved.lastDateTo || today;
        applyDateFilter();
      } else {
        showScreen("verify");
        updateContinueButtonState();
      }
    });
  }

  tryConnect(tab.id);
}

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

  // Re-analyze button (forces fresh AI run)
  document.getElementById("reanalyze-btn").addEventListener("click", () => {
    runAIAnalysis();
  });
}

chrome.tabs.onActivated.addListener(() => {
  setTimeout(() => loadConversation(), 500);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.includes("web.whatsapp.com")) {
    loadConversation();
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "chatChanged") {
    setTimeout(() => loadConversation(), 500);
  }
});



function applyDateFilter() {
  const fromVal = document.getElementById("date-from").value;
  const toVal = document.getElementById("date-to").value;
  if (!fromVal || !toVal) return;

  chrome.storage.local.set({ lastDateFrom: fromVal, lastDateTo: toVal });

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


  if (filteredMessages.length > 0) {
    loadFromCache().then((cached) => {
      if (cached) {
        aiResult = cached;
        renderInsights(aiResult);
        populateCaseFields(aiResult);
        updateCreateButtonState();
        setStatus("Showing saved analysis (cached).", "success");
      }
    });
  }
}

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

async function runAIAnalysis() {
  const token = await getValidToken();
  if (!token) {
    showScreen("sso");
    return;
  }

  showAIState("loading");

  const transcript = filteredMessages
    .map((m) => `[${m.time || ""}] ${m.sender}: ${m.text}`)
    .join("\n");

  try {
    const response = await fetch(AI_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "Authorization":   `Bearer ${AI_CONFIG.apiKey}`,
        "X-PG-Auth-Token": token
      },
      body: JSON.stringify({
        model:           AI_CONFIG.model,
        temperature:     0.3,
        messages:        [{ role: "user", content: buildPrompt(transcript) }],
        response_format: { type: "json_object" }
      })
    });

    if (response.status === 401) {
      await logout();
      showScreen("sso");
      return;
    }

    const data = await response.json();
    if (data.error) {
      setStatus(`AI error: ${data.error.message}`, "error");
      showAIState("idle");
      return;
    }

    const raw = JSON.parse(data.choices[0].message.content);
    aiResult  = validateAIResult(raw);

    console.log("Validation issues:", aiResult._validationIssues);

    await saveToCache(aiResult);
    renderInsights(aiResult);
    populateCaseFields(aiResult);
    updateCreateButtonState();

  } catch (err) {
    console.error("AI analysis failed:", err);
    showAIState("idle");
    setStatus("AI analysis failed. Fill fields manually if needed.", "error");
  }
}


function renderInsights(r) {
  document.getElementById("review-banner").classList.toggle("hidden", !r.needsReview);

  // Summary
  document.getElementById("r-summary").textContent =
    `${r.summary.issue} ${r.summary.action_taken} ${r.summary.outcome}`;

  // Category
  renderBlock("block-category", "CATEGORY",
    `${r.case_management.category.value} → ${r.case_management.sub_category.value}`,
    r.case_management.category.reasoning,
    r.case_management.category.confidence);

  // Mood
  const trend = r.mood.mood_trend.value ? ` (${r.mood.mood_trend.value.toLowerCase()})` : "";
  renderBlock("block-mood", "MOOD TREND",
    `${r.mood.mood_start} → ${r.mood.mood_end}${trend}`,
    r.mood.mood_trend.reasoning,
    r.mood.mood_trend.confidence);

  // Escalation
  const esc = r.follow_up.escalation;
  const escalated = esc.value && esc.value !== "None";
  renderBlock("block-escalation", "ESCALATION",
    escalated ? `🚨 ${esc.value}` : "None",
    esc.reasoning,
    esc.confidence,
    escalated);

  // Resolution
  renderBlock("block-resolution", "RESOLUTION",
    r.resolution.status.value,
    r.resolution.status.reasoning,
    r.resolution.status.confidence);

  // More details
  renderBlock("block-owner", "ACTION OWNER",
    r.follow_up.action_owner.value,
    r.follow_up.action_owner.reasoning,
    r.follow_up.action_owner.confidence);

  renderBlock("block-priority", "PRIORITY",
    r.priority.value,
    r.priority.reasoning,
    r.priority.confidence);

  const steps = r.follow_up.next_steps;
  const stepsHtml = steps.length
    ? `<ol style="margin:4px 0 0 18px; padding:0; font-size:13px; line-height:1.6;">${
        steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")
      }</ol>`
    : "<div class='insight-value'>No further action needed</div>";
  document.getElementById("block-pending").innerHTML = `
    <div class="insight-head"><span class="insight-label">NEXT STEPS</span></div>
    ${stepsHtml}`;

  const tagsHtml = r.customer_insights.tags.length
    ? r.customer_insights.tags.map(t => `<span class="tag">${t.value}</span>`).join("")
    : "<span style='color:#aaa;font-size:11px;'>None detected</span>";
  document.getElementById("block-tags").innerHTML = `
    <div class="insight-head"><span class="insight-label">INSIGHT TAGS</span></div>
    <div style="margin-top:4px;">${tagsHtml}</div>`;

  showAIState("result");
}

function renderBlock(elId, label, value, reasoning, confidence, alert = false) {
  const valClass = alert ? "insight-value alert" : "insight-value";
  const reasoningHtml = reasoning
    ? `<div class="insight-reasoning">"${escapeHtml(reasoning)}"</div>`
    : "";
  document.getElementById(elId).innerHTML = `
    <div class="insight-head">
      <span class="insight-label">${label}</span>
      ${confBadge(confidence)}
    </div>
    <div class="${valClass}">${escapeHtml(value)}</div>
    ${reasoningHtml}`;
}

function confBadge(conf) {
  if (conf == null) return "";
  const pct = Math.round(conf * 100);
  let cls = "conf-low";
  if (conf >= 0.85) cls = "conf-high";
  else if (conf >= 0.7) cls = "conf-mid";
  return `<span class="conf-badge ${cls}">${pct}%</span>`;
}

function populateCaseFields(r) {
  // Build subject in WA(PG) format: WA(PG) - [SUMMARY CAPS] | [STATUS]
  document.getElementById("case-subject").value = buildSubject(r);
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
    `NEXT STEPS`,
    `───────────────────────`,
    r.follow_up.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    ``,
    `───────────────────────`,
    `CUSTOMER MOOD`,
    `───────────────────────`,
    r.mood.mood_trend.reasoning || "Mood scenario not available.",
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

// Build subject: WA(PG) - SUMMARY | STATUS
function buildSubject(r) {
  // Map SF status → subject ending word
  const statusMap = {
    "Closed": "COMPLETED",
    "Working": "PENDING",
    "On Hold": "PENDING",
    "Escalated": "ESCALATED",
    "New": "NEW",
    "Reopen": "REOPENED"
  };
  const status = r.resolution?.status?.value || "New";
  const ending = statusMap[status] || "NEW";

  // Use the AI subject as the summary, strip any existing WA(PG) prefix, uppercase it
  let summary = (r.summary?.subject || "Case").toUpperCase();
  summary = summary.replace(/^WA\(PG\)\s*-\s*/i, "").replace(/\s*\|.*$/, "").trim();

  return `WA(PG) - ${summary} | ${ending}`;
}

// ── CREATE CASE ────────────────────────────────────────────────
document.getElementById("create-btn").addEventListener("click", async () => {
  const phone = document.getElementById("case-phone").value.trim();

  if (!phone) {
    setStatus("⚠️ Please enter the customer's phone number first.", "error");
    document.getElementById("case-phone").focus();
    return;
  }

  const { sfUrl } = SF_URL;

  const finalDescription = document.getElementById("case-description").value
    .replace(/Phone:.*$/m, `Phone: ${phone}`);

  // Pass ALL structured fields to background for dropdown filling
  const caseData = {
    subject: document.getElementById("case-subject").value,
    priority: aiResult?.priority?.value || "Medium",
    status: aiResult?.resolution?.status?.value || "New",
    category: aiResult?.case_management?.category?.value || "",
    subCategory: aiResult?.case_management?.sub_category?.value || "",
    caseChannel: "Phone",
    internalExternal: "External",
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

function showScreen(name) {
  document.getElementById("sso-screen").classList.toggle("hidden",    name !== "sso");
  document.getElementById("verify-screen").classList.toggle("hidden", name !== "verify");
  document.getElementById("main-screen").classList.toggle("hidden",   name !== "main");
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
function escapeHtml(value) {
  const str = String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── CACHE (30 min expiry) ──────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Build a unique key for this conversation + date range
function getCacheKey() {
  const from = document.getElementById("date-from").value;
  const to = document.getElementById("date-to").value;
  return `cache:${contactName}:${from}:${to}`;
}

async function saveToCache(result) {
  const key = getCacheKey();
  const entry = { result, savedAt: Date.now() };
  await chrome.storage.local.set({ [key]: entry });
}

async function loadFromCache() {
  const key = getCacheKey();
  const data = await chrome.storage.local.get(key);
  const entry = data[key];
  if (!entry) return null;

  // Check expiry
  const age = Date.now() - entry.savedAt;
  if (age > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key); // expired, clean up
    return null;
  }
  return entry.result;
}