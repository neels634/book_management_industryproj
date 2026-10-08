import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { navFor } from './navigation';
import { ROLE_LABELS } from '../utils/constants';
import { initials } from '../utils/format';
import Logo from '../components/Logo';

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const sections = navFor(user.role);
  // Start the next session on a clean login page, not on the previous user's screen.
  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full flex-col bg-ink-900 text-ink-100">
      <div className="flex h-16 items-center gap-3 px-5">
        <Logo />
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-none text-white">Folio</p>
          <p className="mt-1 truncate text-[11px] text-ink-300">{settings.libraryName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={`${item.to}-${item.label}`}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive ? 'bg-ink-800 text-white' : 'text-ink-200 hover:bg-ink-800/60 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-brass-300" aria-hidden />}
                        <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-brass-300' : 'text-ink-400 group-hover:text-ink-200'}`} aria-hidden />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass-300 text-sm font-semibold text-ink-950">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-ink-300">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg p-2 text-ink-300 hover:bg-ink-800 hover:text-white"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
