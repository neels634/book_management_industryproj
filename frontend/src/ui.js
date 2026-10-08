import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const colors = {
  bg: '#f6f5f1',
  card: '#ffffff',
  border: '#e2e0d8',
  text: '#1f2421',
  muted: '#6b706c',
  primary: '#1f4d3f',
  green: '#1c7c54',
  amber: '#b26a00',
  red: '#b3261e',
};

export function Button({ title, onPress, variant = 'primary', disabled }) {
  const style = [styles.button, styles[variant], disabled && styles.disabled];
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [...style, pressed && styles.pressed]} accessibilityRole="button">
      <Text style={[styles.buttonText, variant !== 'primary' && { color: variant === 'danger' ? colors.red : colors.primary }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#9a9e9a" accessibilityLabel={label} {...props} />
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Message({ text, type = 'error' }) {
  if (!text) return null;
  return <Text style={[styles.message, type === 'error' ? styles.error : styles.success]}>{text}</Text>;
}

export function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  button: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.red },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  field: { marginBottom: 10 },
  // For fields laid out side by side in a wrapping row.
  rowField: { flexGrow: 1, flexBasis: 200 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, backgroundColor: '#fff', color: colors.text },
  message: { padding: 10, borderRadius: 8, marginBottom: 10 },
  error: { backgroundColor: '#fbe9e7', color: colors.red },
  success: { backgroundColor: '#e6f4ea', color: colors.green },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
