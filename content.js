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
  // --- Contact Name ---
  const nameEl = document.querySelector("header ._amig span[dir='auto']") ||
                 document.querySelector("header span[data-testid='conversation-info-header-chat-title']");
  const contactName = nameEl ? nameEl.innerText.trim() : "Unknown Contact";

  // --- Phone Number ---
  const subtitleEl = document.querySelector("header ._amig span[dir='auto'] + span") ||
                     document.querySelector("header span[title]");
  const phoneNumber = subtitleEl ? subtitleEl.innerText.trim() : "";

  // --- Messages ---
  // We grab everything here — popup.js filters by date range
  const messageEls = document.querySelectorAll("div[role='row']");
  const messages = [];

  messageEls.forEach((row) => {
    // Message text
    const textEl = row.querySelector("span.selectable-text span[dir='ltr'], span.selectable-text span[dir='rtl']");
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

  return {
    contactName,
    phoneNumber,
    messages,   // full unfiltered array — popup filters by date
    scrapedAt: new Date().toISOString()
  };
}