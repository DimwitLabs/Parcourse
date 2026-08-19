import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";

import Avatar from "./Avatar";
import ThemeSwitch from "./ThemeSwitch";
import { useAuth } from "../lib/auth";

const NAV_LINKS = [
  { to: "/", end: true, label: "Home", desc: "Your dashboard and recent courses" },
  { to: "/notebook", end: false, label: "Notebook", desc: "All courses you've generated" },
  { to: "/graph", end: false, label: "Knowledge Graph", desc: "See how concepts connect" },
];

export default function AppShell() {
  const { user, logout } = useAuth();

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {

    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <div className="top-nav">
        <NavLink to="/" className="top-nav-logo">
          <img src="/parcourse-wordmark.svg" alt="Parcourse" height="28" />
        </NavLink>
        <div className="top-nav-links">
          {NAV_LINKS.map(({ to, end, label }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="top-nav-user" ref={menuRef}>
          <button
            className="hamburger-btn"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button className="avatar-button" onClick={() => setMenuOpen((v) => !v)}>
            <Avatar user={user} className="avatar" />
          </button>
          {menuOpen && (
            <div className="user-menu">
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-dropdown-identity">
                    <span className="user-dropdown-name" title={fullName || user?.email}>
                      {fullName || user?.email}
                    </span>
                    <span className={`role-pill${user?.role === "admin" ? " admin" : ""}`}>
                      {user?.role === "admin" ? "Admin" : "User"}
                    </span>
                  </div>
                  {fullName && (
                    <span className="user-dropdown-email" title={user?.email}>{user?.email}</span>
                  )}
                </div>
                <button
                  className="user-dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/settings");
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </button>
                {user?.role === "admin" && (
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/admin");
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Admin
                  </button>
                )}
                <ThemeSwitch />
                <button className="user-dropdown-item danger" onClick={logout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Log out
                </button>
              </div>
              <a
                className="user-dropdown-version"
                href={`https://github.com/DimwitLabs/Parcourse/releases/tag/v${__APP_VERSION__}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                Parcourse v{__APP_VERSION__}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>

      {mobileNavOpen && (
        <div className="mobile-nav">
          <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
          <div className="mobile-nav-drawer">
            <button className="mobile-nav-close" aria-label="Close" onClick={() => setMobileNavOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {NAV_LINKS.map(({ to, end, label, desc }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `mobile-nav-link${isActive ? " active" : ""}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="mobile-nav-link-title">{label}</span>
                <span className="mobile-nav-link-desc">{desc}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <div className="app-shell">
        <Outlet />
      </div>
    </>
  );
}
