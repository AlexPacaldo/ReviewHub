import { Link, NavLink } from "react-router-dom";
import { BookOpen, History, Library, Moon, Sun } from "lucide-react";

export default function Navbar({ theme, onToggleTheme }) {
  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="Review Hub home">
        <BookOpen size={22} aria-hidden="true" />
        <span>Review Hub</span>
      </Link>

      <nav className="nav-links" aria-label="Main navigation">
        <NavLink to="/">Reviewers</NavLink>
        <NavLink to="/history">
          <History size={17} aria-hidden="true" />
          History
        </NavLink>
        <NavLink to="/library">
          <Library size={17} aria-hidden="true" />
          Library
        </NavLink>
      </nav>

      <button className="icon-button" type="button" onClick={onToggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>
    </header>
  );
}
