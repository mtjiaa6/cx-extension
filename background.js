// background.js
// Service worker — handles opening Salesforce and injecting all fields
// Runs silently in the background, never visible to the agent

importScripts("sf-strategy.js");

chrome.action.onClicked.addListener((tab) => {
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

  const tab = await getOrCreateSalesforceTab(url, caseData.sfUrl);
  await waitForTabLoad(tab.id);
  await handleRecordTypePicker(tab.id);
  await new Promise(resolve => setTimeout(resolve, 2500));
  await injectAllFields(tab.id, fields);

  return { success: true };
}

async function handleRecordTypePicker(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: clickRecordType
  });
}

function clickRecordType() {
  const labels = document.querySelectorAll("span, label");
  for (const lbl of labels) {
    if (lbl.textContent.trim() === "Customer Care") {
      const row = lbl.closest("div");
      const radio = row?.querySelector("input[type='radio']") ||
                    lbl.closest("label")?.querySelector("input[type='radio']");
      if (radio) radio.click();
      else lbl.click();
      break;
    }
  }

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

function fillAllFields(fields) {

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

  function fillDropdown(ariaLabel, value, delay) {
    if (!value) return;
    setTimeout(() => {
      const dropdownBtn = document.querySelector(`button[aria-label="${ariaLabel}"]`);
      if (!dropdownBtn) {
        console.warn(`WA→SF: dropdown "${ariaLabel}" not found`);
        return;
      }

      dropdownBtn.click();

      setTimeout(() => {
        const options = document.querySelectorAll("lightning-base-combobox-item, [role='option']");
        let matched = false;
        for (const opt of options) {
          if (opt.textContent.trim() === value) {
            opt.click();
            matched = true;
            break;
          }
        }
        if (!matched) console.warn(`WA→SF: option "${value}" not found for ${ariaLabel}`);
      }, 600);
    }, delay);
  }

  // ── Text fields ───────────────────────────────────────────────
  fillText("input[name='Subject']", fields.Subject);

  const descSelectors = [
    "records-record-layout-text-area textarea",
    "textarea.slds-textarea",
    "div.textarea-container textarea"
  ];
  for (const sel of descSelectors) {
    if (fillText(sel, fields.Description)) break;
  }

  // ── Contact Name lookup ───────────────────────────────────────
  if (fields.ContactName) {
    const contactInput = document.querySelector('input[aria-label="Contact Name"]');
    if (contactInput) {
      contactInput.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(contactInput, fields.ContactName);
      contactInput.dispatchEvent(new Event("input", { bubbles: true }));

      setTimeout(() => {
        const options = document.querySelectorAll("[role='option']");
        for (const opt of options) {
          if (opt.textContent.includes("Show more results")) {
            opt.click();
            break;
          }
        }
      }, 2500);
    }
  }

  // ── Dropdowns (start after contact search settles) ────────────
  fillDropdown("Priority", fields.Priority, 3000);
  fillDropdown("Status", fields.Status, 4500);
  fillDropdown("Case Category", fields.Category, 6000);
  fillDropdown("Case Sub-Category", fields.SubCategory, 7500);
  fillDropdown("Case Channel", fields.CaseChannel, 9000);
  fillDropdown("Internal/External", fields.InternalExternal, 10500);
}