import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '../api';
import { Badge, Button, Card, Field, Message, colors, styles } from '../ui';

const STATUS_COLORS = { ISSUED: colors.primary, OVERDUE: colors.red, RETURNED: colors.green };
const FILTERS = ['', 'ISSUED', 'OVERDUE', 'RETURNED'];
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '–');

/** Pick one item from a searchable list (no extra libraries needed). */
function Picker({ label, items, selected, onSelect, describe }) {
  const [q, setQ] = useState('');
  if (selected) {
    return (
      <Card style={{ flexGrow: 1, flexBasis: 260 }}>
        <Text style={styles.muted}>{label}</Text>
        <Text style={styles.itemTitle}>{selected.name || selected.title}</Text>
        <Text style={styles.muted}>{describe(selected)}</Text>
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Button title="Change" variant="secondary" onPress={() => onSelect(null)} />
        </View>
      </Card>
    );
  }
  const matches = items.filter((i) => (i.name || i.title).toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  return (
    <Card style={{ flexGrow: 1, flexBasis: 260 }}>
      <Field label={label} value={q} onChangeText={setQ} placeholder="Type to search" />
      {matches.map((item) => (
        <Pressable key={item.id} onPress={() => onSelect(item)} style={{ paddingVertical: 6 }} accessibilityRole="button">
          <Text style={{ color: colors.text }}>{item.name || item.title}</Text>
          <Text style={styles.muted}>{describe(item)}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

export default function LoansScreen() {
  const [loans, setLoans] = useState([]);
  const [filter, setFilter] = useState('ISSUED');
  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [book, setBook] = useState(null);
  const [member, setMember] = useState(null);
  const [message, setMessage] = useState({ text: '', type: 'error' });

  const load = () => {
    api.loans(filter).then(setLoans).catch((e) => setMessage({ text: e.message, type: 'error' }));
    api.books().then(setBooks).catch(() => {});
    api.members().then(setMembers).catch(() => {});
  };
  useEffect(load, [filter]);

  const issue = async () => {
    try {
      const loan = await api.issue({ book_id: book.id, member_id: member.id });
      setMessage({ text: `Issued "${loan.book_title}" to ${loan.member_name}, due ${formatDate(loan.due_date)}`, type: 'success' });
      setBook(null);
      setMember(null);
      load();
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    }
  };

  const giveBack = async (loan) => {
    try {
      const result = await api.returnLoan(loan.id);
      const fine = result.fine > 0 ? ` Fine due: ₹${result.fine}.` : ' No fine.';
      setMessage({ text: `"${result.book_title}" returned.${fine}`, type: 'success' });
      load();
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    }
  };

  return (
    <View>
      <Text style={styles.title}>Issue / Return</Text>
      <Message {...message} />

      <Text style={[styles.itemTitle, { marginBottom: 8 }]}>Issue a book</Text>
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        <Picker
          label="Member"
          items={members}
          selected={member}
          onSelect={setMember}
          describe={(m) => `${m.borrowed_count} of ${m.borrowing_limit} books borrowed`}
        />
        <Picker
          label="Book"
          items={books}
          selected={book}
          onSelect={setBook}
          describe={(b) => `${b.author} · ${b.available_copies} of ${b.total_copies} available`}
        />
      </View>
      <View style={{ alignSelf: 'flex-start', marginBottom: 20 }}>
        <Button title="Issue book" onPress={issue} disabled={!book || !member} />
      </View>

      <Text style={[styles.itemTitle, { marginBottom: 8 }]}>Loans</Text>
      <View style={[styles.row, { marginBottom: 10 }]}>
        {FILTERS.map((f) => (
          <Button key={f || 'all'} title={f ? f.charAt(0) + f.slice(1).toLowerCase() : 'All'} variant={filter === f ? 'primary' : 'secondary'} onPress={() => setFilter(f)} />
        ))}
      </View>
      {loans.length === 0 && <Text style={styles.muted}>No loans.</Text>}
      {loans.map((loan) => (
        <Card key={loan.id}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.itemTitle}>{loan.book_title}</Text>
              <Text style={styles.muted}>
                {loan.member_name} · issued {formatDate(loan.issue_date)} · due {formatDate(loan.due_date)}
                {loan.return_date ? ` · returned ${formatDate(loan.return_date)}` : ''}
              </Text>
              {loan.fine > 0 && (
                <Text style={{ color: colors.red, marginTop: 4 }}>
                  Fine ₹{loan.fine}
                  {loan.status === 'OVERDUE' ? ' so far' : ''}
                </Text>
              )}
            </View>
            <Badge label={loan.status} color={STATUS_COLORS[loan.status]} />
          </View>
          {!loan.return_date && (
            <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <Button title="Return" onPress={() => giveBack(loan)} />
            </View>
          )}
        </Card>
      ))}
    </View>
  );
}
