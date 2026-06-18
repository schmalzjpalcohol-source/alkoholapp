import { Camera, CheckCircle2, Gauge, Mail, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const TRIP_TYPES = [
  { value: "beforeWork", label: "業務前" },
  { value: "afterWork", label: "業務後" }
];
const EMAIL_TITLE = "アルコールチェック報告";
let pdfFontBytesPromise = null;

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
    const safeName = safeFilePart(name);
    const baseName = `alcohol-check-${safeName}-${typeLabel}-${fileStamp}`;
    const reportPdf = await buildReportPdf(currentReportData, personPhoto, bacPhoto, `${baseName}.pdf`);
    return {
      data: currentReportData,
      files: [reportPdf]
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
    if (!packageData) {
      setBusy(false);
      return;
    }

    setCreatedAt(timestamp);
    setReportFile({ files: packageData.files });

    try {
      if (navigator.canShare?.({ files: packageData.files }) && navigator.share) {
        await navigator.share({
          files: packageData.files,
          title: EMAIL_TITLE,
          text: buildEmailBody(packageData.data)
        });
        setStatus(`Outlook件名: ${EMAIL_TITLE}`);
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
              <p className="attachment-note">添付: PDF報告書のみ</p>
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
          <p>Outlookの件名は固定です。送信時は記録内容をまとめたPDF報告書のみ添付されます。</p>
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

function buildEmailSubject() {
  return EMAIL_TITLE;
}

function buildEmailBody(data) {
  return [
    EMAIL_TITLE,
    "",
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
    "1. PDF報告書（記録内容を含む）",
    "",
    data.note ? `備考: ${data.note}` : "備考: -"
  ].join("\n");
}

async function buildReportPdf(data, personPhoto, bacPhoto, fileName) {
  const pageWidth = 595;
  const pageHeight = 842;
  const rows = [
    ["件名", buildEmailSubject(data)],
    ["種別", getTripTypeLabel(data.tripType)],
    ["ショートネーム", data.name || "-"],
    ["日付", formatDisplayDate(data.dateTime)],
    ["時刻", formatDisplayTime(data.dateTime)],
    ["BrAC値", data.bacValue || "-"],
    ["備考", data.note || "-"]
  ];
  const [personImage, bacImage] = await Promise.all([loadImageFromFile(personPhoto), loadImageFromFile(bacPhoto)]);
  const [personJpeg, bacJpeg, fontBytes] = await Promise.all([
    jpegFromImage(personImage),
    jpegFromImage(bacImage),
    loadPdfFontBytes()
  ]);
  const pdfBytes = createTextReportPdf({ rows, personImage: personJpeg, bacImage: bacJpeg, fontBytes, pageWidth, pageHeight });
  return new File([pdfBytes], fileName, { type: "application/pdf" });
}

async function loadPdfFontBytes() {
  if (!pdfFontBytesPromise) {
    pdfFontBytesPromise = fetch("https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf").then(async (response) => {
      if (!response.ok) throw new Error("PDF font could not be loaded");
      return new Uint8Array(await response.arrayBuffer());
    });
  }
  return pdfFontBytesPromise;
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

async function jpegFromImage(image) {
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const bytes = await canvasToJpegBytes(canvas, 0.78);
  return { bytes, width: canvas.width, height: canvas.height };
}

function createTextReportPdf({ rows, personImage, bacImage, fontBytes, pageWidth, pageHeight }) {
  const commands = [];
  const fontCMap = readFontCMap(fontBytes);
  const unicodeMappings = new Map();
  const y = (top) => pageHeight - top;
  const add = (value) => commands.push(value);
  const text = (value, x, top, size = 12, color = "0.09 0.13 0.15") => {
    add(`BT /F1 ${size} Tf 0 Tr ${color} rg 1 0 0 1 ${x} ${y(top)} Tm ${pdfHexString(value, fontCMap, unicodeMappings)} Tj ET\n`);
  };
  const rect = (x, top, width, height, color) => {
    add(`${color} rg\n${x} ${y(top + height)} ${width} ${height} re f\n`);
  };

  rect(0, 0, pageWidth, pageHeight, "1 1 1");
  rect(0, 0, pageWidth, 86, "0.06 0.46 0.43");
  text("アルコールチェック報告書", 36, 50, 24, "1 1 1");
  text("Alcohol Check Report", 38, 73, 11, "1 1 1");
  text("確認内容", 36, 121, 16, "0.09 0.13 0.15");

  let top = 138;
  rows.forEach(([label, value]) => {
    rect(36, top, 523, 28, "0.93 0.95 0.95");
    text(label, 48, top + 18, 9, "0.32 0.40 0.42");
    wrapText(String(value), 385, 2).forEach((line, index) => {
      text(line, 135, top + 18 + index * 11, 10, "0.09 0.13 0.15");
    });
    top += 31;
  });

  text("写真", 36, top + 18, 16, "0.09 0.13 0.15");
  top += 30;
  drawPdfPhotoBlock(add, personImage, "Im1", 36, top, 253, 390, pageHeight);
  drawPdfPhotoBlock(add, bacImage, "Im2", 306, top, 253, 390, pageHeight);
  text("本人写真", 45, top + 18, 11, "0.09 0.13 0.15");
  text("アルコール検知器の写真", 314, top + 18, 11, "0.09 0.13 0.15");
  text("写真原本は添付していません。法定記録項目はこのPDFに集約されています。", 36, 806, 9, "0.40 0.47 0.49");

  const content = commands.join("");
  const toUnicodeCMap = createToUnicodeCMap(unicodeMappings);
  const objects = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R /Im2 6 0 R >> >> /Contents 7 0 R >>`),
    ascii("<< /Type /Font /Subtype /Type0 /BaseFont /NotoSansJP-Regular /Encoding /Identity-H /DescendantFonts [8 0 R] /ToUnicode 10 0 R >>"),
    concatBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${personImage.width} /Height ${personImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${personImage.bytes.length} >>\nstream\n`),
      personImage.bytes,
      ascii("\nendstream")
    ]),
    concatBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${bacImage.width} /Height ${bacImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bacImage.bytes.length} >>\nstream\n`),
      bacImage.bytes,
      ascii("\nendstream")
    ]),
    ascii(`<< /Length ${byteLength(content)} >>\nstream\n${content}endstream`),
    ascii("<< /Type /Font /Subtype /CIDFontType0 /BaseFont /NotoSansJP-Regular /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 9 0 R /DW 1000 >>"),
    ascii("<< /Type /FontDescriptor /FontName /NotoSansJP-Regular /Flags 4 /FontBBox [-1000 -1048 2928 1808] /ItalicAngle 0 /Ascent 1160 /Descent -288 /CapHeight 733 /StemV 80 /FontFile3 11 0 R >>"),
    ascii(`<< /Length ${byteLength(toUnicodeCMap)} >>\nstream\n${toUnicodeCMap}endstream`),
    concatBytes([
      ascii(`<< /Length ${fontBytes.length} /Subtype /OpenType >>\nstream\n`),
      fontBytes,
      ascii("\nendstream")
    ])
  ];

  const chunks = [ascii("%PDF-1.6\n")];
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

function drawPdfPhotoBlock(add, image, imageName, x, top, width, height, pageHeight) {
  add(`0.97 0.98 0.98 rg\n${x} ${pageHeight - top - height} ${width} ${height} re f\n`);
  add(`0.84 0.88 0.87 RG\n${x} ${pageHeight - top - height} ${width} ${height} re S\n`);

  const box = { x: x + 10, top: top + 34, width: width - 20, height: height - 44 };
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = box.x + (box.width - drawWidth) / 2;
  const drawY = pageHeight - (box.top + (box.height - drawHeight) / 2) - drawHeight;
  add(`q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /${imageName} Do Q\n`);
}

function wrapText(value, maxWidth, maxLines) {
  const chars = Array.from(value);
  const maxChars = Math.max(1, Math.floor(maxWidth / 5.2));
  const lines = [];
  let line = "";
  chars.forEach((char) => {
    if (Array.from(line + char).length > maxChars && lines.length < maxLines - 1) {
      lines.push(line);
      line = char;
    } else {
      line += char;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function createToUnicodeCMap(mapping) {
  const mappings = Array.from(mapping.entries())
    .sort(([sourceA], [sourceB]) => sourceA - sourceB)
    .map(([source, codePoint]) => {
      return `<${source.toString(16).padStart(4, "0")}> <${utf16Hex(codePoint)}>`;
  });
  const chunks = [];
  for (let index = 0; index < mappings.length; index += 100) {
    const group = mappings.slice(index, index + 100);
    chunks.push(`${group.length} beginbfchar\n${group.join("\n")}\nendbfchar`);
  }

  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /ProofFlowUnicode def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
    ""
  ].join("\n");
}

function pdfHexString(value, fontCMap, unicodeMappings) {
  const bytes = [];
  for (const char of String(value)) {
    const code = char.codePointAt(0);
    const glyphCode = fontCMap.get(code) || fontCMap.get(char.normalize("NFKC").codePointAt(0)) || code;
    pushUtf16Be(bytes, glyphCode);
    unicodeMappings.set(glyphCode, code);
  }
  return `<${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
}

function pushUtf16Be(bytes, code) {
  bytes.push((code >> 8) & 0xff, code & 0xff);
}

function utf16Hex(codePoint) {
  const codes = [];
  if (codePoint > 0xffff) {
    const value = codePoint - 0x10000;
    codes.push(0xd800 + (value >> 10), 0xdc00 + (value & 0x3ff));
  } else {
    codes.push(codePoint);
  }
  return codes.map((code) => code.toString(16).padStart(4, "0")).join("");
}

function readFontCMap(fontBytes) {
  const view = new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength);
  const numTables = view.getUint16(4);
  let cmapOffset = 0;
  for (let index = 0; index < numTables; index += 1) {
    const offset = 12 + index * 16;
    const tag = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    if (tag === "cmap") {
      cmapOffset = view.getUint32(offset + 8);
      break;
    }
  }
  if (!cmapOffset) return new Map();

  const tableCount = view.getUint16(cmapOffset + 2);
  let bestOffset = 0;
  let bestScore = -1;
  for (let index = 0; index < tableCount; index += 1) {
    const record = cmapOffset + 4 + index * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const subtableOffset = cmapOffset + view.getUint32(record + 4);
    const format = view.getUint16(subtableOffset);
    const score = getCMapScore(platform, encoding, format);
    if (score > bestScore) {
      bestScore = score;
      bestOffset = subtableOffset;
    }
  }
  if (!bestOffset) return new Map();

  const format = view.getUint16(bestOffset);
  if (format === 12) return readFormat12CMap(view, bestOffset);
  if (format === 4) return readFormat4CMap(view, bestOffset);
  return new Map();
}

function getCMapScore(platform, encoding, format) {
  if (format === 12 && platform === 3 && encoding === 10) return 40;
  if (format === 12 && platform === 0) return 35;
  if (format === 4 && platform === 3 && encoding === 1) return 30;
  if (format === 4 && platform === 0) return 25;
  if (format === 12) return 20;
  if (format === 4) return 10;
  return 0;
}

function readFormat12CMap(view, offset) {
  const map = new Map();
  const groupCount = view.getUint32(offset + 12);
  for (let index = 0; index < groupCount; index += 1) {
    const group = offset + 16 + index * 12;
    const startCode = view.getUint32(group);
    const endCode = view.getUint32(group + 4);
    const startGlyph = view.getUint32(group + 8);
    for (let code = startCode; code <= endCode && code <= 0xffff; code += 1) {
      map.set(code, startGlyph + code - startCode);
    }
  }
  return map;
}

function readFormat4CMap(view, offset) {
  const map = new Map();
  const segCount = view.getUint16(offset + 6) / 2;
  const endCodes = offset + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;

  for (let segment = 0; segment < segCount; segment += 1) {
    const endCode = view.getUint16(endCodes + segment * 2);
    const startCode = view.getUint16(startCodes + segment * 2);
    const idDelta = view.getInt16(idDeltas + segment * 2);
    const idRangeOffset = view.getUint16(idRangeOffsets + segment * 2);
    if (startCode === 0xffff && endCode === 0xffff) continue;

    for (let code = startCode; code <= endCode; code += 1) {
      let glyph = 0;
      if (idRangeOffset === 0) {
        glyph = (code + idDelta) & 0xffff;
      } else {
        const glyphIndexAddress = idRangeOffsets + segment * 2 + idRangeOffset + (code - startCode) * 2;
        glyph = view.getUint16(glyphIndexAddress);
        if (glyph !== 0) glyph = (glyph + idDelta) & 0xffff;
      }
      if (glyph !== 0) map.set(code, glyph);
    }
  }
  return map;
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
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

function formatDisplayDate(date) {
  return date.toLocaleDateString("ja-JP", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDisplayTime(date) {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

createRoot(document.getElementById("root")).render(<App />);
