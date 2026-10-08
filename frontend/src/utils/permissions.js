import { ROLES } from './constants';

/** UI-side permission map. The API enforces the same rules - this only hides controls. */
const PERMISSIONS = {
  'books:manage': [ROLES.ADMIN, ROLES.LIBRARIAN],
  'members:view': [ROLES.ADMIN, ROLES.LIBRARIAN],
  'members:manage': [ROLES.ADMIN, ROLES.LIBRARIAN],
  'categories:manage': [ROLES.ADMIN],
  'circulation:manage': [ROLES.ADMIN, ROLES.LIBRARIAN],
  'fines:collect': [ROLES.ADMIN, ROLES.LIBRARIAN],
  'fines:waive': [ROLES.ADMIN],
  'reports:view': [ROLES.ADMIN, ROLES.LIBRARIAN],
  'settings:manage': [ROLES.ADMIN],
  'users:manage': [ROLES.ADMIN],
};

export function can(user, permission) {
  if (!user) return false;
  return (PERMISSIONS[permission] || []).includes(user.role);
}
