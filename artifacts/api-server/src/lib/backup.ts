import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import { pool } from "@workspace/db";
import { promisify } from "util";
import { gzip, gunzip } from "zlib";
import { logger } from "./logger";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const BACKUP_PREFIX = (process.env.DATABASE_BACKUP_PREFIX ?? "backups/database").replace(/\/$/, "");
const DEFAULT_MAX_BACKUPS = 120; // 6-hourly backups for roughly 30 days.
const DEFAULT_INTERVAL_HOURS = 6;

type BackupTable = {
  schema: string;
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type LogicalDatabaseBackup = {
  format: "aido.logical-db.v1";
  createdAt: string;
  reason: string;
  database: string | null;
  totalRows: number;
  tables: BackupTable[];
};

export type BackupSummary = {
  key: string;
  createdAt: string | null;
  reason: string | null;
  totalRows: number | null;
  size: number;
  lastModified: string | null;
};

function getBackupConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BACKUP_BUCKET_NAME || process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function assertBackupsConfigured() {
  const config = getBackupConfig();
  if (!config) {
    throw new Error(
      "Database backups are not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME or R2_BACKUP_BUCKET_NAME.",
    );
  }
  return config;
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function tableKey(table: Pick<BackupTable, "schema" | "name">) {
  return `${table.schema}.${table.name}`;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function listPublicTables() {
  const { rows } = await pool.query<{ table_schema: string; table_name: string }>(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);
  return rows.map((row: { table_schema: string; table_name: string }) => ({
    schema: row.table_schema,
    name: row.table_name,
  }));
}

async function createLogicalBackup(reason: string): Promise<LogicalDatabaseBackup> {
  const tables = await listPublicTables();
  const backupTables: BackupTable[] = [];
  let totalRows = 0;

  for (const table of tables) {
    const query = `SELECT * FROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
    const result = await pool.query<Record<string, unknown>>(query);
    const columns = result.fields.map((field: { name: string }) => field.name);
    backupTables.push({
      ...table,
      columns,
      rows: result.rows,
    });
    totalRows += result.rows.length;
  }

  let database: string | null = null;
  try {
    const current = await pool.query<{ current_database: string }>("SELECT current_database()");
    database = current.rows[0]?.current_database ?? null;
  } catch {
    database = null;
  }

  return {
    format: "aido.logical-db.v1",
    createdAt: new Date().toISOString(),
    reason,
    database,
    totalRows,
    tables: backupTables,
  };
}

function backupKey(createdAt: string, reason: string) {
  const safeTimestamp = createdAt.replace(/[:.]/g, "-");
  const safeReason = reason.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "backup";
  return `${BACKUP_PREFIX}/backup-${safeTimestamp}-${safeReason}.json.gz`;
}

function parseSummary(obj: _Object): BackupSummary | null {
  if (!obj.Key || !obj.Key.endsWith(".json.gz")) return null;
  return {
    key: obj.Key,
    createdAt: null,
    reason: null,
    totalRows: null,
    size: obj.Size ?? 0,
    lastModified: obj.LastModified?.toISOString() ?? null,
  };
}

export async function listDatabaseBackups(): Promise<BackupSummary[]> {
  const { client, bucket } = assertBackupsConfigured();
  const summaries: BackupSummary[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${BACKUP_PREFIX}/`,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of response.Contents ?? []) {
      const summary = parseSummary(obj);
      if (summary) summaries.push(summary);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return summaries.sort((a, b) => {
    const at = a.lastModified ? Date.parse(a.lastModified) : 0;
    const bt = b.lastModified ? Date.parse(b.lastModified) : 0;
    return bt - at;
  });
}

async function cleanupOldBackups(latestTotalRows: number) {
  if (latestTotalRows === 0) {
    logger.warn("Skipping backup cleanup because latest backup is empty");
    return;
  }

  const maxBackups = parsePositiveInt(process.env.DATABASE_BACKUP_MAX_BACKUPS, DEFAULT_MAX_BACKUPS);
  const backups = await listDatabaseBackups();
  if (backups.length <= maxBackups) return;

  const { client, bucket } = assertBackupsConfigured();
  for (const backup of backups.slice(maxBackups)) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: backup.key }));
    logger.info({ key: backup.key }, "Deleted old database backup");
  }
}

export async function backupDatabase(options: { reason?: string } = {}) {
  const { client, bucket } = assertBackupsConfigured();
  const reason = options.reason ?? "scheduled";
  const backup = await createLogicalBackup(reason);
  const body = await gzipAsync(Buffer.from(JSON.stringify(backup), "utf8"));
  const key = backupKey(backup.createdAt, reason);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
      Metadata: {
        "backup-format": backup.format,
        "backup-date": backup.createdAt,
        "backup-reason": reason,
        "total-rows": String(backup.totalRows),
        "table-count": String(backup.tables.length),
      },
    }),
  );

  await cleanupOldBackups(backup.totalRows);

  logger.info(
    { key, size: body.length, totalRows: backup.totalRows, tables: backup.tables.length, reason },
    "Database backup uploaded to R2",
  );

  return {
    success: true,
    key,
    size: body.length,
    createdAt: backup.createdAt,
    totalRows: backup.totalRows,
    tables: backup.tables.length,
  };
}

export async function downloadDatabaseBackup(key: string): Promise<LogicalDatabaseBackup> {
  if (!key.startsWith(`${BACKUP_PREFIX}/`) || !key.endsWith(".json.gz")) {
    throw new Error("Invalid backup key");
  }
  const { client, bucket } = assertBackupsConfigured();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const compressed = await streamToBuffer(response.Body);
  const json = (await gunzipAsync(compressed)).toString("utf8");
  const parsed = JSON.parse(json) as LogicalDatabaseBackup;
  if (parsed.format !== "aido.logical-db.v1" || !Array.isArray(parsed.tables)) {
    throw new Error("Unsupported backup format");
  }
  return parsed;
}

async function restoreOrder(backup: LogicalDatabaseBackup) {
  const tables = backup.tables;
  const included = new Set(tables.map(tableKey));
  const dependencies = new Map<string, Set<string>>();
  for (const table of tables) dependencies.set(tableKey(table), new Set());

  const { rows } = await pool.query<{
    table_schema: string;
    table_name: string;
    foreign_table_schema: string;
    foreign_table_name: string;
  }>(`
    SELECT
      tc.table_schema,
      tc.table_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `);

  for (const row of rows) {
    const child = `${row.table_schema}.${row.table_name}`;
    const parent = `${row.foreign_table_schema}.${row.foreign_table_name}`;
    if (included.has(child) && included.has(parent) && child !== parent) {
      dependencies.get(child)?.add(parent);
    }
  }

  const byKey = new Map(tables.map((table) => [tableKey(table), table]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: BackupTable[] = [];

  const visit = (key: string) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) return;
    visiting.add(key);
    for (const dependency of dependencies.get(key) ?? []) visit(dependency);
    visiting.delete(key);
    visited.add(key);
    const table = byKey.get(key);
    if (table) ordered.push(table);
  };

  for (const table of tables) visit(tableKey(table));
  return ordered;
}

async function resetSequences(client: Awaited<ReturnType<typeof pool.connect>>, tables: BackupTable[]) {
  for (const table of tables) {
    const { rows } = await client.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_default LIKE 'nextval(%'
      `,
      [table.schema, table.name],
    );
    for (const row of rows) {
      await client.query(
        `
          SELECT setval(
            pg_get_serial_sequence($1, $2),
            COALESCE((SELECT MAX(${quoteIdent(row.column_name)}) FROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)}), 1),
            (SELECT MAX(${quoteIdent(row.column_name)}) IS NOT NULL FROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)})
          )
        `,
        [`${table.schema}.${table.name}`, row.column_name],
      );
    }
  }
}

export async function restoreDatabaseBackup(key: string) {
  const backup = await downloadDatabaseBackup(key);
  const orderedTables = await restoreOrder(backup);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    if (backup.tables.length > 0) {
      const tableList = backup.tables
        .map((table) => `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`)
        .join(", ");
      await client.query(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);
    }

    let restoredRows = 0;
    for (const table of orderedTables) {
      if (table.rows.length === 0 || table.columns.length === 0) continue;
      const columnSql = table.columns.map(quoteIdent).join(", ");
      for (const row of table.rows) {
        const values = table.columns.map((column) => row[column] ?? null);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(
          `INSERT INTO ${quoteIdent(table.schema)}.${quoteIdent(table.name)} (${columnSql}) VALUES (${placeholders})`,
          values,
        );
        restoredRows += 1;
      }
    }

    await resetSequences(client, orderedTables);
    await client.query("COMMIT");

    logger.warn({ key, restoredRows, createdAt: backup.createdAt }, "Database restored from backup");
    return {
      success: true,
      key,
      backupCreatedAt: backup.createdAt,
      restoredRows,
      tables: backup.tables.length,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function scheduleBackups() {
  if (process.env.DATABASE_BACKUP_DISABLED === "true") {
    logger.info("Database backup scheduler disabled");
    return;
  }
  if (!getBackupConfig()) {
    logger.warn("Database backup scheduler not started because R2 backup credentials are missing");
    return;
  }

  const intervalHours = parsePositiveInt(process.env.DATABASE_BACKUP_INTERVAL_HOURS, DEFAULT_INTERVAL_HOURS);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  backupDatabase({ reason: "startup" }).catch((err) => logger.error({ err }, "Startup database backup failed"));
  setInterval(() => {
    backupDatabase({ reason: "scheduled" }).catch((err) => logger.error({ err }, "Scheduled database backup failed"));
  }, intervalMs);

  logger.info({ intervalHours }, "Database backup scheduler initialized");
}
