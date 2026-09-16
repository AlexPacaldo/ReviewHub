import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { History, Library, Moon, Sparkles, Sun, UserRound, Users, WifiOff } from "lucide-react";
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

  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="Hachi home">
        <span className="brand-icon-wrap">
          <img src={appLogo} alt="Hachi logo" width={28} height={28} />
        </span>
        <span>Hachi</span>
      </Link>

      <nav className="nav-links" aria-label="Main navigation">
        <NavLink to="/">Reviewers</NavLink>
        <NavLink to="/generator">
          <Sparkles size={17} aria-hidden="true" />
          Generator
        </NavLink>
        <NavLink to="/history">
          <History size={17} aria-hidden="true" />
          History
        </NavLink>
        <NavLink to="/library">
          <Library size={17} aria-hidden="true" />
          Library
        </NavLink>
        <NavLink to="/friends">
          <Users size={17} aria-hidden="true" />
          Friends
        </NavLink>
        <NavLink to="/account">
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

      <button className="icon-button" type="button" onClick={onToggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>
    </header>
  );
}
