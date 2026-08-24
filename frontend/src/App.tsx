import { useEffect, useState } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import { useLoadingToast } from "./components/Toast";
import { API_BASE_URL, useAuth } from "./lib/auth";
import AdminScreen from "./screens/AdminScreen";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import CheatsheetScreen from "./screens/CheatsheetScreen";
import CourseScreen from "./screens/CourseScreen";
import HomeScreen from "./screens/HomeScreen";
import KnowledgeGraphScreen from "./screens/KnowledgeGraphScreen";
import LoginScreen from "./screens/LoginScreen";
import NotebookScreen from "./screens/NotebookScreen";
import QuizHistoryScreen from "./screens/QuizHistoryScreen";
import QuizResultsScreen from "./screens/QuizResultsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SetupScreen from "./screens/SetupScreen";

function RootRouter() {
  const { status, user } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== "signed-out") return;
    fetch(`${API_BASE_URL}/auth/setup-status`)
      .then((res) => res.json())
      .then((data) => setNeedsSetup(data.needs_setup))
      .catch(() => setNeedsSetup(false));
  }, [status]);

  const settling = status === "loading" || (status === "signed-out" && needsSetup === null);
  useLoadingToast(settling, "Loading…");

  if (status === "loading") return null;

  if (status === "signed-out") {
    if (needsSetup === null) return null;
    return needsSetup ? <SetupScreen /> : <LoginScreen />;
  }

  if (user?.must_change_password) return <ChangePasswordScreen />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/notebook" element={<NotebookScreen />} />
        <Route path="/course/:courseId" element={<CourseScreen />} />
        <Route path="/course/:courseId/cheatsheet" element={<CheatsheetScreen />} />
        <Route path="/course/:courseId/results" element={<QuizResultsScreen />} />
        <Route path="/course/:courseId/history" element={<QuizHistoryScreen />} />
        <Route path="/graph" element={<KnowledgeGraphScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route
          path="/admin"
          element={user?.role === "admin" ? <AdminScreen /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RootRouter />
    </BrowserRouter>
  );
}
