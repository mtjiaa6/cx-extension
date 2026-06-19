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
    // Format: "[HH:MM, DD/MM/YYYY] Name:"
    const containerEl = row.querySelector("div[data-pre-plain-text]");
    const rawMeta = containerEl ? containerEl.getAttribute("data-pre-plain-text") : null;

    let time = "";
    let date = null; // actual JS Date object for filtering

    if (rawMeta) {
      // Parse "[10:32, 17/06/2026] Ahmad:"
      const match = rawMeta.match(/\[(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/);
        if (match) {
            time = match[1];                        // "11:47"
            const [month, day, year] = match[2].split("/"); // M/D/YYYY
            date = new Date(`${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`);
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