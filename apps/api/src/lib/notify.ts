import { getDb, notifications, whatsappOutbox, users } from '@siteflow/db';
import { eq } from 'drizzle-orm';
import type { NotificationKind } from '@siteflow/shared';
import { sendWhatsApp } from './msg91.js';

type NotifyInput = {
  userId: string;
  orgId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  taskId?: string | null;
  whatsapp?: boolean;
};

/**
 * Records an in-app notification and (optionally) ships a WhatsApp message
 * via MSG91. The outbox row is written first so we have an audit trail even
 * if the provider call fails; status flips to SENT / FAILED based on the result.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const db = getDb();
  await db.insert(notifications).values({
    orgId: input.orgId,
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    taskId: input.taskId ?? null,
  });

  if (!input.whatsapp) return;

  const [u] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, input.userId));
  if (!u?.phone) return;

  const [row] = await db.insert(whatsappOutbox).values({
    orgId: input.orgId,
    toUserId: input.userId,
    toPhone: u.phone,
    template: input.kind.toLowerCase(),
    body: `*${input.title}*\n${input.body}`,
    taskId: input.taskId ?? null,
  }).returning();

  try {
    await sendWhatsApp(u.phone, input.title, input.body);
    if (row) {
      await db.update(whatsappOutbox)
        .set({ status: 'SENT', sentAt: new Date() })
        .where(eq(whatsappOutbox.id, row.id));
    }
  } catch (err) {
    console.error('[whatsapp:send] failed', err);
    if (row) {
      await db.update(whatsappOutbox)
        .set({ status: 'FAILED' })
        .where(eq(whatsappOutbox.id, row.id));
    }
  }
}
