export const ROLES = [
  'worker',
  'supervisor',
  'quality',
  'manager',
  'accounts',
  'ceo',
  'client',
] as const;

export type Role = (typeof ROLES)[number];

export const FIELD_ROLES: ReadonlySet<Role> = new Set(['worker', 'supervisor']);
export const DESK_ROLES: ReadonlySet<Role> = new Set([
  'quality',
  'manager',
  'accounts',
  'ceo',
  'client',
]);

export const APPROVAL_CHAIN: readonly Role[] = [
  'supervisor',
  'quality',
  'manager',
  'client',
];
