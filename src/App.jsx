import { Camera, CheckCircle2, Gauge, Mail, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const RECIPIENT_EMAIL = "recipient@example.invalid";
const TRIP_TYPES = [
  { value: "departure", label: "出発" },
  { value: "arrival", label: "到着" }
];

function App() {
  const pageRef = useRef(null);
  const [tripType, setTripType] = useState("departure");
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
      personPhotoName: personPhoto?.name || "本人写真",
      bacPhotoName: bacPhoto?.name || "アルコール検知器の写真"
    }),
    [bacPhoto, bacValue, createdAt, name, note, personPhoto, tripType]
  );
  const emailSubject = buildEmailSubject(reportData);

  function createAttachmentFiles(timestamp) {
    if (!canCreate) {
      return null;
    }

    const currentReportData = { ...reportData, dateTime: timestamp };
    const reportText = buildReportText(currentReportData);
    const fileStamp = formatFileDate(timestamp);
    const reportName = `proofflow-report-${safeFilePart(tripType)}-${safeFilePart(name)}-${fileStamp}.txt`;
    return {
      data: currentReportData,
      files: [
        new File([reportText], reportName, { type: "text/plain" }),
        renamePhotoFile(personPhoto, `person-photo-${fileStamp}`),
        renamePhotoFile(bacPhoto, `bac-meter-photo-${fileStamp}`)
      ]
    };
  }

  async function sendEmail(event) {
    event.preventDefault();
    if (!canCreate) {
      setStatus("必須項目を入力し、2枚の写真を撮影してください。");
      return;
    }

    setBusy(true);
    setStatus("");

    const timestamp = new Date();
    const packageData = createAttachmentFiles(timestamp);
    if (!packageData) return;

    setCreatedAt(timestamp);
    setReportFile({ files: packageData.files });

    try {
      if (navigator.canShare?.({ files: packageData.files }) && navigator.share) {
        await navigator.share({
          files: packageData.files,
          title: buildEmailSubject(packageData.data),
          text: buildEmailBody(packageData.data)
        });
        setStatus(`宛先: ${RECIPIENT_EMAIL} / 件名: ${buildEmailSubject(packageData.data)}`);
        return;
      }

      setStatus("このブラウザではファイルを添付できません。iPhoneのSafariで開き直して、もう一度「メールを送信」を押してください。");
    } catch {
      setStatus("メール共有がキャンセルされました。もう一度「メールを送信」を押してください。");
    } finally {
      setBusy(false);
    }
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
    setTripType("departure");
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
      <section className={`page mobile-page ${currentStep === "details" ? "is-details" : "is-compact-flow"}`} ref={pageRef}>
        <header className="hero compact-hero">
          <div className="hero-copy">
            <div className="brand-line">
              <ShieldCheck size={26} />
              <span>ProofFlow</span>
            </div>
            <h1>アルコールチェック</h1>
            <p>出発・到着時のアルコール確認を送信します。</p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="meter-card">
              <Gauge size={44} />
              <span>0.00</span>
              <small>BAC</small>
            </div>
            <div className="photo-card">
              <Camera size={28} />
              <span>写真2枚</span>
            </div>
          </div>
        </header>

        <form className="submission-panel" onSubmit={sendEmail}>
          <div className="flow-progress">
            <StepPill active={currentStep === "details"} done={canContinueDetails} label="1. 入力" />
            <StepPill active={currentStep === "photos"} done={Boolean(personPhoto && bacPhoto)} label="2. 写真" />
            <StepPill active={currentStep === "send"} done={Boolean(personPhoto && bacPhoto)} label="3. 送信" />
          </div>

          {currentStep === "details" && (
            <section className="form-step">
              <div className="choice-row" role="radiogroup" aria-label="確認種別">
                {TRIP_TYPES.map((option) => (
                  <button
                    className={tripType === option.value ? "choice-button active" : "choice-button"}
                    key={option.value}
                    onClick={() => setTripType(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label>
                氏名
                <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="氏名を入力" required />
              </label>

              <label>
                BAC値
                <input
                  inputMode="decimal"
                  value={bacValue}
                  onChange={(event) => setBacValue(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>

              <label>
                備考
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="任意" />
              </label>

              <button className="primary-button wide big-next" disabled={!canContinueDetails} onClick={() => goToStep("photos")} type="button">
                続ける
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
                title="本人写真"
              />
              <CameraStep
                capture="environment"
                file={bacPhoto}
                inputId="bac-photo"
                onChange={updateBacPhoto}
                title="アルコール検知器の写真"
              />
              <button className="primary-button wide big-next" disabled={!personPhoto || !bacPhoto} onClick={() => goToStep("send")} type="button">
                確認する
              </button>
            </section>
          )}

          {currentStep === "send" && (
            <section className="review-screen">
              <div className="summary-list">
                <SummaryRow label="宛先" value={RECIPIENT_EMAIL} />
                <SummaryRow label="件名" value={emailSubject} />
                <SummaryRow label="種別" value={getTripTypeLabel(tripType)} />
                <SummaryRow label="氏名" value={name || "-"} />
                <SummaryRow label="BAC値" value={bacValue || "-"} />
                <SummaryRow label="日付" value={formatDisplayDate(reportData.dateTime)} />
                <SummaryRow label="時刻" value={formatDisplayTime(reportData.dateTime)} />
              </div>

              <div className="review-grid">
                <PhotoPreview file={personPhoto} onRetake={() => goToStep("photos")} title="本人写真" />
                <PhotoPreview file={bacPhoto} onRetake={() => goToStep("photos")} title="検知器写真" />
              </div>

              {status && <p className={reportFile ? "success" : "info"}>{status}</p>}

              <div className="action-grid">
                <button className="primary-button" disabled={!canCreate || busy} type="submit">
                  <Send size={20} />
                  {busy ? "準備中..." : "メールを送信"}
                </button>
              </div>
            </section>
          )}

          <div className="footer-actions">
            {currentStep !== "details" && (
              <button className="text-button" onClick={() => goToStep(currentStep === "send" ? "photos" : "details")} type="button">
                戻る
              </button>
            )}
            <button className="text-button" onClick={resetFlow} type="button">
              <RotateCcw size={16} />
              リセット
            </button>
          </div>
        </form>

        <section className="notice">
          <Mail size={20} />
          <p>「メールを送信」を押すと、レポートと2枚の写真を添付した状態でiPhoneの共有画面が開きます。メールアプリを選んで送信してください。</p>
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
        {file && <span>完了</span>}
      </div>
      <div className="camera-preview">{preview ? <img alt="" src={preview} /> : <Camera size={48} />}</div>
      <label className="camera-button secondary-camera" htmlFor={inputId}>
        <Camera size={24} />
        <span>{file ? "撮り直す" : "カメラを開く"}</span>
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
        変更
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
  return `アルコールチェック（${getTripTypeLabel(data.tripType)}） - ${data.name || "氏名未入力"} - ${formatFileDate(data.dateTime)}`;
}

function buildEmailBody(data) {
  return [
    "お疲れさまです。",
    "",
    "アルコールチェックの内容を送付します。",
    "",
    `種別: ${getTripTypeLabel(data.tripType)}`,
    `氏名: ${data.name}`,
    `日付: ${formatDisplayDate(data.dateTime)}`,
    `時刻: ${formatDisplayTime(data.dateTime)}`,
    `BAC値: ${data.bacValue}`,
    "",
    "添付ファイル:",
    `本人写真: ${data.personPhotoName}`,
    `アルコール検知器の写真: ${data.bacPhotoName}`,
    "",
    data.note ? `備考: ${data.note}` : "備考: -",
    "",
    "レポートファイルと2枚の写真が添付されています。"
  ].join("\n");
}

function buildReportText(data) {
  return [
    "PROOFFLOW アルコールチェック レポート",
    "====================================",
    "",
    `宛先: ${RECIPIENT_EMAIL}`,
    `種別: ${getTripTypeLabel(data.tripType)}`,
    `氏名: ${data.name}`,
    `日付: ${formatDisplayDate(data.dateTime)}`,
    `時刻: ${formatDisplayTime(data.dateTime)}`,
    `BAC値: ${data.bacValue}`,
    "",
    "写真",
    "----",
    `本人写真: ${data.personPhotoName}`,
    `アルコール検知器の写真: ${data.bacPhotoName}`,
    "",
    "備考",
    "----",
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

function getTripTypeLabel(value) {
  return TRIP_TYPES.find((item) => item.value === value)?.label || value;
}

function safeFilePart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "check";
}

function formatFileDate(date) {
  return date.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("ja-JP", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDisplayTime(date) {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

createRoot(document.getElementById("root")).render(<App />);
