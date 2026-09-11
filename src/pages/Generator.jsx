import { useEffect, useState } from "react";
import { FileText, HardDrive, Sparkles, Wifi, WifiOff } from "lucide-react";

export default function Generator() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

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
    <div className="page">
      <section className="section-heading">
        <div>
          <p className="eyebrow">AI Generator</p>
          <h1>Create a reviewer from a file</h1>
          <p className="muted">This is the workspace for turning PDFs, notes, and handouts into quiz-ready reviewer JSON.</p>
        </div>
        <span className={`generator-status ${isOnline ? "online" : "offline"}`}>
          {isOnline ? <Wifi size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}
          {isOnline ? "Online AI ready later" : "Offline mode"}
        </span>
      </section>

      <section className="generator-layout">
        <div className="generator-panel">
          <div className="generator-panel-head">
            <FileText size={22} aria-hidden="true" />
            <div>
              <h2>Study File</h2>
              <p className="muted">PDF, DOCX, TXT, or pasted notes will go here.</p>
            </div>
          </div>

          <label className="upload-zone">
            <input type="file" disabled aria-label="Upload study file" />
            <Sparkles size={28} aria-hidden="true" />
            <strong>File upload is planned</strong>
            <span>When connected, this will send the file to online AI. Offline support will depend on device AI availability.</span>
          </label>

          <label className="prompt-box">
            <span>Reviewer Instructions</span>
            <textarea
              disabled
              value="Create a complete multiple-choice reviewer from only the attached study material. Keep answers verifiable and include explanations."
              readOnly
            />
          </label>

          <button className="button primary large" type="button" disabled>
            <Sparkles size={18} aria-hidden="true" />
            Generate Reviewer
          </button>
        </div>

        <aside className="generator-panel">
          <div className="generator-panel-head">
            <HardDrive size={22} aria-hidden="true" />
            <div>
              <h2>How It Will Work</h2>
              <p className="muted">The same screen can support online accounts and device-only use later.</p>
            </div>
          </div>

          <div className="generator-path-list">
            <article>
              <span>Online and signed in</span>
              <p>Use online AI to generate reviewers, save them to the database, share them with friends, and optionally save a copy for offline study.</p>
            </article>
            <article>
              <span>Offline or not signed in</span>
              <p>Use the current local reviewer system. Generated or saved reviewers stay on the device only.</p>
            </article>
            <article>
              <span>Future iPhone app</span>
              <p>If Apple device AI is available to developers, this page can route offline generation through the phone instead of the cloud.</p>
            </article>
          </div>
        </aside>
      </section>
    </div>
  );
}
