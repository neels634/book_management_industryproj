import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { TextField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Feedback';
import Logo from '../components/Logo';

// Seed-data accounts, shown only in development builds for quick demos.
const DEMO_ACCOUNTS = [
  { role: 'Admin', username: 'admin', password: 'Admin@1234' },
  { role: 'Librarian', username: 'librarian', password: 'Librarian@1234' },
  { role: 'Member', username: 'member', password: 'Member@1234' },
];

// Decorative shelf: spine widths / heights / colours.
const SPINES = [
  [14, 78, '#dfb262'], [10, 64, '#5f9282'], [18, 86, '#f5e8cc'], [12, 70, '#a26323'], [16, 92, '#335f52'],
  [11, 60, '#ebcf96'], [20, 80, '#8db5a7'], [13, 74, '#bf7f2b'], [15, 88, '#dce9e4'], [10, 66, '#824a21'],
  [17, 84, '#437766'], [12, 72, '#d4993d'], [19, 90, '#b9d3c9'], [11, 62, '#6b3d21'], [14, 76, '#f5e8cc'],
];

function Bookshelf() {
  return (
    <div aria-hidden className="space-y-6">
      {[0, 1, 2].map((row) => (
        <div key={row} className="border-b-[6px] border-ink-950/60">
          <div className="flex items-end gap-1">
            {SPINES.map((_, i) => {
              const k = (i + row * 5) % SPINES.length;
              return (
                <span
                  key={i}
                  className="rounded-t-[3px] opacity-90"
                  style={{
                    width: SPINES[k][0] * 1.4,
                    height: SPINES[k][1] * (row === 1 ? 0.9 : 1),
                    background: SPINES[k][2],
                    transform: k % 7 === 3 ? 'rotate(-6deg) translateY(2px)' : undefined,
                    transformOrigin: 'bottom left',
                  }}
                >
                  <span className="mx-auto mt-3 block h-1 w-1/2 rounded bg-black/15" />
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { login, isAuthenticated, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.username.trim()) next.username = 'Enter your username';
    if (!form.password) next.password = 'Enter your password';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setFormError('');
    try {
      await login({ username: form.username.trim(), password: form.password });
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="font-display text-2xl font-semibold text-white">Folio</span>
        </div>
        <div className="max-w-lg">
          <Bookshelf />
          <h1 className="mt-12 font-display text-4xl font-semibold leading-tight text-white">
            Every copy accounted for.
            <br />
            <span className="text-brass-300">Every reader served.</span>
          </h1>
          <p className="mt-4 text-ink-200">
            Catalogue, circulation, fines and reporting for your library: one desk for librarians, and a window for members to see their loans.
          </p>
        </div>
        <p className="text-xs text-ink-400">Library Management System</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10" />
            <span className="font-display text-2xl font-semibold">Folio</span>
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-stone-500">Use the account your library administrator gave you.</p>

          {(formError || sessionMessage) && (
            <Alert tone={formError ? 'error' : 'warning'} className="mt-6">
              {formError || sessionMessage}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <TextField
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={form.username}
              onChange={update('username')}
              error={errors.username}
            />
            <div className="relative">
              <TextField
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={update('password')}
                error={errors.password}
                inputClassName="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-[30px] rounded p-1.5 text-stone-400 hover:text-stone-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={submitting} icon={LogIn}>
              Sign in
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-xl border border-dashed border-stone-300 p-4">
              <p className="eyebrow">Demo accounts (seed data)</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => setForm({ username: acc.username, password: acc.password })}
                    className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs font-medium text-stone-700 hover:border-ink-400 hover:text-ink-800"
                  >
                    {acc.role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
