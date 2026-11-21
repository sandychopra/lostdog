import { Navigate, Route, Routes as RouterRoutes } from "react-router";
import { withSentryReactRouterV7Routing } from "@sentry/react";
import LoginPage from "./components/LoginPage";
import UsersPage from "./components/UsersPage";
import KennelsPage from "./components/KennelsPage";
import CatsPage from "./components/CatsPage";
import ShiftReportsPage from "./components/ShiftReportsPage";
import ShiftReportFormPage from "./components/ShiftReportFormPage";
import ShiftReportDetailPage from "./components/ShiftReportDetailPage";
import CatDetailPage from "./components/CatDetailPage";
import KennelDetailPage from "./components/KennelDetailPage";
import PhotosPage from "./components/PhotosPage";
import AnnouncementsPage from "./components/AnnouncementsPage";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import ReloadPrompt from "./components/ReloadPrompt";

// Names Sentry navigation traces after the matched route (e.g. /cats/:id).
const Routes = withSentryReactRouterV7Routing(RouterRoutes);

export default function App() {
  return (
    <>
      <ReloadPrompt />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Navigate to="/announcements" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/cats"
          element={
            <RequireAuth>
              <CatsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/cats/:id"
          element={
            <RequireAuth>
              <CatDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/kennels"
          element={
            <RequireAuth>
              <KennelsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/kennels/:id"
          element={
            <RequireAuth>
              <KennelDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/photos"
          element={
            <RequireAuth>
              <PhotosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/shift-reports"
          element={
            <RequireAuth>
              <ShiftReportsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/shift-reports/new"
          element={
            <RequireAuth>
              <ShiftReportFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="/shift-reports/:id"
          element={
            <RequireAuth>
              <ShiftReportDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/shift-reports/:id/edit"
          element={
            <RequireAuth>
              <ShiftReportFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="/announcements"
          element={
            <RequireAuth>
              <AnnouncementsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuth>
              <RequireAdmin>
                <UsersPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}
