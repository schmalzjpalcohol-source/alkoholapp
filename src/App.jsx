import { Camera, CheckCircle2, Download, FileText, Mail, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const RECIPIENT_EMAIL = "recipient@example.invalid";

function App() {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [note, setNote] = useState("");
  const [personPhoto, setPersonPhoto] = useState(null);
  const [devicePhoto, setDevicePhoto] = useState(null);
  const [currentStep, setCurrentStep] = useState("person");
  const [packageFile, setPackageFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const readyCount = [personPhoto, devicePhoto].filter(Boolean).length;
  const canCreate = name.trim() && identifier.trim() && personPhoto && devicePhoto;

  async function createSubmission(event) {
    event.preventDefault();
    if (!canCreate) {
      setStatus("Bitte Name, Kennung und beide Bilder ausfuellen.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const submission = {
        name: name.trim(),
        identifier: identifier.trim(),
        note: note.trim(),
        createdAt: new Date().toISOString(),
        personPhoto: await fileToDataUrl(personPhoto),
        devicePhoto: await fileToDataUrl(devicePhoto),
        personPhotoName: personPhoto.name || "person.jpg",
        devicePhotoName: devicePhoto.name || "geraet.jpg"
      };
      const html = buildSubmissionHtml(submission);
      const slug = `${safeFilePart(submission.identifier)}-${new Date().toISOString().slice(0, 10)}`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      if (packageFile?.url) URL.revokeObjectURL(packageFile.url);
      setPackageFile({ url, name: `abgabe-${slug}.html` });
      setStatus("Fertige Abgabedatei wurde erstellt.");
      setCurrentStep("send");
    } catch {
      setStatus("Die Datei konnte nicht erstellt werden. Bitte Bilder nochmal auswaehlen.");
    } finally {
      setBusy(false);
    }
  }

  function resetFlow() {
    if (packageFile?.url) URL.revokeObjectURL(packageFile.url);
    setPersonPhoto(null);
    setDevicePhoto(null);
    setNote("");
    setPackageFile(null);
    setStatus("");
    setCurrentStep("person");
  }

  function openEmailDraft() {
    const subject = encodeURIComponent(`Foto-Abgabe ${identifier || name}`);
    const body = encodeURIComponent(
      [
        "Hallo,",
        "",
        "anbei die fertige Foto-Abgabe.",
        "",
        `Name: ${name}`,
        `Kennung: ${identifier}`,
        note ? `Notiz: ${note}` : "",
        "",
        "Hinweis: Bitte die heruntergeladene HTML-Datei an diese E-Mail anhaengen.",
        ""
      ]
        .filter(Boolean)
        .join("\n")
    );

    window.location.href = `mailto:${RECIPIENT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <main className="app-shell">
      <section className="page">
        <header className="hero">
          <div className="hero-copy">
            <div className="brand-line">
              <ShieldCheck size={28} />
              <span>ProofFlow</span>
            </div>
            <h1>Foto-Abgabe</h1>
            <p>Bilder aufnehmen, fertige Datei erstellen und per E-Mail weiterleiten.</p>
          </div>
        </header>

        <form className="submission-panel" onSubmit={createSubmission}>
          <div className="details-grid">
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Max Mustermann" required />
            </label>
            <label>
              Kennung
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Fahrzeug, Tour oder ID" required />
            </label>
          </div>

          <div className="flow-progress">
            <StepPill active={currentStep === "person"} done={Boolean(personPhoto)} label="1. Person" />
            <StepPill active={currentStep === "device"} done={Boolean(devicePhoto)} label="2. Geraet" />
            <StepPill active={currentStep === "send"} done={Boolean(packageFile)} label="3. Datei" />
          </div>

          {currentStep === "person" && (
            <CameraStep
              capture="user"
              detail="Nimm ein klares Foto von dir auf."
              file={personPhoto}
              inputId="person-photo"
              onChange={setPersonPhoto}
              onNext={() => setCurrentStep("device")}
              step="1"
              title="Foto von dir"
            />
          )}

          {currentStep === "device" && (
            <CameraStep
              capture="environment"
              detail="Nimm ein klares Foto vom Geraet oder Display auf."
              file={devicePhoto}
              inputId="device-photo"
              onChange={setDevicePhoto}
              onNext={() => setCurrentStep("send")}
              step="2"
              title="Foto vom Geraet"
            />
          )}

          {currentStep === "send" && (
            <section className="review-screen">
              <div className="simple-heading">
                <span>3</span>
                <div>
                  <h2>Abgabe erstellen</h2>
                  <p>Beide Bilder werden in eine einzelne HTML-Datei gepackt.</p>
                </div>
              </div>

              <div className="review-grid">
                <PhotoPreview file={personPhoto} onRetake={() => setCurrentStep("person")} title="Person" />
                <PhotoPreview file={devicePhoto} onRetake={() => setCurrentStep("device")} title="Geraet" />
              </div>

              <label>
                Notiz
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
              </label>

              {status && <p className={packageFile ? "success" : "info"}>{status}</p>}

              <div className="action-grid">
                <button className="primary-button" disabled={!canCreate || busy} type="submit">
                  <FileText size={20} />
                  {busy ? "Erstelle..." : "Datei erstellen"}
                </button>
                {packageFile && (
                  <>
                    <a className="primary-button download-button" download={packageFile.name} href={packageFile.url}>
                      <Download size={20} />
                      Datei laden
                    </a>
                    <button className="secondary-button" onClick={openEmailDraft} type="button">
                      <Mail size={20} />
                      E-Mail oeffnen
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          <div className="footer-actions">
            {currentStep !== "person" && (
              <button className="text-button" onClick={() => setCurrentStep(currentStep === "send" ? "device" : "person")} type="button">
                Zurueck
              </button>
            )}
            <button className="text-button" onClick={resetFlow} type="button">
              <RotateCcw size={16} />
              Neu starten
            </button>
          </div>
        </form>

        <section className="notice">
          <Send size={20} />
          <p>
            GitHub Pages kann keine Anhaenge automatisch versenden. Deshalb zuerst die Datei herunterladen und danach an die geoeffnete E-Mail
            anhaengen.
          </p>
        </section>
      </section>
    </main>
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

function CameraStep({ capture, detail, file, inputId, onChange, onNext, step, title }) {
  const preview = useObjectUrl(file);

  return (
    <section className="camera-step">
      <div className="simple-heading">
        <span>{step}</span>
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
      </div>
      <div className="camera-preview">{preview ? <img alt="" src={preview} /> : <Camera size={54} />}</div>
      <label className="camera-button secondary-camera" htmlFor={inputId}>
        <Camera size={24} />
        <span>{file ? "Nochmal aufnehmen" : "Kamera oeffnen"}</span>
      </label>
      {file && (
        <button className="primary-button wide big-next" onClick={onNext} type="button">
          Weiter
        </button>
      )}
      <input
        accept="image/*"
        capture={capture}
        className="visually-hidden"
        id={inputId}
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        type="file"
      />
    </section>
  );
}

function PhotoPreview({ file, onRetake, title }) {
  const preview = useObjectUrl(file);

  return (
    <article className="review-photo">
      <div>{preview ? <img alt="" src={preview} /> : <Camera size={28} />}</div>
      <strong>{title}</strong>
      <button onClick={onRetake} type="button">
        Aendern
      </button>
    </article>
  );
}

function useObjectUrl(file) {
  return useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildSubmissionHtml(submission) {
  const created = new Date(submission.createdAt).toLocaleString("de-DE");

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Foto-Abgabe ${escapeHtml(submission.identifier)}</title>
  <style>
    body { color: #172026; font-family: Arial, sans-serif; margin: 0; padding: 24px; }
    h1 { margin: 0 0 8px; }
    dl { display: grid; gap: 8px; grid-template-columns: 120px 1fr; margin: 24px 0; }
    dt { color: #52676b; font-weight: 700; }
    dd { margin: 0; }
    .photos { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    figure { border: 1px solid #d6e0de; border-radius: 8px; margin: 0; padding: 12px; }
    img { display: block; max-width: 100%; width: 100%; }
    figcaption { color: #52676b; font-weight: 700; margin-top: 10px; }
    .note { background: #f3f7f6; border-radius: 8px; padding: 14px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Foto-Abgabe</h1>
  <p>Erstellt am ${escapeHtml(created)}</p>
  <dl>
    <dt>Name</dt><dd>${escapeHtml(submission.name)}</dd>
    <dt>Kennung</dt><dd>${escapeHtml(submission.identifier)}</dd>
    <dt>Notiz</dt><dd>${submission.note ? `<div class="note">${escapeHtml(submission.note)}</div>` : "Keine Notiz"}</dd>
  </dl>
  <section class="photos">
    <figure>
      <img alt="Person" src="${submission.personPhoto}">
      <figcaption>Person: ${escapeHtml(submission.personPhotoName)}</figcaption>
    </figure>
    <figure>
      <img alt="Geraet" src="${submission.devicePhoto}">
      <figcaption>Geraet: ${escapeHtml(submission.devicePhotoName)}</figcaption>
    </figure>
  </section>
</body>
</html>`;
}

function safeFilePart(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "abgabe";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

createRoot(document.getElementById("root")).render(<App />);
