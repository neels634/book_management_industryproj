export const ROLES = { ADMIN: 'ADMIN', LIBRARIAN: 'LIBRARIAN', MEMBER: 'MEMBER' };
export const STAFF = [ROLES.ADMIN, ROLES.LIBRARIAN];
export const ALL_ROLES = Object.values(ROLES);

export const ROLE_LABELS = { ADMIN: 'Administrator', LIBRARIAN: 'Librarian', MEMBER: 'Member' };

export const MEMBERSHIP_TYPES = ['STUDENT', 'FACULTY', 'PUBLIC', 'STAFF'];

/** Label + badge tone for every status the API can return. */
export const STATUS_META = {
  ACTIVE: { label: 'Active', tone: 'green' },
  INACTIVE: { label: 'Inactive', tone: 'stone' },
  SUSPENDED: { label: 'Suspended', tone: 'amber' },
  ISSUED: { label: 'On loan', tone: 'blue' },
  OVERDUE: { label: 'Overdue', tone: 'red' },
  RETURNED: { label: 'Returned', tone: 'green' },
  LOST: { label: 'Lost', tone: 'red' },
  NONE: { label: 'No fine', tone: 'stone' },
  PENDING: { label: 'Fine due', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'green' },
  WAIVED: { label: 'Waived', tone: 'stone' },
  GOOD: { label: 'Good', tone: 'green' },
  DAMAGED: { label: 'Damaged', tone: 'amber' },
};

export const TXN_STATUS_OPTIONS = [
  { value: 'ISSUED', label: 'On loan' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'LOST', label: 'Lost' },
];

export const FINE_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Fine due' },
  { value: 'PAID', label: 'Paid' },
  { value: 'WAIVED', label: 'Waived' },
  { value: 'NONE', label: 'No fine' },
];

export const COPY_ACTIONS = [
  { value: 'ADD', label: 'Add new copies', from: null },
  { value: 'MARK_DAMAGED', label: 'Mark copies damaged', from: 'availableCopies' },
  { value: 'REPAIR', label: 'Repaired - back on shelf', from: 'damagedCopies' },
  { value: 'WRITE_OFF_DAMAGED', label: 'Write off damaged copies', from: 'damagedCopies' },
  { value: 'FOUND', label: 'Lost copy found', from: 'lostCopies' },
  { value: 'WRITE_OFF_LOST', label: 'Write off lost copies', from: 'lostCopies' },
];
