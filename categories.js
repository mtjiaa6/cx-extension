// categories.js
// THE KNOWLEDGE LAYER - Real PropertyGuru categories
// Examples per sub-category for maximum AI accuracy

const CATEGORY_TREE = {

  "General Request": {
    subs: {
      "Concurrent Listing":                 "Example: agent requests to increase concurrent listing limit",
      "Report Suspicious Activity":         "Example: agent reports fake listing or suspicious account",
      "Ad Credit Log":                      "Example: agent requests breakdown of ad credit usage",
      "Remove Google Link":                 "Example: agent wants their listing removed from Google search",
      "Resend Verification Link/SMS":       "Example: agent didn't receive verification SMS, requests resend",
      "Billing Receipt":                    "Example: agent requests invoice or billing receipt for payment",
      "Update / Add Directory":             "Example: agent requests to add listing to a property directory",
      "Update / Add TOP":                   "Example: agent requests to update TOP date on listing",
      "Unsubscribe Newsletter":             "Example: agent wants to stop receiving PropertyGuru newsletters",
      "Intercom":                           "Example: agent wants to disable Intercom message pop-up",
      "PLA Service":                        "Example: agent asks about PLA service setup or changes",
      "MyWeb/AgentWeb/Domain Name Related": "Example: authorization code request, domain transfer, purchase domain name",
      "Account Suspension/Termination":     "Example: agent account suspended, requests reinstatement or termination"
    }
  },

  "Product Inquiry": {
    subs: {
      "Boost":                        "Example: agent asks how Boost works or how many credits it costs",
      "Repost":                       "Example: agent asks how to repost a listing and what it does",
      "Auto-Repost":                  "Example: agent asks how to set up automatic reposting",
      "SpotLight":                    "Example: agent asks what SpotLight does and how to purchase it",
      "SocialCast":                   "Example: agent asks how SocialCast shares listings on social media",
      "MyWeb/AgentWeb/Domain Name":   "Example: agent asks about setting up their own agent website",
      "Corporate":                    "Example: agent asks about corporate package features",
      "Floor Plan":                   "Example: agent asks how to add floor plan to their listing",
      "Insight":                      "Example: agent asks how to read their listing performance insights",
      "Turbo":                        "Example: agent asks what Turbo does compared to Boost",
      "Commercial Guru":              "Example: agent asks about Commercial Guru listing features"
    }
  },

  "Listing Management": {
    subs: {
      "Edit Listing":      "Example: help agent edit price, listing description, property type, listing status",
      "Media":             "Example: help agent upload photo, video, virtual tour or floor plan",
      "Sync to directory": "Example: help agent sync their listing to an external property directory"
    }
  },

  "General Inquiry": {
    subs: {
      "Account Inquiry":        "Example: check account status, subscription type, concurrent listing entitlement, ad credit balance",
      "Listing inquiry":        "Example: unable to find listing, how to edit listing, how to upload media",
      "Campaign Inquiry":       "Example: inquiry about promotions, events, training sessions, new initiatives",
      "Trial Account Inquiry":  "Example: how to activate trial account, change details on trial account",
      "Owner Inquiry":          "Example: how to advertise property on PG website, loan eligibility, HOC qualification",
      "Statistics Inquiry":     "Example: why no impressions on LPI, why no leads on listing",
      "PG Website":             "Example: how to save searches, find an agent, post Ask Guru, shortlist listing",
      "Transactional Pricing":  "Example: how to view transactional pricing on a listing",
      "Home Finance":           "Example: inquiry on home loan, refinancing, mortgage (SG only)",
      "Testing/Experiment":     "Example: inquiry on product or platform experiment conducted by tech team"
    }
  },

  "Agent Account Details": {
    subs: {
      "Update Billing Information":        "Example: update billing name or billing address on account",
      "Update Agency":                     "Example: agent wants to change their associated agency",
      "Update/Remove Alternate Number":    "Example: agent wants to add or remove an alternate contact number",
      "Update Profile Photo":              "Example: agent wants to change their profile picture",
      "Update Agent Licence Number":       "Example: update CEA no., REN No., PEA No., or E-licence number",
      "Update Email":                      "Example: agent wants to change their registered email address",
      "Update Job Title":                  "Example: agent wants to change their job title on profile",
      "Update Mobile Number":              "Example: agent wants to update their primary mobile number",
      "Update Profile Name":               "Example: agent wants to change their display name on profile",
      "Reset Password":                    "Example: agent forgot password and needs it reset",
      "Update MyWeb/Agentweb/Domain Name": "Example: update MyWeb or AgentWeb domain name in agent profile",
      "Update/Disable Find Agent Profile": "Example: agent wants to hide or disable their Find Agent listing"
    }
  },

  "Agency Details": {
    subs: {
      "Add/Remove Agency":  "Example: add a new agency association or remove an existing one",
      "Update Agency Logo": "Example: agency wants to upload a new logo or update existing one"
    }
  },

  "Agency Sales": {
    subs: {
      "Upgrade":                "Example: agent wants to upgrade from basic to premium package",
      "New Sign up":            "Example: new agent wants to sign up for a PropertyGuru account",
      "Renewal":                "Example: agent subscription is expiring and wants to renew",
      "Win Back":               "Example: lapsed agent wants to reactivate their account",
      "Discretionary Products": "Example: purchase Ad Credits, Featured Agent, Weekly Featured Listing, Specialist Spots",
      "Overseas Listing":       "Example: agent wants to list a property outside Malaysia or Singapore",
      "Banner":                 "Example: agent or agency wants to purchase a banner advertisement"
    }
  },

  "B2B Sales": {
    subs: {
      "Developer Sales / Media Agency / Non Developer Sales": "Example: developer or media agency inquiry about bulk listings or partnership",
      "FastKey": "Example: developer inquires about FastKey integration for project launches"
    }
  },

  "Moderation": {
    subs: {
      "Media":   "Example: photo suspended by AIME, wrong floor plan flagged, video rejected",
      "Listing": "Example: unauthorized listing, duplicate listing, account sharing, multiple indication",
      "Account": "Example: account not registered with CEA, contact details belong to another person",
      "General": "Example: removal of AskGuru comments, removal of condo reviews"
    }
  },

  "Feedback/Enhancement": {
    subs: {
      "Platform": "Example: feedback on website layout, navigation issues, interface confusing",
      "Pricing":  "Example: agent not happy with price of product or package",
      "Service":  "Example: complaint about CS staff, SP or AM behaviour, any PG staff complaint",
      "Product":  "Example: feedback on product features such as Boost, SpotLight, Turbo",
      "Agent":    "Example: feedback about agent being unprofessional or inappropriate behaviour"
    }
  },

  "Technical": {
    subs: {
      "MyWeb/AgentWeb/Domain Name": "Example: agent website not loading, domain not resolving, pages broken",
      "Commercial Guru":            "Example: Commercial Guru platform bug, listing not showing",
      "AgentNet":                   "Example: AgentNet dashboard error, stats not updating",
      "PG Consumer":                "Example: PropertyGuru consumer app or website bug",
      "AdminNet":                   "Example: AdminNet tool error or access issue",
      "Salesforce":                 "Example: Salesforce case or record not updating correctly"
    }
  },

  "Product/Platform": {
    subs: {
      "Testing/Experiment": "Example: inquiry on A/B test or platform experiment by tech team",
      "Roll Out":           "Example: tech issue or enhancement related to new product or feature launch",
      "Incident Follow Up": "Example: CS required to call agents regarding a backend error or outage"
    }
  },

  "Others": {
    subs: {
      "Spam":                             "Example: spam email or irrelevant message received",
      "Agent Error":                      "Example: agent made their own mistake and asks for refund, multiple repost error",
      "Call Dropped":                     "Example: call with agent was disconnected unexpectedly",
      "Wrong No.":                        "Example: called or messaged wrong number, not related to PG",
      "Other Department/ Specify Person": "Example: looking for specific staff member, marketing proposal received",
      "Automated Email Reply":            "Example: JIRA ticket reply received, email undelivered report, PG Property Alert",
      "No Further Action Required":       "Example: FYI message to CS team, no action needed"
    }
  }

};

// ── Derived helpers (auto-generated, never edit manually) ────────

const ALL_CATEGORIES = Object.keys(CATEGORY_TREE);

const ALL_SUB_CATEGORIES = Object.values(CATEGORY_TREE)
  .flatMap(cat => Object.keys(cat.subs));

function getSubCategories(category) {
  return category && CATEGORY_TREE[category]
    ? Object.keys(CATEGORY_TREE[category].subs)
    : [];
}

function buildCategoryPromptText() {
  return Object.entries(CATEGORY_TREE)
    .map(([cat, data]) => {
      const subLines = Object.entries(data.subs)
        .map(([sub, example]) => `      - ${sub}: ${example}`)
        .join("\n");
      return `  ${cat}:\n${subLines}`;
    })
    .join("\n\n");
}

// ── Other fixed lists ────────────────────────────────────────────

const ACTION_OWNERS = [
  "Agent",
  "Customer",
  "Tech Team",
  "Moderation Team",
  "Sales Team",
  "Management"
];

const INSIGHT_TAGS = [
  "Agent Complaint",
  "Technical Issue",
  "Billing/Payment",
  "Product Inquiry",
  "Account Management",
  "Listing Management",
  "Sales/Upgrade",
  "Feedback",
  "Policy/Violation",
  "Follow-up Required"
];

const MOODS               = ["Calm", "Neutral", "Frustrated", "Angry"];
const MOOD_TRENDS         = ["Improving", "Worsening", "Stable"];
const RESOLUTION_STATUSES = ["New", "Working", "On Hold", "Escalated", "Closed", "Reopen"];


const CASE_CHANNELS = ["Phone", "Email", "Web", "None"];
const INTERNAL_EXTERNAL = ["Internal", "External", "None"];
const PRIORITIES          = ["High", "Medium", "Low"];