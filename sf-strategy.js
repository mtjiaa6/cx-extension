// sf-strategy.js
// v1: DOM automation — open blank new case page, inject ALL fields
// v2: REST API — swap createCase() only

function createCase(caseData) {
  return domStrategy(caseData);
}

function domStrategy(caseData) {
  const { sfUrl, subject, priority, category, contactName, contactPhone, description } = caseData;

  const baseUrl = sfUrl.replace(/\/$/, "");

  // Clean new case URL — no defaultFieldValues
  // All fields injected by background.js after page loads
  const newCaseUrl = `${baseUrl}/lightning/o/Case/new`;

  return {
    url: newCaseUrl,
    fields: {
      Subject: subject,
      Priority: priority,
      Status: caseData.status,
      Category: category,
      SubCategory: caseData.subCategory,
      CaseChannel: caseData.caseChannel,
      InternalExternal: caseData.internalExternal,
      Description: buildFullDescription(caseData)
    }
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