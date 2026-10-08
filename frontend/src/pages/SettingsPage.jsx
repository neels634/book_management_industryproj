import { useState } from 'react';
import { KeyRound, Landmark, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { useForm } from '../hooks/useForm';
import { useToast } from '../hooks/useToast';
import { useSettings } from '../hooks/useSettings';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { authService, settingService, userService } from '../services';
import { can } from '../utils/permissions';
import { ROLE_LABELS } from '../utils/constants';
import { formatDateTime, formatMoney } from '../utils/format';
import { passwordProblem } from '../utils/validation';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import { SelectField, TextField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Feedback';
import { Badge, StatusBadge } from '../components/ui/Badge';

function ProfileTab() {
  const { user, replaceToken } = useAuth();
  const toast = useToast();
  const form = useForm(
    { currentPassword: '', newPassword: '', confirm: '' },
    {
      validate: (v) => ({
        currentPassword: !v.currentPassword && 'Required',
        newPassword: passwordProblem(v.newPassword) || (v.newPassword === v.currentPassword && 'Must differ from the current password'),
        confirm: v.confirm !== v.newPassword && 'Passwords do not match',
      }),
      onSubmit: async (v) => {
        const res = await authService.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
        replaceToken(res.data.token);
        form.setValues({ currentPassword: '', newPassword: '', confirm: '' });
        toast.success(res.message, { title: 'Password changed' });
      },
    }
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Your account" />
        <CardBody>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Name</dt><dd className="font-medium">{user.name}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Username</dt><dd className="font-mono">@{user.username}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Role</dt><dd><Badge tone="ink">{ROLE_LABELS[user.role]}</Badge></dd></div>
            {user.member && <div className="flex justify-between"><dt className="text-stone-500">Membership</dt><dd>{user.member.memberId}</dd></div>}
            <div className="flex justify-between"><dt className="text-stone-500">Last sign-in</dt><dd>{formatDateTime(user.lastLoginAt)}</dd></div>
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Change password" description="Other signed-in devices will be signed out." />
        <form onSubmit={form.handleSubmit} noValidate>
          <CardBody className="space-y-4">
            {form.formError && <Alert tone="error">{form.formError}</Alert>}
            <TextField label="Current password" type="password" autoComplete="current-password" {...form.bind('currentPassword')} />
            <TextField label="New password" type="password" autoComplete="new-password" hint="8+ characters, with a letter and a number" {...form.bind('newPassword')} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" {...form.bind('confirm')} />
            <Button type="submit" icon={KeyRound} loading={form.submitting}>
              Update password
            </Button>
          </CardBody>
        </form>
      </Card>
    </div>
  );
}

const POLICY_FIELDS = [
  ['libraryName', 'Library name', 'text'],
  ['currency', 'Currency (ISO code)', 'text'],
  ['finePerDay', 'Fine per overdue day', 'number'],
  ['loanPeriodDays', 'Default loan period (days)', 'number'],
  ['maxLoanPeriodDays', 'Longest allowed loan (days)', 'number'],
  ['defaultBorrowingLimit', 'Default borrowing limit', 'number'],
  ['maxRenewals', 'Renewals per loan', 'number'],
  ['lostBookFee', 'Lost book fee (if book has no price)', 'number'],
  ['damagedBookFee', 'Damaged return fee', 'number'],
  ['maxOutstandingFine', 'Block borrowing above unpaid fines of', 'number'],
];

function PolicyTab() {
  const { user } = useAuth();
  const { settings, setSettings } = useSettings();
  const toast = useToast();
  const editable = can(user, 'settings:manage');
  const form = useForm(
    { ...settings },
    {
      validate: (v) => ({
        finePerDay: Number(v.finePerDay) < 0 && 'Cannot be negative',
        loanPeriodDays: Number(v.loanPeriodDays) > Number(v.maxLoanPeriodDays) && 'Longer than the maximum loan',
        currency: !/^[A-Za-z]{3}$/.test(v.currency) && '3-letter code, e.g. INR',
      }),
      onSubmit: async (v) => {
        const payload = Object.fromEntries(POLICY_FIELDS.map(([key, , type]) => [key, type === 'number' ? Number(v[key]) : v[key]]));
        payload.blockBorrowingWhenOverdue = Boolean(v.blockBorrowingWhenOverdue);
        const res = await settingService.update(payload);
        setSettings((s) => ({ ...s, ...res.data }));
        toast.success('New loans will use the updated rules. Existing loans keep the fine rate they were issued with.', { title: 'Policy saved' });
      },
    }
  );

  return (
    <Card>
      <CardHeader
        title="Circulation policy"
        description={editable ? 'Applies to new loans. Fine rates are fixed on each loan when it is issued.' : 'Only an administrator can change these rules.'}
      />
      <form onSubmit={form.handleSubmit} noValidate>
        <CardBody>
          {form.formError && <Alert tone="error" className="mb-4">{form.formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POLICY_FIELDS.map(([key, label, type]) => (
              <TextField key={key} label={label} type={type} min={type === 'number' ? 0 : undefined} step={key.includes('Fee') || key.includes('fine') || key === 'finePerDay' ? '0.01' : undefined} disabled={!editable} {...form.bind(key)} />
            ))}
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" className="h-4 w-4 rounded border-stone-300" disabled={!editable} checked={Boolean(form.values.blockBorrowingWhenOverdue)} onChange={(e) => form.setField('blockBorrowingWhenOverdue', e.target.checked)} />
            Members with overdue books cannot borrow more
          </label>
          <p className="mt-4 text-xs text-stone-500">
            Example: a book returned 3 days late costs 3 × {formatMoney(form.values.finePerDay, form.values.currency?.length === 3 ? form.values.currency : 'INR')} ={' '}
            {formatMoney(3 * Number(form.values.finePerDay || 0), form.values.currency?.length === 3 ? form.values.currency : 'INR')}.
          </p>
        </CardBody>
        {editable && (
          <div className="flex justify-end border-t border-stone-100 px-5 py-3">
            <Button type="submit" loading={form.submitting}>
              Save policy
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function UserModal({ target, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(target);
  const form = useForm(
    { name: target?.name || '', username: target?.username || '', role: target?.role || 'LIBRARIAN', status: target?.status || 'ACTIVE', password: '' },
    {
      validate: (v) => ({
        name: v.name.trim().length < 2 && 'Required',
        username: !isEdit && !/^[a-zA-Z0-9._-]{3,30}$/.test(v.username) && '3-30 letters, numbers, . _ -',
        password: (!isEdit || v.password) && passwordProblem(v.password),
      }),
      onSubmit: async (v) => {
        const res = isEdit
          ? await userService.update(target._id, { name: v.name, role: v.role, status: v.status, ...(v.password ? { password: v.password } : {}) })
          : await userService.create({ name: v.name, username: v.username, password: v.password, role: v.role });
        toast.success(res.message);
        onSaved();
      },
    }
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={isEdit ? `Edit @${target.username}` : 'New staff account'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={form.submitting}>Save</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={form.handleSubmit} noValidate className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <TextField label="Full name" {...form.bind('name')} />
        {!isEdit && <TextField label="Username" autoComplete="off" {...form.bind('username')} />}
        <SelectField
          label="Role"
          disabled={target?.member}
          options={[
            { value: 'LIBRARIAN', label: 'Librarian' },
            { value: 'ADMIN', label: 'Administrator' },
            ...(target?.role === 'MEMBER' ? [{ value: 'MEMBER', label: 'Member' }] : []),
          ]}
          {...form.bind('role')}
        />
        {isEdit && (
          <SelectField label="Status" options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Deactivated' }]} {...form.bind('status')} />
        )}
        <TextField label={isEdit ? 'Reset password (optional)' : 'Password'} type="password" autoComplete="new-password" {...form.bind('password')} />
      </form>
    </Modal>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const [editing, setEditing] = useState(null);
  const users = useAsync(() => userService.list({ limit: 100 }), []);
  return (
    <Card>
      <CardHeader title="User accounts" description="Staff logins and member online accounts." actions={<Button icon={UserPlus} onClick={() => setEditing('new')}>New staff account</Button>} />
      <DataTable
        caption="Users"
        loading={users.loading}
        rows={users.data?.data || []}
        onRowClick={(u) => setEditing(u)}
        columns={[
          { key: 'name', header: 'Name', mobile: 'title', render: (u) => (<div><p className="font-medium text-stone-900">{u.name} {u._id === me._id && <span className="text-xs text-stone-400">(you)</span>}</p><p className="font-mono text-xs text-stone-400">@{u.username}</p></div>) },
          { key: 'role', header: 'Role', render: (u) => <Badge tone={u.role === 'ADMIN' ? 'brass' : u.role === 'LIBRARIAN' ? 'ink' : 'stone'}>{ROLE_LABELS[u.role]}</Badge> },
          { key: 'member', header: 'Linked member', render: (u) => u.member?.memberId || '—' },
          { key: 'lastLoginAt', header: 'Last sign-in', render: (u) => formatDateTime(u.lastLoginAt) },
          { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
        ]}
      />
      {editing && (
        <UserModal
          target={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            users.reload();
          }}
        />
      )}
    </Card>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { user } = useAuth();
  const isStaff = user.role !== 'MEMBER';
  const tabs = [
    { value: 'profile', label: 'Profile', icon: ShieldCheck },
    ...(isStaff ? [{ value: 'policy', label: 'Circulation policy', icon: Landmark }] : []),
    ...(can(user, 'users:manage') ? [{ value: 'users', label: 'Users', icon: Users }] : []),
  ];
  const [tab, setTab] = useState('profile');
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs className="mb-6" tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'policy' && <PolicyTabKeyed />}
      {tab === 'users' && <UsersTab />}
    </>
  );
}

/** Re-initialise the policy form once settings have loaded from the API. */
function PolicyTabKeyed() {
  const { settings } = useSettings();
  return <PolicyTab key={settings.updatedAt || 'initial'} />;
}
