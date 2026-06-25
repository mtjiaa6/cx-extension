// content.js
// Runs automatically on WhatsApp Web
// Listens for a message from popup.js asking for conversation data

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getConversation") {
    const data = scrapeConversation();
    sendResponse(data);
  }
  return true;
});

function scrapeConversation() {
  // --- Contact Name (from header) ---
  const nameEl = document.querySelector("header ._amig span[dir='auto']") ||
                 document.querySelector("header span[data-testid='conversation-info-header-chat-title']") ||
                 document.querySelector("#main header span[title]");
  let contactName = nameEl ? nameEl.innerText.trim() : "Unknown Contact";

  // --- Phone Number ---
  // Only capture if it actually looks like a phone number.
  // Saved contacts show "last seen..."/"online" which we reject.
  let phoneNumber = "";
  const headerTitle = nameEl ? nameEl.innerText.trim() : "";
  const digitCount = (headerTitle.match(/\d/g) || []).length;
  const headerIsPhone = /^[\d\s+\-()]+$/.test(headerTitle) && digitCount >= 7;

  if (headerIsPhone) {
    // Unsaved contact: the header IS the phone number
    phoneNumber = headerTitle;
  }

  // --- Messages ---
  // We grab everything here — popup.js filters by date range
  const messageEls = document.querySelectorAll("div[role='row']");
  const messages = [];

  messageEls.forEach((row) => {
    // Message text
    const textEl = row.querySelector("span[data-testid='selectable-text'], span.selectable-text");
    const text = textEl ? textEl.innerText.trim() : null;
    if (!text) return;

    // Timestamp — WhatsApp stores the full date in data-pre-plain-text
    // Format varies by locale: "[HH:MM, DD/MM/YYYY] Name:" or "[7:18 pm, 14/06/2026] Name:"
    const containerEl = row.querySelector("div[data-pre-plain-text]");
    const rawMeta = containerEl ? containerEl.getAttribute("data-pre-plain-text") : null;

    let time = "";
    let date = null; // actual JS Date object for filtering

    if (rawMeta) {
      const parsed = parseTimestamp(rawMeta);
      if (parsed) {
        time = parsed.time;
        date = parsed.date;
      }
    }

    // Outgoing = sent by agent
    const isOutgoing = row.querySelector("div[data-testid='msg-container'][class*='message-out']") !== null;
    const sender = isOutgoing ? "Agent" : contactName;

    messages.push({ sender, text, time, date, rawMeta });
  });

  // If the header was a phone number (unsaved contact), try to get the
  // real name from the message senders instead
  if (headerIsPhone) {
    const senderNames = messages
      .filter(m => m.sender !== "Agent" && m.sender !== contactName)
      .map(m => m.sender);
    if (senderNames.length > 0) {
      contactName = senderNames[0]; // use the customer's profile name
    }
  }

  return {
    contactName,
    phoneNumber,
    messages,
    scrapedAt: new Date().toISOString()
  };
}

// ── FLEXIBLE TIMESTAMP PARSER ──────────────────────────────────
// Handles the many locale formats WhatsApp uses across machines:
//   [7:18 pm, 14/06/2026]   12-hour, day-first
//   [19:18, 6/14/2026]      24-hour, month-first
//   [09:06, 14.06.2026]     dots
//   [9:06 AM, 14-06-2026]   dashes, uppercase AM
function parseTimestamp(rawMeta) {
  // Pull out the bracketed part: [ ... ]
  const bracket = rawMeta.match(/\[(.*?)\]/);
  if (!bracket) return null;
  const inside = bracket[1]; // e.g. "7:18 pm, 14/06/2026"

  // Split into time portion and date portion at the comma
  const parts = inside.split(",");
  if (parts.length < 2) return null;

  const timeStr = parts[0].trim();              // "7:18 pm"
  const dateStr = parts.slice(1).join(",").trim(); // "14/06/2026"

  // Extract the date numbers regardless of separator (/ . -)
  const nums = dateStr.match(/(\d{1,4})/g);
  if (!nums || nums.length < 3) return null;

  // Figure out which number is the year (the 4-digit one)
  let day, month, year;
  if (nums[2].length === 4) {
    // format: X / Y / YYYY
    year = nums[2];
    let a = parseInt(nums[0], 10);
    let b = parseInt(nums[1], 10);
    // Decide day vs month: >12 must be the day
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { month = a; day = b; }
    else { day = a; month = b; } // ambiguous → day-first (SG/MY default)
  } else if (nums[0].length === 4) {
    // format: YYYY / X / Y
    year = nums[0];
    let a = parseInt(nums[1], 10);
    let b = parseInt(nums[2], 10);
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { month = a; day = b; }
    else { month = a; day = b; } // year-first usually month-first
  } else {
    return null;
  }

  const date = new Date(`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
  if (isNaN(date.getTime())) return null;

  return { time: timeStr, date };
}