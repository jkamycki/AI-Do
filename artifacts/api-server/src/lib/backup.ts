import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "./logger";

const execAsync = promisify(exec);

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BACKUPS_BUCKET = process.env.R2_BUCKET_NAME || "aido-uploads";
const BACKUP_PREFIX = "backups/database";
const MAX_BACKUPS = 7; // Keep last 7 daily backups

export async function backupDatabase() {
  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const filename = `backup-${timestamp}.sql.gz`;
  const filepath = `/tmp/${filename}`;

  try {
    logger.info({ filename }, "Starting database backup");

    // Dump and compress database
    const dumpCommand = `pg_dump "${process.env.DATABASE_URL}" | gzip > "${filepath}"`;
    const { stdout, stderr } = await execAsync(dumpCommand);

    if (stderr && !stderr.includes("warning")) {
      logger.warn({ stderr }, "pg_dump warnings");
    }

    // Read the backup file
    const backupData = await readFile(filepath);

    // Upload to R2
    const key = `${BACKUP_PREFIX}/${filename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BACKUPS_BUCKET,
        Key: key,
        Body: backupData,
        ContentType: "application/gzip",
        Metadata: {
          "backup-date": new Date().toISOString(),
          "backup-type": "full-database",
        },
      })
    );

    logger.info({ key, size: backupData.length }, "Database backup uploaded to R2");

    // Clean up local file
    await unlink(filepath);

    // Clean up old backups (keep only last MAX_BACKUPS)
    await cleanupOldBackups();

    return { success: true, key, size: backupData.length };
  } catch (err) {
    logger.error({ err, filename }, "Database backup failed");
    throw err;
  }
}

async function cleanupOldBackups() {
  try {
    // List all backups
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BACKUPS_BUCKET,
        Prefix: BACKUP_PREFIX,
      })
    );

    if (!response.Contents || response.Contents.length <= MAX_BACKUPS) {
      return; // Not enough backups to clean up
    }

    // Sort by date (most recent first) and delete old ones
    const sorted = (response.Contents || [])
      .filter((obj) => obj.Key?.endsWith(".sql.gz"))
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

    const toDelete = sorted.slice(MAX_BACKUPS);

    for (const obj of toDelete) {
      if (!obj.Key) continue;
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BACKUPS_BUCKET,
          Key: obj.Key,
        })
      );
      logger.info({ key: obj.Key }, "Deleted old backup");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to cleanup old backups");
    // Don't fail the backup if cleanup fails
  }
}

// Run backup on schedule (daily at 2 AM UTC)
export function scheduleBackups() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(2, 0, 0, 0);

  const msUntilBackup = tomorrow.getTime() - now.getTime();

  setTimeout(() => {
    // Run backup immediately
    backupDatabase().catch((err) => logger.error({ err }, "Scheduled backup failed"));

    // Then schedule daily backups
    setInterval(() => {
      backupDatabase().catch((err) => logger.error({ err }, "Scheduled backup failed"));
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }, msUntilBackup);

  logger.info(
    { nextBackupAt: tomorrow.toISOString() },
    "Database backup scheduler initialized"
  );
}
