import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { History, Library, Menu, Moon, Sparkles, Sun, UserRound, Users, WifiOff, X } from "lucide-react";
import appLogo from "../assets/Icon.png";
import { useAuth } from "../contexts/AuthContext.jsx";

function getUserName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Account";
}

function getUserAvatar(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
}

export default function Navbar({ theme, onToggleTheme }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnResize = () => {
      if (window.innerWidth > 760) setMenuOpen(false);
    };

    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, [menuOpen]);

  return (
    <header className={`navbar ${menuOpen ? "menu-open" : ""}`}>
      <Link to="/" className="brand" aria-label="Hachi home">
        <span className="brand-icon-wrap">
          <img src={appLogo} alt="Hachi logo" width={28} height={28} />
        </span>
        <span>Hachi</span>
      </Link>

      <nav className="nav-links" aria-label="Main navigation" id="main-navigation">
        <NavLink to="/" onClick={() => setMenuOpen(false)}>Reviewers</NavLink>
        <NavLink to="/generator" onClick={() => setMenuOpen(false)}>
          <Sparkles size={17} aria-hidden="true" />
          Generator
        </NavLink>
        <NavLink to="/history" onClick={() => setMenuOpen(false)}>
          <History size={17} aria-hidden="true" />
          History
        </NavLink>
        <NavLink to="/library" onClick={() => setMenuOpen(false)}>
          <Library size={17} aria-hidden="true" />
          Library
        </NavLink>
        <NavLink to="/friends" onClick={() => setMenuOpen(false)}>
          <Users size={17} aria-hidden="true" />
          Friends
        </NavLink>
        <NavLink to="/account" onClick={() => setMenuOpen(false)}>
          {user && getUserAvatar(user) ? (
            <img className="nav-avatar" src={getUserAvatar(user)} alt="" />
          ) : (
            <UserRound size={17} aria-hidden="true" />
          )}
          {user ? getUserName(user) : "Sign In"}
        </NavLink>
      </nav>

      {!isOnline ? (
        <span className="offline-pill" role="status">
          <WifiOff size={16} aria-hidden="true" />
          Offline
        </span>
      ) : null}

      <button
        className="icon-button menu-toggle"
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
      >
        {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
      </button>

      <button className="icon-button" type="button" onClick={onToggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>
    </header>
  );
}
