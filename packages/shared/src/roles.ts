export const ROLES = [
  'employee',
  'supervisor',
  'quality',
  'manager',
  'accounts',
  'ceo',
  'client',
] as const;

export type Role = (typeof ROLES)[number];

export const FIELD_ROLES: ReadonlySet<Role> = new Set(['employee', 'supervisor']);
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
