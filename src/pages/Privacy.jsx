import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="page narrow">
      <section className="legal-panel">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy Policy</h1>
        <p>Hachi stores reviewer data on this device for offline use and, when you sign in, can sync your reviewers to your Supabase account.</p>
        <h2>Data We Use</h2>
        <p>We use your sign-in email, display name, profile photo, reviewers, quiz progress, quiz history, friendships, and shared reviewers to run the app features you choose to use.</p>
        <h2>AI Generation</h2>
        <p>When you generate a reviewer, uploaded or pasted study material is sent to the configured Gemini API endpoint so questions can be created.</p>
        <h2>Your Controls</h2>
        <p>You can delete device data or cloud app data from Account Settings. Browser storage is local to the device and cloud data is tied to your signed-in account.</p>
        <Link className="button subtle" to="/account">Back to Account</Link>
      </section>
    </div>
  );
}
