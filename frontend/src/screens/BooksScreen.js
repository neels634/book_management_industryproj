import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { Badge, Button, Card, Field, Message, colors, styles } from '../ui';

const EMPTY = { title: '', author: '', isbn: '', category: '', total_copies: '1' };

export default function BooksScreen() {
  const [books, setBooks] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null); // null = closed, otherwise { id?, ...fields }
  const [message, setMessage] = useState({ text: '', type: 'error' });

  const load = () => api.books(q).then(setBooks).catch((e) => setMessage({ text: e.message, type: 'error' }));
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const save = async () => {
    try {
      const body = { ...form, category: form.category || 'Other', total_copies: Number(form.total_copies) };
      delete body.id;
      if (form.id) await api.updateBook(form.id, body);
      else await api.createBook(body);
      setForm(null);
      setMessage({ text: 'Book saved', type: 'success' });
      load();
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    }
  };

  const remove = async (book) => {
    try {
      await api.deleteBook(book.id);
      setMessage({ text: `"${book.title}" removed from the catalogue`, type: 'success' });
      load();
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    }
  };

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <View>
      <Text style={styles.title}>Books</Text>
      <Message {...message} />
      <View style={[styles.row, { marginBottom: 10 }]}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label="Search" value={q} onChangeText={setQ} placeholder="Title, author, ISBN or category" />
        </View>
        {!form && <Button title="Add book" onPress={() => setForm(EMPTY)} />}
      </View>

      {form && (
        <Card>
          <Text style={styles.itemTitle}>{form.id ? 'Edit book' : 'New book'}</Text>
          <View style={[styles.row, { marginTop: 10, alignItems: 'flex-start' }]}>
            <Field style={styles.rowField} label="Title" value={form.title} onChangeText={set('title')} />
            <Field style={styles.rowField} label="Author" value={form.author} onChangeText={set('author')} />
            <Field style={styles.rowField} label="ISBN" value={form.isbn} onChangeText={set('isbn')} placeholder="978-0-13-235088-4" />
            <Field style={styles.rowField} label="Category" value={form.category} onChangeText={set('category')} placeholder="Fiction, Science…" />
            <Field style={styles.rowField} label="Copies" value={String(form.total_copies)} onChangeText={set('total_copies')} keyboardType="number-pad" />
          </View>
          <View style={styles.row}>
            <Button title="Save" onPress={save} />
            <Button title="Cancel" variant="secondary" onPress={() => setForm(null)} />
          </View>
        </Card>
      )}

      {books.length === 0 && <Text style={styles.muted}>No books found.</Text>}
      {books.map((book) => (
        <Card key={book.id}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.itemTitle}>{book.title}</Text>
              <Text style={styles.muted}>
                {book.author} · {book.category} · ISBN {book.isbn}
              </Text>
            </View>
            <Badge
              label={book.available_copies > 0 ? `${book.available_copies} of ${book.total_copies} available` : 'All copies out'}
              color={book.available_copies > 0 ? colors.green : colors.red}
            />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Button title="Edit" variant="secondary" onPress={() => setForm({ ...book, total_copies: String(book.total_copies) })} />
            <Button title="Remove" variant="danger" onPress={() => remove(book)} />
          </View>
        </Card>
      ))}
    </View>
  );
}
