// sf-strategy.js
// v1: DOM automation — short fields via URL, description via DOM inject
// v2: REST API — swap createCase() only

function createCase(caseData) {
  return domStrategy(caseData);
}

function domStrategy(caseData) {
  const { sfUrl, subject, priority, category, contactName, contactPhone } = caseData;

  const baseUrl = sfUrl.replace(/\/$/, "");

  // Only short fields go in the URL
  // Description is injected by background.js after the page loads
  const fields = {
    Subject: subject,
    Priority: priority,
    Type: category,
    Origin: "Chat"
  };

  const defaultFieldValues = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join(",");

  const newCaseUrl = `${baseUrl}/lightning/o/Case/new?defaultFieldValues=${defaultFieldValues}`;

  return {
    url: newCaseUrl,
    description: buildFullDescription(caseData) // passed separately to background.js
  };
}

function buildFullDescription(caseData) {
  const { description, contactName, contactPhone } = caseData;

  return [
    description,
    "",
    "---",
    `Source: WhatsApp`,
    `Contact: ${contactName}${contactPhone ? ` (${contactPhone})` : ""}`
  ].join("\n");
}

// ── V2: API STRATEGY (placeholder for later) ──────────────────
//
// async function apiStrategy(caseData) {
//   const { sfUrl, subject, priority, category, description } = caseData;
//   const accessToken = await getSalesforceToken();
//
//   const response = await fetch(`${sfUrl}/services/data/v57.0/sobjects/Case`, {
//     method: "POST",
//     headers: {
//       "Authorization": `Bearer ${accessToken}`,
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({
//       Subject: subject,
//       Priority: priority,
//       Type: category,
//       Description: description,
//       Origin: "Chat"
//     })
//   });
//
//   const result = await response.json();
//   return { caseId: result.id, url: `${sfUrl}/lightning/r/Case/${result.id}/view` };
// }