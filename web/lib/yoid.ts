/**
 * YoID API client — handles auth, token caching, and all API calls.
 */

const AUTH_URL = process.env.YOID_AUTH_URL!;
const API_URL = process.env.YOID_API_URL!;
const ONBOARDING_URL = process.env.YOID_ONBOARDING_URL!;
const WALLET_API_URL = "https://test.didxtech.com/me-wallet/api";

// In-memory token cache (resets on server restart, fine for local dev)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value;
  }

  const missingVars = ["YOID_AUTH_URL", "YOID_API_URL", "YOID_CLIENT_ID", "YOID_CLIENT_SECRET"].filter(
    k => !process.env[k]
  );
  if (missingVars.length > 0) {
    throw new Error(`YoID not configured — missing env vars: ${missingVars.join(", ")}. Add them to .env.local.`);
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.YOID_CLIENT_ID!,
    client_secret: process.env.YOID_CLIENT_SECRET!,
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YoID auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.value;
}

async function api(
  path: string,
  options: RequestInit = {},
  baseUrl = API_URL,
  retry = true
): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // On 401, invalidate the cache and retry once with a fresh token
  if (res.status === 401 && retry) {
    cachedToken = null;
    return api(path, options, baseUrl, false);
  }

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as {
        errors?: { title?: string; detail?: string }[];
        message?: string;
      };
      if (json.errors?.length) {
        detail = json.errors.map((e) => e.detail ?? e.title ?? "Unknown error").join("; ");
      } else if (json.message) {
        detail = json.message;
      }
    } catch {
      // not JSON — use raw text
    }
    throw new Error(detail);
  }

  // No body responses
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

// ── Ecosystem Presets ─────────────────────────────────────────────────────────

export async function listEcosystemPresets(): Promise<EcosystemPreset[]> {
  const data = (await api("/presets/credentials")) as {
    data: EcosystemPreset[];
  };
  return data.data;
}

// ── Credential Templates (Issuer) ─────────────────────────────────────────────

export async function listCredentialTemplates() {
  const data = (await api("/templates/credentials")) as {
    data: CredentialTemplate[];
  };
  return data.data;
}

export async function createCredentialTemplate(body: {
  name: string;
  description: string;
  code?: string;
  type?: string;
  attributes: Record<string, { type: string; alwaysDisclosed?: boolean }>;
}) {
  const data = (await api("/templates/credentials", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { data: CredentialTemplate };
  return data.data;
}

// ── Credential Issuance (Issuer) ──────────────────────────────────────────────

export async function issueCredential(body: {
  credentialTemplateId: string;
  attributes: Record<string, string>;
}) {
  const data = (await api("/credentials/issuance", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { data: IssuanceRecord };
  return data.data;
}

export async function sendCredentialToWallet(offerUri: string, recipientEmail: string) {
  await api("/orgs/credentials", {
    method: "POST",
    body: JSON.stringify({ credentialOffer: offerUri, recipient: recipientEmail }),
  }, WALLET_API_URL);
}

export async function listIssuances() {
  const data = (await api("/credentials")) as {
    data: IssuanceRecord[];
  };
  return data.data;
}

export async function getIssuance(id: string) {
  const data = (await api(`/credentials/${id}`)) as {
    data: IssuanceRecord;
  };
  return data.data;
}

export async function revokeCredential(id: string) {
  await api(`/credentials/${id}/revoke`, { method: "POST" });
}

// ── User Account (Issuer — create youth wallet account) ───────────────────────

export async function createUserAccount(body: {
  email: string;
  firstName: string;
  lastName: string;
}) {
  const data = (await api("/users", { method: "POST", body: JSON.stringify(body) }, ONBOARDING_URL)) as {
    data: UserAccount;
  };
  return data.data;
}

// ── Presentation Templates (Verifier) ────────────────────────────────────────

export async function listPresentationTemplates() {
  const data = (await api("/templates/presentations")) as {
    data: PresentationTemplate[];
  };
  return data.data;
}

export async function createPresentationTemplate(body: {
  name: string;
  description: string;
  credentials: {
    name: string;
    description: string;
    type: string;
    attributes: Record<string, { type: string }>;
  }[];
}) {
  const data = (await api("/templates/presentations", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { data: PresentationTemplate };
  return data.data;
}

// ── Presentation Requests (Verifier) ─────────────────────────────────────────

export async function createPresentationRequest(presentationTemplateId: string) {
  const data = (await api("/presentations/request", {
    method: "POST",
    body: JSON.stringify({ presentationTemplateId }),
  })) as { data: PresentationRequest };
  return data.data;
}

export async function getPresentation(id: string) {
  const data = (await api(`/presentations/${id}`)) as {
    data: PresentationRequest;
  };
  return data.data;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export async function registerWebhook(url: string) {
  const data = (await api("/endpoints", {
    method: "POST",
    body: JSON.stringify({ url }),
  })) as { data: { id: string; url: string } };
  return data.data;
}

export async function listWebhookEndpoints() {
  const data = (await api("/endpoints")) as {
    data: { id: string; url: string }[];
  };
  return data.data;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CredentialTemplate = {
  id: string;
  name: string;
  description: string;
  type?: string;
  attributes: Record<string, { type: string; alwaysDisclosed?: boolean }>;
  createdAt: string;
  updatedAt: string;
};

export type IssuanceRecord = {
  id: string;
  status: "offered" | "completed" | "failed" | "expired" | "revoked";
  offerUri?: string;
  offerQrUri?: string;
  credentials?: { id: string; status: string; revocable?: boolean }[];
};

export type UserAccount = {
  id: string;
  email: string;
  didUri?: string;
  // Returned on account creation — empty string means account already existed (GAP-005)
  tempPassword?: string;
};

export type PresentationTemplate = {
  id: string;
  name: string;
  description: string;
  credentials: {
    name: string;
    type: string;
    attributes: Record<string, { type: string }>;
  }[];
  createdAt: string;
};

export type EcosystemPreset = {
  id: string;
  author: string;
  templateName: string;
  templateDescription: string;
  templateType: string;
  credentialFormat: string;
  templateAttributes: Record<
    string,
    {
      name: string;
      type: string;
      required: boolean;
      description: string;
      alwaysDisclosed: boolean;
    }
  >;
  createdAt: string;
  updatedAt: string;
};

export type PresentationRequest = {
  id: string;
  status: "requested" | "verified" | "rejected" | "expired";
  presentationTemplateId: string;
  credentials: {
    isValid: boolean;
    name: string;
    type: string;
    attributes: Record<string, string>;
    issues: string[];
  }[];
  authorizationRequestUri: string;
  authorizationRequestQrUri: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};
