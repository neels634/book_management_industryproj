import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../layouts/AppLayout';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import { PageLoader } from '../components/ui/Feedback';
import { STAFF } from '../utils/constants';

// Route-level code splitting keeps the first load small (charts are heavy).
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const BooksPage = lazy(() => import('../pages/books/BooksPage'));
const BookDetailsPage = lazy(() => import('../pages/books/BookDetailsPage'));
const MembersPage = lazy(() => import('../pages/members/MembersPage'));
const MemberDetailsPage = lazy(() => import('../pages/members/MemberDetailsPage'));
const CirculationPage = lazy(() => import('../pages/CirculationPage'));
const CategoriesPage = lazy(() => import('../pages/CategoriesPage'));
const TransactionsPage = lazy(() => import('../pages/TransactionsPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="books" element={<BooksPage />} />
          <Route path="books/:id" element={<BookDetailsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="categories" element={<CategoriesPage />} />

          <Route element={<ProtectedRoute roles={STAFF} />}>
            <Route path="members" element={<MembersPage />} />
            <Route path="members/:id" element={<MemberDetailsPage />} />
            <Route path="circulation" element={<CirculationPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

