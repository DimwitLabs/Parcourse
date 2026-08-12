import { useEffect, useState } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import { API_BASE_URL, useAuth } from "./lib/auth";
import AdminScreen from "./screens/AdminScreen";
import CourseScreen from "./screens/CourseScreen";
import HomeScreen from "./screens/HomeScreen";
import KnowledgeGraphScreen from "./screens/KnowledgeGraphScreen";
import LoginScreen from "./screens/LoginScreen";
import NotebookScreen from "./screens/NotebookScreen";
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

  if (status === "loading") {
    return <p className="status-message">Loading…</p>;
  }

  if (status === "signed-out") {
    if (needsSetup === null) return <p className="status-message">Loading…</p>;
    return needsSetup ? <SetupScreen /> : <LoginScreen />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/notebook" element={<NotebookScreen />} />
        <Route path="/course/:courseId" element={<CourseScreen />} />
        <Route path="/course/:courseId/results" element={<QuizResultsScreen />} />
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
