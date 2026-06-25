// background.js
// Service worker — handles opening Salesforce and injecting all fields
// Runs silently in the background, never visible to the agent

importScripts("sf-strategy.js");

chrome.action.onClicked.addListener((tab) => {
  // Open the popup when the extension icon is clicked
  chrome.sidePanel.open({tabId: tab.id});
});

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

  // Step 3: Handle the record-type picker (click Customer Care → Next)
  await handleRecordTypePicker(tab.id);

  // Step 4: Wait a bit for the form to render after Next
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Step 5: Inject ALL fields via DOM
  await injectAllFields(tab.id, fields);

  return { success: true };
}

// Clicks "Customer Care" record type, then "Next"
async function handleRecordTypePicker(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: clickRecordType
  });
}

// Runs INSIDE the Salesforce tab
function clickRecordType() {
  // Find the "Customer Care" radio option
  const labels = document.querySelectorAll("span, label");
  for (const lbl of labels) {
    if (lbl.textContent.trim() === "Customer Care") {
      // Click the radio near this label
      const row = lbl.closest("div");
      const radio = row?.querySelector("input[type='radio']") ||
                    lbl.closest("label")?.querySelector("input[type='radio']");
      if (radio) radio.click();
      else lbl.click(); // fallback: click the label itself
      break;
    }
  }

  // Click the "Next" button after a short delay
  setTimeout(() => {
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.textContent.trim() === "Next") {
        btn.click();
        break;
      }
    }
  }, 500);
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
// Runs INSIDE the Salesforce tab — fills all case fields
function fillAllFields(fields) {

  // ── Helper: fill a text input or textarea ──────────────────────
  function fillText(selector, value) {
    const el = document.querySelector(selector);
    if (!el || !value) return false;
    el.focus();
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

  // ── Helper: select an option in a Salesforce dropdown ──────────
  // Salesforce Lightning dropdowns are <button> + a popup list.
  // We click to open, wait, then click the matching option.
  function fillDropdown(fieldLabel, value, delay) {
    if (!value) return;
    setTimeout(() => {
      // Find the dropdown button by its field label
      const labels = document.querySelectorAll("label, span");
      let dropdownBtn = null;

      for (const lbl of labels) {
        if (lbl.textContent.trim() === fieldLabel) {
          // Walk up to the field container, then find the button
          const container = lbl.closest("lightning-combobox, .slds-form-element, lightning-picklist");
          if (container) {
            dropdownBtn = container.querySelector("button, input[role='combobox']");
            if (dropdownBtn) break;
          }
        }
      }

      if (!dropdownBtn) {
        console.warn(`WA→SF: dropdown "${fieldLabel}" not found`);
        return;
      }

      // Open the dropdown
      dropdownBtn.click();

      // Wait for options, then click the matching one
      setTimeout(() => {
        const options = document.querySelectorAll(
          "lightning-base-combobox-item, [role='option']"
        );
        let matched = false;
        for (const opt of options) {
          if (opt.textContent.trim() === value) {
            opt.click();
            matched = true;
            break;
          }
        }
        if (!matched) console.warn(`WA→SF: option "${value}" not found for ${fieldLabel}`);
      }, 600);
    }, delay);
  }

  // ── Fill text fields immediately ───────────────────────────────
  fillText("input[name='Subject']", fields.Subject);

  const descSelectors = [
    "textarea[name='Description']",
    "div[data-field-name='Description'] textarea",
    "div[data-field-name='Description'] lightning-textarea textarea"
  ];
  for (const sel of descSelectors) {
    if (fillText(sel, fields.Description)) break;
  }

  // ── Fill dropdowns with staggered delays ───────────────────────
  // Staggered so each dropdown opens/closes before the next starts,
  // otherwise they interfere with each other.
  fillDropdown("Priority", fields.Priority, 0);
  fillDropdown("Status", fields.Status, 1500);
  fillDropdown("Case Category", fields.Category, 3000);
  fillDropdown("Case Sub-Category", fields.SubCategory, 4500);
  fillDropdown("Case Channel", fields.CaseChannel, 6000);
  fillDropdown("Internal/External", fields.InternalExternal, 7500);
}