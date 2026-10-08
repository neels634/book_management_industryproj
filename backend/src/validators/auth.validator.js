const { z, objectId, password, username } = require('./common');
const { ROLES, USER_STATUS } = require('../utils/constants');

const login = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Username is required').max(30),
  password: z.string().min(1, 'Password is required').max(72),
});

const register = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  username,
  password,
  role: z.enum(Object.values(ROLES)).default(ROLES.LIBRARIAN),
  member: objectId.optional(),
});

const changePassword = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

const updateUser = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(Object.values(ROLES)).optional(),
    status: z.enum(Object.values(USER_STATUS)).optional(),
    password: password.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const listUsers = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  status: z.enum(Object.values(USER_STATUS)).optional(),
});

module.exports = { login, register, changePassword, updateUser, listUsers };
