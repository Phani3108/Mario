import type { Role } from './roles';

export const TASK_STATES = [
  'DRAFT',
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'PROOF_SUBMITTED',
  'SUPERVISOR_APPROVED',
  'QUALITY_APPROVED',
  'MANAGER_APPROVED',
  'CLIENT_ACKNOWLEDGED',
  'CLOSED',
  'REJECTED',
  'REWORK',
  'BLOCKED',
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export type TaskEvent =
  | { type: 'ASSIGN'; toUserId: string; by: string }
  | { type: 'ACCEPT'; by: string; at: Date }
  | { type: 'START'; by: string; at: Date; lat: number; lng: number }
  | { type: 'SUBMIT_PROOF'; by: string; proofArtifactId: string }
  | { type: 'APPROVE'; by: string; byRole: Role; note?: string }
  | { type: 'REJECT'; by: string; byRole: Role; reason: string }
  | { type: 'ACKNOWLEDGE'; by: string }
  | { type: 'BLOCK'; by: string; reason: string }
  | { type: 'UNBLOCK'; by: string };

/**
 * Pure transition function. Returns the next state or throws if illegal.
 * Keeping this pure means we can run it in-process today and swap the
 * driver to Temporal later without touching the rules.
 */
export function nextState(current: TaskState, event: TaskEvent): TaskState {
  switch (current) {
    case 'DRAFT':
      if (event.type === 'ASSIGN') return 'ASSIGNED';
      break;
    case 'ASSIGNED':
      if (event.type === 'ACCEPT') return 'ACCEPTED';
      if (event.type === 'BLOCK') return 'BLOCKED';
      break;
    case 'ACCEPTED':
      if (event.type === 'START') return 'IN_PROGRESS';
      if (event.type === 'BLOCK') return 'BLOCKED';
      break;
    case 'IN_PROGRESS':
      if (event.type === 'SUBMIT_PROOF') return 'PROOF_SUBMITTED';
      if (event.type === 'BLOCK') return 'BLOCKED';
      break;
    case 'PROOF_SUBMITTED':
      if (event.type === 'APPROVE' && event.byRole === 'supervisor') return 'SUPERVISOR_APPROVED';
      if (event.type === 'REJECT') return 'REWORK';
      break;
    case 'SUPERVISOR_APPROVED':
      if (event.type === 'APPROVE' && event.byRole === 'quality') return 'QUALITY_APPROVED';
      if (event.type === 'REJECT') return 'REWORK';
      break;
    case 'QUALITY_APPROVED':
      if (event.type === 'APPROVE' && event.byRole === 'manager') return 'MANAGER_APPROVED';
      if (event.type === 'REJECT') return 'REWORK';
      break;
    case 'MANAGER_APPROVED':
      if (event.type === 'ACKNOWLEDGE') return 'CLIENT_ACKNOWLEDGED';
      if (event.type === 'REJECT') return 'REWORK';
      break;
    case 'CLIENT_ACKNOWLEDGED':
      return 'CLOSED';
    case 'REWORK':
      if (event.type === 'START') return 'IN_PROGRESS';
      break;
    case 'BLOCKED':
      if (event.type === 'UNBLOCK') return 'IN_PROGRESS';
      break;
    case 'REJECTED':
    case 'CLOSED':
      break;
  }
  throw new Error(`Illegal transition: ${current} --${event.type}--> ?`);
}

/** Returns the role expected to act on a task in the given state, or null if terminal/waiting on worker. */
export function expectedApprover(state: TaskState): Role | null {
  switch (state) {
    case 'PROOF_SUBMITTED':
      return 'supervisor';
    case 'SUPERVISOR_APPROVED':
      return 'quality';
    case 'QUALITY_APPROVED':
      return 'manager';
    case 'MANAGER_APPROVED':
      return 'client';
    default:
      return null;
  }
}
