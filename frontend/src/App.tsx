import { Route, Routes } from "react-router";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import UsersPage from "./components/UsersPage";
import KennelsPage from "./components/KennelsPage";
import CatsPage from "./components/CatsPage";
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
