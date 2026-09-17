import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Cloud, History, Home, Library, Menu, Moon, Share2, Sparkles, Sun, Users, WifiOff, Download } from "lucide-react";
import appLogo from "../assets/Icon.png";

export default function Navbar({ theme, onToggleTheme }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 24);
  const menuCloseTimer = useRef(null);
  const touchStart = useRef(null);

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
      if (window.innerWidth > 760) {
        setMenuOpen(false);
        setMenuClosing(false);
      }
    };

    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    const updateScrolled = () => setIsScrolled(window.scrollY > 24);

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  function openMenu() {
    if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    setMenuClosing(false);
    setMenuOpen(true);
  }

  function closeMenu() {
    if (!menuOpen || menuClosing) return;
    setMenuClosing(true);
    if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    menuCloseTimer.current = window.setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 260);
  }

  function handleTouchStart(event) {
    if (!menuOpen) return;
    const touch = event.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY
    };
  }

  function handleTouchEnd(event) {
    if (!menuOpen || !touchStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    if (deltaX < -48 && Math.abs(deltaY) < 80) {
      closeMenu();
    }
  }

  const drawerVisible = menuOpen || menuClosing;
  const swipeHandlers = {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd
  };

  return (
    <>
      {drawerVisible ? (
        <button
          className={`nav-backdrop ${menuClosing ? "closing" : ""}`}
          type="button"
          aria-label="Close menu"
          onClick={closeMenu}
          {...swipeHandlers}
        />
      ) : null}
      <header
        className={`navbar ${menuOpen ? "menu-open" : ""} ${menuClosing ? "menu-closing" : ""} ${isScrolled ? "scrolled" : ""}`}
        {...swipeHandlers}
      >
        <Link to="/" className="brand" aria-label="Hachi home" onClick={closeMenu}>
          <span className="brand-icon-wrap">
            <img src={appLogo} alt="Hachi logo" width={28} height={28} />
          </span>
          <span>Hachi</span>
        </Link>

        <nav className="nav-links" aria-label="Main navigation" id="main-navigation">
          <NavLink to="/" onClick={closeMenu}>
            <Home size={17} aria-hidden="true" />
            Home
          </NavLink>
          <NavLink to="/generator" onClick={closeMenu}>
            <Sparkles size={17} aria-hidden="true" />
            Generator
          </NavLink>
          <NavLink to="/history" onClick={closeMenu}>
            <History size={17} aria-hidden="true" />
            History
          </NavLink>
          <NavLink to="/library" onClick={closeMenu}>
            <Library size={17} aria-hidden="true" />
            Library
          </NavLink>
          <NavLink to="/friends" onClick={closeMenu}>
            <Users size={17} aria-hidden="true" />
            Friends
          </NavLink>
        </nav>

        <div className="sidebar-decks" aria-label="Reviewer shortcuts">
          <div className="sidebar-decks-head">
            <strong>Reviewers</strong>
          </div>
          <Link to="/library" onClick={closeMenu}>
            <Download size={17} aria-hidden="true" />
            Saved offline
          </Link>
          <Link to="/library" onClick={closeMenu}>
            <Cloud size={17} aria-hidden="true" />
            Cloud library
          </Link>
          <Link to="/friends" onClick={closeMenu}>
            <Share2 size={17} aria-hidden="true" />
            Shared
          </Link>
        </div>

        <div className="navbar-controls">
          {!isOnline ? (
            <span className="offline-pill" role="status">
              <WifiOff size={16} aria-hidden="true" />
              Offline
            </span>
          ) : null}

          <button
            className="icon-button menu-toggle"
            type="button"
            onClick={openMenu}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
          >
            <Menu size={19} aria-hidden="true" />
          </button>

          <button className="icon-button theme-toggle" type="button" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>
    </>
  );
}
