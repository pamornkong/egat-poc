import "server-only";
import { Pool } from "pg";
import { config } from "./config";

const shared = globalThis as typeof globalThis & { egatPool?: Pool; egatSchema?: Promise<void> };
export const db = shared.egatPool ??= new Pool({ connectionString: config.databaseUrl, max: 4, connectionTimeoutMillis: 5000 });

export async function ensureSchema() {
  shared.egatSchema ??= db.query(`
    CREATE TABLE IF NOT EXISTS poc_mfa_preferences (
      user_id text PRIMARY KEY, factor_id text NOT NULL, totp_factor_id text, updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE poc_mfa_preferences ADD COLUMN IF NOT EXISTS totp_factor_id text;
    CREATE TABLE IF NOT EXISTS poc_auth_evidence (
      id bigserial PRIMARY KEY, protocol text NOT NULL, account text NOT NULL,
      profile jsonb NOT NULL, proof_sha256 text NOT NULL, validation text NOT NULL,
      authenticated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS poc_auth_proof_unique ON poc_auth_evidence(protocol,proof_sha256);
  `).then(() => undefined).catch(error => { shared.egatSchema = undefined; throw error; });
  return shared.egatSchema;
}
