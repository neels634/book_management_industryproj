import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Library,
  ReceiptText,
  Settings,
  Tags,
  Users,
} from 'lucide-react';
import { ROLES } from '../utils/constants';

const { ADMIN, LIBRARIAN, MEMBER } = ROLES;

export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ADMIN, LIBRARIAN, MEMBER] }],
  },
  {
    label: 'Circulation',
    items: [
      { to: '/circulation', label: 'Issue / Return', icon: ArrowLeftRight, roles: [ADMIN, LIBRARIAN] },
      { to: '/transactions', label: 'Transactions', icon: ReceiptText, roles: [ADMIN, LIBRARIAN] },
      { to: '/transactions', label: 'My loans', icon: ReceiptText, roles: [MEMBER] },
    ],
  },
  {
    label: 'Collection',
    items: [
      { to: '/books', label: 'Books', icon: BookOpen, roles: [ADMIN, LIBRARIAN] },
      { to: '/books', label: 'Catalogue', icon: Library, roles: [MEMBER] },
      { to: '/categories', label: 'Categories', icon: Tags, roles: [ADMIN, LIBRARIAN] },
      { to: '/members', label: 'Members', icon: Users, roles: [ADMIN, LIBRARIAN] },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, roles: [ADMIN, LIBRARIAN] },
      { to: '/settings', label: 'Settings', icon: Settings, roles: [ADMIN, LIBRARIAN, MEMBER] },
    ],
  },
];

export function navFor(role) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
