import { and, eq, isNull } from 'drizzle-orm';
import { getDb, taskTimeSegments, costRates, type Db } from '@siteflow/db';

type ActivityType = 'WORK' | 'REWORK' | 'BLOCKED';

async function hourlyRateFor(db: Db, orgId: string, role: string): Promise<number | null> {
  const [r] = await db.select({ rate: costRates.hourlyRate })
    .from(costRates)
    .where(and(eq(costRates.orgId, orgId), eq(costRates.role, role as any)));
  return r?.rate ?? null;
}

/** Close any open time segment for this user+task before opening a new one. */
export async function closeOpenSegment(userId: string, taskId: string) {
  const db = getDb();
  await db.update(taskTimeSegments)
    .set({ endedAt: new Date() })
    .where(and(
      eq(taskTimeSegments.userId, userId),
      eq(taskTimeSegments.taskId, taskId),
      isNull(taskTimeSegments.endedAt),
    ));
}

/** Open a segment tagged with the activity that's about to happen. */
export async function openSegment(args: {
  userId: string; taskId: string; siteId: string;
  activityType: ActivityType; orgId: string; userRole: string;
}) {
  const db = getDb();
  await closeOpenSegment(args.userId, args.taskId);
  const rate = await hourlyRateFor(db, args.orgId, args.userRole);
  await db.insert(taskTimeSegments).values({
    userId: args.userId, taskId: args.taskId, siteId: args.siteId,
    activityType: args.activityType, hourlyRateAtTime: rate ?? undefined,
  });
}
