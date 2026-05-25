import { z } from 'zod';
import { ROLES } from './roles';

export const LoginRequest = z.object({
  phoneOrEmail: z.string().min(3),
  // Dev-only: in prod this will be OTP/SSO. For now any non-empty code passes.
  devCode: z.string().min(1).default('000000'),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const JwtClaims = z.object({
  sub: z.string().uuid(),
  name: z.string(),
  role: z.enum(ROLES),
  siteId: z.string().uuid().nullable(),
  orgId: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
});
export type JwtClaims = z.infer<typeof JwtClaims>;

export const CreateTask = z.object({
  siteId: z.string().uuid(),
  title: z.string().min(2),
  trade: z.string().min(2),
  location: z.string().min(1), // human-readable e.g. "B2-F7-Bath 2"
  assigneeUserId: z.string().uuid().nullable(),
  plannedStart: z.string().datetime().nullable(),
  plannedEnd: z.string().datetime().nullable(),
  sopProtocolId: z.string().uuid().nullable(),
});
export type CreateTask = z.infer<typeof CreateTask>;

export const PresignProofRequest = z.object({
  taskId: z.string().uuid(),
  mimeType: z.string().regex(/^image\/(jpeg|png|webp)$/),
  capturedAt: z.string().datetime(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  deviceId: z.string().min(1),
});
export type PresignProofRequest = z.infer<typeof PresignProofRequest>;

export const FinalizeProofRequest = z.object({
  taskId: z.string().uuid(),
  s3Key: z.string().min(1),
  mimeType: z.string(),
  capturedAt: z.string().datetime(),
  lat: z.number(),
  lng: z.number(),
  deviceId: z.string().min(1),
  note: z.string().max(500).optional(),
});
export type FinalizeProofRequest = z.infer<typeof FinalizeProofRequest>;

export const ApproveRequest = z.object({
  taskId: z.string().uuid(),
  note: z.string().max(500).optional(),
});
export type ApproveRequest = z.infer<typeof ApproveRequest>;

export const RejectRequest = z.object({
  taskId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});
export type RejectRequest = z.infer<typeof RejectRequest>;

export const PUNCH_KINDS = ['ENTRY', 'LUNCH_OUT', 'LUNCH_IN', 'EXIT'] as const;
export type PunchKind = (typeof PUNCH_KINDS)[number];

export const PunchRequest = z.object({
  kind: z.enum(PUNCH_KINDS),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  selfieS3Key: z.string().min(1).nullable(),
  capturedAt: z.string().datetime().optional(),
});
export type PunchRequest = z.infer<typeof PunchRequest>;

export const PresignSelfieRequest = z.object({
  mimeType: z.string().regex(/^image\/(jpeg|png|webp)$/),
});
export type PresignSelfieRequest = z.infer<typeof PresignSelfieRequest>;

export const AssignTaskRequest = z.object({
  assigneeUserId: z.string().uuid().nullable(),
});
export type AssignTaskRequest = z.infer<typeof AssignTaskRequest>;

export const QUALITY_TEST_KINDS = [
  'VISUAL',
  'MARBLE_LEVEL',
  'PAINT_SCRATCH',
  'BLUE_LIGHT_FLATNESS',
  'TILE_HOLLOW_TAP',
  'PLUMB_LINE',
] as const;
export type QualityTestKind = (typeof QUALITY_TEST_KINDS)[number];

export const CreateSopProtocol = z.object({
  trade: z.string().min(2),
  title: z.string().min(2),
  version: z.string().min(1).default('v1'),
  instructions: z.string().min(5),
  requiredTests: z.array(z.enum(QUALITY_TEST_KINDS)).default([]),
  sampleRatePerN: z.number().int().min(1).max(50).default(3),
  refMediaS3Key: z.string().nullable().default(null),
});
export type CreateSopProtocol = z.infer<typeof CreateSopProtocol>;

export const RecordQualityTest = z.object({
  taskId: z.string().uuid(),
  kind: z.enum(QUALITY_TEST_KINDS),
  result: z.enum(['PASS', 'FAIL']),
  measurement: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
});
export type RecordQualityTest = z.infer<typeof RecordQualityTest>;

export const CURRENCIES = ['INR', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CreateContract = z.object({
  siteId: z.string().uuid(),
  clientName: z.string().min(2),
  totalValue: z.number().int().nonnegative(),
  currency: z.enum(CURRENCIES).default('INR'),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
});
export type CreateContract = z.infer<typeof CreateContract>;

export const SetCostRate = z.object({
  role: z.enum(ROLES),
  hourlyRate: z.number().int().nonnegative(),
  currency: z.enum(CURRENCIES).default('INR'),
});
export type SetCostRate = z.infer<typeof SetCostRate>;

// ---------- M4: Sites · Employees · Notifications · WhatsApp ----------

export const SITE_KINDS = ['APARTMENT', 'VILLA', 'OFFICE', 'OTHER'] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const CreateSite = z.object({
  name: z.string().min(2),
  kind: z.enum(SITE_KINDS).default('APARTMENT'),
  address: z.string().min(2).nullable().default(null),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geofenceRadiusM: z.number().int().min(20).max(2000).default(150),
});
export type CreateSite = z.infer<typeof CreateSite>;

export const CreateEmployee = z.object({
  name: z.string().min(2),
  role: z.enum(ROLES),
  phone: z.string().min(7).max(20).nullable(),
  email: z.string().email().nullable(),
  siteId: z.string().uuid().nullable(),
  joiningDate: z.string().datetime().nullable(),
  salaryMonthly: z.number().int().nonnegative().nullable(),
}).refine((d) => !!d.phone || !!d.email, { message: 'phone or email required' });
export type CreateEmployee = z.infer<typeof CreateEmployee>;

export const NOTIFICATION_KINDS = [
  'TASK_ASSIGNED',
  'TASK_ACCEPTED',
  'PROOF_SUBMITTED',
  'APPROVAL_PENDING',
  'TASK_REJECTED',
  'TASK_APPROVED',
  'WELCOME',
  'CRITICAL_FAILURE',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const ACTIVITY_TYPES = ['WORK', 'REWORK', 'BLOCKED'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const AcceptTaskRequest = z.object({
  // Empty body — accept is from caller.
}).default({});
export type AcceptTaskRequest = z.infer<typeof AcceptTaskRequest>;

// ---------- Onboarding / OTP / Org settings ----------

const phoneSchema = z.string().regex(/^\+?[0-9]{8,15}$/, 'invalid phone');

export const OtpRequest = z.object({
  phone: phoneSchema,
  purpose: z.enum(['LOGIN', 'SIGNUP']),
});
export type OtpRequest = z.infer<typeof OtpRequest>;

export const OtpVerify = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^[0-9]{4,8}$/),
  purpose: z.enum(['LOGIN', 'SIGNUP']),
});
export type OtpVerify = z.infer<typeof OtpVerify>;

export const OrgSignupRequest = z.object({
  // Caller must have just verified an OTP for this phone with purpose=SIGNUP.
  phone: phoneSchema,
  signupToken: z.string().min(20), // returned by /auth/otp/verify when purpose=SIGNUP
  founderName: z.string().min(2),
  email: z.string().email().optional(),
  companyName: z.string().min(2),
  primaryCity: z.string().min(2).optional(),
  currency: z.string().length(3).default('INR'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#F59E0B'),
});
export type OrgSignupRequest = z.infer<typeof OrgSignupRequest>;

export const UpdateOrgSettings = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  primaryCity: z.string().min(2).optional(),
  currency: z.string().length(3).optional(),
  defaultGeofenceRadiusM: z.number().int().min(10).max(2000).optional(),
});
export type UpdateOrgSettings = z.infer<typeof UpdateOrgSettings>;
