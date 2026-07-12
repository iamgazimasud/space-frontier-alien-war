// Screen recording: captures the canvas (+ live game audio) during a mission,
// then lets the player replay, download, or share the clip to social media.
// Every path is defensive — a recording failure must NEVER affect gameplay.

let recorder = null;
let chunks = [];
let clipBlob = null;
let clipUrl = null;
let capTimer = null;
let overlay = null;
let supported = null;

const MAX_MS = 180000;          // hard cap so long runs don't exhaust memory (~3 min)
const BITRATE = 2500000;        // 2.5 Mbps — good quality, mobile-safe file sizes

export function recordingSupported() {
  if (supported !== null) return supported;
  try {
    supported = !!(window.MediaRecorder &&
      HTMLCanvasElement.prototype.captureStream &&
      typeof MediaRecorder.isTypeSupported === "function");
  } catch (e) { supported = false; }
  return supported;
}

function pickMime() {
  const opts = [
    "video/mp4;codecs=avc1,mp4a", "video/mp4",
    "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm",
  ];
  for (const m of opts) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return "";
}

function fileExt() { return clipBlob && clipBlob.type.includes("mp4") ? "mp4" : "webm"; }

// Begin recording the given canvas. audioStream is optional (the game mix).
export function startRecording(canvas, audioStream) {
  if (!recordingSupported() || !canvas) return false;
  try {
    hardStop();          // drop any prior recorder without keeping its clip
    clearClip();
    const stream = canvas.captureStream(30);
    if (audioStream) {
      try { audioStream.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch (e) {}
    }
    const mime = pickMime();
    const opts = { videoBitsPerSecond: BITRATE };
    if (mime) opts.mimeType = mime;
    recorder = new MediaRecorder(stream, opts);
    chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.start(1000);
    capTimer = setTimeout(() => { stopRecording(); }, MAX_MS);
    return true;
  } catch (e) { recorder = null; return false; }
}

// Stop and finalize; resolves with the clip Blob (or null).
export function stopRecording() {
  return new Promise((resolve) => {
    if (capTimer) { clearTimeout(capTimer); capTimer = null; }
    if (!recorder || recorder.state === "inactive") { resolve(clipBlob); return; }
    recorder.onstop = () => {
      try {
        clipBlob = new Blob(chunks, { type: (chunks[0] && chunks[0].type) || "video/webm" });
        if (clipUrl) URL.revokeObjectURL(clipUrl);
        clipUrl = clipBlob.size ? URL.createObjectURL(clipBlob) : null;
      } catch (e) { clipBlob = null; clipUrl = null; }
      recorder = null;
      resolve(clipBlob);
    };
    try { recorder.stop(); } catch (e) { recorder = null; resolve(clipBlob); }
  });
}

function hardStop() {
  if (capTimer) { clearTimeout(capTimer); capTimer = null; }
  if (recorder && recorder.state !== "inactive") { try { recorder.onstop = null; recorder.stop(); } catch (e) {} }
  recorder = null;
}

export function hasClip() { return !!(clipBlob && clipBlob.size > 0 && clipUrl); }

export function clearClip() {
  clipBlob = null; chunks = [];
  if (clipUrl) { URL.revokeObjectURL(clipUrl); clipUrl = null; }
}

function isMobile() { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ""); }
function makeFile() { return new File([clipBlob], `space-frontier-clip.${fileExt()}`, { type: clipBlob.type || "video/webm" }); }

// Direct download via <a download>. Reliable on desktop; silently ignored inside
// Android apps / TWAs — callers must have a fallback there.
function downloadLink() {
  if (!hasClip()) return false;
  try {
    const a = document.createElement("a");
    a.href = clipUrl;
    a.download = `space-frontier-clip.${fileExt()}`;
    a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  } catch (e) { return false; }
}

function openInTab() {
  try { return !!window.open(clipUrl, "_blank"); } catch (e) { return false; }
}

// Native OS share sheet with the video file — the reliable path on Android/iOS.
// Returns a status string, or null if file-sharing isn't available at all.
async function nativeShare() {
  if (!navigator.share) return null;
  const file = makeFile();
  let canFiles = true;
  try { if (navigator.canShare) canFiles = navigator.canShare({ files: [file] }); } catch (e) { canFiles = true; }
  if (!canFiles) return null;
  try {
    await navigator.share({
      files: [file],
      title: "Space Frontier: Alien War",
      text: "My run in Space Frontier: Alien War 🚀 Play free: https://space-frontier-alien-war.vercel.app",
    });
    return "Shared!";
  } catch (e) {
    if (e && e.name === "AbortError") return "";      // user dismissed the sheet — not an error
    return null;                                       // share failed — let caller fall back
  }
}

// SHARE button: prefer the native share sheet, then fall back.
async function share() {
  if (!hasClip()) return "No clip yet — play a mission first.";
  const s = await nativeShare();
  if (s !== null) return s;
  if (!isMobile() && downloadLink()) return "Saved to your downloads.";
  if (openInTab()) return "Video opened in a new tab — long-press it to save or share.";
  return "Sharing isn't supported on this device.";
}

// SAVE button: on mobile a direct download does nothing inside an app, so use the
// share sheet (it has Save to Files / Photos / Drive). Desktop gets a real download.
async function save() {
  if (!hasClip()) return "No clip yet — play a mission first.";
  if (isMobile()) {
    const s = await nativeShare();
    if (s !== null) return s === "Shared!" ? "Saved / shared!" : s;
    if (openInTab()) return "Video opened in a new tab — long-press it to save.";
    return "Couldn't save on this device.";
  }
  if (downloadLink()) return "Saved to your downloads.";
  if (openInTab()) return "Video opened in a new tab — right-click to save.";
  return "Couldn't save on this device.";
}

// Build (once) and show the replay overlay. onClose fires when the user dismisses it.
export function showReplay(onClose) {
  if (!hasClip()) { if (onClose) onClose(); return; }
  if (!overlay) overlay = buildOverlay();
  const video = overlay.querySelector("video");
  video.src = clipUrl;
  if (overlay._status) overlay._status.textContent = "";
  overlay.style.display = "flex";
  overlay._onClose = onClose;
  try { video.currentTime = 0; video.play().catch(() => {}); } catch (e) {}
}

function hideReplay() {
  if (!overlay) return;
  const video = overlay.querySelector("video");
  try { video.pause(); } catch (e) {}
  overlay.style.display = "none";
  const cb = overlay._onClose; overlay._onClose = null;
  if (cb) cb();
}

function btnStyle(el, accent) {
  el.style.cssText =
    "flex:1;min-width:120px;padding:14px 10px;border-radius:12px;border:1.5px solid " + accent +
    ";background:rgba(10,14,32,0.85);color:" + accent +
    ";font:600 15px system-ui,sans-serif;letter-spacing:0.04em;cursor:pointer;-webkit-tap-highlight-color:transparent;";
}

function buildOverlay() {
  const o = document.createElement("div");
  o.style.cssText =
    "position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;" +
    "gap:16px;padding:20px;box-sizing:border-box;background:rgba(4,4,14,0.92);backdrop-filter:blur(6px);";

  const title = document.createElement("div");
  title.textContent = "MISSION REPLAY";
  title.style.cssText = "color:#7de0ff;font:700 20px system-ui,sans-serif;letter-spacing:0.12em;text-shadow:0 0 14px rgba(125,224,255,0.5);";
  o.appendChild(title);

  const video = document.createElement("video");
  video.controls = true; video.loop = true; video.playsInline = true; video.muted = false;
  video.style.cssText = "max-width:100%;max-height:62vh;border-radius:14px;border:1.5px solid rgba(125,224,255,0.4);background:#000;box-shadow:0 8px 40px rgba(0,0,0,0.6);";
  o.appendChild(video);

  const hint = document.createElement("div");
  hint.textContent = "Share your run to social media, or save the video.";
  hint.style.cssText = "color:#9fb2dd;font:400 13px system-ui,sans-serif;text-align:center;";
  o.appendChild(hint);

  const status = document.createElement("div");
  status.style.cssText = "color:#41f7d2;font:600 13px system-ui,sans-serif;text-align:center;min-height:18px;transition:opacity .2s;";
  o.appendChild(status);
  o._status = status;

  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;width:100%;max-width:520px;";
  const bShare = document.createElement("button"); bShare.textContent = "SHARE"; btnStyle(bShare, "#41f7d2");
  const bSave = document.createElement("button"); bSave.textContent = "SAVE VIDEO"; btnStyle(bSave, "#ffd75c");
  const bClose = document.createElement("button"); bClose.textContent = "CLOSE"; btnStyle(bClose, "#9fb2dd");
  const setStatus = (t) => { if (t) status.textContent = t; };
  bShare.onclick = async () => { setStatus("Opening share…"); setStatus(await share()); };
  bSave.onclick = async () => { setStatus("Saving…"); setStatus(await save()); };
  bClose.onclick = hideReplay;
  row.append(bShare, bSave, bClose);
  o.appendChild(row);

  document.body.appendChild(o);
  return o;
}
