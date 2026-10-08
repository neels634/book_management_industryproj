const { z, pagination, order, optionalText, date, blankToUndefined, password, username } = require('./common');
const { MEMBER_STATUS, MEMBERSHIP_TYPES } = require('../utils/constants');

const phone = z
  .string({ required_error: 'Phone is required' })
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,18}$/, 'Phone must be 7-19 digits, optionally starting with +');

const email = z.string().trim().toLowerCase().email('E-mail address is invalid').max(120);

const fields = {
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name is required').max(100),
  email: blankToUndefined(email),
  phone,
  address: optionalText(300),
  membershipType: z.enum(MEMBERSHIP_TYPES).optional(),
  membershipDate: date.optional(),
  membershipExpiry: blankToUndefined(date),
  borrowingLimit: z.coerce.number().int().min(1, 'Borrowing limit must be at least 1').max(50).optional(),
  notes: optionalText(500),
};

const membershipDatesInOrder = (v) => !v.membershipDate || !v.membershipExpiry || v.membershipExpiry > v.membershipDate;
const datesMessage = { message: 'Membership expiry must be after the membership date', path: ['membershipExpiry'] };

const createMember = z
  .object({
    ...fields,
    // Optional login account so the member can view their own loans and fines.
    login: z.object({ username, password }).optional(),
  })
  .refine(membershipDatesInOrder, datesMessage);

const updateMember = z
  .object({
    ...Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()])),
    // On update an empty string explicitly clears these optional fields.
    email: z.union([z.literal(''), email]).optional(),
    membershipExpiry: z.union([z.literal(''), z.null(), date]).optional(),
    membershipStatus: z.enum(Object.values(MEMBER_STATUS)).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const listMembers = z.object({
  ...pagination,
  q: z.string().trim().max(100).optional(),
  status: z.enum(Object.values(MEMBER_STATUS)).optional(),
  membershipType: z.enum(MEMBERSHIP_TYPES).optional(),
  hasLoans: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['name', 'memberId', 'membershipDate', 'currentBorrowedCount', 'createdAt']).optional(),
  order,
});

module.exports = { createMember, updateMember, listMembers };
