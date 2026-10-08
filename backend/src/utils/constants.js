const ROLES = Object.freeze({ ADMIN: 'ADMIN', LIBRARIAN: 'LIBRARIAN', MEMBER: 'MEMBER' });
const STAFF_ROLES = Object.freeze([ROLES.ADMIN, ROLES.LIBRARIAN]);

const USER_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
const BOOK_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
const CATEGORY_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });

const MEMBER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE', // may borrow
  SUSPENDED: 'SUSPENDED', // temporarily blocked from borrowing, can still return and log in
  INACTIVE: 'INACTIVE', // membership closed (soft-deleted)
});

const MEMBERSHIP_TYPES = Object.freeze(['STUDENT', 'FACULTY', 'PUBLIC', 'STAFF']);

const TXN_STATUS = Object.freeze({
  ISSUED: 'ISSUED',
  RETURNED: 'RETURNED',
  LOST: 'LOST',
  // Not stored: derived when status is ISSUED and dueDate has passed.
  OVERDUE: 'OVERDUE',
});

const FINE_STATUS = Object.freeze({ NONE: 'NONE', PENDING: 'PENDING', PAID: 'PAID', WAIVED: 'WAIVED' });

const RETURN_CONDITION = Object.freeze({ GOOD: 'GOOD', DAMAGED: 'DAMAGED' });

const COPY_ACTIONS = Object.freeze({
  ADD: 'ADD', // new copies acquired
  MARK_DAMAGED: 'MARK_DAMAGED', // available -> damaged
  REPAIR: 'REPAIR', // damaged -> available
  WRITE_OFF_DAMAGED: 'WRITE_OFF_DAMAGED', // damaged -> removed from stock
  FOUND: 'FOUND', // lost -> available
  WRITE_OFF_LOST: 'WRITE_OFF_LOST', // lost -> removed from stock
});

module.exports = {
  ROLES,
  STAFF_ROLES,
  USER_STATUS,
  BOOK_STATUS,
  CATEGORY_STATUS,
  MEMBER_STATUS,
  MEMBERSHIP_TYPES,
  TXN_STATUS,
  FINE_STATUS,
  RETURN_CONDITION,
  COPY_ACTIONS,
};
