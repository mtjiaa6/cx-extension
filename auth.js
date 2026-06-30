// auth.js
// Microsoft SSO — OAuth 2.0 Authorization Code flow with PKCE

const AUTH_CONFIG = {
  clientId:      "%%AZURE_CLIENT_ID%%",
  tenantId:      "%%AZURE_TENANT_ID%%",
  redirectUri:   chrome.identity.getRedirectURL(),
  scopes:        ["openid", "email", "profile", "User.Read"],
  allowedDomain: "propertyguru.com"
};

const STORAGE_KEY_TOKEN  = "msft_access_token";
const STORAGE_KEY_EXPIRY = "msft_token_expiry";
const STORAGE_KEY_EMAIL  = "msft_user_email";
const STORAGE_KEY_NAME   = "msft_user_name";


function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}


function buildAuthUrl(codeChallenge) {
  const params = new URLSearchParams({
    client_id:             AUTH_CONFIG.clientId,
    response_type:         "code",
    redirect_uri:          AUTH_CONFIG.redirectUri,
    scope:                 AUTH_CONFIG.scopes.join(" "),
    response_mode:         "query",
    code_challenge:        codeChallenge,
    code_challenge_method: "S256",
    nonce:                 Math.random().toString(36).slice(2)
  });

  return `https://login.microsoftonline.com/${AUTH_CONFIG.tenantId}/oauth2/v2.0/authorize?${params}`;
}

function extractCodeFromUrl(url) {
  try {
    const params = new URL(url).searchParams;
    return params.get("code") || null;
  } catch {
    return null;
  }
}


async function exchangeCodeForToken(code, codeVerifier) {
  const params = new URLSearchParams({
    client_id:     AUTH_CONFIG.clientId,
    grant_type:    "authorization_code",
    code:          code,
    redirect_uri:  AUTH_CONFIG.redirectUri,
    code_verifier: codeVerifier,
    scope:         AUTH_CONFIG.scopes.join(" ")
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${AUTH_CONFIG.tenantId}/oauth2/v2.0/token`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString()
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data.access_token || null;
}

// ── USER PROFILE ───────────────────────────────────────────────

async function fetchUserProfile(token) {
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}


async function microsoftLogin() {
  const codeVerifier  = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const authUrl       = buildAuthUrl(codeChallenge);

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          resolve({ success: false, error: chrome.runtime.lastError?.message || "Login cancelled" });
          return;
        }

        const code = extractCodeFromUrl(redirectUrl);
        if (!code) {
          resolve({ success: false, error: "No code in redirect URL" });
          return;
        }

        const token = await exchangeCodeForToken(code, codeVerifier);
        if (!token) {
          resolve({ success: false, error: "Token exchange failed" });
          return;
        }

        const profile = await fetchUserProfile(token);
        if (!profile) {
          resolve({ success: false, error: "Could not fetch user profile" });
          return;
        }

        const email = profile.mail || profile.userPrincipalName || "";
        if (!email.toLowerCase().endsWith(`@${AUTH_CONFIG.allowedDomain}`)) {
          resolve({ success: false, error: `Only @${AUTH_CONFIG.allowedDomain} accounts are allowed.` });
          return;
        }

        const expiry = Date.now() + (50 * 60 * 1000);
        await chrome.storage.local.set({
          [STORAGE_KEY_TOKEN]:  token,
          [STORAGE_KEY_EXPIRY]: expiry,
          [STORAGE_KEY_EMAIL]:  email,
          [STORAGE_KEY_NAME]:   profile.displayName || email.split("@")[0]
        });

        resolve({ success: true, email, name: profile.displayName });
      }
    );
  });
}


async function getValidToken() {
  const data = await chrome.storage.local.get([
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_EXPIRY
  ]);

  const token  = data[STORAGE_KEY_TOKEN];
  const expiry = data[STORAGE_KEY_EXPIRY];

  if (!token || !expiry) return null;
  if (Date.now() > expiry) {
    await clearAuthData();
    return null;
  }

  return token;
}

async function getStoredUser() {
  const data = await chrome.storage.local.get([STORAGE_KEY_EMAIL, STORAGE_KEY_NAME]);
  return {
    email: data[STORAGE_KEY_EMAIL] || "",
    name:  data[STORAGE_KEY_NAME]  || ""
  };
}

async function logout() {
  await clearAuthData();

  const logoutUrl = `https://login.microsoftonline.com/${AUTH_CONFIG.tenantId}/oauth2/v2.0/logout`
    + `?post_logout_redirect_uri=${encodeURIComponent(AUTH_CONFIG.redirectUri)}`;

  chrome.identity.launchWebAuthFlow(
    { url: logoutUrl, interactive: false },
    () => {}
  );
}

async function clearAuthData() {
  await chrome.storage.local.remove([
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_EXPIRY,
    STORAGE_KEY_EMAIL,
    STORAGE_KEY_NAME
  ]);
}