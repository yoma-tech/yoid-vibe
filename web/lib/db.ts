/**
 * SQLite DB — talent pool, issuance tracking, webhook events.
 * Using better-sqlite3 (synchronous, zero config, local dev friendly).
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "yoid-demo.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  // Add credential_id column if it doesn't exist (for existing DBs)
  try {
    db.exec("ALTER TABLE issuances ADD COLUMN credential_id TEXT");
  } catch {
    // Column already exists — fine
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS talent_profiles (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS talent_credentials (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES talent_profiles(id),
      credential_name TEXT NOT NULL,
      credential_type TEXT NOT NULL,
      attributes TEXT NOT NULL, -- JSON
      verified_at TEXT NOT NULL DEFAULT (datetime('now')),
      presentation_request_id TEXT
    );

    CREATE TABLE IF NOT EXISTS issuances (
      id TEXT PRIMARY KEY,
      credential_id TEXT, -- inner credential ID used for revocation
      credential_template_id TEXT NOT NULL,
      credential_template_name TEXT,
      holder_email TEXT,
      claims TEXT NOT NULL, -- JSON
      status TEXT NOT NULL DEFAULT 'offered',
      offer_uri TEXT,
      offer_qr_uri TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL, -- JSON
      processed INTEGER NOT NULL DEFAULT 0,
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS presentation_requests (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      template_name TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      authorization_request_uri TEXT,
      authorization_request_qr_uri TEXT,
      verified_attributes TEXT, -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ── Issuances ─────────────────────────────────────────────────────────────────

export function saveIssuance(row: {
  id: string;
  credentialId?: string;
  credentialTemplateId: string;
  credentialTemplateName?: string;
  holderEmail?: string;
  claims: Record<string, string>;
  status: string;
  offerUri?: string;
  offerQrUri?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO issuances
      (id, credential_id, credential_template_id, credential_template_name, holder_email, claims, status, offer_uri, offer_qr_uri, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    row.id,
    row.credentialId ?? null,
    row.credentialTemplateId,
    row.credentialTemplateName ?? null,
    row.holderEmail ?? null,
    JSON.stringify(row.claims),
    row.status,
    row.offerUri ?? null,
    row.offerQrUri ?? null
  );
}

export function updateIssuanceStatus(id: string, status: string) {
  const db = getDb();
  db.prepare(
    "UPDATE issuances SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, id);
}

export function updateIssuanceHolderEmail(id: string, holderEmail: string) {
  const db = getDb();
  db.prepare(
    "UPDATE issuances SET holder_email = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(holderEmail, id);
}

export function updateIssuanceCredentialId(id: string, credentialId: string) {
  const db = getDb();
  db.prepare(
    "UPDATE issuances SET credential_id = ? WHERE id = ? AND credential_id IS NULL"
  ).run(credentialId, id);
}

export function getIssuances(): IssuanceRow[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM issuances ORDER BY created_at DESC").all() as RawIssuanceRow[]).map(
    parseIssuanceRow
  );
}

export function getIssuance(id: string): IssuanceRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM issuances WHERE id = ?").get(id) as RawIssuanceRow | undefined;
  return row ? parseIssuanceRow(row) : null;
}

// ── Talent Pool ───────────────────────────────────────────────────────────────

export function upsertTalentProfile(profile: {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO talent_profiles (id, first_name, last_name, email)
    VALUES (?, ?, ?, ?)
  `).run(profile.id, profile.firstName, profile.lastName, profile.email ?? null);
}

export function saveTalentCredential(cred: {
  id: string;
  profileId: string;
  credentialName: string;
  credentialType: string;
  attributes: Record<string, string>;
  presentationRequestId?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO talent_credentials
      (id, profile_id, credential_name, credential_type, attributes, presentation_request_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    cred.id,
    cred.profileId,
    cred.credentialName,
    cred.credentialType,
    JSON.stringify(cred.attributes),
    cred.presentationRequestId ?? null
  );
}

export function searchTalentPool(query: string): TalentProfile[] {
  const db = getDb();
  const q = `%${query}%`;
  const rows = db.prepare(`
    SELECT DISTINCT p.*
    FROM talent_profiles p
    LEFT JOIN talent_credentials c ON c.profile_id = p.id
    WHERE
      p.first_name LIKE ?
      OR p.last_name LIKE ?
      OR p.email LIKE ?
      OR c.credential_name LIKE ?
      OR c.credential_type LIKE ?
      OR c.attributes LIKE ?
    ORDER BY p.last_name, p.first_name
  `).all(q, q, q, q, q, q) as RawProfileRow[];

  return rows.map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    createdAt: p.created_at,
    credentials: getTalentCredentials(p.id),
  }));
}

export function getAllTalentProfiles(): TalentProfile[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM talent_profiles ORDER BY last_name, first_name")
    .all() as RawProfileRow[];
  return rows.map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    createdAt: p.created_at,
    credentials: getTalentCredentials(p.id),
  }));
}

export function getTalentCredentials(profileId: string): TalentCredential[] {
  const db = getDb();
  return (
    db
      .prepare(
        "SELECT * FROM talent_credentials WHERE profile_id = ? ORDER BY verified_at DESC"
      )
      .all(profileId) as RawCredentialRow[]
  ).map((c) => ({
    id: c.id,
    profileId: c.profile_id,
    credentialName: c.credential_name,
    credentialType: c.credential_type,
    attributes: JSON.parse(c.attributes) as Record<string, string>,
    verifiedAt: c.verified_at,
    presentationRequestId: c.presentation_request_id,
  }));
}

// ── Webhook Events ────────────────────────────────────────────────────────────

export function saveWebhookEvent(event: {
  id: string;
  eventType: string;
  payload: unknown;
}) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO webhook_events (id, event_type, payload)
    VALUES (?, ?, ?)
  `).run(event.id, event.eventType, JSON.stringify(event.payload));
}

export function markWebhookProcessed(id: string) {
  const db = getDb();
  db.prepare("UPDATE webhook_events SET processed = 1 WHERE id = ?").run(id);
}

export function isWebhookProcessed(id: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT processed FROM webhook_events WHERE id = ?").get(id) as
    | { processed: number }
    | undefined;
  return !!row?.processed;
}

// ── Presentation Requests ─────────────────────────────────────────────────────

export function savePresentationRequest(req: {
  id: string;
  templateId: string;
  templateName?: string;
  status: string;
  authorizationRequestUri?: string;
  authorizationRequestQrUri?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO presentation_requests
      (id, template_id, template_name, status, authorization_request_uri, authorization_request_qr_uri, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    req.id,
    req.templateId,
    req.templateName ?? null,
    req.status,
    req.authorizationRequestUri ?? null,
    req.authorizationRequestQrUri ?? null
  );
}

export function updatePresentationRequestStatus(
  id: string,
  status: string,
  verifiedAttributes?: unknown
) {
  const db = getDb();
  db.prepare(`
    UPDATE presentation_requests
    SET status = ?, verified_attributes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, verifiedAttributes ? JSON.stringify(verifiedAttributes) : null, id);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RawIssuanceRow = {
  id: string;
  credential_id: string | null;
  credential_template_id: string;
  credential_template_name: string | null;
  holder_email: string | null;
  claims: string;
  status: string;
  offer_uri: string | null;
  offer_qr_uri: string | null;
  created_at: string;
  updated_at: string;
};

type RawProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  created_at: string;
};

type RawCredentialRow = {
  id: string;
  profile_id: string;
  credential_name: string;
  credential_type: string;
  attributes: string;
  verified_at: string;
  presentation_request_id: string | null;
};

function parseIssuanceRow(r: RawIssuanceRow): IssuanceRow {
  return {
    id: r.id,
    credentialId: r.credential_id ?? undefined,
    credentialTemplateId: r.credential_template_id,
    credentialTemplateName: r.credential_template_name ?? undefined,
    holderEmail: r.holder_email ?? undefined,
    claims: JSON.parse(r.claims) as Record<string, string>,
    status: r.status,
    offerUri: r.offer_uri ?? undefined,
    offerQrUri: r.offer_qr_uri ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type IssuanceRow = {
  id: string;
  credentialId?: string;
  credentialTemplateId: string;
  credentialTemplateName?: string;
  holderEmail?: string;
  claims: Record<string, string>;
  status: string;
  offerUri?: string;
  offerQrUri?: string;
  createdAt: string;
  updatedAt: string;
};

export type TalentProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  createdAt: string;
  credentials: TalentCredential[];
};

export type TalentCredential = {
  id: string;
  profileId: string;
  credentialName: string;
  credentialType: string;
  attributes: Record<string, string>;
  verifiedAt: string;
  presentationRequestId: string | null;
};
