import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_KEY = "parcourse_token";

export type UserInfo = { id: string; email: string; role: "admin" | "student"; first_name?: string; last_name?: string; must_change_password?: boolean };

type AuthState = {
  status: "loading" | "signed-out" | "signed-in";
  token: string | null;
  user: UserInfo | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setSession: (token: string, user: UserInfo) => void;
  setUser: (user: UserInfo) => void;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchMe(token: string): Promise<UserInfo> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("invalid session");
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("signed-out");
      return;
    }
    fetchMe(token)
      .then((me) => {
        setUser(me);
        setStatus("signed-in");
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setStatus("signed-out");
      });
  }, [token]);

  function setSession(newToken: string, newUser: UserInfo) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setStatus("signed-in");
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
    const me = await fetchMe(data.access_token);
    setSession(data.access_token, me);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setStatus("signed-out");
  }

  return (
    <AuthContext.Provider value={{ status, token, user, login, logout, setSession, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
