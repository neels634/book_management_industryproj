import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { SelectField, TextareaField, TextField } from '../ui/FormField';
import { Alert } from '../ui/Feedback';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { useSettings } from '../../hooks/useSettings';
import { memberService } from '../../services';
import { MEMBERSHIP_TYPES } from '../../utils/constants';
import { isEmail, isPhone, passwordProblem } from '../../utils/validation';
import { titleCase, toDateInput } from '../../utils/format';

const toForm = (m, defaultLimit) => ({
  name: m?.name || '',
  email: m?.email || '',
  phone: m?.phone || '',
  address: m?.address || '',
  membershipType: m?.membershipType || 'PUBLIC',
  membershipDate: toDateInput(m?.membershipDate),
  membershipExpiry: m?.membershipExpiry ? toDateInput(m.membershipExpiry) : '',
  borrowingLimit: m?.borrowingLimit ?? defaultLimit,
  membershipStatus: m?.membershipStatus || 'ACTIVE',
  notes: m?.notes || '',
  createLogin: false,
  username: '',
  password: '',
});

function validate(v) {
  return {
    name: v.name.trim().length < 2 && 'Name is required',
    phone: !isPhone(v.phone) && 'Enter a valid phone number',
    email: v.email && !isEmail(v.email) && 'Enter a valid e-mail',
    borrowingLimit: !(Number(v.borrowingLimit) >= 1 && Number(v.borrowingLimit) <= 50) && 'Between 1 and 50',
    membershipExpiry: v.membershipExpiry && v.membershipExpiry <= v.membershipDate && 'Must be after the membership date',
    username: v.createLogin && !/^[a-zA-Z0-9._-]{3,30}$/.test(v.username) && '3-30 letters, numbers, . _ -',
    password: v.createLogin && passwordProblem(v.password),
  };
}

export default function MemberFormModal({ open, onClose, member, onSaved }) {
  const toast = useToast();
  const { settings } = useSettings();
  const isEdit = Boolean(member);
  const form = useForm(toForm(member, settings.defaultBorrowingLimit), {
    validate,
    onSubmit: async (v) => {
      const payload = {
        name: v.name,
        email: v.email,
        phone: v.phone,
        address: v.address,
        membershipType: v.membershipType,
        membershipDate: v.membershipDate,
        membershipExpiry: v.membershipExpiry || (isEdit ? '' : undefined),
        borrowingLimit: Number(v.borrowingLimit),
        notes: v.notes,
      };
      if (isEdit) payload.membershipStatus = v.membershipStatus;
      if (!isEdit && v.createLogin) payload.login = { username: v.username, password: v.password };
      const res = isEdit ? await memberService.update(member._id, payload) : await memberService.create(payload);
      toast.success(res.message, { title: isEdit ? 'Saved' : `${res.data.memberId} registered` });
      onSaved(res.data);
    },
  });
  const { bind, handleSubmit, submitting, formError, values } = form;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${member.memberId}` : 'Register a member'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Register member'}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField label="Full name" required {...bind('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Phone" required type="tel" placeholder="+91 98200 12345" {...bind('phone')} />
          <TextField label="E-mail" type="email" {...bind('email')} />
        </div>
        <TextareaField label="Address" rows={2} {...bind('address')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Membership type" options={MEMBERSHIP_TYPES.map((t) => ({ value: t, label: titleCase(t) }))} {...bind('membershipType')} />
          <TextField label="Borrowing limit" type="number" min={1} max={50} required {...bind('borrowingLimit')} />
          {isEdit ? (
            <SelectField
              label="Status"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'SUSPENDED', label: 'Suspended (cannot borrow)' },
                { value: 'INACTIVE', label: 'Inactive (closed)' },
              ]}
              {...bind('membershipStatus')}
            />
          ) : (
            <div />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Member since" type="date" {...bind('membershipDate')} />
          <TextField label="Membership expires" type="date" hint="Leave empty for no expiry" {...bind('membershipExpiry')} />
        </div>
        <TextareaField label="Notes" rows={2} {...bind('notes')} />

        {!isEdit && (
          <fieldset className="rounded-lg border border-stone-200 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
              <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-ink-700" checked={values.createLogin} onChange={(e) => form.setField('createLogin', e.target.checked)} />
              Create a login so the member can see their loans and fines
            </label>
            {values.createLogin && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextField label="Username" autoComplete="off" {...bind('username')} />
                <TextField label="Initial password" type="password" autoComplete="new-password" hint="8+ characters with a letter and a number" {...bind('password')} />
              </div>
            )}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
