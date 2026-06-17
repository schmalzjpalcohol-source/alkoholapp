import { Camera, CheckCircle2, Gauge, Mail, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const TRIP_TYPES = [
  { value: "beforeWork", label: "業務前" },
  { value: "afterWork", label: "業務後" }
];

function App() {
  const pageRef = useRef(null);
  const [tripType, setTripType] = useState("beforeWork");
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

  const canContinueDetails = name.trim();
  const canContinuePhotos = personPhoto && bacPhoto && bacValue.trim();
  const canCreate = canContinueDetails && canContinuePhotos;

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

  async function createAttachmentFiles(timestamp) {
    if (!canCreate) {
      return null;
    }

    const currentReportData = { ...reportData, dateTime: timestamp };
    const fileStamp = formatFileDate(timestamp);
    const typeLabel = getTripTypeLabel(tripType);
    const baseName = `alcohol-check-${safeFilePart(name)}-${typeLabel}-${fileStamp}`;
    const reportPdf = await buildReportPdf(currentReportData, personPhoto, bacPhoto, `${baseName}.pdf`);
    const personImage = renamePhotoFile(personPhoto, `${baseName}-separate-本人写真`);
    const bacImage = renamePhotoFile(bacPhoto, `${baseName}-separate-検知器写真`);
    return {
      data: currentReportData,
      files: [reportPdf, personImage, bacImage]
    };
  }

  async function sendEmail(event) {
    event.preventDefault();
    if (!canCreate) {
      setStatus("必須項目を入力し、2枚の写真を撮影して、BrAC値を入力してください。");
      return;
    }

    setBusy(true);
    setStatus("");

    const timestamp = new Date();
    const packageData = await createAttachmentFiles(timestamp);
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
        setStatus(`Outlook件名: ${buildEmailSubject(packageData.data)}`);
        return;
      }

      setStatus("このブラウザではファイルを添付できません。iPhoneのSafariまたはOutlookアプリから開き直して、もう一度「Outlookで送信」を押してください。");
    } catch {
      setStatus("メール共有がキャンセルされました。もう一度「Outlookで送信」を押してください。");
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
    setTripType("beforeWork");
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
            <p>業務前・業務後のアルコール確認を送信します。</p>
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
            <StepPill active={currentStep === "details"} done={canContinueDetails} label="1. 基本情報" />
            <StepPill active={currentStep === "photos"} done={Boolean(canContinuePhotos)} label="2. 写真・数値" />
            <StepPill active={currentStep === "send"} done={Boolean(canCreate)} label="3. 送信" />
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
                ショートネーム
                <input autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} placeholder="ショートネームを入力" required />
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

              <label>
                BrAC値
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

              <button className="primary-button wide big-next" disabled={!canContinuePhotos} onClick={() => goToStep("send")} type="button">
                確認する
              </button>
            </section>
          )}

          {currentStep === "send" && (
            <section className="review-screen">
              <div className="summary-list">
                <SummaryRow label="件名" value={emailSubject} />
                <SummaryRow label="種別" value={getTripTypeLabel(tripType)} />
                <SummaryRow label="ショートネーム" value={name || "-"} />
                <SummaryRow label="BrAC値" value={bacValue || "-"} />
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
                  {busy ? "準備中..." : "Outlookで送信"}
                </button>
              </div>
              <p className="attachment-note">別添付: PDF報告書 + separate本人写真 + separate検知器写真</p>
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
          <p>Outlookの自動仕分け用に件名は固定形式です。送信時はPDF報告書に加えて、本人写真と検知器写真も本文ではなく別ファイルとして添付されます。</p>
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
  const trip = getTripType(data.tripType);
  return `【アルコールチェック報告】【${trip.label}】【${formatSubjectDate(data.dateTime)}】【${data.name || "ショートネーム未入力"}】【BrAC:${data.bacValue || "-"}】`;
}

function buildEmailBody(data) {
  return [
    "お疲れさまです。",
    "",
    "アルコールチェックの内容を送付します。",
    "",
    `件名: ${buildEmailSubject(data)}`,
    `種別: ${getTripTypeLabel(data.tripType)}`,
    `ショートネーム: ${data.name}`,
    `日付: ${formatDisplayDate(data.dateTime)}`,
    `時刻: ${formatDisplayTime(data.dateTime)}`,
    `BrAC値: ${data.bacValue}`,
    "",
    "添付ファイル:",
    "1. PDF報告書（入力内容と2枚の写真を含む）",
    "2. 本人写真（本文ではなく別添付）",
    "3. アルコール検知器の写真（本文ではなく別添付）",
    "",
    data.note ? `備考: ${data.note}` : "備考: -"
  ].join("\n");
}

async function buildReportPdf(data, personPhoto, bacPhoto, fileName) {
  const pageWidth = 1240;
  const pageHeight = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = pageWidth;
  canvas.height = pageHeight;

  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, pageWidth, pageHeight);

  context.fillStyle = "#0f766e";
  context.fillRect(0, 0, pageWidth, 180);
  context.fillStyle = "#ffffff";
  context.font = "700 58px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  context.fillText("アルコールチェック報告書", 72, 92);
  context.font = "400 30px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  context.fillText("Alcohol Check Report", 76, 142);

  const rows = [
    ["件名", buildEmailSubject(data)],
    ["種別", getTripTypeLabel(data.tripType)],
    ["ショートネーム", data.name || "-"],
    ["日付", formatDisplayDate(data.dateTime)],
    ["時刻", formatDisplayTime(data.dateTime)],
    ["BrAC値", data.bacValue || "-"],
    ["備考", data.note || "-"]
  ];

  let y = 250;
  context.fillStyle = "#172026";
  context.font = "700 34px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  context.fillText("確認内容", 72, y);
  y += 38;

  rows.forEach(([label, value]) => {
    context.fillStyle = "#eef3f2";
    context.fillRect(72, y, 1096, 48);
    context.fillStyle = "#52676b";
    context.font = "700 20px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
    context.fillText(label, 96, y + 31);
    context.fillStyle = "#172026";
    context.font = "500 21px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
    drawWrappedText(context, String(value), 270, y + 28, 860, 24, 2);
    y += 54;
  });

  y += 10;
  context.fillStyle = "#172026";
  context.font = "700 34px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  context.fillText("写真", 72, y);
  y += 26;

  const [personImage, bacImage] = await Promise.all([loadImageFromFile(personPhoto), loadImageFromFile(bacPhoto)]);
  drawPhotoBlock(context, personImage, "本人写真", 72, y, 536, 840);
  drawPhotoBlock(context, bacImage, "アルコール検知器の写真", 632, y, 536, 840);

  context.fillStyle = "#66777d";
  context.font = "400 20px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  context.fillText("PDFに加えて、メールには2枚の写真ファイルも別添付されています。", 72, 1648);

  const jpegBytes = await canvasToJpegBytes(canvas, 0.72);
  const pdfBytes = createSingleImagePdf(jpegBytes, pageWidth, pageHeight);
  return new File([pdfBytes], fileName, { type: "application/pdf" });
}

function drawPhotoBlock(context, image, title, x, y, width, height) {
  context.fillStyle = "#f7faf9";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "#d6e0de";
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);

  context.fillStyle = "#172026";
  context.font = "700 25px -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  context.fillText(title, x + 18, y + 38);

  const imageBox = { x: x + 18, y: y + 58, width: width - 36, height: height - 78 };
  const scale = Math.min(imageBox.width / image.width, imageBox.height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = imageBox.x + (imageBox.width - drawWidth) / 2;
  const drawY = imageBox.y + (imageBox.height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = Array.from(text);
  let line = "";
  let lineCount = 0;
  chars.forEach((char, index) => {
    const testLine = line + char;
    const isLast = index === chars.length - 1;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, y + lineCount * lineHeight);
      line = char;
      lineCount += 1;
    } else {
      line = testLine;
    }
    if (isLast && line && lineCount < maxLines) {
      context.fillText(line, x, y + lineCount * lineHeight);
    }
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be loaded"));
    };
    image.src = url;
  });
}

function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)));
      },
      "image/jpeg",
      quality
    );
  });
}

function createSingleImagePdf(jpegBytes, imageWidth, imageHeight) {
  const pageWidth = 595;
  const pageHeight = 842;
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  const objects = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concatBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
      jpegBytes,
      ascii("\nendstream")
    ]),
    ascii(`<< /Length ${content.length} >>\nstream\n${content}endstream`)
  ];

  const chunks = [ascii("%PDF-1.4\n")];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(totalLength(chunks));
    chunks.push(ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n"));
  });

  const xrefOffset = totalLength(chunks);
  chunks.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  offsets.slice(1).forEach((offset) => {
    chunks.push(ascii(`${String(offset).padStart(10, "0")} 00000 n \n`));
  });
  chunks.push(ascii(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));

  return concatBytes(chunks);
}

function ascii(value) {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks) {
  const output = new Uint8Array(totalLength(chunks));
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function totalLength(chunks) {
  return chunks.reduce((sum, chunk) => sum + chunk.length, 0);
}

function renamePhotoFile(file, baseName) {
  const extension = getFileExtension(file.name) || imageExtensionFromType(file.type);
  return new File([file], `${baseName}${extension}`, { type: file.type || "image/jpeg" });
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
  return getTripType(value).label;
}

function getTripType(value) {
  return TRIP_TYPES.find((item) => item.value === value) || TRIP_TYPES[0];
}

function safeFilePart(value) {
  return String(value).trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-") || "check";
}

function formatFileDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}${minute}`;
}

function formatSubjectDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("ja-JP", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDisplayTime(date) {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

createRoot(document.getElementById("root")).render(<App />);
