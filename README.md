# WhatsApp → Salesforce Case Creator

A Chrome extension that turns WhatsApp Web conversations into fully-formed Salesforce cases in seconds — no copy-pasting, no manual categorisation.

Built as a fast-win internal tool for the PropertyGuru CX team to automate the manual process of logging WhatsApp agent/customer conversations into Salesforce.

---

## The Problem

Every time a CX agent handles a WhatsApp conversation, they manually:
- Re-type or copy-paste the conversation into Salesforce
- Select the case category and sub-category by hand
- Write a summary of the issue, action taken, and outcome
- Set priority, status, and other fields
- Fill in contact details

This is slow, repetitive, and inconsistent across agents. This extension automates the entire workflow.

---

## How It Works

```
WhatsApp Web  →  Extension reads the chat  →  AI analyses it
     →  Agent reviews insights  →  One click  →  Salesforce pre-filled
```

The agent stays in control — nothing is submitted to Salesforce automatically. The extension prepares everything; the agent reviews and saves.

**Total time: under 30 seconds vs several minutes manually.**

---

## Features

### Conversation Scraping
- Reads the open WhatsApp Web conversation directly from the page DOM
- Captures contact name, phone number, all messages with timestamps
- Distinguishes between agent and customer messages
- Works on saved and unsaved contacts
- Handles all locale/date formats across Windows and Mac (D/M/YYYY, M/D/YYYY, 12hr, 24hr)

### Date Range Filtering
- Agent picks a custom start and end date
- Only messages in that range are sent for analysis
- Live preview shows exactly which messages are selected
- Live message count updates as the date range changes

### Contact Verification Gate
- Before analysis, a confirmation screen shows the detected name and phone
- Auto-detected fields are flagged green; missing fields flagged orange
- Agent confirms or corrects before proceeding — ensures data quality
- Verified contacts are cached for 30 minutes (skips re-confirmation on reopen)

### AI Analysis
Powered by an LLM with a purpose-built CX prompt. Produces for each conversation:

- **Summary** — Issue, Action Taken, Outcome in plain English
- **Case Category + Sub-Category** — mapped to the real PropertyGuru Salesforce taxonomy (13 categories, 60+ sub-categories with examples)
- **Priority** — High / Medium / Low with reasoning
- **Case Status** — New / Working / On Hold / Escalated / Closed / Reopen
- **Customer Mood Analysis** — a narrative explaining the emotional journey and what caused any shift
- **Escalation** — which team it was escalated to and why
- **Action Owner** — who should act next
- **Next Steps** — concrete numbered action list
- **Customer Insight Tags** — multi-tag classification
- **Language Detection** — including Bahasa Malaysia

### AI Engineering Layer
- **Constrained outputs** — AI can only pick from valid PropertyGuru category lists
- **Confidence scoring** — every insight has a 0–100% confidence score
- **Reasoning** — every insight includes a brief explanation of why the AI decided that
- **Validation layer** — every AI response is checked before being trusted; invalid values are caught and flagged
- **Human-review flagging** — low confidence triggers a yellow "please verify" banner
- **Few-shot prompting** — good/bad examples in the prompt keep output quality high

### Comprehensive Insight Panel
- Summary paragraph at the top — readable without scrolling
- Each insight shows: value + confidence badge + reasoning
- Escalation highlighted in red when flagged
- "Show more" toggle for secondary insights
- Re-analyze button for fresh runs when conversation has moved on

### Salesforce Case Creation
- Reuses the agent's existing Salesforce login session — no separate auth needed
- Auto-handles the record-type picker (selects "Customer Care")
- Auto-fills all structured fields via Salesforce's real dropdowns:
  - Subject (standard `WA(PG) - SUMMARY | STATUS` format)
  - Priority, Status, Case Category, Case Sub-Category
  - Case Channel, Internal/External
  - Description (structured, de-duplicated, with full transcript)
- Agent reviews the pre-filled form and clicks Save — full control retained

### Smart Subject Formatting
Automatically formats the subject to the team standard:
```
WA(PG) - LISTING PHOTO SUSPENDED | PENDING
```
Status word maps automatically:
- Closed → COMPLETED
- Working / On Hold → PENDING
- Escalated → ESCALATED
- New → NEW
- Reopen → REOPENED

### Lean Description Output
The Salesforce description is structured and de-duplicated — fields already captured in dropdowns are not repeated:
```
SUMMARY
  Issue / Action Taken / Outcome

NEXT STEPS
  1. ...
  2. ...

CUSTOMER MOOD
  Narrative explanation of the emotional journey

CONTACT
  Name, Phone, Date range

FULL TRANSCRIPT
```

### Token-Saving Cache
- AI analysis cached per conversation + date range for 30 minutes
- Reopening the popup shows saved analysis instantly — zero additional API cost
- Re-analyze button forces a fresh run when needed
- Cache auto-expires after 30 minutes

---

## Architecture

```
manifest.json    → extension config & permissions
content.js       → scrapes WhatsApp Web DOM
popup.html       → agent UI (3 screens: setup, verify, main)
popup.js         → orchestration layer
categories.js    → PropertyGuru category taxonomy (knowledge layer)
ai-config.js     → LLM prompt (prompt engineering layer)
validator.js     → AI output safety checks (validation layer)
sf-strategy.js   → Salesforce field mapping
background.js    → opens Salesforce, handles picker, fills all fields
```

### Current Data Flow

```
WhatsApp Web (DOM)
       ↓ content.js scrapes
popup.js (orchestration)
       ↓ builds prompt
ai-config.js
       ↓ sends to LLM
Groq API (llama-3.3-70b-versatile)   ← current, to be replaced
       ↓ returns JSON
validator.js (checks every field)
       ↓ validated result
popup.js (renders insights to agent)
       ↓ agent clicks Create Case
background.js (fills Salesforce via DOM)
       ↓
Salesforce Lightning (agent reviews + saves)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome MV3, vanilla JavaScript |
| AI Provider | Groq API (llama-3.3-70b-versatile) — temporary |
| CRM | Salesforce Lightning (DOM automation) |
| Messaging | WhatsApp Web (DOM scraping) |
| Storage | chrome.storage.local |

---

## Security Model

### Chrome Extension Permissions
The manifest restricts the extension to only these domains:
```
https://web.whatsapp.com/*
https://*.salesforce.com/*
https://*.force.com/*
```
Chrome enforces this at the browser level — the extension physically cannot communicate with any other domain.

### Current Security Limitations

| Concern | Current State |
|---------|--------------|
| API key | Stored in Chrome local storage — extractable via DevTools |
| Authentication | None — no per-user identity |
| Rate limiting | None — no per-user controls |
| Usage tracking | None |
| Data residency | Groq (US-based third party) |

These limitations are being addressed via the PG AI integration described below.

---

## Status

| Component | Status |
|-----------|--------|
| WhatsApp scraping | ✅ Working |
| AI analysis + insights | ✅ Working |
| Salesforce case creation | ✅ Working |
| All SF dropdowns auto-filled | ✅ Working |
| 30-min analysis cache | ✅ Working |
| Multi-locale date parsing | ✅ Working |
| CX team demo | ✅ Completed, positive feedback |
| PG AI integration | 🔜 In progress |
| Salesforce REST API (v2) | 🔜 Planned |

---

## Next Steps

### PG AI Integration

The extension is working end-to-end and has been demoed to the CX team with positive feedback. The one thing blocking team-wide deployment is security — specifically the AI API key stored in the browser.

Right now, when an agent clicks "Analyze with AI", the extension calls Groq — an external US-based AI provider — directly from the browser. To do this, it needs a Groq API key, and that key is stored inside the extension itself. Anyone with access to the extension files or Chrome DevTools can extract it. There is no way to know who is using it, no way to limit usage, and no way to revoke access without replacing the key for everyone.

The fix is to route through PG AI instead. Rather than calling an external provider directly, the extension calls PG AI — PropertyGuru's internal AI platform — which sits between the extension and the underlying language model. The agent authenticates with their PG credentials once. From then on, every analysis request goes to PG AI with that auth token. PG AI validates the identity, applies rate limits, logs the request, and calls the LLM using its own server-side key. The JSON response comes back to the extension exactly as it does today. The agent experience is identical — the difference is entirely under the hood.

**Current flow (insecure):**

```
┌─────────────────────────────────────────┐
│           Agent's Browser               │
│                                         │
│  1. Agent clicks Analyze                │
│  2. Extension reads API key             │
│     from Chrome local storage           │
│  3. Calls Groq directly ────────────────┼──→ api.groq.com (external)
│  4. Groq returns JSON ──────────────────┼──←
│  5. Extension renders insights          │
│                                         │
└─────────────────────────────────────────┘

Problem: API key is in the browser. No auth. No limits. No tracking.
```

**Envisioned flow (with PG AI):**

```
┌─────────────────────────────────────────┐
│           Agent's Browser               │
│                                         │
│  SETUP (one-time):                      │
│  1. Agent logs in with PG credentials   │
│  2. PG AI returns auth token            │
│  3. Token stored in Chrome storage      │
│                                         │
│  EVERY ANALYSIS:                        │
│  4. Agent clicks Analyze                │
│  5. Extension sends prompt + token ─────┼──→ PG AI (internal)
│                                         │         │
│                                         │   ① Validates token
│                                         │   ② Checks rate limit
│                                         │   ③ Logs request
│                                         │   ④ Calls LLM with
│                                         │      its own key
│                                         │         │
│  6. JSON response returned ─────────────┼──←──────┘
│  7. Extension validates + renders       │
│  8. Agent creates Salesforce case       │
│                                         │
└─────────────────────────────────────────┘

No key in the browser. Identity verified. Usage controlled.
```

**What this solves:**

| Concern | Before | After |
|---------|--------|-------|
| API key location | Browser, extractable | PG AI server only |
| Authentication | None | PG credentials required |
| Rate limiting | None | Enforced per agent |
| Usage tracking | None | Full visibility per user/team |
| Data residency | Groq (US third party) | Internal PG infrastructure |
| Access revocation | Requires key change for all | Disable individual account |

**What changes in our code:**

Only `popup.js` changes — the Groq API call is swapped for the PG AI endpoint with an auth token attached. Everything else (prompt, validator, UI, Salesforce filling) stays identical. Estimated implementation time: **1–2 days once PG AI details are confirmed.**

**What we need from the PG AI team:**

1. Endpoint URL — where the extension sends requests
2. Authentication method — SSO, per-user token, or session-based
3. API format — OpenAI-compatible? Custom schema?
4. Rate limiting policy — limits per user/team
5. Model availability — needs structured JSON output and large context window

---

## Contributing

This is an internal PropertyGuru CX tool. For questions or contributions, contact the CX team or raise an issue in this repository.
