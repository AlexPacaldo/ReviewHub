import { useState } from "react";
import { Cloud, LogOut, Mail, UserRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";

export default function Account() {
  const { configured, loading, session, user } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signInWithEmail(event) {
    event.preventDefault();
    setMessage("");

    if (!configured) {
      setMessage("Add your Supabase URL and anon key in .env.local first.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    setSubmitting(false);
    setMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  async function signInWithGoogle() {
    setMessage("");

    if (!configured) {
      setMessage("Add your Supabase URL and anon key in .env.local first.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage("Signed out.");
  }

  return (
    <div className="page narrow">
      <section className="setup-panel">
        <p className="eyebrow">Account</p>
        <h1>Online Sync</h1>
        <p className="muted">Sign in for cloud reviewers, database sync, friends, and sharing. Review Hub stays website-first for now, with offline study still available without an account.</p>

        <div className="account-status">
          <Cloud size={22} aria-hidden="true" />
          <div>
            <strong>{configured ? "Supabase connected" : "Supabase not configured"}</strong>
            <p className="muted">
              {configured
                ? "This device can use Supabase auth when online."
                : "Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="muted">Checking session...</p>
        ) : session ? (
          <div className="account-card">
            <UserRound size={22} aria-hidden="true" />
            <div>
              <strong>{user.email}</strong>
              <p className="muted">Signed in. Cloud reviewer sync can plug into this account next.</p>
            </div>
            <button className="button subtle" type="button" onClick={signOut}>
              <LogOut size={17} aria-hidden="true" />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="account-signin-stack">
            <button className="button primary wide" type="button" onClick={signInWithGoogle}>
              Continue with Google
            </button>
            <div className="account-divider">
              <span>or</span>
            </div>
            <form className="account-form" onSubmit={signInWithEmail}>
              <label>
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </label>
              <button className="button subtle" type="submit" disabled={submitting}>
                <Mail size={17} aria-hidden="true" />
                {submitting ? "Sending..." : "Send Sign-In Link"}
              </button>
            </form>
          </div>
        )}

        {message ? <p className="account-message">{message}</p> : null}
      </section>
    </div>
  );
}
