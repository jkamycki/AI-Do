import { db } from "@workspace/db";
import { checklistItems, weddingProfiles } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { FROM_EMAIL, sendEmail } from "./resend";
import { logger } from "./logger";

type ClerkEmailAddress = {
  id?: string;
  email_address?: string;
};

type ClerkUserResponse = {
  primary_email_address_id?: string;
  email_addresses?: ClerkEmailAddress[];
};

type ChecklistReminderRow = typeof checklistItems.$inferSelect;
type ReminderProfileRow = typeof weddingProfiles.$inferSelect;

const DEFAULT_PUBLIC_ORIGIN = "https://aidowedding.net";
const DAY_MS = 24 * 60 * 60 * 1000;

function publicOrigin(): string {
  return (process.env.FRONTEND_URL ?? process.env.PUBLIC_APP_URL ?? process.env.APP_ORIGIN ?? DEFAULT_PUBLIC_ORIGIN)
    .replace(/\/+$/, "");
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatDateKey(value: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

async function getPrimaryEmailForUser(userId: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey || !userId) return null;

  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!response.ok) {
      logger.warn({ status: response.status, userId }, "Task reminders: Clerk user lookup failed");
      return null;
    }
    const user = await response.json() as ClerkUserResponse;
    const email = user.email_addresses?.find(row => row.id === user.primary_email_address_id)?.email_address
      ?? user.email_addresses?.[0]?.email_address
      ?? null;
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  } catch (err) {
    logger.warn({ err, userId }, "Task reminders: Clerk user lookup error");
    return null;
  }
}

function buildReminderEmail(input: {
  coupleName: string;
  daysBefore: number;
  tasks: Array<{ task: string; dueDate: string; month: string }>;
}): { subject: string; text: string; html: string } {
  const origin = publicOrigin();
  const checklistUrl = `${origin}/checklist`;
  const taskLines = input.tasks
    .map(task => `- ${task.task} (${formatDateKey(task.dueDate)})`)
    .join("\n");
  const htmlItems = input.tasks
    .map(task => `
      <li style="margin:0 0 10px;">
        <strong>${escapeHtml(task.task)}</strong>
        <div style="color:#7c5564;font-size:13px;">Due ${escapeHtml(formatDateKey(task.dueDate))} · ${escapeHtml(task.month)}</div>
      </li>`)
    .join("");

  return {
    subject: "A.IDO reminder: checklist deadlines coming up",
    text: `Hi ${input.coupleName},

You asked A.IDO to remind you ${input.daysBefore} days before checklist deadlines.

These tasks are coming up:
${taskLines}

Open your checklist:
${checklistUrl}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#3a1826;font-size:15px;line-height:1.55;">
        <p>Hi ${escapeHtml(input.coupleName)},</p>
        <p>You asked A.IDO to remind you <strong>${input.daysBefore} days before</strong> checklist deadlines.</p>
        <div style="background:#fff7f9;border:1px solid #f2c9d4;border-radius:14px;padding:16px 18px;margin:18px 0;">
          <p style="margin:0 0 12px;font-weight:700;color:#8d294d;">Coming up</p>
          <ul style="margin:0;padding-left:18px;">${htmlItems}</ul>
        </div>
        <p>
          <a href="${escapeHtml(checklistUrl)}" style="display:inline-block;background:#9f2e5b;color:#ffffff;text-decoration:none;border-radius:999px;padding:11px 18px;font-weight:700;">
            Open checklist
          </a>
        </p>
      </div>`,
  };
}

export async function sendTaskDeadlineReminders(now = new Date()): Promise<{ sent: number; tasks: number }> {
  if (!process.env.RESEND_API_KEY) {
    logger.info("Task reminders skipped: RESEND_API_KEY is not configured");
    return { sent: 0, tasks: 0 };
  }
  if (!process.env.CLERK_SECRET_KEY) {
    logger.info("Task reminders skipped: CLERK_SECRET_KEY is not configured");
    return { sent: 0, tasks: 0 };
  }

  const profiles = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.taskEmailRemindersEnabled, true)) as ReminderProfileRow[];

  let sent = 0;
  let taskCount = 0;

  for (const profile of profiles) {
    const daysBefore = Number.isFinite(profile.taskReminderDaysBefore)
      ? Math.max(0, Math.min(60, profile.taskReminderDaysBefore))
      : 7;
    const cutoff = toDateKey(addDays(now, daysBefore));
    const tasks = await db
      .select()
      .from(checklistItems)
      .where(and(eq(checklistItems.profileId, profile.id), eq(checklistItems.isCompleted, false))) as ChecklistReminderRow[];

    const dueTasks = tasks
      .filter((task: ChecklistReminderRow) => task.dueDate && !task.reminderSentAt && task.dueDate <= cutoff)
      .sort((a: ChecklistReminderRow, b: ChecklistReminderRow) => String(a.dueDate).localeCompare(String(b.dueDate)));

    if (dueTasks.length === 0) continue;

    const to = await getPrimaryEmailForUser(profile.userId);
    if (!to) {
      logger.warn({ profileId: profile.id, userId: profile.userId }, "Task reminders: no primary email found");
      continue;
    }

    const coupleName = `${profile.partner1Name} & ${profile.partner2Name}`;
    const email = buildReminderEmail({
      coupleName,
      daysBefore,
      tasks: dueTasks.map((task: ChecklistReminderRow) => ({
        task: task.task,
        dueDate: task.dueDate!,
        month: task.month,
      })),
    });

    const result = await sendEmail({
      to,
      from: FROM_EMAIL,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (!result.ok) {
      logger.warn({ profileId: profile.id, error: result.error }, "Task reminder email failed");
      continue;
    }

    const sentAt = new Date();
    for (const task of dueTasks) {
      await db
        .update(checklistItems)
        .set({ reminderSentAt: sentAt })
        .where(and(eq(checklistItems.id, task.id), eq(checklistItems.profileId, profile.id)));
    }
    sent += 1;
    taskCount += dueTasks.length;
    logger.info({ profileId: profile.id, tasks: dueTasks.length }, "Task reminder email sent");
  }

  return { sent, tasks: taskCount };
}

export function scheduleTaskDeadlineReminders(): void {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.TASK_REMINDER_SCHEDULER_ENABLED === "false") {
    logger.info("Task reminder scheduler disabled");
    return;
  }

  const intervalMs = Math.max(60, Number(process.env.TASK_REMINDER_INTERVAL_MINUTES ?? 360)) * 60_000;

  const run = () => {
    sendTaskDeadlineReminders().catch(err => {
      logger.warn({ err }, "Task reminder scheduler failed");
    });
  };

  setTimeout(run, 30_000).unref();
  setInterval(run, intervalMs).unref();
  logger.info({ intervalMinutes: Math.round(intervalMs / 60_000) }, "Task reminder scheduler started");
}
