import { Pool } from "pg";
import dotenv from "dotenv";
import { authSchemaAuditTables, getAuthSchemaAuditConfig } from "@/lib/auth-schema-audit";

// CLI scripts do not receive Next.js' automatic .env loading. Keep this
// explicit so a deliberately confirmed read-only audit uses the same local
// configuration as the application without printing any credentials.
dotenv.config({ path: process.env.ENV_FILE?.trim() || ".env" });

type QueryableClient = {
  query: (query: string, values?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
};

async function collectAudit(client: QueryableClient) {
  const tables = [...authSchemaAuditTables];
  const columns = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name, ordinal_position`,
    [tables],
  );
  const indexes = await client.query(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = ANY($1::text[])
     ORDER BY tablename, indexname`,
    [tables],
  );
  const presentTables = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [tables],
  );
  const migrationLedger = await client.query(
    "SELECT to_regclass('public.\"_prisma_migrations\"') AS relation",
  );
  const hasMigrationLedger = migrationLedger.rows[0]?.relation !== null;
  const migrations = hasMigrationLedger
    ? await client.query(
      `SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
       FROM "_prisma_migrations"
       ORDER BY started_at`,
    )
    : { rows: [] as Record<string, unknown>[] };
  const available = new Set(presentTables.rows.map((row) => String(row.table_name)));
  const rowCounts: Record<string, string | null> = {};

  for (const table of tables) {
    if (!available.has(table)) {
      rowCounts[table] = null;
      continue;
    }
    const result = await client.query(`SELECT COUNT(*)::text AS count FROM "${table}"`);
    rowCounts[table] = String(result.rows[0]?.count ?? "0");
  }

  return {
    tablesPresent: [...available],
    columns: columns.rows,
    indexes: indexes.rows,
    migrationLedgerPresent: hasMigrationLedger,
    migrations: migrations.rows,
    rowCounts,
  };
}

async function main() {
  const config = getAuthSchemaAuditConfig();
  const pool = new Pool({
    connectionString: config.connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  let client: QueryableClient | undefined;

  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const audit = await collectAudit(client);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ environment: config.environment, ...audit }, null, 2));
  } finally {
    client?.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  const details = [
    typeof candidate.name === "string" ? candidate.name : "UnknownError",
    typeof candidate.code === "string" ? `code=${candidate.code}` : null,
    typeof candidate.message === "string" && candidate.message.trim() ? candidate.message.trim() : null,
  ].filter(Boolean).join(" ");
  const message = details || "Auth schema audit failed without a diagnostic message.";
  console.error(`Auth schema audit failed: ${message}`);
  process.exitCode = 1;
});
