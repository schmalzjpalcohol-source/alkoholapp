import {
  Camera,
  CheckCircle2,
  Clock3,
  FileImage,
  LogOut,
  Search,
  Shield,
  UploadCloud,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function api(path, options = {}) {
  return fetch(path, {
    credentials: "include",
    ...options,
    headers: options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options.headers }
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    })
    .catch((error) => {
      if (error instanceof TypeError) {
        throw new Error("Server is not reachable. Start it with npm run local and open http://127.0.0.1:3000.");
      }

      throw error;
    });
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/me")
      .then((data) => setUser(data.user))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api("/api/logout", { method: "POST" });
    setUser(null);
  }

  if (loading) return <div className="boot">Loading...</div>;

  return (
    <main className="app-shell">
      {user ? (
        <>
          <Topbar user={user} onLogout={logout} />
          {user.role === "admin" ? <AdminDashboard /> : <UserDashboard user={user} />}
        </>
      ) : (
        <Login onLogin={setUser} />
      )}
    </main>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("supervisor@example.invalid");
  const [password, setPassword] = useState("supervisor123");
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/demo-accounts")
      .then((data) => setAccounts(data.accounts))
      .catch(() => {
        setAccounts([
          { email: "supervisor@example.invalid", password: "supervisor123", role: "admin", name: "Test Supervisor" },
          { email: "driver@example.invalid", password: "driver123", role: "user", name: "Demo Driver" }
        ]);
      });
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function fillAccount(account) {
    setEmail(account.email);
    setPassword(account.password);
  }

  return (
    <section className="login-layout">
      <div className="brand-panel">
        <div className="brand-mark">
          <Shield size={34} />
        </div>
        <h1>ProofFlow</h1>
        <p>Fast photo submission for field checks, with a clean supervisor dashboard backed by your Railway database.</p>
      </div>

      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">Secure access</span>
        <h2>Sign in</h2>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary-button" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <div className="account-picks">
          {accounts.map((account) => (
            <button key={account.email} type="button" onClick={() => fillAccount(account)}>
              <strong>{account.role === "admin" ? "Admin" : "User"}</strong>
              <span>{account.email}</span>
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}

function Topbar({ user, onLogout }) {
  return (
    <header className="topbar">
      <div>
        <strong>ProofFlow</strong>
        <span>{user.role === "admin" ? "Supervisor dashboard" : "User workspace"}</span>
      </div>
      <div className="topbar-user">
        <UserRound size={18} />
        <span>{user.email}</span>
        <button className="icon-button" onClick={onLogout} title="Log out">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function UserDashboard({ user }) {
  const [personPhoto, setPersonPhoto] = useState(null);
  const [devicePhoto, setDevicePhoto] = useState(null);
  const [note, setNote] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState("person");

  useEffect(() => {
    refreshSubmissions();
  }, []);

  async function refreshSubmissions() {
    const data = await api("/api/submissions");
    setSubmissions(data.submissions);
  }

  async function submit(event) {
    event.preventDefault();
    if (!personPhoto || !devicePhoto) return;

    const formData = new FormData();
    formData.append("personPhoto", personPhoto);
    formData.append("devicePhoto", devicePhoto);
    formData.append("note", note);

    setBusy(true);
    setStatus("");
    try {
      await api("/api/submissions", { method: "POST", body: formData });
      setPersonPhoto(null);
      setDevicePhoto(null);
      setNote("");
      setFlowStarted(false);
      setCurrentStep("person");
      setStatus("Submitted. Your photos have been saved.");
      await refreshSubmissions();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  const readyCount = [personPhoto, devicePhoto].filter(Boolean).length;
  const lastSubmission = submissions[0];

  function handlePhotoChange(kind, file) {
    if (kind === "person") {
      setPersonPhoto(file);
    } else {
      setDevicePhoto(file);
    }
    setFlowStarted(true);
  }

  return (
    <section className="mobile-workspace">
      <div className="camera-hero">
        <div>
          <span className="eyebrow">Hello {user.name}</span>
          <h1>Please send your photos</h1>
          <p>Press the green button. The phone camera will open.</p>
        </div>
        {lastSubmission && (
          <time>
            Last sent {new Date(lastSubmission.created_at).toLocaleDateString("en-GB")} at{" "}
            {new Date(lastSubmission.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </time>
        )}
      </div>

      {!flowStarted ? (
        <div className="start-actions">
          <button className="camera-button" type="button" onClick={() => setFlowStarted(true)}>
            <Camera size={30} />
            <span>START</span>
          </button>
          <button className="later-button" type="button" onClick={() => setStatus("No problem. You can submit the check later.")}>
            <Clock3 size={21} />
            <span>Later</span>
          </button>
          {status && <p className={status.startsWith("Submitted") ? "success" : "info"}>{status}</p>}
        </div>
      ) : (
        <form className="camera-flow" onSubmit={submit}>
          <div className="flow-progress">
            <StepPill active={currentStep === "person"} done={Boolean(personPhoto)} label="1. You" />
            <StepPill active={currentStep === "device"} done={Boolean(devicePhoto)} label="2. Device" />
            <StepPill active={currentStep === "review"} done={readyCount === 2} label="3. Send" />
          </div>

          {currentStep === "person" && (
            <CameraStep
              step="1"
              title="Photo of you"
              detail="Tap the big button and take a clear photo of yourself."
              capture="user"
              file={personPhoto}
              onChange={(file) => handlePhotoChange("person", file)}
              onNext={() => setCurrentStep("device")}
            />
          )}

          {currentStep === "device" && (
            <CameraStep
              step="2"
              title="Photo of the device"
              detail="Take a clear photo of the device display."
              capture="environment"
              file={devicePhoto}
              onChange={(file) => handlePhotoChange("device", file)}
              onNext={() => setCurrentStep("review")}
            />
          )}

          {currentStep === "review" && (
            <div className="review-screen">
              <div className="simple-heading">
                <span>3</span>
                <div>
                  <h2>Send photos</h2>
                  <p>Both photos are ready. Press the green button.</p>
                </div>
              </div>
              <div className="review-grid">
                <PhotoPreview title="Your photo" file={personPhoto} onRetake={() => setCurrentStep("person")} />
                <PhotoPreview title="Device photo" file={devicePhoto} onRetake={() => setCurrentStep("device")} />
              </div>

              {status && <p className={status.startsWith("Submitted") ? "success" : "error"}>{status}</p>}

              <button className="primary-button wide" disabled={!personPhoto || !devicePhoto || busy}>
                <UploadCloud size={20} />
                {busy ? "Sending..." : "SEND"}
              </button>
            </div>
          )}

          <button className="text-button" type="button" onClick={() => setFlowStarted(false)}>
            Back
          </button>
        </form>
      )}

      <section className="recent-strip">
        <div className="panel-title">
          <FileImage size={20} />
          <h2>Recent submissions</h2>
        </div>
        {submissions.length === 0 ? (
          <p className="muted">No submissions yet.</p>
        ) : (
          <div className="mini-list">
            {submissions.slice(0, 3).map((submission) => (
              <article key={submission.id}>
                <strong>{new Date(submission.created_at).toLocaleDateString("en-GB")}</strong>
                <span>{new Date(submission.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                {submission.note && <p>{submission.note}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function StepPill({ label, active, done }) {
  return (
    <span className={`step-pill ${active ? "active" : ""} ${done ? "done" : ""}`}>
      {done && <CheckCircle2 size={15} />}
      {label}
    </span>
  );
}

function CameraStep({ step, title, detail, capture, file, onChange, onNext }) {
  const inputId = `camera-${capture}`;
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  return (
    <section className="camera-step">
      <div className="simple-heading">
        <span>{step}</span>
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
      </div>
      <div className="camera-preview">
        {preview ? <img src={preview} alt="" /> : <Camera size={54} />}
      </div>
      <label className="camera-button secondary-camera" htmlFor={inputId}>
        <Camera size={24} />
        <span>{file ? "TAKE AGAIN" : "OPEN CAMERA"}</span>
      </label>
      {file && <button className="primary-button wide big-next" type="button" onClick={onNext}>NEXT</button>}
      <input
        id={inputId}
        accept="image/*"
        capture={capture}
        className="visually-hidden"
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </section>
  );
}

function PhotoPreview({ title, file, onRetake }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  return (
    <article className="review-photo">
      <div>{preview ? <img src={preview} alt="" /> : <Camera size={28} />}</div>
      <strong>{title}</strong>
      <button type="button" onClick={onRetake}>Retake</button>
    </article>
  );
}

function AdminDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([api("/api/admin/submissions"), api("/api/admin/users")]).then(([submissionData, userData]) => {
      setSubmissions(submissionData.submissions);
      setUsers(userData.users);
    });
  }, []);

  const filtered = submissions.filter((submission) => {
    const haystack = `${submission.name} ${submission.email} ${submission.note || ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <section className="workspace">
      <div className="admin-summary">
        <Metric label="Submissions" value={submissions.length} />
        <Metric label="Users" value={users.filter((u) => u.role === "user").length} />
        <Metric label="Admins" value={users.filter((u) => u.role === "admin").length} />
      </div>

      <div className="page-heading row">
        <div>
          <span className="eyebrow">Supervisor view</span>
          <h1>All submissions</h1>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input placeholder="Search by user or note" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      <div className="submission-list">
        {filtered.length === 0 ? (
          <p className="muted">No submissions found.</p>
        ) : (
          filtered.map((submission) => (
            <article className="submission-card" key={submission.id}>
              <div className="submission-meta">
                <strong>{submission.name}</strong>
                <span>{submission.email}</span>
                <time>{new Date(submission.created_at).toLocaleString("en-GB")}</time>
                {submission.note && <p>{submission.note}</p>}
              </div>
              <div className="admin-photos">
                <img src={`/uploads/${submission.person_photo}`} alt="User" />
                <img src={`/uploads/${submission.device_photo}`} alt="Device" />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
