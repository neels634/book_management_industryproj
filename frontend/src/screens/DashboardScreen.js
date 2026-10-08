import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { Button, Card, Message, colors, styles } from '../ui';

const STATS = [
  ['total_books', 'Total books'],
  ['available_books', 'Available'],
  ['issued_books', 'Issued'],
  ['overdue_books', 'Overdue'],
  ['total_members', 'Members'],
  ['total_fines', 'Fines charged (₹)'],
];

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.dashboard().then(setData).then(() => setError('')).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  return (
    <View>
      <Text style={styles.title}>Dashboard</Text>
      <Message text={error} />
      <View style={styles.row}>
        {STATS.map(([key, label]) => (
          <Card key={key} style={{ flexGrow: 1, flexBasis: 150 }}>
            <Text style={styles.muted}>{label}</Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: key === 'overdue_books' && data?.[key] ? colors.red : colors.text }}>
              {data ? data[key] : '–'}
            </Text>
          </Card>
        ))}
      </View>
      {data && (
        <Text style={[styles.muted, { marginBottom: 10 }]}>
          Loan period {data.loan_days} days · late fine ₹{data.fine_per_day} per day
        </Text>
      )}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button title="Refresh" variant="secondary" onPress={load} />
      </View>
    </View>
  );
}
