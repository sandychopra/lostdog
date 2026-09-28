import { Route, Routes } from "react-router";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import UsersPage from "./components/UsersPage";
import KennelsPage from "./components/KennelsPage";
import CatsPage from "./components/CatsPage";
import ShiftReportsPage from "./components/ShiftReportsPage";
import ShiftReportFormPage from "./components/ShiftReportFormPage";
import ShiftReportDetailPage from "./components/ShiftReportDetailPage";
import AnnouncementsPage from "./components/AnnouncementsPage";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
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
        path="/kennels"
        element={
          <RequireAuth>
            <KennelsPage />
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
  );
}
