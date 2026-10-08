import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DashboardScreen from './src/screens/DashboardScreen';
import BooksScreen from './src/screens/BooksScreen';
import MembersScreen from './src/screens/MembersScreen';
import LoansScreen from './src/screens/LoansScreen';
import { colors } from './src/ui';

const TABS = [
  ['dashboard', 'Dashboard', DashboardScreen],
  ['books', 'Books', BooksScreen],
  ['members', 'Members', MembersScreen],
  ['loans', 'Issue / Return', LoansScreen],
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const Screen = TABS.find(([key]) => key === tab)[2];

  return (
    <View style={s.app}>
      <StatusBar style="light" />
      <View style={s.header}>
        <View style={s.page}>
          <Text style={s.brand}>Library</Text>
          <View style={s.tabs}>
            {TABS.map(([key, label]) => (
              <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabActive]} accessibilityRole="tab">
                <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.page}>
          <Screen />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.primary,
    // Room for the phone status bar; not needed in a browser.
    paddingTop: Platform.OS === 'web' ? 14 : 44,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  brand: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  tabActive: { backgroundColor: '#ffffff' },
  tabText: { color: '#dfe9e4', fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  content: { padding: 16 },
  // Keeps lines readable on wide desktop screens.
  page: { width: '100%', maxWidth: 960, alignSelf: 'center' },
});
