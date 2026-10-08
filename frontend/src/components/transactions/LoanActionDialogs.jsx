import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { SelectField, TextField, TextareaField } from '../ui/FormField';
import { Alert } from '../ui/Feedback';
import { transactionService } from '../../services';
import { useToast } from '../../hooks/useToast';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../utils/permissions';
import { addDays, formatDate, formatMoney, toDateInput } from '../../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;
const overdueDaysAt = (dueDate, at) => Math.max(0, Math.ceil((at.getTime() - new Date(dueDate).getTime()) / DAY_MS));

function LoanSummary({ txn }) {
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3 text-sm">
      <div className="col-span-2">
        <dt className="text-xs text-stone-500">Book</dt>
        <dd className="font-medium text-stone-900">{txn.book?.title}</dd>
      </div>
      <div>
        <dt className="text-xs text-stone-500">Member</dt>
        <dd className="text-stone-800">
          {txn.member?.name} <span className="text-stone-400">· {txn.member?.memberId}</span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-stone-500">Transaction</dt>
        <dd className="font-mono text-xs text-stone-700">{txn.transactionId}</dd>
      </div>
      <div>
        <dt className="text-xs text-stone-500">Issued</dt>
        <dd className="text-stone-800">{formatDate(txn.issueDate)}</dd>
      </div>
      <div>
        <dt className="text-xs text-stone-500">Due</dt>
        <dd className={txn.isOverdue ? 'font-medium text-rose-700' : 'text-stone-800'}>{formatDate(txn.dueDate)}</dd>
      </div>
    </dl>
  );
}

function ReturnDialog({ txn, onClose, onDone }) {
  const toast = useToast();
  const { settings } = useSettings();
  const today = toDateInput();
  const [form, setForm] = useState({ returnDate: today, condition: 'GOOD', remarks: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Mirror of the server's calculation so the librarian sees the fine before confirming.
  const preview = useMemo(() => {
    const at = form.returnDate === today ? new Date() : new Date(`${form.returnDate}T12:00:00`);
    const days = overdueDaysAt(txn.dueDate, at);
    const overdue = days * txn.finePerDay;
    const damage = form.condition === 'DAMAGED' ? settings.damagedBookFee || 0 : 0;
    return { days, overdue, damage, total: overdue + damage };
  }, [form, txn, settings, today]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { transaction: txn._id, condition: form.condition, remarks: form.remarks || undefined };
      if (form.returnDate !== today) body.returnDate = new Date(`${form.returnDate}T12:00:00`).toISOString();
      const res = await transactionService.return(body);
      toast.success(res.message, { title: 'Book returned' });
      onDone(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Return book"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="return-form" loading={busy}>
            Confirm return
          </Button>
        </>
      }
    >
      <form id="return-form" onSubmit={submit} className="space-y-4">
        <LoanSummary txn={txn} />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Return date"
            type="date"
            value={form.returnDate}
            min={toDateInput(txn.issueDate)}
            max={today}
            onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value || today }))}
            hint="Back-date if the book came in earlier (e.g. book drop)."
          />
          <SelectField
            label="Condition"
            value={form.condition}
            onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            options={[
              { value: 'GOOD', label: 'Good - back on shelf' },
              { value: 'DAMAGED', label: 'Damaged - needs repair' },
            ]}
          />
        </div>
        <TextareaField
          label="Remarks"
          rows={2}
          maxLength={500}
          value={form.remarks}
          onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          placeholder="Optional note for the record"
        />
        <div className={`rounded-lg border p-3 text-sm ${preview.total > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          {preview.total > 0 ? (
            <>
              <p className="font-semibold text-amber-900">Fine due: {formatMoney(preview.total, settings.currency)}</p>
              <p className="mt-0.5 text-amber-800">
                {preview.days > 0 && `${preview.days} day(s) late × ${formatMoney(txn.finePerDay, settings.currency)}`}
                {preview.days > 0 && preview.damage > 0 && ' + '}
                {preview.damage > 0 && `damage fee ${formatMoney(preview.damage, settings.currency)}`}
              </p>
            </>
          ) : (
            <p className="font-medium text-emerald-900">Returned on time - no fine.</p>
          )}
        </div>
      </form>
    </Modal>
  );
}

function RenewDialog({ txn, onClose, onDone }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const newDue = addDays(txn.dueDate, settings.loanPeriodDays);
  const remaining = settings.maxRenewals - txn.renewCount;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await transactionService.renew(txn._id);
      toast.success(`New due date: ${formatDate(res.data.dueDate)}`, { title: 'Loan renewed' });
      onDone(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Renew loan"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={remaining <= 0 || txn.isOverdue}>
            Renew
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <LoanSummary txn={txn} />
        {error && <Alert tone="error">{error}</Alert>}
        {txn.isOverdue ? (
          <Alert tone="warning">Overdue loans cannot be renewed. Return the book and settle the fine first.</Alert>
        ) : remaining <= 0 ? (
          <Alert tone="warning">This loan has reached the renewal limit ({settings.maxRenewals}).</Alert>
        ) : (
          <p className="text-sm text-stone-600">
            The due date moves to <strong className="text-stone-900">{formatDate(newDue)}</strong>. {remaining} renewal
            {remaining === 1 ? '' : 's'} left.
          </p>
        )}
      </div>
    </Modal>
  );
}

function LostDialog({ txn, onClose, onDone }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const replacement = txn.book?.price > 0 ? txn.book.price : settings.lostBookFee;
  const total = (txn.accruedFine || 0) + (replacement || 0);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await transactionService.markLost(txn._id, { remarks: remarks || undefined });
      toast.warning(`Fine of ${formatMoney(res.data.fine, settings.currency)} recorded`, { title: 'Book marked lost' });
      onDone(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark book as lost"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Mark lost
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <LoanSummary txn={txn} />
        {error && <Alert tone="error">{error}</Alert>}
        <Alert tone="warning" title={`Charge: ${formatMoney(total, settings.currency)}`}>
          Replacement cost {formatMoney(replacement, settings.currency)}
          {txn.accruedFine > 0 && ` + overdue fine ${formatMoney(txn.accruedFine, settings.currency)}`}. The copy is moved
          from &quot;on loan&quot; to &quot;lost&quot; and the loan is closed.
        </Alert>
        <TextareaField label="Remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
    </Modal>
  );
}

function FineDialog({ txn, onClose, onDone }) {
  const toast = useToast();
  const { settings } = useSettings();
  const { user } = useAuth();
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const submit = async (action) => {
    setBusy(action);
    setError('');
    try {
      const res = await transactionService.settleFine(txn._id, { action, remarks: remarks || undefined });
      toast.success(res.message);
      onDone(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Settle fine"
      size="sm"
      footer={
        <>
          {can(user, 'fines:waive') && (
            <Button variant="secondary" onClick={() => submit('WAIVE')} loading={busy === 'WAIVE'} disabled={Boolean(busy)}>
              Waive fine
            </Button>
          )}
          <Button onClick={() => submit('PAY')} loading={busy === 'PAY'} disabled={Boolean(busy)}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <LoanSummary txn={txn} />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-800">Amount due</p>
          <p className="font-display text-2xl font-semibold text-amber-950">{formatMoney(txn.fine, settings.currency)}</p>
          <p className="mt-1 text-xs text-amber-800">
            {txn.fineBreakdown?.overdue > 0 && `Overdue ${formatMoney(txn.fineBreakdown.overdue, settings.currency)} `}
            {txn.fineBreakdown?.damage > 0 && `· Damage ${formatMoney(txn.fineBreakdown.damage, settings.currency)} `}
            {txn.fineBreakdown?.lost > 0 && `· Replacement ${formatMoney(txn.fineBreakdown.lost, settings.currency)}`}
          </p>
        </div>
        <TextField label="Receipt / remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Cash, receipt #1042" />
      </div>
    </Modal>
  );
}

const DIALOGS = { return: ReturnDialog, renew: RenewDialog, lost: LostDialog, fine: FineDialog };

/**
 * Renders whichever loan dialog is active.
 *   const [action, setAction] = useState(null); // { type: 'return', txn }
 *   <LoanActionDialogs action={action} onClose={() => setAction(null)} onDone={reload} />
 */
export default function LoanActionDialogs({ action, onClose, onDone }) {
  const [current, setCurrent] = useState(action);
  useEffect(() => setCurrent(action), [action]);
  if (!current) return null;
  const Dialog = DIALOGS[current.type];
  return (
    <Dialog
      txn={current.txn}
      onClose={onClose}
      onDone={(updated) => {
        onClose();
        onDone?.(updated, current.type);
      }}
    />
  );
}
