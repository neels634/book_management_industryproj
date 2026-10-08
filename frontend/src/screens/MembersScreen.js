import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { Badge, Button, Card, Field, Message, colors, styles } from '../ui';

const EMPTY = { name: '', email: '', phone: '', borrowing_limit: '3' };

export default function MembersScreen() {
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState({ text: '', type: 'error' });

  const load = () => api.members(q).then(setMembers).catch((e) => setMessage({ text: e.message, type: 'error' }));
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const save = async () => {
    try {
      const body = { name: form.name, email: form.email, phone: form.phone, borrowing_limit: Number(form.borrowing_limit) };
      if (form.id) await api.updateMember(form.id, body);
      else await api.createMember(body);
      setForm(null);
      setMessage({ text: 'Member saved', type: 'success' });
      load();
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    }
  };

  const remove = async (member) => {
    try {
      await api.deleteMember(member.id);
      setMessage({ text: `${member.name} deactivated`, type: 'success' });
      load();
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    }
  };

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <View>
      <Text style={styles.title}>Members</Text>
      <Message {...message} />
      <View style={[styles.row, { marginBottom: 10 }]}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label="Search" value={q} onChangeText={setQ} placeholder="Name, e-mail or phone" />
        </View>
        {!form && <Button title="Add member" onPress={() => setForm(EMPTY)} />}
      </View>

      {form && (
        <Card>
          <Text style={styles.itemTitle}>{form.id ? 'Edit member' : 'New member'}</Text>
          <View style={[styles.row, { marginTop: 10, alignItems: 'flex-start' }]}>
            <Field style={styles.rowField} label="Name" value={form.name} onChangeText={set('name')} />
            <Field style={styles.rowField} label="E-mail" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            <Field style={styles.rowField} label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <Field style={styles.rowField} label="Borrowing limit" value={String(form.borrowing_limit)} onChangeText={set('borrowing_limit')} keyboardType="number-pad" />
          </View>
          <View style={styles.row}>
            <Button title="Save" onPress={save} />
            <Button title="Cancel" variant="secondary" onPress={() => setForm(null)} />
          </View>
        </Card>
      )}

      {members.length === 0 && <Text style={styles.muted}>No members found.</Text>}
      {members.map((member) => (
        <Card key={member.id}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.itemTitle}>{member.name}</Text>
              <Text style={styles.muted}>
                {member.email}
                {member.phone ? ` · ${member.phone}` : ''}
              </Text>
            </View>
            <Badge
              label={`${member.borrowed_count} / ${member.borrowing_limit} books`}
              color={member.borrowed_count >= member.borrowing_limit ? colors.amber : colors.primary}
            />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Button title="Edit" variant="secondary" onPress={() => setForm({ ...member, borrowing_limit: String(member.borrowing_limit) })} />
            <Button title="Deactivate" variant="danger" onPress={() => remove(member)} />
          </View>
        </Card>
      ))}
    </View>
  );
}
