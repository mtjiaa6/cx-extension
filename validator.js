// validator.js
// THE SAFETY LAYER
// Updated to handle new CATEGORY_TREE structure (objects with examples)

function validateAIResult(raw) {
  const issues = [];

  // ── Core helper: validate a {value, confidence, evidence} block ──
  function validateInsight(block, allowedValues, fieldName) {
    if (!block || typeof block !== "object") {
      issues.push(`${fieldName}: missing`);
      return { value: null, confidence: 0, evidence: "", needsReview: true };
    }

    let { value, confidence, reasoning } = block;

    // Check value is in allowed list
    if (allowedValues && !allowedValues.includes(value)) {
      issues.push(`${fieldName}: "${value}" not in allowed list`);
      value = null;
    }

    // Repair confidence: clamp to 0-1
    // AI sometimes returns 85 instead of 0.85
    confidence = Number(confidence);
    if (isNaN(confidence))  confidence = 0;
    if (confidence > 1)     confidence = confidence / 100;
    if (confidence < 0)     confidence = 0;
    if (confidence > 1)     confidence = 1;

    const needsReview = confidence < CONFIDENCE_THRESHOLD || value === null;

    return {
      value,
      confidence,
      reasoning: reasoning || "",
      needsReview
    };
  }

  // ── Validate summary (free text, just ensure fields exist) ──────
  const summary = {
    subject:      raw.summary?.subject      || "",
    issue:        raw.summary?.issue        || "",
    action_taken: raw.summary?.action_taken || "",
    outcome:      raw.summary?.outcome      || "",
    language:     raw.summary?.language     || ""
  };

  // ── Validate case management ─────────────────────────────────────
  const category = validateInsight(
    raw.case_management?.category,
    ALL_CATEGORIES,
    "category"
  );

  // Sub-category must belong to the chosen category
  // Uses getSubCategories() from categories.js
  const validSubs = getSubCategories(category.value);
  const sub_category = validateInsight(
    raw.case_management?.sub_category,
    validSubs.length > 0 ? validSubs : null,
    "sub_category"
  );

  // ── Validate follow-up ───────────────────────────────────────────
  const action_owner = validateInsight(
    raw.follow_up?.action_owner,
    ACTION_OWNERS,
    "action_owner"
  );

  // escalation_required is boolean — special handling
  const escalationRaw = raw.follow_up?.escalation_required;
  const escalationValue = escalationRaw?.value === true || escalationRaw?.value === "true";
  const escalation_required = {
    value:      escalationValue,
    confidence: Math.min(1, Math.max(0, Number(escalationRaw?.confidence) || 0)),
    reasoning:   escalationRaw?.reasoning || "",
    needsReview: (Number(escalationRaw?.confidence) || 0) < CONFIDENCE_THRESHOLD
  };

  // ── Validate customer insight tags (multi-select) ────────────────
  const tags = validateTags(raw.customer_insights?.tags);

  // ── Validate mood ────────────────────────────────────────────────
  const mood = {
    mood_start: MOODS.includes(raw.mood?.mood_start) ? raw.mood.mood_start : "Neutral",
    mood_end:   MOODS.includes(raw.mood?.mood_end)   ? raw.mood.mood_end   : "Neutral",
    mood_trend: validateInsight(raw.mood?.mood_trend, MOOD_TRENDS, "mood_trend")
  };

  // ── Validate resolution ──────────────────────────────────────────
  const resolution = {
    status: validateInsight(raw.resolution?.status, RESOLUTION_STATUSES, "resolution")
  };

  // ── Validate priority ────────────────────────────────────────────
  const priority = validateInsight(raw.priority, PRIORITIES, "priority");

  // ── Assemble clean result ────────────────────────────────────────
  const clean = {
    summary,
    case_management: { category, sub_category },
    follow_up: {
      action_owner,
      next_steps: Array.isArray(raw.follow_up?.next_steps)
        ? raw.follow_up.next_steps.filter(s => typeof s === "string" && s.trim())
        : [],
      escalation_required
    },
    customer_insights: { tags },
    mood,
    resolution,
    priority,

    // Overall review flag — true if ANY key field needs review
    needsReview: [
      category.needsReview,
      sub_category.needsReview,
      escalation_required.needsReview,
      resolution.status.needsReview
    ].some(Boolean),

    _validationIssues: issues // for debugging
  };

  return clean;
}

// ── Tag validator (multi-select) ─────────────────────────────────
function validateTags(tags) {
  if (!Array.isArray(tags)) return [];

  return tags
    .filter(t => t && INSIGHT_TAGS.includes(t.value))
    .map(t => {
      let c = Number(t.confidence);
      if (isNaN(c)) c = 0;
      if (c > 1)    c = c / 100;
      return {
        value:      t.value,
        confidence: Math.max(0, Math.min(1, c))
      };
    });
}