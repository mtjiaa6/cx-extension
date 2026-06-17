// background.js
// Service worker — handles opening Salesforce and injecting all fields
// Runs silently in the background, never visible to the agent

importScripts("sf-strategy.js");

// ── MESSAGE LISTENER ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "createCase") {
    handleCreateCase(request.caseData)
      .then((result) => sendResponse(result))
      .catch((err) => {
        console.error("createCase failed:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

// ── MAIN HANDLER ──────────────────────────────────────────────
async function handleCreateCase(caseData) {
  const { url, fields } = createCase(caseData);

  // Step 1: Reuse existing Salesforce tab or open a new one
  const tab = await getOrCreateSalesforceTab(url, caseData.sfUrl);

  // Step 2: Wait for the page to fully load
  await waitForTabLoad(tab.id);

  // Step 3: Inject ALL fields via DOM
  await injectAllFields(tab.id, fields);

  // Step 4: Don't force tab switch — agent switches when ready
  // popup.js shows a "ready" message instead

  return { success: true };
}

// ── GET OR CREATE SALESFORCE TAB ──────────────────────────────
async function getOrCreateSalesforceTab(url, sfUrl) {
  const sfDomain = new URL(sfUrl).hostname;

  const existingTabs = await chrome.tabs.query({});
  const sfTab = existingTabs.find(t =>
    t.url && new URL(t.url).hostname === sfDomain
  );

  if (sfTab) {
    await chrome.tabs.update(sfTab.id, { url });
    return sfTab;
  }

  return await chrome.tabs.create({ url });
}

// ── WAIT FOR TAB TO LOAD ──────────────────────────────────────
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        // Extra buffer — Salesforce Lightning renders after DOM load
        setTimeout(resolve, 2000);
      }
    });
  });
}

// ── INJECT ALL FIELDS ─────────────────────────────────────────
async function injectAllFields(tabId, fields) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: fillAllFields,
    args: [fields]
  });
}

// Runs INSIDE the Salesforce tab
function fillAllFields(fields) {

  function fillText(selector, value) {
    const el = document.querySelector(selector);
    if (!el || !value) return false;

    el.focus();
    el.click();

    const setter = Object.getOwnPropertyDescriptor(
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      "value"
    ).set;

    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fillCombobox(fieldName, value) {
    const container = document.querySelector(`div[data-field-name='${fieldName}']`);
    if (!container || !value) return false;

    const input = container.querySelector("input");
    if (!input) return false;

    input.focus();
    input.click();

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    setTimeout(() => {
      const options = document.querySelectorAll("lightning-base-combobox-item");
      for (const opt of options) {
        if (opt.textContent.trim() === value) {
          opt.click();
          break;
        }
      }
    }, 500);

    return true;
  }

  // Subject
  fillText("input[name='Subject']", fields.Subject);

  // Description
  const descSelectors = [
    "textarea[name='Description']",
    "div[data-field-name='Description'] textarea",
    "div[data-field-name='Description'] lightning-textarea textarea"
  ];
  for (const sel of descSelectors) {
    if (fillText(sel, fields.Description)) break;
  }

  // Priority
  fillCombobox("Priority", fields.Priority);

  // Type / Category
  fillCombobox("Type", fields.Type);

  // Origin
  fillCombobox("Origin", fields.Origin);
}