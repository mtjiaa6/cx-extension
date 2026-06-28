# API Schema — CX Extension ↔ PG AI

This document describes the exact request and response format between the CX Chrome extension and the AI provider. Currently using Groq; to be replaced with PG AI.

---

## Request

The extension sends a standard chat completion request. If PG AI is OpenAI-compatible, no changes are needed to the request structure — only the endpoint URL and auth header change.

### Request Format

```javascript
POST https://[PG_AI_ENDPOINT]
Content-Type: application/json
Authorization: Bearer [AGENT_AUTH_TOKEN]

{
  "model": "[PG_AI_MODEL]",
  "temperature": 0.3,
  "response_format": { "type": "json_object" },
  "messages": [
    {
      "role": "user",
      "content": "[PROMPT — see below]"
    }
  ]
}
```

### What's in the Prompt

The prompt sent in `messages[0].content` contains:

1. **Role context** — explains the CX analyst role and what PropertyGuru does
2. **Instructions** — 8 rules covering reasoning, constrained outputs, confidence scoring, evidence, and output format
3. **Category taxonomy** — the full PropertyGuru category + sub-category list with examples (13 categories, 60+ sub-categories)
4. **Allowed value lists** — Priority, Status, Action Owner, Mood, Tags etc.
5. **The conversation transcript** — the WhatsApp messages in chronological order
6. **JSON schema** — the exact structure the model must return

The prompt is approximately 3,000–5,000 tokens depending on conversation length. Transcripts can be up to ~2,000 tokens for longer conversations.

**`response_format: { type: "json_object" }` is required** — the extension parses the response as strict JSON. If PG AI does not support this parameter, we need to handle JSON extraction differently.

---

## Response

The extension expects a standard chat completion response with the analysis as a JSON string in `choices[0].message.content`.

### Response Format

```javascript
{
  "choices": [
    {
      "message": {
        "content": "[JSON STRING — see schema below]"
      }
    }
  ]
}
```

The extension reads the response as:
```javascript
const raw = JSON.parse(data.choices[0].message.content);
```

---

## Response JSON Schema

The content field must be a valid JSON object matching this schema exactly. Every insight includes a `value`, `confidence` (0.0–1.0), and `reasoning` field.

```json
{
  "summary": {
    "subject":      "string — short case subject, max 80 chars",
    "issue":        "string — 1-2 sentences describing the customer problem",
    "action_taken": "string — 1-2 sentences describing what the agent did",
    "outcome":      "string — 1-2 sentences describing how it ended",
    "language":     "string — detected language e.g. English, Bahasa Malaysia"
  },

  "case_management": {
    "category": {
      "value":      "string — must be one of the allowed categories",
      "confidence": "number — 0.0 to 1.0",
      "reasoning":  "string — one sentence explaining why"
    },
    "sub_category": {
      "value":      "string — must belong to the chosen category",
      "confidence": "number — 0.0 to 1.0",
      "reasoning":  "string — one sentence explaining why"
    }
  },

  "follow_up": {
    "action_owner": {
      "value":      "string — one of: Agent, Customer, Tech Team, Moderation Team, Sales Team, Management",
      "confidence": "number — 0.0 to 1.0",
      "reasoning":  "string — one sentence explaining why"
    },
    "next_steps": [
      "string — concrete action item 1",
      "string — concrete action item 2",
      "string — concrete action item 3"
    ],
    "escalation": {
      "value":      "string — team name e.g. Moderation Team, Sales Team, Tech Team. Use 'None' if no escalation",
      "confidence": "number — 0.0 to 1.0",
      "reasoning":  "string — one sentence summarising what was escalated and why"
    }
  },

  "customer_insights": {
    "tags": [
      {
        "value":      "string — one of the allowed insight tags",
        "confidence": "number — 0.0 to 1.0"
      }
    ]
  },

  "mood": {
    "mood_start": "string — one of: Calm, Neutral, Frustrated, Angry",
    "mood_end":   "string — one of: Calm, Neutral, Frustrated, Angry",
    "mood_trend": {
      "value":      "string — one of: Improving, Worsening, Stable",
      "confidence": "number — 0.0 to 1.0",
      "reasoning":  "string — 2-3 sentences explaining the customer's emotional journey, what caused the shift, and what the agent did"
    }
  },

  "resolution": {
    "status": {
      "value":      "string — one of: New, Working, On Hold, Escalated, Closed, Reopen",
      "confidence": "number — 0.0 to 1.0",
      "reasoning":  "string — one sentence explaining why"
    }
  },

  "priority": {
    "value":      "string — one of: High, Medium, Low",
    "confidence": "number — 0.0 to 1.0",
    "reasoning":  "string — one sentence explaining why"
  }
}
```

---

## Allowed Values

These are the fixed lists the model must choose from. Values outside these lists are rejected by the validation layer.

**Case Category** (13 categories — sub-categories omitted for brevity, full list in `categories.js`):
```
General Request, Product Inquiry, Listing Management, General Inquiry,
Agent Account Details, Agency Details, Agency Sales, B2B Sales,
Moderation, Feedback/Enhancement, Technical, Product/Platform, Others
```

**Resolution Status:**
```
New, Working, On Hold, Escalated, Closed, Reopen
```

**Priority:**
```
High, Medium, Low
```

**Action Owner:**
```
Agent, Customer, Tech Team, Moderation Team, Sales Team, Management
```

**Mood:**
```
Calm, Neutral, Frustrated, Angry
```

**Mood Trend:**
```
Improving, Worsening, Stable
```

**Customer Insight Tags:**
```
Agent Complaint, Technical Issue, Billing/Payment, Product Inquiry,
Account Management, Listing Management, Sales/Upgrade, Feedback,
Policy/Violation, Follow-up Required
```

---

## Validation Rules

The extension runs every response through a validation layer before rendering or sending to Salesforce. The rules are:

| Field | Rule |
|-------|------|
| Category value | Must be in the allowed category list |
| Sub-category value | Must belong to the chosen category |
| All value fields | Must be in their respective allowed lists |
| Confidence scores | Clamped to 0.0–1.0 (e.g. "85" is corrected to 0.85) |
| Confidence < 0.7 | Flagged for human review (yellow banner shown to agent) |
| next_steps | Must be an array of strings |
| Any null value | Rendered as empty, does not crash |

Fields that fail validation are flagged rather than rejected — the agent sees a "please verify" banner and can correct before creating the case.

---

## Example — Full Response

```json
{
  "summary": {
    "subject": "WA(PG) - LISTING PHOTO SUSPENDED | PENDING",
    "issue": "Customer's listing photos were suspended due to watermarks and they are inquiring about renewing their subscription.",
    "action_taken": "Agent checked the account, explained the suspension reason, escalated the photo review to moderation, and connected the customer with sales for the upgrade.",
    "outcome": "Photo review escalated to moderation with a 24-hour timeline. Customer connected with sales team for premium upgrade.",
    "language": "English"
  },
  "case_management": {
    "category":     { "value": "Moderation",  "confidence": 0.9, "reasoning": "The core issue is a photo suspension triggered by the moderation system." },
    "sub_category": { "value": "Media",       "confidence": 0.9, "reasoning": "The suspension specifically relates to listing photos flagged for watermarks." }
  },
  "follow_up": {
    "action_owner": { "value": "Moderation Team", "confidence": 0.9, "reasoning": "The agent escalated the photo review to moderation, making them the next actor." },
    "next_steps": [
      "Moderation team to review the suspended photos within 24 hours",
      "Sales team to follow up with customer regarding premium upgrade",
      "Agent to check on resolution status if no update by tomorrow"
    ],
    "escalation": { "value": "Moderation Team", "confidence": 0.9, "reasoning": "Agent explicitly escalated the photo review to the moderation team to expedite the suspension." }
  },
  "customer_insights": {
    "tags": [
      { "value": "Policy/Violation", "confidence": 0.9 },
      { "value": "Sales/Upgrade",    "confidence": 0.85 }
    ]
  },
  "mood": {
    "mood_start": "Frustrated",
    "mood_end":   "Neutral",
    "mood_trend": {
      "value": "Improving",
      "confidence": 0.8,
      "reasoning": "The customer grew frustrated when told their photos were suspended again despite 3 years on the platform. Their tone settled once the agent apologised, escalated the review as urgent, and provided a clear 24-hour resolution timeline — though their underlying concern about losing leads daily remained unresolved."
    }
  },
  "resolution": {
    "status": { "value": "Working", "confidence": 0.9, "reasoning": "The case is actively being handled — escalated to moderation and sales, with follow-ups pending." }
  },
  "priority": { "value": "High", "confidence": 0.8, "reasoning": "Customer explicitly stated they are losing leads every day due to the suspension." }
}
```

---

## Compatibility Checklist for PG AI

Before integration, confirm the following:

- [ ] Supports POST chat completion endpoint
- [ ] Accepts `Authorization: Bearer [token]` header
- [ ] Supports `response_format: { type: "json_object" }` — or confirm alternative
- [ ] Returns response in `choices[0].message.content`
- [ ] Supports `temperature` parameter
- [ ] Context window large enough for ~5,000 token prompts
- [ ] Model capable of reliable structured JSON output
