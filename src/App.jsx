import { Camera, CheckCircle2, Download, Gauge, Mail, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const RECIPIENT_EMAIL = "recipient@example.invalid";

function App() {
  const pageRef = useRef(null);
  const [tripType, setTripType] = useState("Departure");
  const [name, setName] = useState("");
  const [bacValue, setBacValue] = useState("");
  const [note, setNote] = useState("");
  const [personPhoto, setPersonPhoto] = useState(null);
  const [bacPhoto, setBacPhoto] = useState(null);
  const [currentStep, setCurrentStep] = useState("details");
  const [reportFile, setReportFile] = useState(null);
  const [createdAt, setCreatedAt] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const canContinueDetails = name.trim() && bacValue.trim();
  const canCreate = canContinueDetails && personPhoto && bacPhoto;
  const emailSubject = buildEmailSubject(reportData);

  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [currentStep]);

  const reportData = useMemo(
    () => ({
      tripType,
      name: name.trim(),
      bacValue: bacValue.trim(),
      note: note.trim(),
      dateTime: createdAt,
      personPhotoName: personPhoto?.name || "person photo",
      bacPhotoName: bacPhoto?.name || "bac photo"
    }),
    [bacPhoto, bacValue, createdAt, name, note, personPhoto, tripType]
  );

  async function createReport(event) {
    event.preventDefault();
    if (!canCreate) {
      setStatus("Please complete all required fields and both photos.");
      return;
    }

    setBusy(true);
    setStatus("");

    const timestamp = new Date();
    const currentReportData = { ...reportData, dateTime: timestamp };
    const reportText = buildReportText(currentReportData);
    const fileStamp = formatFileDate(timestamp);
    const reportName = `proofflow-report-${safeFilePart(tripType)}-${safeFilePart(name)}-${fileStamp}.txt`;
    const emailName = `proofflow-email-${safeFilePart(tripType)}-${safeFilePart(name)}-${fileStamp}.eml`;
    const reportFileForAttachment = new File([reportText], reportName, { type: "text/plain" });
    const personFile = renamePhotoFile(personPhoto, `person-photo-${fileStamp}`);
    const bacFile = renamePhotoFile(bacPhoto, `bac-meter-photo-${fileStamp}`);
    const emailText = await buildEmlMessage(currentReportData, [reportFileForAttachment, personFile, bacFile]);
    const emailBlob = new Blob([emailText], { type: "message/rfc822;charset=utf-8" });
    const emailFile = new File([emailBlob], emailName, { type: "message/rfc822" });
    const url = URL.createObjectURL(emailBlob);

    if (reportFile?.url) URL.revokeObjectURL(reportFile.url);
    setCreatedAt(timestamp);
    setReportFile({
      file: emailFile,
      files: [emailFile],
      name: emailName,
      text: emailText,
      url
    });
    downloadUrl(url, emailName);
    setStatus(`Email file created for ${RECIPIENT_EMAIL}. Subject: ${buildEmailSubject(currentReportData)}`);
    setBusy(false);
  }

  async function shareReport() {
    const files = reportFile?.files || [];
    if (files.length === 0) return;

    if (navigator.canShare?.({ files }) && navigator.share) {
      await navigator.share({
        files,
        title: buildEmailSubject(reportData),
        text: buildEmailBody(reportData)
      });
      return;
    }

    setStatus("Your browser cannot share the email file directly. Open the downloaded .eml file from Files/Mail.");
  }

  function goToStep(step) {
    setCurrentStep(step);
    requestAnimationFrame(() => pageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function updatePersonPhoto(file) {
    setPersonPhoto(file);
    requestAnimationFrame(() => pageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function updateBacPhoto(file) {
    setBacPhoto(file);
    requestAnimationFrame(() => pageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function resetFlow() {
    if (reportFile?.url) URL.revokeObjectURL(reportFile.url);
    setTripType("Departure");
    setName("");
    setBacValue("");
    setNote("");
    setPersonPhoto(null);
    setBacPhoto(null);
    setReportFile(null);
    setCreatedAt(new Date());
    setStatus("");
    setCurrentStep("details");
  }

  return (
    <main className="app-shell">
      <section className="page mobile-page" ref={pageRef}>
        <header className="hero compact-hero">
          <div className="hero-copy">
            <div className="brand-line">
              <ShieldCheck size={26} />
              <span>ProofFlow</span>
            </div>
            <h1>Alcohol Check</h1>
            <p>Submit an arrival or departure alcohol check.</p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="meter-card">
              <Gauge size={44} />
              <span>0.00</span>
              <small>BAC</small>
            </div>
            <div className="photo-card">
              <Camera size={28} />
              <span>2 photos</span>
            </div>
          </div>
        </header>

        <form className="submission-panel" onSubmit={createReport}>
          <div className="flow-progress">
            <StepPill active={currentStep === "details"} done={canContinueDetails} label="1. Details" />
            <StepPill active={currentStep === "photos"} done={Boolean(personPhoto && bacPhoto)} label="2. Photos" />
            <StepPill active={currentStep === "send"} done={Boolean(reportFile)} label="3. Send" />
          </div>

          {currentStep === "details" && (
            <section className="form-step">
              <div className="choice-row" role="radiogroup" aria-label="Trip type">
                {["Departure", "Arrival"].map((option) => (
                  <button
                    className={tripType === option ? "choice-button active" : "choice-button"}
                    key={option}
                    onClick={() => setTripType(option)}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>

              <label>
                Name
                <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required />
              </label>

              <label>
                BAC value
                <input
                  inputMode="decimal"
                  value={bacValue}
                  onChange={(event) => setBacValue(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>

              <label>
                Notes
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
              </label>

              <button className="primary-button wide big-next" disabled={!canContinueDetails} onClick={() => goToStep("photos")} type="button">
                Continue
              </button>
            </section>
          )}

          {currentStep === "photos" && (
            <section className="form-step">
              <CameraStep
                capture="user"
                file={personPhoto}
                inputId="person-photo"
                onChange={updatePersonPhoto}
                title="Person photo"
              />
              <CameraStep
                capture="environment"
                file={bacPhoto}
                inputId="bac-photo"
                onChange={updateBacPhoto}
                title="BAC meter photo"
              />
              <button className="primary-button wide big-next" disabled={!personPhoto || !bacPhoto} onClick={() => goToStep("send")} type="button">
                Review
              </button>
            </section>
          )}

          {currentStep === "send" && (
            <section className="review-screen">
              <div className="summary-list">
                <SummaryRow label="To" value={RECIPIENT_EMAIL} />
                <SummaryRow label="Subject" value={emailSubject} />
                <SummaryRow label="Type" value={tripType} />
                <SummaryRow label="Name" value={name || "-"} />
                <SummaryRow label="BAC" value={bacValue || "-"} />
                <SummaryRow label="Date" value={formatDisplayDate(reportData.dateTime)} />
                <SummaryRow label="Time" value={formatDisplayTime(reportData.dateTime)} />
              </div>

              <div className="review-grid">
                <PhotoPreview file={personPhoto} onRetake={() => goToStep("photos")} title="Person photo" />
                <PhotoPreview file={bacPhoto} onRetake={() => goToStep("photos")} title="BAC meter photo" />
              </div>

              {status && <p className={reportFile ? "success" : "info"}>{status}</p>}

              <div className="action-grid">
                <button className="primary-button" disabled={!canCreate || busy} type="submit">
                  <Download size={20} />
                  {busy ? "Creating..." : "Create email file"}
                </button>
                <button className="secondary-button" disabled={!reportFile} onClick={shareReport} type="button">
                  <Send size={20} />
                  Send email
                </button>
              </div>
            </section>
          )}

          <div className="footer-actions">
            {currentStep !== "details" && (
              <button className="text-button" onClick={() => goToStep(currentStep === "send" ? "photos" : "details")} type="button">
                Back
              </button>
            )}
            <button className="text-button" onClick={resetFlow} type="button">
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>

        <section className="notice">
          <Mail size={20} />
          <p>Create email file first, then tap Send email to open/share the prepared message with all attachments.</p>
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

function CameraStep({ capture, file, inputId, onChange, title }) {
  const preview = useObjectUrl(file);

  return (
    <section className="camera-step compact-camera">
      <div className="camera-step-title">
        <h2>{title}</h2>
        {file && <span>Ready</span>}
      </div>
      <div className="camera-preview">{preview ? <img alt="" src={preview} /> : <Camera size={48} />}</div>
      <label className="camera-button secondary-camera" htmlFor={inputId}>
        <Camera size={24} />
        <span>{file ? "Retake photo" : "Open camera"}</span>
      </label>
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
        Change
      </button>
    </article>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function useObjectUrl(file) {
  return useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
}

function buildEmailSubject(data) {
  return `${data.tripType} alcohol check - ${data.name || "Unknown"} - ${formatFileDate(data.dateTime)}`;
}

function buildEmailBody(data) {
  return [
    "Hello,",
    "",
    "Please find the alcohol check details below.",
    "",
    `Check type: ${data.tripType}`,
    `Name: ${data.name}`,
    `Date: ${formatDisplayDate(data.dateTime)}`,
    `Time: ${formatDisplayTime(data.dateTime)}`,
    `BAC value: ${data.bacValue}`,
    "",
    "Attached photo files:",
    `Person photo: ${data.personPhotoName}`,
    `BAC meter photo: ${data.bacPhotoName}`,
    "",
    data.note ? `Notes: ${data.note}` : "Notes: -",
    "",
    "Please make sure the report file and both photos are attached."
  ].join("\n");
}

function buildReportText(data) {
  return [
    "PROOFFLOW ALCOHOL CHECK REPORT",
    "================================",
    "",
    `Recipient: ${RECIPIENT_EMAIL}`,
    `Check type: ${data.tripType}`,
    `Name: ${data.name}`,
    `Date: ${formatDisplayDate(data.dateTime)}`,
    `Time: ${formatDisplayTime(data.dateTime)}`,
    `BAC value: ${data.bacValue}`,
    "",
    "Photos",
    "------",
    `Person photo: ${data.personPhotoName}`,
    `BAC meter photo: ${data.bacPhotoName}`,
    "",
    "Notes",
    "-----",
    data.note || "-"
  ].join("\n");
}

async function buildEmlMessage(data, attachments) {
  const boundary = `proofflow-${crypto.randomUUID()}`;
  const subject = buildEmailSubject(data);
  const body = buildEmailBody(data);
  const encodedAttachments = await Promise.all(attachments.map(async (file) => ({ file, base64: await fileToBase64(file) })));

  return [
    `To: ${RECIPIENT_EMAIL}`,
    `Subject: ${sanitizeHeader(subject)}`,
    `Date: ${data.dateTime.toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    "",
    ...encodedAttachments.flatMap(({ file, base64 }) => [
      `--${boundary}`,
      `Content-Type: ${file.type || "application/octet-stream"}; name="${sanitizeHeader(file.name)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${sanitizeHeader(file.name)}"`,
      "",
      wrapBase64(base64),
      ""
    ]),
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

function downloadUrl(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

function renamePhotoFile(file, baseName) {
  const extension = getFileExtension(file.name) || imageExtensionFromType(file.type);
  return new File([file], `${baseName}${extension}`, { type: file.type || "image/jpeg" });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function wrapBase64(value) {
  return String(value).replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function sanitizeHeader(value) {
  return String(value).replace(/[\r\n"]/g, " ").trim();
}

function getFileExtension(fileName) {
  const match = String(fileName).match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : "";
}

function imageExtensionFromType(type) {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

function safeFilePart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "check";
}

function formatFileDate(date) {
  return date.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDisplayTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

createRoot(document.getElementById("root")).render(<App />);
