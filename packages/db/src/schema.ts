import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { ROLES, TASK_STATES } from '@siteflow/shared';

export const roleEnum = pgEnum('role', ROLES);
export const taskStateEnum = pgEnum('task_state', TASK_STATES);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('APARTMENT'),
  address: text('address'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  geofenceRadiusM: integer('geofence_radius_m').notNull().default(150),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('sites_org_idx').on(t.orgId),
}));

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Field roles use phone, desk roles use email. One of them must be set.
  phone: text('phone'),
  email: text('email'),
  role: roleEnum('role').notNull(),
  // Optional site scope; null = org-wide (e.g. CEO, Accounts).
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  active: boolean('active').notNull().default(true),
  joiningDate: timestamp('joining_date', { withTimezone: true }),
  salaryMonthly: integer('salary_monthly'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  phoneIdx: uniqueIndex('users_phone_idx').on(t.phone),
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
}));

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  trade: text('trade').notNull(),
  location: text('location').notNull(),
  state: taskStateEnum('state').notNull().default('DRAFT'),
  assigneeUserId: uuid('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  plannedStart: timestamp('planned_start', { withTimezone: true }),
  plannedEnd: timestamp('planned_end', { withTimezone: true }),
  actualStart: timestamp('actual_start', { withTimezone: true }),
  actualEnd: timestamp('actual_end', { withTimezone: true }),
  sopProtocolId: uuid('sop_protocol_id'),
  qualitySampled: boolean('quality_sampled').notNull().default(true),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  siteIdx: index('tasks_site_idx').on(t.siteId),
  assigneeIdx: index('tasks_assignee_idx').on(t.assigneeUserId),
  stateIdx: index('tasks_state_idx').on(t.state),
}));

export const proofArtifacts = pgTable('proof_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  capturedByUserId: uuid('captured_by_user_id').notNull().references(() => users.id),
  s3Key: text('s3_key').notNull(),
  mimeType: text('mime_type').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  deviceId: text('device_id').notNull(),
  insideGeofence: boolean('inside_geofence').notNull(),
  geofenceDistanceM: integer('geofence_distance_m').notNull(),
  // SHA-256 of bytes for tamper-evidence (filled by finalize after head)
  sha256: text('sha256'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  taskIdx: index('proofs_task_idx').on(t.taskId),
}));

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  byUserId: uuid('by_user_id').notNull().references(() => users.id),
  byRole: roleEnum('by_role').notNull(),
  decision: text('decision', { enum: ['APPROVE', 'REJECT'] }).notNull(),
  reason: text('reason'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  taskIdx: index('approvals_task_idx').on(t.taskId),
}));

/**
 * Append-only audit log. Every state-changing operation writes here.
 * Never UPDATE or DELETE rows in this table — that is the whole point.
 */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorRole: roleEnum('actor_role'),
  eventType: text('event_type').notNull(),
  fromState: taskStateEnum('from_state'),
  toState: taskStateEnum('to_state'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  taskIdx: index('audit_task_idx').on(t.taskId),
  createdIdx: index('audit_created_idx').on(t.createdAt),
}));

export const timesheetEntries = pgTable('timesheet_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  kind: text('kind', { enum: ['ENTRY', 'LUNCH_OUT', 'LUNCH_IN', 'EXIT'] }).notNull(),
  selfieS3Key: text('selfie_s3_key'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  insideGeofence: boolean('inside_geofence').notNull(),
  punchedAt: timestamp('punched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDayIdx: index('timesheet_user_idx').on(t.userId, t.punchedAt),
}));

// Per-task work segments. Opens when the employee starts (or restarts after rework / block)
// and closes when they submit proof or the task is blocked. activityType separates productive
// work from waste so the Accounts ROI report can isolate procurement and quality penalties.
export const taskTimeSegments = pgTable('task_time_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  activityType: text('activity_type', { enum: ['WORK', 'REWORK', 'BLOCKED'] }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  hourlyRateAtTime: integer('hourly_rate_at_time'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('tts_user_idx').on(t.userId, t.startedAt),
  taskIdx: index('tts_task_idx').on(t.taskId),
  openIdx: index('tts_open_idx').on(t.userId, t.endedAt),
}));

// Standard Operating Procedure templates, scoped per org and trade.
export const sopProtocols = pgTable('sop_protocols', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  trade: text('trade').notNull(),
  title: text('title').notNull(),
  version: text('version').notNull().default('v1'),
  instructions: text('instructions').notNull(),
  // jsonb array of QualityTestKind strings
  requiredTests: jsonb('required_tests').notNull().default([]),
  sampleRatePerN: integer('sample_rate_per_n').notNull().default(3),
  refMediaS3Key: text('ref_media_s3_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgTradeIdx: index('sop_org_trade_idx').on(t.orgId, t.trade),
}));

export const qualityTests = pgTable('quality_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  sopProtocolId: uuid('sop_protocol_id').references(() => sopProtocols.id, { onDelete: 'set null' }),
  byUserId: uuid('by_user_id').notNull().references(() => users.id),
  kind: text('kind').notNull(),
  result: text('result', { enum: ['PASS', 'FAIL'] }).notNull(),
  measurement: text('measurement'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  taskIdx: index('quality_tests_task_idx').on(t.taskId),
}));

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  clientName: text('client_name').notNull(),
  totalValue: integer('total_value').notNull(),
  currency: text('currency').notNull().default('INR'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  siteIdx: uniqueIndex('contracts_site_idx').on(t.siteId),
}));

export const costRates = pgTable('cost_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(),
  hourlyRate: integer('hourly_rate').notNull(),
  currency: text('currency').notNull().default('INR'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgRoleIdx: uniqueIndex('cost_rates_org_role_idx').on(t.orgId, t.role),
}));

// In-app notifications. WhatsApp delivery is logged separately in whatsappOutbox.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('notifications_user_idx').on(t.userId, t.createdAt),
}));

// WhatsApp delivery queue. Provider integration is stubbed — rows record what
// WOULD be sent. Swap status to SENT/FAILED when wired to Meta or Twilio.
export const whatsappOutbox = pgTable('whatsapp_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  toUserId: uuid('to_user_id').references(() => users.id, { onDelete: 'set null' }),
  toPhone: text('to_phone').notNull(),
  template: text('template').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['QUEUED', 'SENT', 'FAILED'] }).notNull().default('QUEUED'),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (t) => ({
  orgIdx: index('whatsapp_org_idx').on(t.orgId, t.createdAt),
}));

// Per-tenant branding + defaults. One row per organization.
export const orgSettings = pgTable('org_settings', {
  orgId: uuid('org_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  logoS3Key: text('logo_s3_key'),
  accentColor: text('accent_color').notNull().default('#F59E0B'), // amber-500
  currency: text('currency').notNull().default('INR'),
  primaryCity: text('primary_city'),
  defaultGeofenceRadiusM: integer('default_geofence_radius_m').notNull().default(50),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  taskCap: integer('task_cap').notNull().default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// One-time codes for phone-OTP login + signup. Rows are short-lived (consumed or expired).
export const otpChallenges = pgTable('otp_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  purpose: text('purpose', { enum: ['LOGIN', 'SIGNUP'] }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  phoneIdx: index('otp_phone_idx').on(t.phone, t.createdAt),
}));
