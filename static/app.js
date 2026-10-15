/* LECCORTUBE by Leccorside Ai */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
let CFG = null, VOICES = [], NATURAL = [false, ""], CAT = null, SYS = null, APP = {}, VSTAT = null;
let CUR = null, VIEW = "new", POLL = null, dirty = {}, lastImgV = {}, TAB = "scenes", SETUP_POLL = null;
const THEMES = {crimson: ["Crimson", "#ff2d40", "#16060a"], matte: ["Matte", "#f4f5f7", "#9aa0ab"], ember: ["Ember", "#ff6a2b", "#ffb13b"]};

/* ---------------- icons (line icons, ISC-style paths) ---------------- */
/* versions are shown as 1.4 (patch updates keep the same name, the updater still sees 1.4.x) */
function shortV(v) { return String(v || "").split(".").slice(0, 2).join("."); }
const ICONS = {
  "skip-back": '<path d="M19 20 9 12l10-8v16z"/><path d="M5 19V5"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  minus: '<path d="M5 12h14"/>',
  unlink: '<path d="m18.8 13.4 1.7-1.7a4.2 4.2 0 0 0-6-6l-1.7 1.7"/><path d="m5.2 10.6-1.7 1.7a4.2 4.2 0 0 0 6 6l1.7-1.7"/><path d="M8 2v3M2 8h3M16 22v-3M22 16h-3"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M18.1 10.4a6 6 0 1 1-7.7 7.7"/><path d="M7 7h2v4"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  setup: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M8 16H3v5"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  ghost: '<path d="M9 10h.01M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  winmin: '<path d="M4 12h16"/>',
  winmax: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  winres: '<rect x="4" y="8" width="12" height="12" rx="1.5"/><path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4H18.5A1.5 1.5 0 0 1 20 5.5V14.5A1.5 1.5 0 0 1 18.5 16H16"/>',
  winx: '<path d="M5 5l14 14M19 5L5 19"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  video: '<path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.6-1.7h2A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevrons: '<path d="m6 17 5-5-5-5M13 17l5-5-5-5"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  sparkles: '<path d="M9.9 15.5A2 2 0 0 0 8.5 14.1L2.4 12.5a.5.5 0 0 1 0-1l6.1-1.6a2 2 0 0 0 1.4-1.4l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z"/>',
  radio: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5M19.1 4.9C23 8.8 23 15.1 19.1 19"/><circle cx="12" cy="12" r="2"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  layers: '<path d="m12.8 2.2 8.6 3.9a1 1 0 0 1 0 1.8l-8.6 3.9a2 2 0 0 1-1.6 0L2.6 7.9a1 1 0 0 1 0-1.8l8.6-3.9a2 2 0 0 1 1.6 0Z"/><path d="m22 17.6-9.2 4.2a2 2 0 0 1-1.6 0L2 17.6M22 12.6l-9.2 4.2a2 2 0 0 1-1.6 0L2 12.6"/>',
  hd: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8v8M10 8v8M6 12h4M14 8h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  crown: '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z"/><path d="M5 21h14"/>',
  star2: '<path d="M11.5 2.3a.5.5 0 0 1 1 0l2.3 4.7 5.2.8a.5.5 0 0 1 .3.9l-3.8 3.7.9 5.1a.5.5 0 0 1-.8.6L12 15.6l-4.6 2.5a.5.5 0 0 1-.8-.6l.9-5.1-3.8-3.7a.5.5 0 0 1 .3-.9l5.2-.8z"/>',
};
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24">${ICONS[n] || ICONS.star}</svg>`;
const TYPE_ICON = {sleep: "moon", bedtime: "star", documentary: "film", story: "book", mystery: "ghost", meditation: "leaf", short: "phone", rhyme: "music"};

async function api(path, opts = {}) {
  const o = {...opts};
  if (o.body && !(o.body instanceof FormData)) { o.headers = {"content-type": "application/json"}; o.body = JSON.stringify(o.body); }
  const r = await fetch(path, o);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || r.statusText);
  return data;
}
function openLink(key) { api("/api/open-link", {method: "POST", body: {key}}).catch(() => {}); }
function toast(msg, ms = 3800) { const t = $("#toast"); t.innerHTML = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms); }
function fmtMin(m) { if (!m) return "0 min"; const h = Math.floor(m / 60), mm = Math.round(m % 60); return h ? `${h}h ${mm}m` : `${mm} min`; }
function fmtT(t) { return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`; }
function fill(el) { if (!el) return; const p = (el.value - el.min) / (el.max - el.min) * 100; el.style.setProperty("--p", p + "%"); }
function closeModal(id) { $("#" + id).classList.remove("show"); if (id === "voiceModal") stopAudio(); }
["settingsModal", "pickModal", "voiceModal", "confirmModal", "shotModal"].forEach(id => $("#" + id).addEventListener("mousedown", e => { if (e.target.id === id) closeModal(id); }));
function confirmBox(title, html, okLabel = "Confirm", danger = false) {
  return new Promise(res => {
    $("#confirmBody").innerHTML = `<h2>${esc(title)}</h2><div style="margin:12px 0 18px">${html}</div>
      <div class="actions" style="justify-content:flex-end"><button class="btn" id="cfNo">Cancel</button><button class="btn ${danger ? "danger solid" : "primary"}" id="cfYes">${esc(okLabel)}</button></div>`;
    $("#confirmModal").classList.add("show");
    const done = v => { closeModal("confirmModal"); res(v); };
    $("#cfNo").onclick = () => done(false);
    $("#cfYes").onclick = () => done({ok: true, checks: Object.fromEntries($$("#confirmBody input[type=checkbox]").map(c => [c.id, c.checked]))});
  });
}

/* ---------------- shell: sidebar, nav, theme ---------------- */
function paintShell() {
  $("#collapseBtn").innerHTML = ic("panel");
  $("#collapseBtn").title = t("collapse_sidebar", "Collapse sidebar");
  $("#menuBtn").innerHTML = ic("menu");
  $("#refreshBtn").innerHTML = ic("refresh");
  $("#refreshBtn").title = t("refresh", "Refresh");
  $("#newBtn").innerHTML = `${ic("plus")}<span>${t("new_video", "New video")}</span>`;
  $("#nav").innerHTML = `
    <a data-nav="new" onclick="go('new')" title="${t("create", "Create")}">${ic("sparkles")}<span>${t("create", "Create")}</span></a>
    <a data-nav="seasons" onclick="go('seasons')" title="${t("seasons", "Seasons (series)")}">${ic("tv")}<span>${t("seasons", "Seasons")}</span></a>
    <a data-nav="setup" onclick="go('setup')" title="${t("setup_center", "Setup Center")}">${ic("setup")}<span>${t("setup_center", "Setup Center")}</span><em id="setupDot"></em></a>
    <a data-nav="docu" id="navDocu" onclick="go('docu')" title="${t("documentary", "Documentary Studio")}" style="display:none">${ic("book")}<span>${t("documentary", "Documentary")}</span><em class="protag on">PRO</em></a>
    <a data-nav="pro" onclick="go('pro')" title="LECCORTUBE Pro">${ic("zap")}<span>${t("pro", "Pro")}</span><em class="protag" id="proDot">PRO</em></a>
    <a data-nav="settings" onclick="openSettings()" title="${t("settings", "Settings")}">${ic("sliders")}<span>${t("settings", "Settings")}</span></a>`;
  const ph = $(".side-h span:first-child");
  if (ph) ph.textContent = t("projects", "Projects");
  const ql = $(".side-h a.qlink");
  if (ql) { ql.textContent = t("batch", "Batch"); ql.title = t("batch_title", "Build several videos one after another"); }
}
function toggleSide() {
  document.body.classList.toggle("collapsed");
  try { localStorage.setItem("ot_side", document.body.classList.contains("collapsed") ? "1" : "0"); } catch (e) {}
}
function setTheme(t, save = true) {
  if (!THEMES[t]) t = "crimson";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("ot_theme", t); } catch (e) {}
  $("#themes").innerHTML = Object.entries(THEMES).map(([k, [n, c1, c2]]) =>
    `<button title="${n}" class="${k === t ? "on" : ""}" onclick="setTheme('${k}')"><i style="background:linear-gradient(135deg,${c1},${c2})"></i><b>${n}</b></button>`).join("");
  if (save && CFG && CFG.theme !== t) api("/api/config", {method: "POST", body: {theme: t}}).then(() => CFG.theme = t).catch(() => {});
}

/* ---------------- header: hardware + health + running job ---------------- */
async function loadSystem(refresh) {
  try { SYS = await api("/api/system" + (refresh ? "?refresh=true" : "")); } catch (e) { return; }
  const g = SYS.gpu;
  $("#gpuChip").innerHTML = g ? `<div class="ic">${ic(g.cuda ? "zap" : "cpu", "sm")}</div><div><b>${esc(g.name.replace(/NVIDIA |GeForce /g, ""))}</b><span>${g.vram_gb ? g.vram_gb + " GB VRAM · " : ""}${SYS.ram_gb} GB RAM · ${SYS.tier.toUpperCase()}</span></div>`
    : `<div class="ic">${ic("cpu", "sm")}</div><div><b>${esc((SYS.cpu.name || "CPU").slice(0, 26))}</b><span>No NVIDIA GPU found</span></div>`;
}
let HEALTH = null;
async function loadHealth() {
  try {
    const h = await api("/api/health"); HEALTH = h;
    const names = {comfyui: "ComfyUI", tts: t("pill_voice", "Voice"), ffmpeg: "FFmpeg", workflow: t("pill_images", "Images"), video: t("pill_video", "Video")};
    $("#pills").innerHTML = Object.entries(h).filter(([k]) => names[k]).map(([k, v]) =>
      `<span class="chip ${v.ok ? "ok" : "bad"}" title="${esc(v.msg)}"><span class="dot"></span>${names[k]}</span>`).join("");
  } catch (e) { $("#pills").innerHTML = `<span class="chip bad"><span class="dot"></span>Engine offline</span>`; }
}
async function loadJobChip() {
  let q; try { q = await api("/api/queue"); } catch (e) { return; }
  if (q.active && q.active !== "__styles__") {
    const same = CUR && CUR.id === q.active;
    let label = t("working", "Working");
    try { const p = same ? CUR : (await api("/api/projects")).find(x => x.id === q.active); if (p) label = `${esc((p.title || "").slice(0, 22))} · ${esc(same ? p.status.step : p.step)}`; } catch (e) {}
    $("#jobChip").innerHTML = `<span class="chip a"><span class="eq"><i></i><i></i><i></i><i></i></span> ${label}${q.waiting ? ` · +${q.waiting} waiting` : ""}</span>
      <button class="btn danger sm" onclick="stopJob('${q.active}')">${ic("stop", "sm")} ${t("stop", "Stop")}</button>`;
  } else if (q.active === "__styles__") {
    $("#jobChip").innerHTML = `<span class="chip a"><span class="eq"><i></i><i></i><i></i><i></i></span> Painting style previews</span><button class="btn danger sm" onclick="stopJob('__styles__')">${ic("stop", "sm")} ${t("stop", "Stop")}</button>`;
  } else $("#jobChip").innerHTML = "";
}
async function stopJob(pid) {
  if (pid === "__styles__") await api("/api/styles/cancel", {method: "POST"});
  else await api(`/api/projects/${pid}/cancel`, {method: "POST"});
  toast("Stopping… (the current image or clip finishes first)");
}

async function loadConfig() { const c = await api("/api/config"); CFG = c.config; VOICES = c.voices; NATURAL = c.natural; CFG._workflows = c.workflows; CFG._vworkflows = c.video_workflows; }
async function loadCatalog() { CAT = await api("/api/catalog"); }
async function loadVoiceStatus() { try { VSTAT = await api("/api/voice/status"); } catch (e) { VSTAT = null; } return VSTAT; }

async function loadProjects() {
  const list = await api("/api/projects");
  $("#pcount").textContent = list.length || "";
  $("#plist").innerHTML = list.length ? list.map(p => {
    const st = p.state === "running" || p.state === "queued" ? `<span class="run">● ${esc(p.step)} ${Math.round((p.progress || 0) * 100)}%</span>`
      : p.has_video ? t("proj_video_ready", "Video ready") : p.state === "error" ? t("proj_needs_attention", "Needs attention") : t("proj_draft", "Draft");
    return `<div class="pitem ${CUR && CUR.id === p.id && VIEW === "project" ? "on" : ""}" onclick="openProject('${p.id}')" title="${esc(p.title)}">
      <div class="cv">${p.cover ? `<img src="${p.cover}" loading="lazy">` : ic(TYPE_ICON[p.preset] || "film", "sm")}</div>
      <div style="min-width:0"><div class="t">${esc(p.title)}</div><div class="m">${fmtMin(p.minutes)} · ${st}</div></div></div>`;
  }).join("") : `<div class="hint" style="padding:8px">${t("no_videos", "No videos yet.")}</div>`;
  return list;
}
async function openBatch() {
  const list = await api("/api/projects");
  const can = list.filter(p => !["running", "queued"].includes(p.state));
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>Batch build</h2><div class="hint" style="margin-top:4px">Build several videos one after another, for example overnight. Each runs Build everything.</div></div>
      <button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <div class="batch">${can.map(p => `<label class="bi"><input type="checkbox" value="${p.id}" ${p.has_video ? "" : "checked"}><span class="cv">${p.cover ? `<img src="${p.cover}">` : ic("film", "sm")}</span><span><b>${esc(p.title)}</b><small>${fmtMin(p.minutes)} · ${p.has_video ? "video ready" : "draft"}</small></span></label>`).join("") || `<div class="empty">No projects to build.</div>`}</div>
    <div class="note info" style="margin-top:12px">${ic("upload")}<div style="flex:1"><b>Import many scripts at once</b><br><small>Pick .txt files (one video each, the file name becomes the title), or one .csv / .json with <code>title</code> and <code>script</code> columns. Up to 200.</small>
      <div class="actions" style="margin-top:8px"><select id="imp_type" style="width:auto">${CAT.types.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>
        <label class="chk" style="margin:0"><input type="checkbox" id="imp_build" checked> Build them right away</label>
        <label class="btn sm primary" style="cursor:pointer">${ic("upload", "sm")} Choose files<input type="file" multiple accept=".txt,.md,.csv,.json" style="display:none" onchange="importScripts(this.files)"></label></div></div></div>
    <div class="vsfoot"><span class="hint" style="flex:1">Your PC must stay on. Missing parts only are made (images and voice already made are kept).</span>
      <button class="btn primary pill" onclick="runBatch()">${ic("play", "sm")} Build selected</button></div>`;
  $("#pickModal").classList.add("show");
}
function parseCSV(text) {
  const rows = [], re = /("([^"]|"")*"|[^,\r\n]*)(,|\r?\n|$)/g; let row = [], m;
  while ((m = re.exec(text)) && m[0] !== "") { let v = m[1]; if (v.startsWith('"')) v = v.slice(1, -1).replace(/""/g, '"'); row.push(v); if (m[3] !== ",") { rows.push(row); row = []; } }
  if (row.length) rows.push(row);
  const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  const ti = head.indexOf("title"), si = head.indexOf("script");
  return rows.filter(r => r[si]).map(r => ({title: r[ti] || "Untitled", script: r[si]}));
}
async function importScripts(files) {
  const items = [];
  for (const f of files) {
    const txt = await f.text(), name = f.name.replace(/\.[^.]+$/, "");
    if (/\.json$/i.test(f.name)) { try { const j = JSON.parse(txt); (Array.isArray(j) ? j : j.items || []).forEach(x => items.push({title: x.title || name, script: x.script || x.text || ""})); } catch (e) { toast("Bad JSON: " + esc(f.name)); } }
    else if (/\.csv$/i.test(f.name)) items.push(...parseCSV(txt));
    else items.push({title: name, script: txt});
  }
  if (!items.length) { toast("No scripts found in those files"); return; }
  try {
    const r = await api("/api/projects/import", {method: "POST", body: {items, preset: $("#imp_type").value, build: $("#imp_build").checked}});
    closeModal("pickModal"); loadProjects(); loadJobChip();
    toast(`${r.created.length} video(s) created${$("#imp_build").checked ? " and queued" : ""}${r.skipped.length ? `, ${r.skipped.length} skipped (empty)` : ""}.`, 8000);
  } catch (e) { toast("Error: " + esc(e.message)); }
}
async function trySample(btn) {
  btn.disabled = true;
  try { const p = await api("/api/projects/sample", {method: "POST"}); await loadProjects(); await openProject(p.id); run("all"); }
  catch (e) { toast("Error: " + esc(e.message)); btn.disabled = false; }
}
function publishModal() {
  const pack = (KIT || {}).pack || {}, meta = (KIT || {}).meta || {};
  const t0 = (pack.titles && pack.titles[0] && pack.titles[0].title) || CUR.title;
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>${PTAG} Publish</h2><div class="hint" style="margin-top:4px">Uploads through your Upload-Post account (Pro page). The thumbnail is added for YouTube.</div></div><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <label>Title</label><input id="pb_title" maxlength="100" value="${esc(t0)}">
    <label>Description</label><textarea id="pb_desc" rows="6">${esc(meta.description || "")}</textarea>
    <label>Tags (comma separated)</label><input id="pb_tags" value="${esc((meta.tags || []).join(", "))}">
    <div class="row"><div><label>Where</label><div class="actions">${["youtube", "tiktok", "instagram", "facebook"].map(x => `<label class="chk" style="margin:0"><input type="checkbox" class="pb_pl" value="${x}" ${x === "youtube" ? "checked" : ""}> ${x}</label>`).join("")}</div></div>
      <div><label>Privacy</label><select id="pb_priv"><option>public</option><option>unlisted</option><option>private</option></select></div>
      <div><label>Schedule (optional)</label><input id="pb_when" type="datetime-local"></div></div>
    <div class="vsfoot"><span class="hint" style="flex:1">${CUR.preset === "short" ? "Vertical video: perfect for Shorts, TikTok and Reels." : "16:9 video: best for YouTube."}</span>
      <button class="btn primary pill" onclick="doPublish()">${ic("upload", "sm")} Publish</button></div>`;
  $("#pickModal").classList.add("show");
}
async function doPublish() {
  const when = $("#pb_when").value ? new Date($("#pb_when").value).toISOString() : null;
  const body = {title: $("#pb_title").value, description: $("#pb_desc").value, tags: $("#pb_tags").value.split(",").map(x => x.trim()).filter(Boolean),
                platforms: [...$$(".pb_pl:checked")].map(x => x.value), privacy: $("#pb_priv").value, when};
  if (!body.platforms.length) { toast("Pick at least one platform"); return; }
  closeModal("pickModal");
  try { await api(`/api/projects/${CUR.id}/run/publish`, {method: "POST", body}); toast(when ? "Scheduling the upload…" : "Uploading…", 6000); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function runBatch() {
  const ids = [...$$("#pickBody .bi input:checked")].map(x => x.value);
  if (!ids.length) { toast("Select at least one video"); return; }
  try { const r = await api("/api/batch", {method: "POST", body: {ids}}); closeModal("pickModal"); toast(`${r.queued.length} video(s) queued. They build one after another.`, 6000); loadProjects(); loadJobChip(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function markNav() { $$(".nav a").forEach(a => a.classList.toggle("on", a.dataset.nav === VIEW)); }
function go(v) {
  document.body.classList.remove("menu");
  stopPoll(); clearTimeout(SETUP_POLL);
  VIEW = v; markNav(); RP_LAST = {}; { const m = $("#main"); if (m) m.scrollTop = 0; }
  setWhere({new: "Create", setup: "Setup Center", seasons: "Seasons", pro: "LECCORTUBE Pro", docu: "Documentary Studio"}[v] || "");
  if (v === "new") { CUR = null; showNew(); loadProjects(); }
  else if (v === "setup") { CUR = null; showSetup(); loadProjects(); }
  else if (v === "seasons") { CUR = null; showSeasons(); loadProjects(); }
  else if (v === "pro") { CUR = null; showPro(); loadProjects(); }
  else if (v === "docu") { CUR = null; showDocu(); loadProjects(); }
}
async function refreshAll() { await loadConfig(); await loadCatalog(); loadVoiceStatus(); loadHealth(); loadSystem(true); loadProjects(); if (VIEW === "project" && CUR) openProject(CUR.id, true); else if (VIEW === "setup") showSetup(); else if (VIEW === "season" && SEASON) openSeason(SEASON.id); else if (VIEW === "seasons") showSeasons(); else showNew(); }

/* ---------------- voices helpers ---------------- */
function voiceGroups(filter) { const g = {}; for (const v of VOICES) if (!filter || filter(v)) (g[v.group] = g[v.group] || []).push(v); return g; }
const CLOUD_ENG = ["eleven", "gemini", "openai"];
function isCloudVoice(id) { return CLOUD_ENG.includes(String(id || "").split(":")[0]); }
function voiceOptions(sel, filter) {
  const known = VOICES.some(v => v.id === sel && (!filter || filter(v)));
  return (known || !sel ? "" : `<option selected value="${esc(sel)}">${esc(sel)}</option>`) + Object.entries(voiceGroups(filter)).map(([g, vs]) =>
    `<optgroup label="${esc(g)}">${vs.map(v => `<option value="${esc(v.id)}" ${v.id === sel ? "selected" : ""} ${v.available === false ? "disabled" : ""}>${esc(v.label)}</option>`).join("")}</optgroup>`).join("");
}
function isNatural(id) { return String(id || "").includes(":"); }
function voiceName(id) { const v = VOICES.find(x => x.id === id); return v ? `${v.label}` : id; }
function fxName(id) { const f = (CAT.fx || []).find(x => x.id === id); return f ? f.name : "Original"; }
function rec(type, voice) { const r = CAT.recommend[type] || CAT.recommend.sleep; return isNatural(voice) ? r.natural : r.kokoro; }

/* one audio player for the whole app; shows state in the Voice Studio player bar */
let PLAYING = null;
let MP_LABEL = "Audio", MP_ON = false;
function stopAudio() { const pl = $("#player"); pl.pause(); try { pl.currentTime = 0; } catch (e) {} PLAYING = null; MP_ON = false; paintPlayer(); paintMini(); }
function pauseAudio() { const pl = $("#player"); if (pl.paused) pl.play().catch(() => {}); else pl.pause(); }
$("#player").addEventListener("ended", () => { PLAYING = null; MP_ON = false; paintPlayer(); paintMini(); });
$("#player").addEventListener("play", () => { MP_ON = true; paintMini(); });
$("#player").addEventListener("pause", () => paintMini());
$("#player").addEventListener("timeupdate", () => paintMiniTime());
document.addEventListener("keydown", e => { if (e.key === "Escape" && MP_ON) stopAudio(); });
const _mp = document.createElement("div"); _mp.id = "miniPlayer"; _mp.className = "miniplayer"; document.body.appendChild(_mp);
function mmss(t) { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }
function paintMini() {
  const pl = $("#player"), box = $("#miniPlayer");
  box.classList.toggle("on", MP_ON);
  if (!MP_ON) return;
  box.innerHTML = `<button class="btn primary mpb" onclick="pauseAudio()" title="${pl.paused ? "Play" : "Pause"}">${ic(pl.paused ? "play" : "pause")}</button>
    <button class="btn mpb" onclick="stopAudio()" title="Stop (Esc)">${ic("stop")}</button>
    <div class="mpm"><b>${esc(MP_LABEL)}</b><input type="range" id="mpSeek" min="0" max="1000" value="0" oninput="mpSeek(this.value)"><span id="mpTime"></span></div>`;
  paintMiniTime();
}
function paintMiniTime() {
  const pl = $("#player"), r = $("#mpSeek"), t = $("#mpTime");
  if (!r || !pl.duration) return;
  if (document.activeElement !== r) r.value = Math.round(1000 * pl.currentTime / pl.duration);
  fill(r); t.textContent = `${mmss(pl.currentTime)} / ${mmss(pl.duration)}`;
}
function mpSeek(v) { const pl = $("#player"); if (pl.duration) pl.currentTime = pl.duration * v / 1000; }
function paintPlayer(state, msg) {
  const w = $("#vsWave"), b = $("#vsPlayBtn"), m = $("#vsMsg");
  if (!w) return;
  w.classList.toggle("on", state === "playing" || (!state && !!PLAYING));
  if (b) b.innerHTML = state === "loading" ? `<span class="eq"><i></i><i></i><i></i><i></i></span>` : ic(PLAYING || state === "playing" ? "stop" : "play");
  if (m) { m.innerHTML = msg || (state === "loading" ? "Making the preview…" : PLAYING ? "Playing" : "Press play to listen"); m.style.color = state === "error" ? "var(--bad)" : ""; }
  $$(".vp").forEach(el => el.classList.toggle("playing", PLAYING && el.dataset.id === PLAYING));
}
async function playPreview(opts, btn, tag) {
  const old = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span>`; }
  paintPlayer("loading");
  const slow = isNatural(opts.voice) ? setTimeout(() => paintPlayer("loading", "First natural voice takes 1 to 3 minutes (the model loads). Next ones are fast."), 3500) : null;
  try {
    const r = await api("/api/voice/preview", {method: "POST", body: opts});
    const pl = $("#player"); MP_LABEL = `Voice preview · ${voiceName(opts.voice)}`; pl.src = r.url; await pl.play();
    PLAYING = tag || "x"; paintPlayer("playing");
  } catch (e) {
    PLAYING = null;
    if ($("#vsWave")) paintPlayer("error", esc(e.message)); else toast("Voice: " + esc(e.message), 9000);
  }
  clearTimeout(slow); if (btn) { btn.disabled = false; btn.innerHTML = old; }
}
function sampleText(src) {
  const clean = (src || "").split("\n").filter(l => !/^\s*(\[.*\]|#)/.test(l)).join(" ").replace(/\s+/g, " ").trim();
  const sents = clean.match(/[^.!?]+[.!?]+/g) || [];
  return sents.slice(0, 2).join(" ").trim().slice(0, 320) || "Settle in, and let your breathing slow down. Tonight we travel far back in time, to a quiet village on the banks of a great river.";
}

/* ---------------- style gallery ---------------- */
let STYLE_FILTER = "All";
function styleCard(s, on, onclick) {
  const [c1, c2] = s.colors;
  const bg = s.preview ? `<img src="${s.preview}" loading="lazy">` : `<svg class="grad" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="sg_${s.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#sg_${s.id})"/><circle cx="112" cy="40" r="15" fill="#fff" opacity=".4"/>
    <path d="M0 86 30 60l22 16 32-28 34 30 22-14 20 10v46H0Z" fill="${c1}" opacity=".7"/>
    <path d="M0 100 40 82l30 12 34-16 56 20v22H0Z" fill="#000" opacity=".35"/></svg>`;
  return `<div class="style ${on ? "on" : ""}" onclick="${onclick}" title="${esc(s.prefix)}">${bg}<div class="ck">${ic("check")}</div><div class="cap">${esc(s.name)}<small>${esc(s.group)}</small></div></div>`;
}
function styleGallery(selId, fn) {
  const missing = CAT.styles.some(s => !s.preview), sj = CAT.style_job || {};
  const running = ["queued", "running"].includes(sj.state);
  const groups = ["All", ...(CAT.style_groups || [])];
  const list = CAT.styles.filter(s => STYLE_FILTER === "All" || s.group === STYLE_FILTER);
  return `<div class="filters">${groups.map(g => `<button class="${g === STYLE_FILTER ? "on" : ""}" onclick="STYLE_FILTER='${g}';rerenderStyles()">${esc(g === "All" ? t("filter_all", "All") : g)}</button>`).join("")}</div>
    <div class="styles">${list.map(s => styleCard(s, s.id === selId, `${fn}('${s.id}')`)).join("")}</div>
    ${missing || running ? `<div class="actions" style="margin-top:12px">${running ? `<span class="chip a"><span class="eq"><i></i><i></i><i></i><i></i></span> ${esc(sj.message || "Painting previews")}</span>`
      : `<button class="btn sm" onclick="paintStyles()">${ic("palette", "sm")} ${t("paint_previews_gpu", "Paint real previews with my GPU")}</button><span class="hint">${t("paint_previews_hint", "Cards show colors until previews are painted (1 to 2 minutes, needs ComfyUI and the image model).")}</span>`}</div>` : ""}`;
}
function rerenderStyles() {
  if (VIEW === "new") renderStylesNew();
  else if (VIEW === "project" && $("#stylesProj")) $("#stylesProj").innerHTML = lookGallery(CUR.style_id);
  else if (VIEW === "setup" && $("#stylesSetup")) $("#stylesSetup").innerHTML = styleGallery(null, "void");
}
async function paintStyles() {
  try { await api("/api/styles/generate", {method: "POST", body: {}}); toast("Painting style previews…"); watchStyles(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function watchStyles() {
  await loadCatalog();
  const st = CAT.style_job.state;
  rerenderStyles();
  if (["queued", "running"].includes(st)) setTimeout(watchStyles, 2500);
  else if (st === "error") toast("Style previews: " + esc(CAT.style_job.message), 9000);
}

/* ================================================================ NEW VIDEO */
let NEW = null;
function newDefaults() {
  const type = "story";
  const voice = NATURAL[0] ? rec(type, "x:y").voice : rec(type, "").voice;
  const r = rec(type, voice);
  return {type, voice, speed: r.speed, speedAuto: true, secs: r.scene_seconds, secsAuto: true, style: r.style, prefix: r.style_prefix,
          fx: r.fx, clean: CFG.default_voice_clean !== false, title: "", thumb: "", script: "",
          mode: "single", season: "", chars: "", epTitle: "", songStyle: "happy", singer: "woman", topic: "", where: proOn() ? "cloud" : "pc"};
}
function showNew() {
  VIEW = "new"; markNav();
  if (!NEW) NEW = newDefaults();
  const N = NEW;
  const typesCount = CAT && CAT.types ? CAT.types.filter(t => !t.hidden).length : 8;
  const stylesCount = CAT && CAT.styles ? CAT.styles.length : 24;
  const voicesCount = CAT && CAT.voice_presets ? CAT.voice_presets.length : 12;
  const typesSummary = t("hero_types_summary", "{types} video types · {styles} styles · {voices} voice templates")
    .replace("{types}", typesCount)
    .replace("{styles}", stylesCount)
    .replace("{voices}", voicesCount);

  $("#main").innerHTML = `
  <div class="card hot hero">
    <img class="orb" src="/static/brand/orb.png" alt="">
    <div class="hero-grid"><div>
    <div class="kicker">${t("hero_kicker", "FREE AI YOUTUBE AUTOMATION")}</div>
    <h1>${t("hero_title", "Script in.<br><span>Video out.</span>")}</h1>
    <p>${t("hero_desc", "Pick a type, paste your script, choose a voice and a look. LECCORTUBE makes the voice, images, video scenes, music, thumbnail and YouTube text on your own PC.")}</p>
    </div>
    <div class="hero-brand"><div class="by">${t("hero_by", "Crafted by")}</div><div class="sig">Leccorside<i>Ai</i></div>
      <div class="line">${t("hero_cinema", "Cinema tools for every creator")}</div>
      <div class="dots">${t("hero_dots", "<span>Camera</span><span>Grade</span><span>Music</span><span>Cast</span>")}</div></div>
    </div>
    <div class="actions" style="margin-top:16px">
      ${!SYS || SYS.tier === "cpu" ? `<span class="chip bad"><span class="dot"></span>${t("hero_no_gpu", "No NVIDIA GPU: images and video will be slow")}</span>` : `<span class="chip ok"><span class="dot"></span>${esc(SYS.gpu ? SYS.gpu.name.replace(/NVIDIA |GeForce /g, "") : "")} · ${esc(SYS.tier.toUpperCase())} tier</span>`}
      <span class="chip">${typesSummary}</span>
      <button class="btn sm" onclick="trySample(this)" title="${esc(t("hero_sample_title", "A 1 minute story with 2 characters, to see what LECCORTUBE makes on your PC"))}">${ic("play", "sm")} ${t("hero_sample_btn", "Try a 1 minute sample")}</button>
    </div>
  </div>
  <div class="card"><div class="modes">
    <button class="${N.mode !== "season" ? "on" : ""}" onclick="NEW.mode='single';if(NEW.type==='rhyme')NEW.type='story';showNew();if(NEW.style===rec('rhyme','').style)pickTypeNew(NEW.type)">${ic("film")}<div><b>${t("mode_single", "Single video")}</b><span>${t("mode_single_desc", "One script, one video")}</span></div></button>
    <button class="${N.mode === "season" ? "on" : ""}" onclick="NEW.mode='season';if(NEW.type==='rhyme')NEW.type='story';showNew();if(NEW.style===rec('rhyme','').style)pickTypeNew(NEW.type)">${ic("tv")}<div><b>${t("mode_season", "Season (series)")}</b><span>${t("mode_season_desc", "Many episodes, the same characters in every episode")}</span></div></button>
    <button class="${N.mode === "rhyme" ? "on" : ""}" onclick="setRhymeMode()">${ic("music")}<div><b>${t("mode_rhyme", "Rhyme (kids song)")}</b><span>${t("mode_rhyme_desc", "Your lyrics are sung, every line gets a picture")}</span></div></button>
  </div></div>
  ${N.mode === "single" ? whereCard(N) : ""}
  ${N.mode === "rhyme" ? rhymeNewCards(N) : `
  <div class="card"><div class="sec-t"><span class="n step">1</span><div><h3>${t("step_1_type", "Video type")}</h3><small>${t("step_1_desc", "Sets pace, voice, look and editing. Everything stays editable.")}</small></div></div>
    <div class="types" id="typesBox"></div></div>
  <div class="card"><div class="sec-t"><span class="n step">2</span><div><h3>${t("step_2_script", "Script")}</h3><small>${t("step_2_desc", "# Chapter for chapters · [IMG: prompt] for a picture · [CAST: Name = appearance] for characters")}</small></div></div>
    ${N.mode === "single" && N.where === "cloud" ? `<div class="cw" id="cwBox">${cloudWriter()}</div>` : ""}
    ${N.mode === "season" ? `<div class="row">
      <div><label style="margin-top:0">${t("label_season_name", "Season name")}</label><input id="n_season" value="${esc(N.season)}" oninput="NEW.season=this.value" placeholder="${esc(t("ph_season_name", "The Clockmaker Chronicles"))}"></div>
      <div><label style="margin-top:0">${t("label_ep1_title", "Episode 1 title")}</label><input id="n_eptitle" value="${esc(N.epTitle)}" oninput="NEW.epTitle=this.value" placeholder="${esc(t("ph_ep1_title", "The Broken Clock"))}"></div>
    </div>
    <label>${t("label_season_chars", "Characters of the season")} <span class="hint">${t("season_chars_hint", "one per line: Name = what they look like (age, hair, face, clothes)")}</span></label>
    <textarea id="n_chars" rows="5" oninput="NEW.chars=this.value" placeholder="Farid = a 60 year old clockmaker, white beard, round glasses, brown leather apron&#10;Laila = a 10 year old girl, curly black hair, yellow dress&#10;Rustam = a tall merchant, black turban, red coat">${esc(N.chars)}</textarea>
    <div class="hint" style="margin-top:6px">${t("season_chars_note", "All of them get a character sheet when Episode 1 is built, and every later episode uses the same pictures. New characters can join in any episode. Use @Name in the script to put a character in a scene.")}</div>
    <input type="hidden" id="n_title"><input type="hidden" id="n_thumb">` : `<div class="row">
      <div><label style="margin-top:0">${t("label_video_title", "Video title")}</label><input id="n_title" value="${esc(N.title)}" oninput="NEW.title=this.value" placeholder="${esc(t("ph_video_title", "Life of a Medieval Peasant | 2 Hours of History to Fall Asleep To"))}"></div>
      <div style="max-width:320px"><label style="margin-top:0">${t("label_thumb_text", "Thumbnail text")}</label><input id="n_thumb" value="${esc(N.thumb)}" oninput="NEW.thumb=this.value" placeholder="${esc(t("ph_thumb_text", "1348: A Peasant's Day"))}"></div>
    </div>`}
    <label>${N.mode === "season" ? t("label_ep1_script", "Episode 1 script") : t("label_script", "Script")}</label>
    ${N.mode !== "season" && N.where !== "cloud" ? `<details class="explw" ${N.eOpen ? "open" : ""} ontoggle="NEW.eOpen=this.open"><summary>${ic("sparkles", "sm")} ${t("explainer_summary", "<b>Write a doodle explainer script with AI</b> <span class=\"hint\">stick figures, a new picture every ~3 s, text cards</span>")}</summary>
      <div class="row" style="margin-top:8px;align-items:end"><div><label style="margin-top:0">${t("explainer_topic_label", "What is the video about?")}</label><input id="n_etopic" value="${esc(N.etopic || "")}" oninput="NEW.etopic=this.value" placeholder="${esc(t("explainer_topic_ph", "Why did ancient people value salt more than gold?"))}"></div>
        <div style="max-width:120px"><label style="margin-top:0">${t("explainer_min_label", "Minutes")}</label><input type="number" min="1" max="12" value="${N.emin || 2}" oninput="NEW.emin=+this.value"></div>
        <div style="max-width:200px"><button class="btn primary" onclick="writeExplainer(this)">${ic("sparkles", "sm")} ${t("explainer_write_btn", "Write it")}</button></div></div>
      <div class="hint" style="margin-top:8px">${t("explainer_hint", "Takes about a minute. Read it once and fix any fact you are not sure about before you build: the local Smart Director is small and can get dates wrong.")}</div></details>` : ""}
    <textarea id="n_script" rows="13" oninput="NEW.script=this.value;if(!importEpisodeNew(this.value))estimateNew()" placeholder="${esc(t("script_ph", "# The Village at Dawn\n[IMG: a medieval village at dawn, thatched roofs, mist over the fields]\nThe peasant woke before dawn. The fire had burned low..."))}">${esc(N.script)}</textarea>
    <div class="hint" id="n_est" style="margin-top:8px"></div>
  </div>
  <div class="card" style="display:none"><div class="sec-t"><span class="n step">3</span><div><h3>${t("step_3_voice", "Voice")}</h3><small>${t("step_3_desc", "Templates, effects and speed in Voice Studio. Listen before you build.")}</small></div><div class="grow"></div><button class="btn sm" onclick="openVoiceStudio('new')">${ic("headphones", "sm")} ${t("btn_voice_studio", "Voice Studio")}</button></div>
    <div id="voiceBoxNew"></div></div>`}
  <div class="card" style="display:none"><div class="sec-t"><span class="n step">${N.mode === "rhyme" ? 3 : 4}</span><div><h3>${t("step_4_look", "Look")}</h3><small>${t("step_4_desc", "{styles} styles in {groups} groups. Pick one, every image and every person in it follows it.").replace("{styles}", CAT && CAT.styles ? CAT.styles.length : 24).replace("{groups}", CAT && CAT.style_groups ? CAT.style_groups.length : 6)}</small></div></div>
    <div id="stylesNew"></div>
    <details style="margin-top:14px"><summary class="hint" style="cursor:pointer">${t("edit_style_prefix", "Edit the style text (added in front of every image prompt)")}</summary>
      <textarea id="n_style" rows="2" style="margin-top:8px" oninput="NEW.prefix=this.value;NEW.style=''">${esc(N.prefix)}</textarea></details>
    <div class="row" style="margin-top:12px"><div id="secsBoxNew" style="max-width:520px"></div></div>
  </div>
  <div class="card hot" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
    <div class="hint" id="n_sum" style="font-size:13.5px"></div>
    ${N.mode === "rhyme" ? `<div class="actions"><button class="btn pill two" onclick="createRhyme(this)">${ic("layers")}<span>Review first<small>check the song and scenes, then build</small></span></button>
         <button class="btn primary pill two" onclick="createRhyme(this, true)">${ic("music")}<span>Make my rhyme video<small>everything automatic, start to finish</small></span></button></div>`
      : N.mode === "season" ? `<button class="btn primary pill" style="padding:14px 26px;font-size:15px" onclick="createSeason(this)">${ic("tv")} ${t("btn_create_season", "Create season & Episode 1")}</button>`
      : `<div class="actions"><button class="btn pill two" onclick="createProject(this)" title="${esc(t("review_scenes_title", "Opens the storyboard: check or change any scene, then press Build everything"))}">${ic("layers")}<span>${t("btn_review_scenes", "Review scenes first")}<small>${t("btn_review_scenes_sub", "edit the storyboard, then build")}</small></span></button>
         <button class="btn primary pill two" onclick="createProject(this, true)" title="${esc(t("make_video_title", "Everything automatic: voice, characters, places, images, music, sounds and the final video"))}">${ic("sparkles")}<span>${t("btn_make_video", "Make my video")}<small>${t("btn_make_video_sub", "everything automatic, start to finish")}</small></span></button></div>`}
  </div>`;
  if (N.mode === "rhyme") { renderStylesNew(); $("#n_sum").innerHTML = rhymeSummary(); return; }
  renderTypesNew(); renderVoiceNew(); renderStylesNew(); renderSecsNew(); estimateNew(); cwCost();
}
/* ---- Where it is made: On my PC (free) or Cloud (Pro, writes the script with Google research) ---- */

let CSST = null;

async function loadCloudStatus(rerender) {

  try { CSST = await api("/api/cloud-script/status"); } catch (e) { CSST = {pro: false, ready: false}; }

  if (rerender && VIEW === "new" && NEW && NEW.mode === "single") { const b = $("#whereBox"); if (b) b.innerHTML = whereInner(NEW); cwRender(); if (NEW.where === "cloud") saiLoadModels(); }

}

function lowEndPC() { const g = SYS && SYS.gpu; return !SYS || SYS.tier === "cpu" || !g || (g.vram_gb && g.vram_gb < 4); }

function whereInner(N) {
  const s = CSST || {};
  const badge = `<span class="pro-badge">${ic(s.pro === false ? "lock" : "crown")}<i>PRO</i></span>`;
  return orderWhere(`<button class="wh ${N.where !== "cloud" ? "on" : ""}" onclick="pickWhere('pc')">
      <div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>${t("where_pc_title", "On my PC")}</b>
      <span>${t("where_pc_desc", "Free, private, no internet needed. Script with Smart Director or your own, pictures on your GPU.")}</span>
      <small>${t("where_pc_cost", "Costs nothing, only time")}</small></div></button>
    <button class="wh ${N.where === "cloud" ? "on" : ""} ${s.pro === false ? "nopro" : ""}" onclick="pickWhere('cloud')">
      <div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>${t("where_cloud_title", "Cloud")} ${badge}</b>
      <span>${t("where_cloud_desc", "Fast on any PC, even low-end. AI fixes your topic, researches the web, checks the facts and writes the script.")}</span>
      <small>${t("where_cloud_cost", "Uses your own API key: OpenRouter, OpenAI, Claude or DeepSeek")}</small></div></button>`);
}
function whereCard(N) {
  if (!CSST) setTimeout(() => loadCloudStatus(true), 0);
  return `<div class="card"><div class="sec-t"><span class="n step">${ic("zap", "sm")}</span><div><h3>${t("where_title", "Where should it be made?")}</h3><small>${t("where_desc", "Script, pictures and video clips. Voice, music and the final render always run on this PC.")}</small></div></div>
    <div class="where" id="whereBox">${whereInner(N)}</div></div>`;
}
function pickWhere(w) {
  if (w === "cloud" && !proOn()) { needPro("Cloud script and pictures"); return; }
  NEW.where = w; showNew();
  if (w === "cloud") saiLoadModels();
}
/* ---- Script AI for Cloud: provider + key + model ---- */
let SAI_SEL = null, SAI_EDIT = false;
const SAI_MODELS = {};
function saiState() { return (CSST && CSST.ai) || {provider: "openrouter", providers: []}; }
function saiProv() { const st = saiState(); return SAI_SEL || st.provider; }
function saiPicker() {
  const st = saiState(), sel = saiProv(), P = (st.providers || []).find(x => x.id === sel) || {name: sel, has_key: false};
  const tabs = (st.providers || []).map(x => `<button class="${x.id === sel ? "on" : ""}" onclick="saiPick('${x.id}')">${esc(x.name)}${x.has_key ? ic("check", "sm") : ""}</button>`).join("");
  let body;
  if (P.has_key && !SAI_EDIT) {
    const D = SAI_MODELS[sel], ms = D && D.models, cur = st.provider === sel ? st.model : "";
    const byId = id => (ms || []).find(m => m.id === id);
    const card = (kind, id) => { const m = byId(id); if (!m) return "";
      return `<button class="sai-pick ${id === cur ? "on" : ""}" onclick="saiChoose('${esc(id)}')">
        <div class="sp-t"><span class="sp-k ${kind}">${kind === "best" ? ic("crown", "sm") + "Best quality" : ic("zap", "sm") + "Budget"}</span><b>${esc(m.name)}</b>${id === cur ? `<span class="sp-on">${ic("check", "sm")}</span>` : ""}</div>
        <div class="sp-c">${saiCostLine(m)}</div></button>`; };
    const pk = (D && D.picks) || {};
    const other = cur && cur !== pk.best && cur !== pk.budget && byId(cur);
    body = !ms ? `<div class="hint" style="margin-top:10px"><span class="eq"><i></i><i></i><i></i><i></i></span> Loading the models and prices…</div>`
      : `<label style="margin-top:10px">Model <span class="hint">cost of the AI for one script, research and fact check included</span></label>
        <div class="sai-picks">${card("budget", pk.budget)}${pk.best !== pk.budget ? card("best", pk.best) : ""}</div>
        <div class="sai-own ${other ? "on" : ""}">
          <div class="sp-t"><span class="sp-k own">${ic("sliders", "sm")}Your own model</span>${other ? `<b>${esc(other.name)}</b><span class="sp-on">${ic("check", "sm")}</span>` : `<span class="hint">choose any of the ${ms.length} models</span>`}</div>
          <div class="msel"><div class="msel-in">${ic("search", "sm")}<input id="sai_q" autocomplete="off" placeholder="Search models, for example: gemini, gpt, claude, llama" value="${esc(SAI_Q)}" onfocus="saiOpen(true)" oninput="SAI_Q=this.value;saiOpen(true)">
            <button class="btn sm" onclick="saiOpen(!SAI_OPEN)">${SAI_OPEN ? "Close" : "Browse all"}</button></div>
            <div class="msel-list" id="sai_list" style="${SAI_OPEN ? "" : "display:none"}">${SAI_OPEN ? saiRows(ms, cur) : ""}</div></div>
          ${other ? `<div class="sp-c">${saiCostLine(other)}</div>` : ""}</div>
        <div class="hint" style="margin-top:8px">Key saved on this PC (${esc(P.mask || "")}) · <a onclick="SAI_EDIT=true;cwRender()">Change key</a></div>`;
  } else {
    body = `<div class="row" style="align-items:end;margin-top:10px"><div><label style="margin-top:0">Your ${esc(P.name)} API key</label>
        <input id="sai_key" type="password" autocomplete="off" placeholder="Paste the key here" onkeydown="if(event.key==='Enter')saiConnect(this)"></div>
        <div style="max-width:150px"><button class="btn primary" onclick="saiConnect(this)">${ic("link", "sm")} Connect</button></div></div>
      <div class="hint" style="margin-top:6px">Saved encrypted on this PC only. <a href="${esc(P.get_key || "#")}" target="_blank" rel="noopener">Get your key from ${esc(P.name.replace(/ \(.*\)/, ""))}</a>${SAI_EDIT ? ` · <a onclick="SAI_EDIT=false;cwRender()">Cancel</a>` : ""}</div>`;
  }
  return `<div class="sai"><label style="margin-top:0">Script AI</label><div class="sai-prov">${tabs}</div>${body}</div>`;
}
let SAI_Q = "", SAI_OPEN = false;
function saiRows(ms, cur) {
  const q = SAI_Q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = ms.filter(m => !q.length || q.every(w => (m.id + " " + m.name).toLowerCase().includes(w)));
  if (!list.length) return `<div class="msel-empty">No model matches "${esc(SAI_Q)}"</div>`;
  return `<div class="msel-head"><span>${list.length} model${list.length > 1 ? "s" : ""}</span><span>1 min</span><span>5 min</span><span>10 min</span><span>15 min</span></div>`
    + list.slice(0, 300).map(m => `<button class="mrow ${m.id === cur ? "on" : ""}" onmousedown="event.preventDefault()" onclick="SAI_Q='';saiOpen(false);saiChoose('${esc(m.id)}')">
      <span class="mn">${m.id === cur ? ic("check", "sm") : ""}${esc(m.name)}</span>${m.cost ? [1, 5, 10, 15].map(n => `<span class="mc">${money(m.cost[n])}</span>`).join("") : `<span class="mc na">price not listed</span>`}</button>`).join("");
}
function saiOpen(open) {
  SAI_OPEN = open;
  const D = SAI_MODELS[saiProv()], l = $("#sai_list"); if (!D || !l) return;
  l.style.display = open ? "" : "none";
  l.innerHTML = open ? saiRows(D.models || [], saiState().model) : "";
  const btn = l.parentNode.querySelector(".msel-in .btn"); if (btn) btn.textContent = open ? "Close" : "Browse all";
}
function saiFill() { saiOpen(SAI_OPEN); }
function money(v) { return v == null ? "?" : v < 0.01 ? "<$0.01" : "$" + v.toFixed(2); }
function saiCostLine(m) {
  if (!m.cost) return `<span class="hint">price not listed</span>`;
  return [1, 5, 10, 15].map(n => `<span><small>${n} min</small>${money(m.cost[n])}</span>`).join("");
}
function saiCurCost(min) {
  const D = SAI_MODELS[saiProv()], st = saiState(), m = D && D.models && D.models.find(x => x.id === st.model);
  if (!m || !m.cost) return null;
  return m.cost["1"] + (m.cost["15"] - m.cost["1"]) * (min - 1) / 14;
}
function cwRender() { const c = $("#cwBox"); if (c) c.innerHTML = cloudWriter(); cwCost(); }
async function saiPick(id) {
  SAI_SEL = id; SAI_EDIT = false; SAI_Q = ""; SAI_OPEN = false;
  const P = (saiState().providers || []).find(x => x.id === id);
  if (P && P.has_key) { try { CSST.ai = await api("/api/script-ai/choose", {method: "POST", body: {provider: id, model: ""}}); } catch (e) { toast(esc(e.message)); } }
  cwRender(); saiLoadModels();
}
async function saiLoadModels() {
  const id = saiProv(), P = (saiState().providers || []).find(x => x.id === id);
  if (!P || !P.has_key || SAI_MODELS[id]) { cwRender(); return; }
  try { SAI_MODELS[id] = await api(`/api/script-ai/models?provider=${id}`); }
  catch (e) { SAI_MODELS[id] = {models: [], picks: {}}; toast(esc(e.message), 8000); }
  const st = saiState(), D = SAI_MODELS[id];
  if (st.provider === id && !st.model && D.picks && D.picks.best) { try { CSST.ai = await api("/api/script-ai/choose", {method: "POST", body: {provider: id, model: D.picks.best}}); } catch (e) {} }
  cwRender();
}
async function saiChoose(model) {
  try { CSST.ai = await api("/api/script-ai/choose", {method: "POST", body: {provider: saiProv(), model}}); cwRender(); } catch (e) { toast(esc(e.message)); }
}
async function saiConnect(btn) {
  const k = ($("#sai_key").value || "").trim(), id = saiProv();
  if (!k) { toast("Paste the API key first"); return; }
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Checking…`;
  try {
    const r = await api("/api/script-ai/connect", {method: "POST", body: {provider: id, key: k}});
    SAI_MODELS[id] = {models: r.models, picks: r.picks}; SAI_EDIT = false;
    await loadCloudStatus(false);
    toast(`Connected. ${r.models.length} models found, the best one is selected.`, 6000);
    cwRender();
  } catch (e) { toast(esc(e.message), 9000); btn.disabled = false; btn.innerHTML = old; }
}
const CW_MIN = {sleep: 20, story: 3, mystery: 10, short: 1};

function cwMinutes() { return NEW.cmin || CW_MIN[NEW.type] || 5; }

function cloudWriter() {

  const N = NEW, P = N.cplan, J = N.cjob, s = CSST || {};

  const head = `<div class="cw-h">${ic("sparkles", "sm")} <b>${t("cw_title", "Cloud script writer")}</b><span class="hint">${s.search ? t("cw_researches_with", "researches with {name}").replace("{name}", esc(s.search_name)) : t("cw_needs_key", "web research needs OpenRouter, OpenAI, Claude or Google AI")}</span></div>`
    + (J && J.state === "running" ? "" : saiPicker());
  const sp = (saiState().providers || []).find(x => x.id === saiProv());
  if (!(J && J.state === "running") && !(sp && sp.has_key && saiState().provider === saiProv())) return head + `<div class="hint" style="margin-top:12px">${t("cw_connect_key_hint", "Connect a key above, then type your topic.")}</div>`;

  if (J && J.state === "running") return head + cwProgress(J);

  if (J && J.state === "done" && J.result) return head + cwDone(J.result);

  const err = J && J.state === "error" ? `<div class="cw-err">${ic("alert", "sm")} ${esc(J.error)}</div>` : "";

  const top = `<div class="row" style="align-items:end"><div><label style="margin-top:0">${t("cw_topic_label", "What is your video about?")}</label>

      <input id="cw_topic" value="${esc(N.ctopic || "")}" oninput="NEW.ctopic=this.value;NEW.cplan=null" onkeydown="if(event.key==='Enter')cwPlan(this)" placeholder="${N.type === "sleep" ? "life in ancient rome for falling asleep" : N.type === "mystery" ? "the dyatlov pass incident" : N.type === "short" ? "why octopus have 3 hearts" : "a lonely robot who finds a flower"}"></div>

      <div style="max-width:110px"><label style="margin-top:0">${t("cw_minutes_label", "Minutes")}</label><input type="number" min="0.5" max="60" step="0.5" value="${cwMinutes()}" oninput="NEW.cmin=+this.value;cwCost()"></div>

      ${P ? "" : `<div style="max-width:210px"><button class="btn primary" onclick="cwPlan(this)">${ic("search", "sm")} ${t("cw_plan_btn", "Next: plan research")}</button></div>`}</div>`;

  if (!P) return head + top + err + `<div class="hint" style="margin-top:8px">${t("cw_topic_hint", "Type it any way you like, spelling mistakes are fine. Next you choose what to research.")}</div>`;

  const fix = P.changed ? `<div class="cw-fix">${ic("check", "sm")} Spelling fixed: <s>${esc(P.topic)}</s> → <b>${esc(P.fixed)}</b> <a onclick="NEW.cplan.fixed=NEW.cplan.topic;NEW.cplan.changed=false;NEW.ctopic=NEW.cplan.topic;showNew()">keep mine</a></div>` : "";

  const searchEngine = CSST && CSST.search === "google" ? "Google" : "web";
  const kind = `<div class="seg" style="margin-top:12px"><button class="${P.factual ? "on" : ""}" onclick="NEW.cplan.factual=true;showNew()">${ic("search", "sm")} ${t("cw_facts_btn", "Real facts")} (${searchEngine})</button><button class="${!P.factual ? "on" : ""}" onclick="NEW.cplan.factual=false;showNew()">${ic("book", "sm")} ${t("cw_story_btn", "Made-up story")}</button></div>`;

  const dirs = P.directions.map((d, i) => `<label class="cw-dir ${d.off ? "" : "on"}" title="${esc(d.why || "")}"><input type="checkbox" ${d.off ? "" : "checked"} onchange="NEW.cplan.directions[${i}].off=!this.checked;this.parentNode.classList.toggle('on',this.checked);cwCost()">

      <span><b>${esc(d.label)}</b><small>${esc(P.factual ? d.query : (d.why || d.query))}</small></span></label>`).join("");

  return head + top + fix + kind + `

    <label>${P.factual ? t("cw_research_dirs", "Research directions") : t("cw_story_dirs", "Story directions")} <span class="hint">${P.factual ? `each one is a ${searchEngine} search, untick what you do not want` : "the AI builds the story from these"}</span></label>

    <div class="cw-dirs">${dirs}</div>

    <div class="row" style="margin-top:8px;align-items:end"><div><input id="cw_add" placeholder="${esc(t("cw_add_dir_ph", "Add your own direction, for example: his net worth in 2026"))}" onkeydown="if(event.key==='Enter')cwAdd()"></div>

      <div style="max-width:120px"><button class="btn" onclick="cwAdd()">${ic("plus", "sm")} ${t("add", "Add")}</button></div></div>

    <label>${t("cw_must_include", "Must include")} <span class="hint">${t("cw_must_include_hint", "optional")}</span></label>

    <input id="cw_notes" value="${esc(N.cnotes || "")}" oninput="NEW.cnotes=this.value" placeholder="${P.factual ? "a point, a name or an angle you want in the script" : "names, a place, the ending you want"}">

    ${err}

    <div class="cw-go"><div class="hint" id="cw_cost"></div>

      <button class="btn" onclick="NEW.cplan=null;NEW.cjob=null;showNew()">${t("cw_start_over", "Start over")}</button>

      <button class="btn primary" onclick="cwStart(this)">${ic("sparkles", "sm")} ${P.factual ? t("cw_write_script", "Research &amp; write the script") : t("cw_write_story", "Write the story")}</button></div>`;

}

function cwCost() {

  const P = NEW && NEW.cplan, el = $("#cw_cost"); if (!P || !el) return;

  const n = P.directions.filter(d => !d.off).length, m = cwMinutes();

  const ai = saiCurCost(m), usd = (P.factual ? n * 0.03 : 0) + (ai != null ? ai : 0.05 + m * 140 / 1000 * 0.03);

  el.innerHTML = `About <b>$${usd.toFixed(2)}</b> · ${P.factual ? `${n} ${CSST && CSST.search === "google" ? "Google" : "web"} searches · facts checked across sources · ` : ""}${m} min ≈ ${Math.round(m * 140)} words · 1 to 3 minutes`;

}

async function cwPlan(btn) {

  const t = (NEW.ctopic || "").trim(); if (!t) { toast("Write what the video is about"); return; }

  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Reading your topic…`;

  try {

    const r = await api("/api/cloud-script/plan", {method: "POST", body: {topic: t, type: NEW.type}});

    NEW.cplan = r; NEW.ctopic = r.fixed; NEW.cjob = null;

    if (!NEW.cmin && r.minutes && NEW.type !== "short") NEW.cmin = Math.max(1, Math.min(60, +r.minutes));

    if (!NEW.title.trim() && r.title) NEW.title = r.title;

    showNew();

  } catch (e) { toast(esc(e.message), 8000); btn.disabled = false; btn.innerHTML = old; }

}

function cwAdd() {

  const v = ($("#cw_add").value || "").trim(); if (!v || !NEW.cplan) return;

  NEW.cplan.directions.push({label: v.split(/\s+/).slice(0, 5).join(" "), query: NEW.cplan.factual ? `${NEW.cplan.subject} ${v}` : v, why: "Your direction"});

  showNew();

}

async function cwStart(btn) {

  const P = NEW.cplan; if (!P) return;

  const dirs = P.directions.filter(d => !d.off);

  if (P.factual && !dirs.length) { toast("Tick at least one research direction"); return; }

  btn.disabled = true;

  try {

    const r = await api("/api/cloud-script/start", {method: "POST", body: {topic: P.fixed, subject: P.subject, type: NEW.type, factual: P.factual,

      minutes: cwMinutes(), directions: dirs, notes: NEW.cnotes || "", title: NEW.title}});

    NEW.cjob = {id: r.job, state: "running", progress: 0, step: "research", log: [], message: "Starting"};

    showNew(); cwPoll(r.job);

  } catch (e) { toast(esc(e.message), 8000); btn.disabled = false; }

}

async function cwPoll(id) {

  while (NEW && NEW.cjob && NEW.cjob.id === id) {

    await new Promise(r => setTimeout(r, 1500));

    let j; try { j = await api(`/api/cloud-script/job/${id}`); } catch (e) { break; }

    if (!NEW || !NEW.cjob || NEW.cjob.id !== id) return;

    NEW.cjob = j;

    if (j.state === "done" && j.result) {

      const R = j.result; NEW.script = R.script;

      if (!NEW.title.trim()) NEW.title = R.title; if (!NEW.thumb.trim() && R.thumbnail) NEW.thumb = R.thumbnail;

      if (VIEW === "new") showNew();

      toast(R.factual ? `Script ready: ${R.facts} facts, ${R.confirmed} confirmed by 2+ websites, ${R.fixes} line(s) fixed by the fact check.` : "Story ready. Read it once and change anything you like.", 9000);

      return;

    }

    if (j.state === "error") { if (VIEW === "new") showNew(); return; }

    const b = $("#cwBox"); if (b && VIEW === "new") b.innerHTML = cloudWriter();

  }

}

function cwProgress(J) {

  const steps = (NEW.cplan && !NEW.cplan.factual) ? [["write", "Writing"]] : [["research", "Research"], ["facts", "Facts"], ["write", "Writing"], ["check", "Fact check"]];

  const at = Math.max(0, steps.findIndex(s => s[0] === J.step));

  return `<div class="cw-steps">${steps.map((s, i) => `<div class="${i < at ? "done" : i === at ? "now" : ""}"><span>${i < at ? ic("check", "sm") : i + 1}</span>${s[1]}</div>`).join("")}</div>

    <div class="bar" style="margin-top:12px"><i style="width:${Math.round((J.progress || 0) * 100)}%"></i></div>

    <div class="cw-now"><span class="eq"><i></i><i></i><i></i><i></i></span> ${esc(J.message || "")}</div>

    <div class="cw-log">${(J.log || []).slice(-6).map(l => `<div>${esc(l)}</div>`).join("")}</div>

    <div style="margin-top:10px"><button class="btn sm" onclick="api('/api/cloud-script/job/${J.id}/cancel',{method:'POST'});toast('Stopping…')">${ic("stop", "sm")} Stop</button></div>`;

}

function cwDone(R) {

  const src = (R.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.id)} · ${esc(s.domain || s.title)}</a>`).join("");

  return `<div class="cw-ok">${ic("check", "sm")} <b>Script written</b> · ${R.words.toLocaleString()} words

      ${R.factual ? `<span class="chip">${R.facts} facts</span><span class="chip ok"><span class="dot"></span>${R.confirmed} confirmed by 2+ websites</span>${R.conflicts ? `<span class="chip">${R.conflicts} disagreements mentioned</span>` : ""}<span class="chip">${R.fixes} line(s) fixed by fact check</span>` : `<span class="chip">made-up story</span>`}</div>

    ${src ? `<details class="cw-src"><summary class="hint">${(R.sources || []).length} sources</summary><div>${src}</div></details>` : ""}

    <div class="actions" style="margin-top:10px"><button class="btn sm" onclick="NEW.cjob=null;showNew()">${ic("refresh", "sm")} Change directions and write again</button>

      <button class="btn sm" onclick="NEW.cjob=null;NEW.cplan=null;NEW.ctopic='';showNew()">${ic("plus", "sm")} New topic</button></div>`;

}

/* ---- Rhyme mode: kids songs ---- */
function setRhymeMode() {
  NEW.mode = "rhyme"; NEW.type = "rhyme";
  const r = rec("rhyme", ""); NEW.style = r.style; NEW.prefix = r.style_prefix;
  showNew();
}
function rhymeSummary() {
  const st = CAT.styles.find(x => x.id === NEW.style), so = CAT.song;
  const lines = (NEW.script || "").split("\n").filter(l => l.trim() && !/^\s*(\[.*\]|#)/.test(l)).length;
  return `<b>Kids Rhyme</b> · ${esc((so.styles.find(x => x.id === NEW.songStyle) || {}).name || "")} · ${esc((so.singers.find(x => x.id === NEW.singer) || {}).name || "")} · ${st ? esc(st.name) : "custom look"}${lines ? ` · ${lines} lines ≈ ${Math.round(lines * 3.2 + 12)} s song` : ""}`;
}
function rhymeNewCards(N) {
  const so = CAT.song || {styles: [], singers: []};
  return `<div class="card"><div class="sec-t"><span class="n step">1</span><div><h3>${t("rhyme_lyrics_title", "Lyrics")}</h3><small>${t("rhyme_lyrics_desc", "2 lines per picture. <code>[IMG: …]</code> before a verse sets its picture, <code>[CAST: Bobo = a little red bus…]</code> keeps a character the same.")}</small></div>
      <div class="grow"></div><button class="btn sm" onclick="NEW.script=CAT.song.example;NEW.title='';showNew()">${ic("file", "sm")} ${t("rhyme_example_btn", "Use the example")}</button></div>
    <div class="row"><div><label style="margin-top:0">${t("label_video_title", "Title")}</label><input id="n_title" value="${esc(N.title)}" oninput="NEW.title=this.value" placeholder="The Little Red Bus | Nursery Rhyme for Kids"></div>
      <div style="max-width:320px"><label style="margin-top:0">${t("label_thumb_text", "Thumbnail text")}</label><input id="n_thumb" value="${esc(N.thumb)}" oninput="NEW.thumb=this.value" placeholder="Beep Beep!"></div></div>
    <div class="row" style="align-items:flex-end;margin-top:10px"><div><label style="margin-top:0">${t("rhyme_topic_label", "No lyrics yet? Write them with AI")}</label><input id="n_topic" value="${esc(N.topic)}" oninput="NEW.topic=this.value" placeholder="a little duck who learns to swim"></div>
      <div style="max-width:220px"><button class="btn" onclick="writeRhyme(this)">${ic("sparkles", "sm")} ${t("rhyme_topic_btn", "Write the rhyme")}</button></div></div>
    <label>${t("rhyme_lyrics_title", "Lyrics")}</label>
    <textarea id="n_script" rows="14" oninput="NEW.script=this.value;$('#n_sum').innerHTML=rhymeSummary()" placeholder="The little red bus goes beep beep beep&#10;Down the road and up the street&#10;&#10;Stop for Grandma, stop for me&#10;Climb aboard, one two three">${esc(N.script)}</textarea>
  </div>
  <div class="card"><div class="sec-t"><span class="n step">2</span><div><h3>${t("rhyme_song_title", "Song")}</h3><small>${t("rhyme_song_desc", "Sung on your PC by the AI Music model (Setup Center). Free for YouTube.")}</small></div></div>
    <label style="margin-top:0">${t("rhyme_music_style", "Music style")}</label><div class="chips">${so.styles.map(x => `<button class="${N.songStyle === x.id ? "on" : ""}" onclick="NEW.songStyle='${x.id}';showNew()">${esc(x.name)}</button>`).join("")}</div>
    <label>${t("rhyme_singer", "Singer")}</label><div class="chips">${so.singers.map(x => `<button class="${N.singer === x.id ? "on" : ""}" onclick="NEW.singer='${x.id}';showNew()">${esc(x.name)}</button>`).join("")}</div>
  </div>`;
}
async function writeExplainer(btn) {
  if (!(NEW.etopic || "").trim()) { toast("Write what the video is about first"); return; }
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Writing…`;
  try {
    const r = await api("/api/explainer/write", {method: "POST", body: {topic: NEW.etopic, minutes: NEW.emin || 2}});
    NEW.script = r.script; if (!NEW.title.trim()) NEW.title = r.title;
    const st = CAT.styles.find(x => x.id === "stick"); if (st) { NEW.style = "stick"; NEW.prefix = st.prefix; }
    showNew(); toast("Script written in the doodle explainer style, Stick style selected. Check the facts and change any line you like.", 8000);
  } catch (e) { toast(esc(e.message), 8000); }
  btn.disabled = false; btn.innerHTML = old;
}
async function writeRhyme(btn) {
  if (!NEW.topic.trim()) { toast("Write what the rhyme is about first"); return; }
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Writing…`;
  try { const r = await api("/api/rhyme/write", {method: "POST", body: {topic: NEW.topic}}); NEW.script = r.script; if (!NEW.title.trim()) NEW.title = r.title; showNew(); toast("Lyrics written. Change any line you like."); }
  catch (e) { toast(esc(e.message), 8000); }
  btn.disabled = false; btn.innerHTML = old;
}
async function createRhyme(btn, build) {
  if (!NEW.script.trim()) { toast("Write or paste the lyrics first."); return; }
  btn.disabled = true;
  try {
    const p = await api("/api/projects", {method: "POST", body: {
      title: NEW.title.trim(), script: NEW.script, preset: "rhyme", style_prefix: NEW.prefix, style_id: NEW.style,
      thumbnail_text: NEW.thumb, song: {style: NEW.songStyle, singer: NEW.singer}}});
    NEW = null;
    if (build) { await openProject(p.id); await run("all"); toast(`Making your rhyme: the song first, then ${p.scenes.length} pictures.`, 9000); return; }
    TAB = "settings"; openProject(p.id, true); toast(`Created <b>${p.scenes.length}</b> pictures. Build everything sings the song and makes the video.`, 7000);
  } catch (e) { toast("Error: " + esc(e.message)); btn.disabled = false; }
}
function songCard(p) {
  const sg = p.song || {}, so = CAT.song;
  return `<div class="card"><div class="sec-t"><span class="n">${ic("music")}</span><div><h3>Song</h3><small>The lyrics from the Script tab are sung by the AI Music model. Change the style or singer, then sing it again.</small></div><div class="grow"></div>
      ${sg.file ? `<button class="btn sm" onclick="playMusic('${sg.file}',this)">${ic("play", "sm")} Play the song</button>` : ""}
      <button class="btn sm primary" onclick="run('song', true)">${ic("music", "sm")} ${sg.file ? "Sing it again" : "Sing it now"}</button></div>
    <label style="margin-top:0">Music style</label><div class="chips">${so.styles.map(x => `<button class="${(sg.style || "happy") === x.id ? "on" : ""}" onclick="patch({song:{style:'${x.id}'}},'Music style set. Press Sing it again.')">${esc(x.name)}</button>`).join("")}</div>
    <label>Singer</label><div class="chips">${so.singers.map(x => `<button class="${(sg.singer || "woman") === x.id ? "on" : ""}" onclick="patch({song:{singer:'${x.id}'}},'Singer set. Press Sing it again.')">${esc(x.name)}</button>`).join("")}</div>
    ${sg.duration ? `<div class="infoline">${ic("check", "sm")} Song ready: ${Math.round(sg.duration)} seconds, ${p.scenes.length} pictures timed to it.</div>` : `<div class="infoline">${ic("info", "sm")} Not sung yet. Build everything sings it first.</div>`}
  </div>`;
}
function typeArt(t) {
  if (t.poster) return `<img class="pbg" src="${t.poster}" loading="lazy" alt="">`;
  const st = CAT.styles.find(s => s.id === t.style) || CAT.styles[0] || {colors: ["#3a0d12", "#a32330"]};
  const [c1, c2] = st.colors;
  return `<svg class="pbg" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="tg_${t.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>
    <rect width="160" height="120" fill="url(#tg_${t.id})"/><circle cx="84" cy="30" r="11" fill="#fff" opacity=".3"/>
    <path d="M0 80 28 58l24 14 30-26 36 28 20-12 22 12v46H0Z" fill="${c1}" opacity=".75"/><path d="M0 98 44 80l30 12 36-14 50 18v24H0Z" fill="#000" opacity=".4"/></svg>`;
}
function typeCards(sel, fn, compact) {
  const types = CAT.types.filter(t => !t.hidden || t.id === sel);
  if (compact) return types.map(t => `<div class="type ${t.id === sel ? "on" : ""}" onclick="${fn}('${t.id}')">
    <div class="ck">${ic("check")}</div><div class="ic">${ic(TYPE_ICON[t.id] || "film")}</div><div class="nm">${esc(window.t("type_" + t.id + "_name", t.name))}</div></div>`).join("");
  return types.map(t => `<div class="type poster ${t.id === sel ? "on" : ""}" onclick="${fn}('${t.id}')">
    ${typeArt(t)}<div class="shade"></div><div class="ck">${ic("check")}</div>
    <div class="in"><div class="ic">${ic(TYPE_ICON[t.id] || "film")}</div><div class="nm">${esc(window.t("type_" + t.id + "_name", t.name))}</div><div class="ds">${esc(window.t("type_" + t.id + "_desc", t.desc))}</div></div></div>`).join("")
    + `<div class="type poster soon" title="${esc(t("type_soon_title", "Coming soon in the free version"))}"><svg class="pbg asmr-art" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="asg" cx="70%" cy="28%" r="80%"><stop offset="0" stop-color="#6b4bd6"/><stop offset=".45" stop-color="#2a1d5c"/><stop offset="1" stop-color="#0c0a1c"/></radialGradient><linearGradient id="ash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2d9ff"/><stop offset="1" stop-color="#b48cff"/></linearGradient><filter id="asb"><feGaussianBlur stdDeviation="6"/></filter></defs>
<rect width="300" height="200" fill="url(#asg)"/><g fill="#fff">${[[30,22,1.3],[62,48,.9],[118,18,1.1],[250,62,1],[278,26,1.4],[200,14,.8],[90,80,.7],[160,40,.9]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" opacity=".85"/>`).join("")}</g>
<circle cx="236" cy="44" r="20" fill="#f6ecff"/><circle cx="246" cy="38" r="18" fill="#2c1f60"/>
<g fill="none" stroke="#c9a8ff" stroke-linecap="round" opacity=".55"><path d="M60 128a18 18 0 0 0 0-30" stroke-width="3"/><path d="M48 138a32 32 0 0 0 0-50" stroke-width="2.5" opacity=".7"/><path d="M36 148a46 46 0 0 0 0-70" stroke-width="2" opacity=".45"/><path d="M240 128a18 18 0 0 1 0-30" stroke-width="3"/><path d="M252 138a32 32 0 0 1 0-50" stroke-width="2.5" opacity=".7"/><path d="M264 148a46 46 0 0 1 0-70" stroke-width="2" opacity=".45"/></g>
<ellipse cx="150" cy="118" rx="70" ry="48" fill="#9a6bff" opacity=".35" filter="url(#asb)"/>
<path d="M104 128v-16a46 46 0 0 1 92 0v16" fill="none" stroke="url(#ash)" stroke-width="9" stroke-linecap="round"/>
<rect x="92" y="114" width="26" height="40" rx="11" fill="url(#ash)"/><rect x="182" y="114" width="26" height="40" rx="11" fill="url(#ash)"/>
<rect x="98" y="121" width="14" height="26" rx="7" fill="#7d55e6" opacity=".6"/><rect x="188" y="121" width="14" height="26" rx="7" fill="#7d55e6" opacity=".6"/>
<path d="M0 178c40-10 70 8 110 0s80-16 120-4 50 8 70 2v24H0z" fill="#120d26" opacity=".9"/></svg><div class="shade"></div>
    <div class="in"><div class="ic">${ic("headphones")}</div><div class="nm">ASMR <span class="chip soon-chip">${t("type_soon_chip", "Coming soon")}</span></div><div class="ds">${t("type_asmr_desc", "Soft whispers, close sounds and slow calm visuals. Coming soon, free.")}</div></div></div>`;
}
function renderTypesNew() { $("#typesBox").innerHTML = typeCards(NEW.type, "pickTypeNew"); }
function pickTypeNew(id) {
  if (id === "rhyme" && NEW.mode !== "season") { setRhymeMode(); return; }
  NEW.type = id;
  const keepNatural = isNatural(NEW.voice);
  const r = rec(id, keepNatural ? "x:y" : "");
  NEW.voice = r.voice; NEW.fx = r.fx;
  NEW.speed = r.speed; NEW.speedAuto = true;
  NEW.secs = r.scene_seconds; NEW.secsAuto = true;
  NEW.style = r.style; NEW.prefix = r.style_prefix; if ($("#n_style")) $("#n_style").value = NEW.prefix;
  const st = CAT.styles.find(s => s.id === r.style); if (st && STYLE_FILTER !== "All" && st.group !== STYLE_FILTER) STYLE_FILTER = "All";
  renderTypesNew(); renderVoiceNew(); renderStylesNew(); renderSecsNew(); estimateNew();
}
function speedBlock(prefix, voice, speed, isAuto, recSpeed) {
  return `<div class="slider"><div class="top-l"><div><span class="muted" style="font-size:12.5px;font-weight:700">${t("speed", "Speed")}</span>
      ${isAuto ? `<span class="rec">${t("auto", "AUTO")}</span>` : `<span class="rec off" onclick="${prefix}SpeedAuto()" title="${esc(t("back_recommended", "Back to recommended"))} ${recSpeed}x">↺ ${t("auto", "AUTO")} ${recSpeed}x</span>`}</div>
      <div class="actions"><span class="val" id="${prefix}_sv">${Number(speed).toFixed(2)}<small>x</small></span>
      <button class="btn sm" onclick="${prefix}Play(this)" title="${esc(t("listen_speed_title", "Listen with this speed and effect"))}">${ic("play", "sm")} ${t("listen", "Listen")}</button></div></div>
    <input type="range" id="${prefix}_speed" min="0.7" max="1.25" step="0.01" value="${speed}" oninput="fill(this);${prefix}Speed(this.value)">
    <div class="marks"><span>0.70 ${t("slow", "slow")}</span><span>${t("recommended", "recommended")} ${recSpeed}</span><span>1.25 ${t("fast", "fast")}</span></div></div>`;
}
function renderVoiceNew() {
  const N = NEW, r = rec(N.type, N.voice);
  const warn = VSTAT && !VSTAT.ready ? `<div class="note bad">${ic("alert")}<div>${esc(VSTAT.problems[0] || t("voice_engine_not_ready", "Voice engine not ready."))}</div><button class="btn sm" onclick="go('setup')">${t("setup_center", "Setup Center")}</button></div>` : "";
  $("#voiceBoxNew").innerHTML = `${warn}<div class="row" style="margin-top:${warn ? 12 : 0}px">
      <div><label style="margin-top:0">${t("narrator", "Narrator")} ${N.voice === r.voice ? `<span class="rec">${t("recommended_tag", "RECOMMENDED")}</span>` : ""}</label><select id="n_voice" onchange="nVoice(this.value)">${voiceOptions(N.voice)}</select>
        <label>${t("effect", "Effect")}</label>
        <div class="actions"><span class="chip a">${ic("wand", "sm")} ${esc(fxName(N.fx))}${N.fx === r.fx ? ` · ${t("auto", "auto")}` : ""}</span><span class="chip ${N.clean ? "ok" : ""}">${N.clean ? t("clean_on", "Studio clean on") : t("no_cleaning", "No cleaning")}</span>
          <button class="btn sm" onclick="openVoiceStudio('new')">${t("change", "Change")}</button></div>
        ${NATURAL[0] ? "" : `<div class="note info">${ic("info")}<div>${t("natural_voices_tip", "Want a more human voice? Install <b>Natural voices</b> in Setup Center.")}</div><button class="btn sm" onclick="go('setup')">${t("open", "Open")}</button></div>`}
      </div>
      <div>${speedBlock("n", N.voice, N.speed, N.speedAuto, r.speed)}</div></div>`;
  fill($("#n_speed"));
}
function nVoice(v) { NEW.voice = v; if (NEW.speedAuto) NEW.speed = rec(NEW.type, v).speed; renderVoiceNew(); estimateNew(); }
function nSpeed(v) { NEW.speed = parseFloat(v); NEW.speedAuto = Math.abs(NEW.speed - rec(NEW.type, NEW.voice).speed) < 0.005; $("#n_sv").innerHTML = NEW.speed.toFixed(2) + "<small>x</small>"; estimateNew(); clearTimeout(nSpeed._t); nSpeed._t = setTimeout(renderVoiceNew, 800); }
function nSpeedAuto() { NEW.speed = rec(NEW.type, NEW.voice).speed; NEW.speedAuto = true; renderVoiceNew(); estimateNew(); }
function nPlay(btn) { playPreview({voice: NEW.voice, speed: NEW.speed, fx: NEW.fx, clean: NEW.clean, text: sampleText(NEW.script)}, btn); }
function renderStylesNew() { if ($("#stylesNew")) $("#stylesNew").innerHTML = styleGallery(NEW.style, "nStyle"); }
function nStyle(id) { const s = CAT.styles.find(x => x.id === id); NEW.style = id; NEW.prefix = s.prefix; $("#n_style").value = s.prefix; renderStylesNew(); estimateNew(); }
function secsBlock(prefix, secs, isAuto, recSecs) {
  return `<div class="slider"><div class="top-l"><div><span class="muted" style="font-size:12.5px;font-weight:700">${t("secs_per_image", "Seconds per image")}</span>
      ${isAuto ? `<span class="rec">${t("auto", "AUTO")}</span>` : `<span class="rec off" onclick="${prefix}SecsAuto()">↺ ${t("auto", "AUTO")} ${recSecs}s</span>`}</div>
      <span class="val" id="${prefix}_secv">${secs}<small> s</small></span></div>
    <input type="range" id="${prefix}_secs" min="3" max="10" step="1" value="${Math.max(3, Math.min(10, secs))}" oninput="fill(this);${prefix}Secs(this.value)">
    <div class="marks"><span>3 s ${t("fast_cuts", "fast cuts")}</span><span>${t("recommended", "recommended")} ${recSecs}</span><span>10 s ${t("calm", "calm")}</span></div></div>`;
}
function renderSecsNew() { const r = rec(NEW.type, NEW.voice); $("#secsBoxNew").innerHTML = secsBlock("n", NEW.secs, NEW.secsAuto, r.scene_seconds); fill($("#n_secs")); }
function nSecs(v) { NEW.secs = parseInt(v); NEW.secsAuto = NEW.secs === rec(NEW.type, NEW.voice).scene_seconds; $("#n_secv").innerHTML = v + "<small> s</small>"; estimateNew(); clearTimeout(nSecs._t); nSecs._t = setTimeout(renderSecsNew, 800); }
function nSecsAuto() { NEW.secs = rec(NEW.type, NEW.voice).scene_seconds; NEW.secsAuto = true; renderSecsNew(); estimateNew(); }
function estimateNew() {
  const raw = NEW.script;
  const meta = k => (raw.match(new RegExp("^\\s*\\[" + k + "\\s*:\\s*(.+?)\\]\\s*$", "im")) || [])[1];
  const t = meta("TITLE"), th = meta("THUMBNAIL");
  if (t && !NEW.title.trim()) { NEW.title = t; $("#n_title").value = t; }
  if (th && !NEW.thumb.trim()) { NEW.thumb = th; $("#n_thumb").value = th; }
  const spoken = raw.split("\n").filter(l => !/^\s*(\[.*\]|#)/.test(l)).join(" ");
  const words = (spoken.match(/\b\w+\b/g) || []).length;
  const min = words / (2.6 * NEW.speed) / 60;
  $("#n_est").innerHTML = words ? `${words.toLocaleString()} ${window.t("words", "words")} ≈ <b>${fmtMin(min)}</b> ${window.t("of_narration", "of narration")} ≈ <b>${Math.ceil(min * 60 / NEW.secs)}</b> ${window.t("images", "images")}` : window.t("paste_script_hint", "Paste a script to see the length.");
  const tp = CAT.types.find(x => x.id === NEW.type), st = CAT.styles.find(x => x.id === NEW.style);
  const typeLabel = tp ? window.t("type_" + tp.id + "_name", tp.name) : "";
  const styleLabel = st ? window.t("style_" + st.id + "_name", st.name) : window.t("custom_look", "custom look");
  const secsLabel = `${NEW.secs}s ${window.t("per_image", "per image")}`;
  $("#n_sum").innerHTML = `<b>${esc(typeLabel)}</b> · ${esc(voiceName(NEW.voice))} ${window.t("at_speed", "at")} ${NEW.speed.toFixed(2)}x · ${esc(fxName(NEW.fx))} · ${styleLabel} · ${secsLabel}${words ? " · " + fmtMin(min) : ""}`;
}
async function createProject(btn, build) {
  if (!NEW.script.trim()) { toast("Paste your script first."); return; }
  btn.disabled = true;
  try {
    const p = await api("/api/projects", {method: "POST", body: {
      title: NEW.title.trim(), script: NEW.script, voice: NEW.voice, speed: NEW.speed, scene_seconds: NEW.secs,
      style_prefix: NEW.prefix, thumbnail_text: NEW.thumb, preset: NEW.type, voice_fx: NEW.fx, voice_clean: NEW.clean, style_id: NEW.style,
      explainer: NEW.style === "stick" ? true : null, cloud: NEW.mode === "single" && NEW.where === "cloud"}});
    NEW = null;
    if (build) {  // one click: create and make the whole video, with every automatic helper on
      await openProject(p.id); await run("all");
      toast(`Making your video: ${p.scenes.length} scenes. Characters, places, camera, music and sounds are handled for you.`, 9000); return;
    }
    toast(`Created <b>${p.scenes.length}</b> scenes. Review the prompts, then build.`);
    if ((p.cast || []).length || p.scenes.some(s => /image [12]|@\w/i.test(s.prompt))) {
      if (!(p.cast || []).length) await api(`/api/projects/${p.id}/cast`, {method: "POST", body: {name: "Main character"}});
      TAB = "script"; await openProject(p.id, true);
      toast("This story has characters. Build everything makes a character sheet for each one automatically, or set them up on the Cast tab.", 9000); return;
    }
    openProject(p.id);
  } catch (e) { toast("Error: " + esc(e.message)); btn.disabled = false; }
}

/* ================================================================ SEASONS */
/* A whole LECCORTUBE episode file (with ----- SCRIPT ----- boxes) pasted into a script box fills every field. */
function parseEpisodeFile(txt) {
  if (!/-----\s*SCRIPT\s*-----/.test(txt || "")) return null;
  const t = txt.replace(/\r\n/g, "\n");
  const box = label => {
    const m = t.match(new RegExp("-----\\s*" + label + "\\s*-----\\s*\\n(?:\\(copy[^\\n]*\\)\\s*\\n)?([\\s\\S]*?)\\n\\s*-----\\s*END OF " + label + "\\s*-----"));
    return m ? m[1].trim() : null;
  };
  const line = re => { const m = t.match(re); return m ? m[1].trim() : null; };
  const chars = box("NEW CHARACTERS") ?? box("CHARACTERS");
  return {season: box("SEASON NAME"), title: box("EPISODE TITLE"), script: box("SCRIPT"),
          chars: chars && !/^\(leave/i.test(chars) ? chars : "",
          type: line(/Video type:\s*([^\n.]+)/), look: line(/Look:\s*([^\n.]+)/), secs: parseInt(line(/Seconds per image:\s*(\d+)/) || "0")};
}
function importEpisodeNew(txt) {
  const f = parseEpisodeFile(txt); if (!f || !f.script) return false;
  NEW.mode = "season";
  if (f.season) NEW.season = f.season;
  if (f.title) NEW.epTitle = f.title;
  NEW.chars = f.chars; NEW.script = f.script;
  const tp = f.type && CAT.types.find(x => x.name.toLowerCase() === f.type.toLowerCase());
  if (tp) { const keep = NEW.script, r = rec(tp.id, isNatural(NEW.voice) ? "x:y" : ""); NEW.type = tp.id; NEW.voice = r.voice; NEW.fx = r.fx; NEW.speed = r.speed; NEW.speedAuto = true; NEW.script = keep; }
  const st = f.look && CAT.styles.find(x => x.name.toLowerCase() === f.look.toLowerCase());
  if (st) { NEW.style = st.id; NEW.prefix = st.prefix; STYLE_FILTER = "All"; }
  if (f.secs) { NEW.secs = f.secs; NEW.secsAuto = false; }
  showNew();
  toast(`Episode file read: season name, title, ${f.chars ? f.chars.split("\n").filter(Boolean).length + " characters, " : ""}script${tp ? ", type" : ""}${st ? ", look" : ""}${f.secs ? ", " + f.secs + "s per image" : ""} are filled in. Check the voice, then create.`, 9000);
  return true;
}
function importEpisodeForm(txt) {
  const f = parseEpisodeFile(txt); if (!f || !f.script) return;
  $("#ep_script").value = f.script;
  if (f.title) $("#ep_title").value = f.title;
  $("#ep_chars").value = f.chars || "";
  toast(`Episode file read: title, script${f.chars ? " and new characters" : ""} are filled in.`, 7000);
}
async function createSeason(btn) {
  if (!NEW.season.trim()) { toast("Give the season a name."); return; }
  if (!NEW.script.trim()) { toast("Write the Episode 1 script."); return; }
  btn.disabled = true;
  try {
    const r = await api("/api/seasons", {method: "POST", body: {
      title: NEW.season.trim(), characters: NEW.chars, episode_title: NEW.epTitle.trim(), script: NEW.script,
      voice: NEW.voice, speed: NEW.speed, scene_seconds: NEW.secs, style_prefix: NEW.prefix, preset: NEW.type,
      voice_fx: NEW.fx, voice_clean: NEW.clean, style_id: NEW.style}});
    NEW = null;
    toast(`Season created with <b>${r.season.cast.length}</b> characters. Build Episode 1: it makes every character sheet first.`, 9000);
    TAB = "script"; openProject(r.project.id, true);
  } catch (e) { toast("Error: " + esc(e.message)); btn.disabled = false; }
}
async function showSeasons() {
  VIEW = "seasons"; markNav();
  let list = [];
  try { list = await api("/api/seasons"); } catch (e) {}
  $("#main").innerHTML = `<div class="card hot"><div class="sec-t" style="margin:0"><span class="n">${ic("tv")}</span><div><h3>Seasons</h3><small>A series of episodes with the same characters. Characters are made once and used in every episode.</small></div><div class="grow"></div>
      <button class="btn primary" onclick="NEW=newDefaults();NEW.mode='season';go('new')">${ic("plus", "sm")} New season</button></div></div>
    ${list.length ? `<div class="seasons">${list.map(x => `<div class="season-c" onclick="openSeason('${x.id}')">
        <div class="sc-img">${x.cover ? `<img src="${x.cover}" loading="lazy">` : ic("tv", "lg")}</div>
        <div class="sc-in"><b>${esc(x.title)}</b><span>${x.episodes} episode${x.episodes === 1 ? "" : "s"} · ${x.characters} character${x.characters === 1 ? "" : "s"}</span></div></div>`).join("")}</div>`
      : `<div class="card empty"><div class="big">${ic("tv", "lg")}</div>No seasons yet.<br>Click <b>New season</b>, write the characters once and the first episode.</div>`}`;
}
let SEASON = null, EP_FORM = false;
async function openSeason(sid, form) {
  stopPoll(); clearTimeout(SETUP_POLL);
  VIEW = "season"; markNav(); CUR = null;
  if (form !== undefined) EP_FORM = form;
  try { SEASON = await api(`/api/seasons/${sid}`); } catch (e) { toast("Error: " + esc(e.message)); go("seasons"); return; }
  renderSeason(); loadProjects();
}
function renderSeason() {
  const S = SEASON, n = (S.episode_list || []).length;
  const tp = CAT.types.find(t => t.id === S.preset), st = CAT.styles.find(x => x.id === S.style_id);
  $("#main").innerHTML = `
  <div class="card hot">
    <div class="phead"><div style="min-width:0;flex:1">
      <div class="actions"><span class="chip a">${ic("tv", "sm")} Season</span>${tp ? `<span class="chip">${ic(TYPE_ICON[tp.id] || "film", "sm")} ${esc(tp.name)}</span>` : ""}${st ? `<span class="chip">${ic("palette", "sm")} ${esc(st.name)}</span>` : ""}${S.voice ? `<span class="chip">${ic("mic", "sm")} ${esc(voiceName(S.voice))}</span>` : ""}</div>
      <h2 style="margin-top:10px">${esc(S.title)}</h2>
      <div class="stats"><span class="stat"><b>${n}</b> episode${n === 1 ? "" : "s"}</span><span class="stat"><b>${S.cast.length}</b> characters</span><span class="stat"><b>${S.cast.filter(c => c.file).length}</b> with pictures</span></div>
    </div>
    <div class="actions"><button class="btn primary" onclick="EP_FORM=true;renderSeason();setTimeout(()=>$('#ep_script')&&$('#ep_script').focus(),50)">${ic("plus", "sm")} New episode</button>
      <button class="btn danger sm" onclick="deleteSeasonUI()" title="Removes the season. Episodes stay as normal videos.">${ic("trash", "sm")}</button></div></div>
  </div>
  ${EP_FORM ? `<div class="card"><div class="sec-t"><span class="n">${ic("plus")}</span><div><h3>Episode ${n + 1}</h3><small>Same type, voice, look and characters as the season</small></div></div>
    <label style="margin-top:0">Episode title</label><input id="ep_title" placeholder="The Stranger">
    <label>Script</label>
    <div class="chips" style="margin-bottom:8px">${S.cast.map(c => `<button onclick="insertTag('${esc(c.name.split(" ")[0])}')" title="Put @${esc(c.name.split(" ")[0])} in the script">@${esc(c.name.split(" ")[0])}</button>`).join("")}</div>
    <textarea id="ep_script" rows="12" oninput="importEpisodeForm(this.value)" placeholder="@Farid fixed the clock by candle light...&#10;&#10;# Part two&#10;..."></textarea>
    <label>New characters in this episode <span class="hint">(optional) one per line: Name = what they look like</span></label>
    <textarea id="ep_chars" rows="3" placeholder="Zara = a young traveler, short red hair, green cloak"></textarea>
    <div class="hint" style="margin-top:6px">Characters you already have keep their pictures. New ones get a character sheet when this episode is built, then they are shared with the whole season.</div>
    <div class="actions" style="margin-top:12px"><button class="btn primary" onclick="createEpisode(this)">${ic("sparkles", "sm")} Create Episode ${n + 1}</button><button class="btn ghost" onclick="EP_FORM=false;renderSeason()">Cancel</button></div></div>` : ""}
  <div class="card"><div class="sec-t"><span class="n">${ic("film")}</span><div><h3>Episodes</h3><small>Open an episode and Build everything</small></div></div>
    <div class="eps">${(S.episode_list || []).map(e => `<div class="ep" onclick="openProject('${e.id}')">
      <div class="ep-img">${e.cover ? `<img src="${e.cover}" loading="lazy">` : ic("film", "lg")}<span class="epn">EP ${e.episode || ""}</span></div>
      <div class="ep-in"><b>${esc(e.title)}</b><span>${e.scenes} scenes · ${e.video ? "Video ready" : e.state === "running" || e.state === "queued" ? "Building…" : "Not built yet"}</span></div></div>`).join("")}
      <div class="ep add" onclick="EP_FORM=true;renderSeason()"><div class="ep-img">${ic("plus", "lg")}</div><div class="ep-in"><b>New episode</b><span>Episode ${n + 1}</span></div></div></div></div>
  <div class="card"><div class="sec-t"><span class="n">${ic("user")}</span><div><h3>Characters</h3><small>Shared by every episode. ${S.cast.some(c => !c.file) ? "Characters without a picture get one when an episode that has them is built." : "All characters have pictures."}</small></div></div>
    <div class="scast">${S.cast.map((c, i) => `<div class="scc">
      <div class="scc-img">${c.url ? `<img src="${c.url}" onclick="viewImage('${c.sheet_url || c.url}','${esc(c.name)}')">` : `<div class="ph">${ic("user", "lg")}<span>Made when built</span></div>`}</div>
      <div class="scc-in"><b>${esc(c.name)}</b><span class="hint">From episode ${c.since || 1}</span>
        <textarea rows="3" id="scd_${i}" ${c.file ? "" : ""}>${esc(c.desc || "")}</textarea>
        <div class="actions"><button class="btn sm" onclick="saveSeasonChar(${i})">Save</button>${c.sheet_url ? `<button class="btn sm ghost" onclick="viewImage('${c.sheet_url}','${esc(c.name)} sheet')">Sheet</button>` : ""}</div></div></div>`).join("")}</div>
    <div class="hint" style="margin-top:10px">To change a character's picture, open any episode > Cast tab and make a new sheet or upload a picture. The new picture is shared with the season and used in episodes you build after that.</div></div>`;
}
function insertTag(name) {
  const t = $("#ep_script"); if (!t) return;
  const a = t.selectionStart || t.value.length;
  t.value = t.value.slice(0, a) + "@" + name + " " + t.value.slice(a); t.focus(); t.selectionStart = t.selectionEnd = a + name.length + 2;
}
async function createEpisode(btn) {
  const script = $("#ep_script").value;
  if (!script.trim()) { toast("Write the episode script."); return; }
  btn.disabled = true;
  try {
    const p = await api(`/api/seasons/${SEASON.id}/episodes`, {method: "POST", body: {title: $("#ep_title").value.trim(), script, characters: $("#ep_chars").value}});
    EP_FORM = false; toast(`Episode ${p.season.episode} created with the season's characters.`);
    TAB = "script"; openProject(p.id, true);
  } catch (e) { toast("Error: " + esc(e.message)); btn.disabled = false; }
}
async function saveSeasonChar(i) {
  const c = SEASON.cast[i];
  try { SEASON = await api(`/api/seasons/${SEASON.id}/characters`, {method: "PATCH", body: {name: c.name, desc: $("#scd_" + i).value}}); toast(`${esc(c.name)} saved`); renderSeason(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function deleteSeasonUI() {
  if (!await confirmBox("Remove this season?", "The shared character list is removed. <b>Episodes stay</b> as normal videos with their pictures.", "Remove season", true)) return;
  try { await api(`/api/seasons/${SEASON.id}`, {method: "DELETE"}); SEASON = null; go("seasons"); } catch (e) { toast("Error: " + esc(e.message)); }
}

/* ================================================================ PROJECT */
async function openProject(id, keepTab) {
  stopPoll(); clearTimeout(SETUP_POLL); dirty = {}; lastImgV = {};
  if (!keepTab || !CUR || CUR.id !== id) RP_LAST = {};
  document.body.classList.remove("menu");
  try { CUR = await api(`/api/projects/${id}`); } catch (e) { toast("Error: " + esc(e.message)); go("new"); return; }
  if (!keepTab) TAB = (CUR.outputs || {}).video ? "output" : CUR.scenes.some(s => s.image || s.clip || s.duration) ? "scenes" : "script";
  VIEW = "project"; markNav(); setWhere(CUR.title || ""); loadProjects(); renderProject(); maybePoll();
}
let RP_LAST = {};
function renderProject() {
  const p = CUR;
  // re-rendering the same tab (a scene finished, a setting saved) keeps the scroll position instead of jumping to the top
  const mainEl = $("#main"), keepTop = RP_LAST.id === p.id && RP_LAST.tab === TAB ? mainEl.scrollTop : 0;
  RP_LAST = {id: p.id, tab: TAB};
  const imgs = p.scenes.filter(s => s.image || s.clip).length, voiced = p.scenes.filter(s => s.duration).length;
  const running = ["running", "queued"].includes(p.status.state);
  $("#main").innerHTML = `
  <div class="card hot">
    <div class="phead">
      <div style="min-width:0;flex:1">
        <div class="actions">${p.season ? `<a class="chip a" style="cursor:pointer" onclick="openSeason('${p.season.id}')">${ic("tv", "sm")} ${esc(p.season.title)} · Episode ${p.season.episode}</a><button class="btn sm" onclick="openSeason('${p.season.id}', true)">${ic("plus", "sm")} Next episode</button>` : ""}<span class="chip a">${ic(TYPE_ICON[p.preset] || "film", "sm")} ${esc(p.type_info.name)}</span>${p.preset === "rhyme" ? `<span class="chip">${ic("music", "sm")} Sung · ${esc(((CAT.song.styles.find(x => x.id === (p.song || {}).style) || {}).name) || "Happy nursery rhyme")} · ${esc(((CAT.song.singers.find(x => x.id === (p.song || {}).singer) || {}).name) || "Kids choir")}${(p.song || {}).duration ? ` · ${Math.round(p.song.duration)} s` : ""}</span>` : `<span class="chip">${ic("mic", "sm")} ${esc(p.voice_label || p.voice)} · ${p.speed}x · ${esc(fxName(p.voice_fx))}</span>`}</div>
        <h2 style="margin-top:10px">${esc(p.title)}</h2>
        <div class="stats">
          <span class="stat"><b>${p.scenes.length}</b> scenes</span><span class="stat"><b>${p.chapters.length}</b> chapters</span>
          <span class="stat">≈ <b>${fmtMin(p.estimate_min)}</b></span>
          <span class="stat">voice <b id="st_voice">${voiced}/${p.scenes.length}</b>${p.narrated_min ? ` · ${fmtMin(p.narrated_min)}` : ""}</span>
          <span class="stat">images <b id="st_imgs">${imgs}/${p.scenes.length}</b></span>
          <span class="stat"><b>${p.scenes.filter(s => s.media === "video").length}</b> video scenes</span>
          ${p.eta && p.eta.minutes > 0.5 ? `<span class="stat" title="${p.eta.learned ? "Learned from your earlier builds on this PC" : "First guess, gets exact after your first build"}">build ≈ <b>${fmtMin(p.eta.minutes)}</b></span>` : ""}
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost sm" onclick="openFolder('project')" title="Open the project folder">${ic("folder", "sm")}</button>
        <button class="btn danger sm" onclick="deleteProjectUI()" title="Delete this project and its files">${ic("trash", "sm")} Delete</button>
      </div>
    </div>
    <div class="steps">
      ${!running && ["error", "cancelled"].includes(p.status.state) ? `<button class="btn primary" onclick="run('all')" title="Continue from where it stopped. Finished voices, images and clips are kept.">${ic("play", "sm")} Resume</button>` : ""}
      <button class="btn ${!running && ["error", "cancelled"].includes(p.status.state) ? "" : "primary"}" onclick="run('all'${p.cloud_mode ? ", false, true" : ""})" title="Voice, Images, Videos, Render, Export. Finished parts are kept. Pictures and clips are made where the Storyboard says (On my PC or Cloud).">${ic("play", "sm")} Build everything</button>
      <span id="cloudChip">${cloudChip(p)}</span>
      <button class="btn" onclick="run('preview')" title="Voice, images and a short render of the first 3 scenes. Check the look, voice and captions before the long build.">${ic("eye", "sm")} Preview first</button>
      <button class="btn" onclick="run('voice')">1 · Voice</button>
      <button class="btn" onclick="run('images')">2 · Images</button>
      <button class="btn" onclick="run('videos')" title="Animate the video scenes">3 · Videos</button>
      <button class="btn" onclick="run('render')">4 · Render</button>
      <button class="btn" onclick="run('export')">5 · Export</button>
      <button class="btn danger" id="stopBtn" onclick="cancelJob()" ${running ? "" : "disabled"}>${ic("stop", "sm")} Stop</button>
    </div>
    <div class="progress ${running ? "run" : ""}" id="pwrap"><div id="pbar"></div></div>
    <div class="statusline"><span id="pmsg" class="muted"></span><span id="pstate" class="state"></span></div>
    <details class="log"><summary>Log</summary><pre id="plog"></pre></details>
  </div>
  <div class="tabs glass">
    ${[["script", "file", p.preset === "rhyme" ? "Lyrics" : "Script"], ["settings", p.preset === "rhyme" ? "music" : "mic", p.preset === "rhyme" ? "Song" : "Voice"], ["look", "palette", "Look"], ["cast", "user", "Cast"],
       ["places", "map", "Places"], ["scenes", "layers", "Storyboard"], ["music", "headphones", "Music & sound"], ["timeline", "sliders", "Timeline"], ["output", "film", "Output"]].map(([t, i, l]) =>
      `<button class="tab ${TAB === t ? "on" : ""} ${t === "timeline" && !(PRO && PRO.pro) ? "tab-pro" : ""}" onclick="setTab('${t}')">${ic(i, "sm")} ${l}${t === "timeline" ? ` <span class="protag">PRO</span>` : ""}</button>`).join("")}
  </div>
  <div id="tabBody"></div>`;
  updateStatus();
  ({scenes: renderScenes, output: renderOutput, settings: renderSettings, script: renderScript, cast: renderCast,
    look: renderLook, music: renderMusic, places: renderPlaces,
    timeline: () => !(PRO && PRO.pro) ? renderTimelineLocked() : p.docu_look ? renderDocTimeline(TL && TLS.pid === p.id ? "keep" : false)
      : renderProjTimeline()})[TAB]();
  if (!keepTop) mainEl.scrollTop = 0;
  if (keepTop) { mainEl.scrollTop = keepTop; requestAnimationFrame(() => { mainEl.scrollTop = keepTop; }); }
}
async function setTab(t) { if (TAB === "scenes" && Object.keys(dirty).length) await saveScenes(true); await flushCast(); TAB = t; renderProject(); }
function updateStatus() {
  const st = CUR.status, running = ["running", "queued"].includes(st.state);
  $("#pbar").style.width = Math.round((st.progress || 0) * 100) + "%";
  $("#pwrap").classList.toggle("run", running);
  $("#pmsg").textContent = st.message || "";
  const lbl = {idle: "", queued: "Queued", running: `Running: ${st.step} · ${Math.round((st.progress || 0) * 100)}%`, done: `Done: ${st.step}`, error: "Error", cancelled: "Stopped"}[st.state] || st.state;
  $("#pstate").textContent = lbl; $("#pstate").className = "state " + st.state;
  if ($("#stopBtn")) $("#stopBtn").disabled = !running;
  const log = $("#plog"); const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 5;
  log.textContent = (st.log || []).join("\n"); if (atBottom) log.scrollTop = log.scrollHeight;
  const imgs = CUR.scenes.filter(s => s.image || s.clip).length, voiced = CUR.scenes.filter(s => s.duration).length;
  if ($("#st_imgs")) $("#st_imgs").textContent = `${imgs}/${CUR.scenes.length}`;
  if ($("#st_voice")) $("#st_voice").textContent = `${voiced}/${CUR.scenes.length}`;
}
async function deleteProjectUI() {
  const r = await confirmBox("Delete this project?",
    `<div><b>${esc(CUR.title)}</b> and all its files on this PC (images, voice, videos, final video) will be deleted. This cannot be undone.</div>
     <div class="path" style="margin-top:10px">${esc(CUR.path)}</div>
     ${(CUR.outputs || {}).export_dir ? `<label class="chk"><input type="checkbox" id="delExp"><span>Also delete the copy in your output folder<br><span class="hint">${esc(CUR.outputs.export_dir)}</span></span></label>` : ""}`,
    "Delete forever", true);
  if (!r) return;
  try {
    const res = await api(`/api/projects/${CUR.id}?exported=${r.checks.delExp ? "true" : "false"}`, {method: "DELETE"});
    toast("Project deleted" + (res.removed_exports.length ? " (and its output copy)" : ""));
    CUR = null; if (res.projects.length) openProject(res.projects[0].id); else go("new");
    loadJobChip();
  } catch (e) { toast("Error: " + esc(e.message), 8000); }
}

/* ---------------- scenes ---------------- */
function sceneImg(s) {
  if (s.clip_url) return `<video muted loop playsinline preload="metadata" src="${s.clip_url}#t=0.5" onmouseenter="this.play()" onmouseleave="this.pause()"></video>`;
  if (s.media === "video" && s.has_video) {
    const poster = s.image ? `poster="/files/${CUR.id}/${s.image}?v=${s.image_v || 0}"` : "";
    return `<video muted loop playsinline preload="none" ${poster} src="/files/${CUR.id}/${s.video}?v=${s.video_v || 0}" onmouseenter="this.play()" onmouseleave="this.pause()"></video>`;
  }
  if (!s.image) return s.clip ? `<span>Your clip</span>` : `<span>no image yet</span>`;
  return `<img loading="lazy" src="/files/${CUR.id}/${s.image}?v=${s.image_v || 0}">`;
}
function mediaBadge(s) {
  if (s.clip) return `<span class="badge r">Your clip</span>`;
  if (s.media === "video") return `<span class="badge r">${s.has_video ? "video ready" : "video"}</span>`;
  return CUR.thumbnail_scene === CUR.scenes.indexOf(s) ? `<span class="badge r">Thumbnail</span>` : "";
}
function sentAs(s) {
  if (!s.effective_prompt || s.effective_prompt.trim() === (s.prompt || "").trim()) return "";
  const txt = esc(s.effective_prompt).replace(/(image \d)/gi, "<b>$1</b>");
  return `<div class="sent" title="References are written into the prompt automatically">Sent as: ${txt}</div>`;
}
function renderScenes() {
  const mainEl = $("#main"), top = mainEl ? mainEl.scrollTop : 0;  // keep the place in the storyboard after any change
  _renderScenes();
  if (top) { mainEl.scrollTop = top; requestAnimationFrame(() => { mainEl.scrollTop = top; }); }
}
function _renderScenes() {
  const chTitle = i => CUR.chapters[i]?.title || "";
  const nv = CUR.scenes.filter(s => s.media === "video").length, nvd = CUR.scenes.filter(s => s.media === "video" && s.has_video).length;
  const hk = (CUR.recommend || {}).hook_minutes || 3;
  $("#tabBody").innerHTML = `
    <div class="toolbar glass">
      ${ic("film")}<b>Director</b>
      <label class="switch" title="Camera, angle, light and motion for every scene, set before the pictures are made"><input type="checkbox" ${CUR.auto_director !== false ? "checked" : ""} onchange="setAutoDirector(this.checked)"><span></span> Auto Director ${CUR.auto_director !== false ? "on" : "off"}</label>
      <button class="btn sm" onclick="runDirector(false)" title="Set the camera again for every scene (scenes you set by hand are kept)">${ic("refresh", "sm")} Direct again</button>
      <button class="btn sm" onclick="runDirector(true)" title="Local AI through Ollama (Setup Center)">${ic("sparkles", "sm")} Smart Director (AI)</button>
      <span class="hint" style="margin-left:auto">Click <b>Shot</b> on a scene to set it by hand. Hand-set scenes are never changed.</span>
    </div>
    <div class="toolbar glass">
      ${ic("video")}<b>Hook</b><span class="hint">Animate the first</span><input id="hk_min" type="number" min="0.5" step="0.5" value="${hk}"><span class="hint">min</span>
      <label class="chk" style="margin:0"><input type="checkbox" id="hk_split" checked> cut into shots of</label><input id="hk_sec" type="number" min="4" max="20" value="8"><span class="hint">s</span>
      <button class="btn sm primary" onclick="setHook()">Apply</button>
      <button class="btn sm" onclick="clearHook()">All back to image</button>
      <span class="hint" style="margin-left:auto">${nv} video scene(s)${nv ? `, ${nvd} made` : ""}</span>
    </div>
    <div class="card bd-card"><div class="where ck-where" id="bdWhere" style="margin-top:0">${boardWhere()}</div><div id="bdCloud">${boardModels()}</div></div>
    <div class="toolbar glass">
      ${ic("mic")}<b>Lip sync</b> ${PTAG}<span class="hint">Dialogue video scenes (with @Name: lines) get moving lips. Run after 3 · Videos, then 4 · Render.</span>
      <button class="btn sm" style="margin-left:auto" onclick="needPro('Lip sync') || run('lipsync', true)">${ic("mic", "sm")} Lip sync dialogue scenes</button>
    </div>
    <div class="hint" style="margin:0 2px 12px">Edit prompts, then Save. <b>Image</b> = still with slow camera move. <b>Video</b> = animated by the video model; its motion prompt is written for you from the image prompt. Reference slots keep characters and places consistent, the <b>image 1 / image 2</b> wording is added automatically.</div>
    <div class="grid ${CUR.preset === "short" ? "tall" : ""}">${CUR.scenes.map((s, i) => `
      <div class="scene ${s.media === "video" ? "isvideo" : ""}" id="sc_${s.id}">
        <div class="img" id="img_${s.id}">${sceneImg(s)}
          <span class="badge">${s.id} · ${fmtT(s.start || 0)}${s.duration ? " · " + s.duration.toFixed(0) + "s" : ""}</span>
          ${mediaBadge(s)}
          ${s.refs_resolved.length || s.style_applied ? `<span class="badge b">${[...s.refs_resolved.map(r => esc(r.label)), ...(s.extra_refs || (s.style_applied ? ["style"] : [])).map(esc)].join(" + ")}</span>` : ""}
        </div>
        <div class="body">
          ${CUR.chapters.some(c => c.start_scene === i) && !/^Part \d+$/.test(chTitle(s.chapter)) ? `<div class="ch">▸ ${esc(chTitle(s.chapter))}</div>` : ""}
          <div class="narr" onclick="editNarr('${s.id}', this)" title="Click to edit narration">${esc(s.text)}</div>
          <textarea data-id="${s.id}" oninput="markDirty('${s.id}','prompt',this.value)" placeholder="Image prompt">${esc(s.prompt)}</textarea>
          <div class="refs">${autoTags(s)}</div>
          ${placeSelect(s)}
          ${sentAs(s)}
          ${camLine(s)}
          <div class="btns">
            <button class="btn sm primary" onclick="openShot('${s.id}')">${ic("film", "sm")} Shot</button>
            ${sceneModelBtn(s)}
            <span class="seg"><button class="${s.media !== "video" ? "on" : ""}" onclick="setMedia('${s.id}','image')">${ic("image", "sm")} Image</button><button class="${s.media === "video" ? "on" : ""}" onclick="setMedia('${s.id}','video')">${ic("video", "sm")} Video</button></span>
            <button class="btn sm" onclick="regen('${s.id}')" title="New image${s.media === "video" ? " and a new video from it" : ""}">${ic("refresh", "sm")} Image</button>
            ${s.media === "video" ? `<button class="btn sm" onclick="regenVideo('${s.id}')" ${s.image ? "" : "disabled"}>${ic("refresh", "sm")} Video</button>` : ""}
            <label class="upl" title="Use your own picture for this scene"><input type="file" accept="image/*" onchange="replaceImage('${s.id}',this,false)"><span class="btn sm">${ic("upload", "sm")} Image</span></label>
            <label class="upl"><input type="file" accept="video/*" onchange="uploadClip('${s.id}',this)"><span class="btn sm">${ic("plus", "sm")} Clip</span></label>
            <button class="btn sm ghost" onclick="moveScene('${s.id}',-1)" title="Move earlier">↑</button><button class="btn sm ghost" onclick="moveScene('${s.id}',1)" title="Move later">↓</button><button class="btn sm ghost danger" onclick="deleteScene('${s.id}')" title="Delete this scene from the story">${ic("trash", "sm")}</button>
            ${s.clip ? `<button class="btn sm danger" onclick="removeClip('${s.id}')">${ic("x", "sm")} Clip</button>` : ""}
            <button class="btn sm ghost" onclick="setThumb(${i})" title="Use as thumbnail">${ic("star2", "sm")}</button>
            ${scenePcBtn(s)}
          </div>
          ${s.media === "video" ? `<div class="motion"><div class="lab"><span>Motion ${s.motion_auto !== false && s.motion ? `<span class="rec">AUTO</span>` : ""}</span>
              <button class="btn sm ghost" onclick="autoMotion('${s.id}')" title="Write it again from the image prompt">${ic("sparkles", "sm")} Rewrite</button></div>
            <textarea rows="2" oninput="markDirty('${s.id}','motion',this.value)" placeholder="How things move">${esc(s.motion || "")}</textarea></div>` : ""}
        </div>
      </div>`).join("")}</div>
    <div class="savebar" id="savebar"><div class="card" style="display:flex;gap:10px;align-items:center;padding:10px 12px"><span class="hint" id="dirtyCount"></span>
      <button class="btn" onclick="discard()">Discard</button><button class="btn primary" onclick="saveScenes()">Save changes</button></div></div>`;
  CUR.scenes.forEach(s => lastImgV[s.id] = sceneKey(s));
}
/* ---------------- Storyboard: on my PC / cloud, models per scene, cost ---------------- */
let BM = null, LM = null;
async function bdLoad(force) {
  const jobs = [];
  if (!LM || force) jobs.push(api("/api/local/board-models").then(r => LM = r).catch(() => LM = {image: [], video: [], image_default: "klein", video_default: "wan5b"}));
  if (!BM || force) jobs.push(api("/api/cloud/board-models").then(r => BM = r).catch(() => BM = {pro: false, image: {providers: [], chosen: ""}, video: {providers: [], chosen: ""}}));
  await Promise.all(jobs);
  if (!CIM && BM.pro) CIM = {...BM.image, pro: true};
  if (CUR && CUR.cloud_mode && BM.pro && (!CUR.board_image_model || !CUR.board_video_model)) {  // what you see is what is used
    const body = {}; if (!CUR.board_image_model && BM.image.chosen) body.image_model = BM.image.chosen; if (!CUR.board_video_model && BM.video.chosen) body.video_model = BM.video.chosen;
    if (Object.keys(body).length) { try { CUR = await api(`/api/projects/${CUR.id}/board`, {method: "POST", body}); } catch (e) {} }
  }
  bdRepaint();
  return BM;
}
/* "make the voice first": pick Free (on my PC) or Cloud (Pro) right there */
function voiceChoice(msg) {
  const cloud = isCloudVoice(CUR.voice), pro = proOn(), local = cloud ? CUR.recommend.voice : CUR.voice;
  return `<div class="card empty vchoose">${ic("mic", "lg")}<br>${esc(msg)}<div class="where">${orderWhere(`<button class="wh ${!cloud ? "on" : ""}" onclick="vcRun('pc')"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>On my PC</b>
      <span>Free. ${esc(vName(local))}</span><small>Costs nothing, only time. The first time it may download the voice model.</small></div></button>
    <button class="wh ${cloud ? "on" : ""} ${pro ? "" : "nopro"}" onclick="vcRun('cloud')"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>Cloud voice <span class="pro-badge">${ic(pro ? "crown" : "lock")}<i>PRO</i></span></b>
      <span>${cloud ? esc(vName(CUR.voice)) : "Google Gemini, ElevenLabs or OpenAI on your own key. Fast on any PC."}</span><small>${cloud ? "Records in the cloud now" : "Pick a cloud voice first on the Voice tab"}</small></div></button>`)}</div></div>`;
}
async function vcRun(w) {
  if (w === "cloud") {
    if (!proOn()) { needPro("Cloud voices"); return; }
    if (isCloudVoice(CUR.voice)) { run("voice"); return; }
    await setTab("settings"); setTimeout(() => vWhere("cloud"), 60);
    toast("Pick a cloud voice, click Save voice, then 1 · Voice.", 7000); return;
  }
  if (isCloudVoice(CUR.voice)) {
    try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {voice: CUR.recommend.voice}}); }
    catch (e) { toast("Error: " + esc(e.message)); return; }
  }
  run("voice");
}
function cloudChip(p) { return p.cloud_mode ? `<span class="chip ok" title="Pictures and clips are made in the cloud. Change it on the Storyboard." onclick="TAB='scenes';renderProject()" style="cursor:pointer"><span class="dot"></span>Cloud pictures</span>` : ""; }
/* repaint only what changed (no full re-render, so nothing flashes) */
function setHTML(el, html) { if (el && el.innerHTML !== html) el.innerHTML = html; }
function bdRepaint() {
  if (TAB !== "scenes" || !$("#bdWhere")) return;
  const w = document.createElement("div");
  w.innerHTML = boardWhere(); setHTML($("#bdWhere"), w.innerHTML);
  w.innerHTML = boardModels(); setHTML($("#bdCloud"), w.innerHTML);
  CUR.scenes.forEach(s => { const el = $("#smb_" + s.id); if (el) el.outerHTML = sceneModelBtn(s); const b = $("#pcb_" + s.id); if (b) b.outerHTML = scenePcBtn(s); });
  setHTML($("#cloudChip"), cloudChip(CUR));
}
function boardWhere() {
  const cloud = !!CUR.cloud_mode, pro = !BM || BM.pro !== false;
  if (!BM || !LM) setTimeout(() => bdLoad(), 0);
  return orderWhere(`<button class="wh ${!cloud ? "on" : ""}" onclick="bdWhere('local')"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>On my PC</b>
      <span>Free. Pictures with FLUX and clips with Wan on your GPU, pick a model per scene.</span><small>Costs nothing, only time</small></div></button>
    <button class="wh ${cloud ? "on" : ""} ${pro ? "" : "nopro"}" onclick="bdWhere('cloud')"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>Cloud <span class="pro-badge">${ic(pro ? "crown" : "lock")}<i>PRO</i></span></b>
      <span>Pictures and video clips from the models you pick, on your own key. Fast on any PC, pick a model per scene.</span><small>Voice, music and the final render stay on this PC</small></div></button>`);
}
async function bdWhere(w) {
  if (w === "cloud" && !proOn()) { needPro("Cloud pictures and clips"); return; }
  if (!!CUR.cloud_mode === (w === "cloud")) return;
  try { CUR = await api(`/api/projects/${CUR.id}/board`, {method: "POST", body: {where: w}}); bdRepaint(); if (w === "cloud") await bdLoad(true);
    toast(w === "cloud" ? "Cloud: pictures and clips use the models below. Change any scene with its model button." : "On my PC: pictures and clips on your GPU, free.", 6000); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
/* model lists: cloud ones grouped by account, PC ones flat */
function isPc(s) { return !CUR.cloud_mode || !!(s && s.on_pc); }  // free on this GPU: the whole board, or one scene in a cloud build
function bmAll(kind, pc) {
  if (pc === undefined ? !CUR.cloud_mode : pc) return ((LM && LM[kind]) || []).map(m => ({...m, prov: "On my PC"}));
  return ((BM && BM[kind] && BM[kind].providers) || []).flatMap(p => p.models.map(m => ({...m, prov: p.label})));
}
function bmFind(kind, id, pc) { return bmAll(kind, pc).find(m => m.id === id) || null; }
function imgOf(s) {
  if (isPc(s)) return bmFind("image", (s && s.img_local) || CUR.board_image_local || (LM && LM.image_default), true);
  return bmFind("image", (s && s.img_model) || CUR.board_image_model || (BM && BM.image.chosen), false);
}
function vidOf(s) {
  if (isPc(s)) return bmFind("video", (s && s.vid_local) || CUR.board_video_local || (LM && LM.video_default), true);
  return bmFind("video", (s && s.vid_model) || CUR.board_video_model || (BM && BM.video.chosen), false);
}
function sceneNeed(s) { return (s.duration || Math.max(3, (s.text || "").split(/\s+/).length / 2.5)) + 0.5; }
/* clip length: the one picked for the scene if the model makes it, else the shortest that covers the narration */
function autoSecs(m, need) {
  const a = m && m.prov === "On my PC" && LM && LM.auto_secs ? LM.auto_secs : (m && m.secs) || [5];  // on this PC Auto follows Settings > Max clips chained
  return a.find(x => x >= need) || a[a.length - 1];
}
function clipSecs(m, s) { const a = (m && m.secs) || [5]; return s && s.vid_secs && a.includes(s.vid_secs) ? s.vid_secs : autoSecs(m, s ? sceneNeed(s) : 6); }
function boardCost() {
  const imgs = {}, vids = {};
  let total = 0, ni = 0, nv = 0;
  for (const s of CUR.scenes) {
    if (CUR.cloud_mode && s.on_pc) continue;  // made free on this PC
    if (!s.image) { const m = imgOf(s); if (m) { const g = imgs[m.id] || (imgs[m.id] = {m, n: 0}); g.n++; ni++; total += m.price || 0; } }
    if (s.media === "video" && !s.has_video) { const m = vidOf(s); if (m) { const sec = clipSecs(m, s), g = vids[m.id] || (vids[m.id] = {m, n: 0, sec: 0}); g.n++; g.sec += sec; nv++; total += sec * (m.per_sec || 0); } }
  }
  return {imgs: Object.values(imgs), vids: Object.values(vids), total, ni, nv};
}
function boardModels() {
  const cloud = !!CUR.cloud_mode;
  if (cloud ? !BM : !LM) return `<div class="hint" style="margin-top:12px"><span class="eq"><i></i><i></i><i></i></span> Loading the models…</div>`;
  const mi = imgOf(null), mv = vidOf(null), c = boardCost(), nVid = CUR.scenes.filter(s => s.media === "video").length;
  const box = (kind, m, label) => `<button class="cmbox cloud" onclick="bdPicker('${kind}')"><div class="cm-ic ${cloud ? "cloud" : ""}">${ic(kind === "image" ? "image" : "video")}</div>
      <div class="cm-t"><small>${label}</small>${m ? `<b>${esc(m.name)}</b><span>${esc(m.prov)}${m.installed === false ? ` · <em class="warnt">not installed</em>` : ""}</span><span>${!cloud ? (kind === "image" ? "Free · on your GPU" : "Free · 5 s clips, up to 3 chained (15 s)") : kind === "image" ? `<i>$${m.price.toFixed(3)}</i>/picture` : `<i>$${m.per_sec.toFixed(3)}</i>/second · clips of ${m.secs.join(", ")} s`}</span>` : `<b class="warn">Pick a model</b><span>${cloud ? "Connect a key on the Pro page" : "Install one in Setup Center"}</span>`}</div>
      <span class="cm-chg">Change ${ic("chevrons", "sm")}</span></button>`;
  const row = (t, n, usd) => `<div class="bc-row"><span>${t}</span><b>${n}</b><i>${cloud ? "$" + usd.toFixed(2) : "free"}</i></div>`;
  return `<div class="bd-grid">
      ${box("image", mi, "Default picture model")}
      ${box("video", mv, `Default video model · ${nVid} video scene${nVid === 1 ? "" : "s"}`)}
      <div class="bd-cost"><div class="bc-h"><b>${ic(cloud ? "coins" : "cpu", "sm")} ${cloud ? "Cost of what is left" : "Left to make"}</b><span class="bc-total">${cloud ? "$" + c.total.toFixed(2) : "Free"}</span></div>
        ${c.imgs.map(g => row(`${esc(g.m.name)}${cloud ? ` · $${g.m.price.toFixed(3)} each` : ""}`, `${g.n} picture${g.n === 1 ? "" : "s"}`, g.n * (g.m.price || 0))).join("")}
        ${c.vids.map(g => row(`${esc(g.m.name)}${cloud ? ` · $${g.m.per_sec.toFixed(3)}/s` : ""}`, `${g.n} clip${g.n === 1 ? "" : "s"}, ${g.sec} s`, g.sec * (g.m.per_sec || 0))).join("")}
        ${!c.ni && !c.nv ? `<div class="hint">Nothing left to make.${cloud ? " Regenerating a scene costs its model's price." : ""}</div>` : ""}
        <small>${cloud ? "Paid to your own account. Already made pictures and clips cost nothing again." : "Runs on your GPU. Clip lengths always cover the narration of the scene."}</small></div>
    </div>`;
}
function sceneModelBtn(s) {
  if (!(CUR.cloud_mode ? BM : LM)) return `<span id="smb_${s.id}" hidden></span>`;
  const vid = s.media === "video", m = vid ? vidOf(s) : imgOf(s), pc = isPc(s);
  const own = vid ? !!(pc ? s.vid_local : s.vid_model) || !!s.vid_secs : !!(pc ? s.img_local : s.img_model);
  return `<button class="btn sm smodel ${own ? "own" : ""}" id="smb_${s.id}" onclick="bdPicker('${vid ? "video" : "image"}','${s.id}')" title="${vid ? "Video" : "Picture"} model for this scene">${ic(pc ? "monitor" : "cloud", "sm")}
    <span>${m ? esc(m.name) : "Pick model"}${vid && m ? ` · ${clipSecs(m, s)} s` : ""}</span>${ic("chevrons", "sm")}</button>`;
}
/* cloud build: one scene can still be made free on this PC (FLUX / Wan) */
function scenePcBtn(s) {
  if (!CUR.cloud_mode) return `<span id="pcb_${s.id}" hidden></span>`;
  return `<button class="btn sm pcbtn ${s.on_pc ? "on" : ""}" id="pcb_${s.id}" onclick="togglePc('${s.id}')" title="${s.on_pc ? "Made free on your PC. Click to make it in the cloud again." : "Make only this scene on your PC, free (FLUX / Wan)"}">${ic("monitor", "sm")} ${s.on_pc ? `On my PC ${ic("check", "sm")}` : "On my PC"}</button>`;
}
async function togglePc(sid) {
  const s = CUR.scenes.find(x => x.id === sid); if (!s) return;
  if (!LM) await bdLoad();
  try { CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: [{id: sid, on_pc: !s.on_pc}]}}); bdRepaint();
    const n = CUR.scenes.find(x => x.id === sid);
    toast(n.on_pc ? `${sid} is made on your PC, free (${esc((n.media === "video" ? vidOf(n) : imgOf(n)) ? (n.media === "video" ? vidOf(n) : imgOf(n)).name : "FLUX")}).` : `${sid} is made in the cloud again.`); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
/* model picker: a video scene shows video models (with the clip length), a picture scene picture models */
const BDP = {kind: "image", sid: null, q: ""};
function bdPicker(kind, sid) {
  if (!BM || !LM) { bdLoad().then(() => bdPicker(kind, sid)); return; }
  BDP.kind = kind; BDP.sid = sid || null; BDP.q = "";
  const s = sid && CUR.scenes.find(x => x.id === sid), V = kind === "video";
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>${s ? `${V ? "Video" : "Picture"} model for ${s.id}` : `Default ${V ? "video" : "picture"} model`}</h2><div class="hint">${s ? esc((s.text || "").slice(0, 110)) : "Used by every scene that has no model of its own."}</div></div><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <div id="bdpSecs"></div>
    ${CUR.cloud_mode ? `<input class="ck-q" id="bdpQ" placeholder="Search models…" oninput="BDP.q=this.value;bdpPaint()">` : ""}
    <div class="cvp-list cmp-list" id="bdpList"></div>`;
  $("#pickModal").classList.add("show"); bdpPaint();
}
function bdpSecs(s, m) {
  if (!s || BDP.kind !== "video" || !m) return "";
  const need = sceneNeed(s), a = m.secs || [5], fit = a.filter(x => x >= need), cur = clipSecs(m, s), auto = !s.vid_secs || !a.includes(s.vid_secs);
  const ok = x => x >= need || (!fit.length && x === a[a.length - 1]);
  return `<div class="secs"><div class="secs-h"><b>${ic("video", "sm")} Clip length</b><span class="hint">This line is about ${need.toFixed(1)} s. Shorter clips are off so the narration is never cut.</span></div>
    <div class="cvp-tabs" style="margin-top:6px"><button class="${auto ? "on" : ""}" onclick="bdpSecsSet(0)">Auto · ${autoSecs(m, need)} s</button>${a.map(x => `<button class="${!auto && x === cur ? "on" : ""}" ${ok(x) ? "" : "disabled title=\"Too short for this line\""} onclick="bdpSecsSet(${x})">${x} s</button>`).join("")}</div>
    ${!fit.length ? `<div class="hint" style="margin-top:6px">The longest clip of this model is ${a[a.length - 1]} s. The picture holds still for the last ${(need - a[a.length - 1]).toFixed(1)} s of the line.</div>` : ""}</div>`;
}
async function bdpSecsSet(x) {
  try { CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: [{id: BDP.sid, vid_secs: x}]}}); bdpPaint(); bdRepaint(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function bdpPaint() {
  const s = BDP.sid && CUR.scenes.find(x => x.id === BDP.sid), K = BDP.kind, q = BDP.q.toLowerCase(), cloud = !isPc(s);
  const curM = K === "image" ? imgOf(s) : vidOf(s), cur = curM && curM.id;
  const own = s ? (K === "image" ? (cloud ? s.img_model : s.img_local) : (cloud ? s.vid_model : s.vid_local)) : "";
  $("#bdpSecs").innerHTML = bdpSecs(s, curM);
  const price = m => K === "image" ? (cloud ? `<b>$${m.price.toFixed(3)}</b><small>/picture</small>` : `<b>Free</b> <small>on your GPU</small>`)
    : cloud ? `<b>$${m.per_sec.toFixed(3)}</b><small>/second</small><i>${s ? `this scene ~$${(clipSecs(m, s) * m.per_sec).toFixed(2)} (${clipSecs(m, s)} s)` : `clips ${m.secs.join(", ")} s`}</i>` : `<b>Free</b> <small>on your GPU</small><i>5, 10 or 15 s (clips chained)</i>`;
  const row = (m, p) => { const off = m.installed === false; return `<div class="ck-row ${m.id === cur ? "on" : ""} ${off ? "off" : ""}" onclick="${off ? "closeModal('pickModal');go('setup')" : `bdpUse('${esc(m.id)}')`}"><div class="ck-rt"><b>${esc(m.name)}</b><span>${esc(m.note || "")}</span></div>
      ${p && m.id === p.best ? `<span class="ck-tag best">Best</span>` : p && m.id === p.budget ? `<span class="ck-tag">Budget</span>` : off ? `<span class="ck-tag">Not installed</span>` : "<span></span>"}
      <div class="ck-price">${price(m)}</div><span class="vrow-use">${off ? "Setup Center" : m.id === cur ? `${ic("check", "sm")} Selected` : "Use"}</span></div>`; };
  let body;
  if (!cloud) body = `<div class="cmp-sec"><div class="cmp-h"><span class="cmp-name">${ic("monitor", "sm")} On my PC</span><small>free · ${K === "image" ? "FLUX" : "Wan"} models</small></div>${((LM && LM[K]) || []).map(m => row(m, null)).join("")}</div>`;
  else {
    const provs = (BM[K] && BM[K].providers) || [], on = provs.filter(p => p.connected), off = provs.filter(p => !p.connected);
    const sec = p => { const list = p.models.filter(m => !q || (m.name + " " + m.id + " " + (m.note || "")).toLowerCase().includes(q)); if (!list.length) return "";
      return `<div class="cmp-sec"><div class="cmp-h"><span class="cmp-name">${ic("check", "sm")} ${esc(p.label)}</span><small>connected · ${p.models.length} models</small></div>${list.map(m => row(m, p)).join("")}</div>`; };
    body = (on.map(sec).join("") || `<div class="hint" style="padding:14px">${on.length ? "No model matches." : "No key connected for this yet."}</div>`)
      + (off.length ? `<div class="cmp-off">${off.map(p => `<button class="btn sm ghost" onclick="closeModal('pickModal');showPro()">${ic("plus", "sm")} Connect ${esc(p.label)}</button>`).join("")}</div>` : "");
  }
  $("#bdpList").innerHTML = (s && own ? `<div class="infoline" style="margin:0">${ic("info", "sm")} This scene has its own model. <a href="#" onclick="bdpUse('');return false">Use the default again</a></div>` : "") + body;
}
async function bdpUse(id) {
  const K = BDP.kind, sid = BDP.sid, cloud = !isPc(sid && CUR.scenes.find(x => x.id === sid));
  const field = K === "image" ? (cloud ? "img_model" : "img_local") : (cloud ? "vid_model" : "vid_local");
  const bfield = K === "image" ? (cloud ? "image_model" : "image_local") : (cloud ? "video_model" : "video_local");
  try {
    if (sid) CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: [{id: sid, [field]: id}]}});
    else CUR = await api(`/api/projects/${CUR.id}/board`, {method: "POST", body: {[bfield]: id}});
    if (sid) bdpPaint(); else closeModal("pickModal");
    bdRepaint();
    const s = sid && CUR.scenes.find(x => x.id === sid), m = K === "image" ? imgOf(s) : vidOf(s);
    toast(`${sid || "Default"} ${K === "image" ? "picture" : "video"} model: ${esc(m ? m.name : "default")}`);
  } catch (e) { toast("Error: " + esc(e.message)); }
}
function sceneKey(s) { return `${s.image_v || 0}:${s.clip}:${s.video_v || 0}:${s.has_video}`; }
async function setMedia(id, media) {
  if (Object.keys(dirty).length) await saveScenes(true);
  try {
    CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: [{id, media}]}}); renderScenes();
    if (media === "video") toast("Video scene. Motion prompt written from the image prompt, edit it if you like.");
  } catch (e) { toast("Error: " + esc(e.message)); }
}
async function autoMotion(id) {
  if (Object.keys(dirty).length) await saveScenes(true);
  try { CUR = await api(`/api/projects/${CUR.id}/motion/${id}`, {method: "POST"}); renderScenes(); toast("Motion rewritten"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function setHook() {
  if (Object.keys(dirty).length) await saveScenes(true);
  const minutes = parseFloat($("#hk_min").value) || 3, split = $("#hk_split").checked ? (parseFloat($("#hk_sec").value) || 8) : 0;
  try {
    CUR = await api(`/api/projects/${CUR.id}/hook`, {method: "POST", body: {minutes, split_seconds: split}});
    const r = CUR.hook_result || {};
    renderProject(); toast(`${r.marked || 0} scene(s) tagged as video${r.added ? `, ${r.added} new shots added` : ""}. Motion prompts written automatically.`, 7000);
  } catch (e) { toast("Error: " + esc(e.message)); }
}
async function clearHook() {
  if (!await confirmBox("All scenes back to image?", "Every scene becomes a still image again. Generated videos stay on disk.", "Yes")) return;
  try { CUR = await api(`/api/projects/${CUR.id}/hook`, {method: "POST", body: {clear: true}}); renderProject(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function regenVideo(id) {
  if (Object.keys(dirty).length) await saveScenes(true);
  try { await api(`/api/projects/${CUR.id}/run/regen_video`, {method: "POST", body: {scene_ids: [id]}}); toast(`Making a new video for ${id}…`); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function editNarr(id, el) {
  if (el.querySelector("textarea")) return;
  const s = CUR.scenes.find(x => x.id === id);
  el.classList.add("open");
  el.innerHTML = `<textarea rows="6" oninput="markDirty('${id}','text',this.value)">${esc(s.text)}</textarea><div class="hint">Changing narration re-records this scene's voice.</div>`;
  el.querySelector("textarea").focus();
}
function markDirty(id, field, val) {
  dirty[id] = {...(dirty[id] || {id}), [field]: val};
  $("#sc_" + id).classList.add("dirty");
  $("#savebar").classList.add("show"); $("#dirtyCount").textContent = `${Object.keys(dirty).length} scene(s) changed`;
}
function discard() { dirty = {}; renderScenes(); }
async function saveScenes(quiet) {
  try { CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: Object.values(dirty)}}); dirty = {}; if (TAB === "scenes") renderScenes(); if (quiet !== true) toast("Saved"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function regen(id) {
  if (Object.keys(dirty).length) await saveScenes(true);
  try { await api(`/api/projects/${CUR.id}/run/regen`, {method: "POST", body: {scene_ids: [id]}}); toast(`Regenerating ${id}…`); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function uploadClip(id, input) {
  const f = input.files[0]; if (!f) return;
  const fd = new FormData(); fd.append("file", f);
  toast("Uploading clip…");
  try { await api(`/api/projects/${CUR.id}/scenes/${id}/clip`, {method: "POST", body: fd}); await openProject(CUR.id, true); toast("Clip added"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function removeClip(id) { await api(`/api/projects/${CUR.id}/scenes/${id}/clip`, {method: "DELETE"}); openProject(CUR.id, true); }
async function setThumb(i) { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {thumbnail_scene: i}}); renderScenes(); toast("Thumbnail image set. Run Export to rebuild it."); }

/* ---------------- reference slots ---------------- */
function autoTags(s) {
  const tags = s.auto_tags || [];
  if (s.refs != null || !tags.length) return [0, 1].map(n => refSlot(s, n)).join("") + (s.refs != null ? `<button class="atag reset" onclick="autoRefs('${s.id}')" title="Let LECCORTUBE pick the characters and place again">${ic("refresh", "sm")} Auto</button>` : "");
  const sub = t => t.kind === "place" ? `${t.view === "outdoor" ? "outdoor" : t.view + " view"}${t.how === "build" ? " · sheet on Build" : t.how.startsWith("same as") ? " · " + t.how : ""}`
    : t.how === "picture" ? "sheet" : t.how === "words" ? "in words" : "sheet on Build";
  return tags.map(t => `<div class="atag ${t.kind} ${t.how === "build" ? "wait" : ""}" title="Found automatically. ${t.kind === "place" ? "Change the place below." : "Click to choose by hand."}" ${t.kind === "cast" ? `onclick="pickRef('${s.id}',0)"` : ""}>
      ${t.url ? `<img src="${t.url}">` : `<span class="ph">${ic(t.kind === "place" ? "pin" : "user", "sm")}</span>`}
      <span><b>${esc(t.label)}</b><small>${esc(sub(t))}</small></span></div>`).join("");
}
async function autoRefs(sid) {
  try { CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: [{id: sid, refs: null}]}}); renderScenes(); toast("Back to automatic: characters and place are found from the prompt"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function refSlot(s, n) {
  const r = s.refs_resolved[n];
  if (!r && n > 0 && !s.refs_resolved[0]) return "";
  const inner = r ? (r.url ? `<img src="${r.url}">` : `<span class="ph">${ic("alert", "sm")}</span>`) + `<span><b>image ${n + 1}</b> · ${esc(r.label)}${r.auto ? " <span class='muted'>(auto)</span>" : ""}</span>`
                  : `<span class="ph">${ic("plus", "sm")}</span><span>${n ? "2nd reference" : "Reference: character or place"}</span>`;
  return `<div class="slot ${r ? "set" : ""}" onclick="pickRef('${s.id}',${n})">${inner}</div>`;
}
function refOptions(sceneId) {
  const cast = (CUR.cast || []).map(c => ({key: `cast:${c.id}`, label: c.name, sub: "character", url: c.file ? `/files/${CUR.id}/character/${c.file}?v=${c.v || 0}` : null}));
  const scenes = CUR.scenes.filter(x => x.id !== sceneId && x.image).map(x => ({key: `scene:${x.id}`, label: x.id, sub: x.text.slice(0, 38) + "…", url: `/files/${CUR.id}/${x.image}?v=${x.image_v || 0}`}));
  return [{title: "Cast (same face everywhere)", items: cast, empty: "No characters yet. Add them in Voice, look & cast > Cast."},
          {title: "Scene images (same place and look)", items: scenes, empty: "No other scene images yet."}];
}
function pickRef(sid, n) {
  const s = CUR.scenes.find(x => x.id === sid);
  const cur = s.refs_resolved.map(r => r.key);
  openPicker(`${sid} · reference ${n + 1}`, refOptions(sid), cur[n] || null, async key => {
    let refs = cur.slice();
    if (key === null) refs.splice(n, 1); else { refs[n] = key; refs = refs.filter(Boolean); }
    refs = [...new Set(refs)].slice(0, 2);
    const applyAll = $("#pickAll") && $("#pickAll").checked;
    const edits = [{id: sid, refs}];
    if (applyAll && key) {
      const cid = key.startsWith("cast:") ? (CUR.cast.find(c => "cast:" + c.id === key) || {}).name : null;
      for (const x of CUR.scenes) {
        if (x.id === sid || x.id === key.replace("scene:", "")) continue;
        const mentions = x.prompt.toLowerCase().includes(`image ${n + 1}`) || (cid && new RegExp("\\b" + cid.split(" ")[0] + "\\b", "i").test(x.prompt + " " + x.text));
        if (mentions) { const rr = x.refs_resolved.map(r => r.key); rr[n] = key; edits.push({id: x.id, refs: [...new Set(rr.filter(Boolean))].slice(0, 2)}); }
      }
    }
    if (Object.keys(dirty).length) await saveScenes(true);
    CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: edits}});
    renderScenes();
    toast(edits.length > 1 ? `Reference set on ${edits.length} scenes. Regenerate them to apply.` : `Reference set, prompt wording added automatically. Click ↻ Image on ${sid} to apply.`, 5500);
  }, true, n);
}
function openPicker(title, sections, currentKey, onPick, allowNone, n) {
  const body = $("#pickBody");
  body.innerHTML = `<div class="mhead"><h2>${esc(title)}</h2>
      <div class="actions">${allowNone ? `<button class="btn sm" data-key="__none">${ic("x", "sm")} No reference</button>` : ""}
      <button class="btn sm" onclick="closeModal('pickModal')">Close</button></div></div>
    ${n !== undefined ? `<label class="chk"><input type="checkbox" id="pickAll"> Also use it on every scene that mentions this character (or "image ${n + 1}")</label>` : ""}
    ${sections.map(sec => `<div class="pick-sec">${esc(sec.title)}</div>` + (sec.items.length ? `<div class="pick-grid">${sec.items.map(it => `
      <div class="pick ${it.key === currentKey ? "cur" : ""}" data-key="${esc(it.key)}">
        ${it.url ? `<img src="${it.url}" loading="lazy">` : `<div style="aspect-ratio:16/10;display:grid;place-items:center;color:var(--muted)">no image yet</div>`}
        <div class="cap"><b>${esc(it.label)}</b><span class="muted" style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(it.sub || "")}</span></div></div>`).join("")}</div>`
      : `<div class="hint" style="margin-top:6px">${esc(sec.empty || "Nothing here")}</div>`)).join("")}`;
  body.querySelectorAll("[data-key]").forEach(el => el.addEventListener("click", async () => {
    const k = el.dataset.key === "__none" ? null : el.dataset.key;
    try { await onPick(k); } catch (e) { toast("Error: " + esc(e.message)); }
    closeModal("pickModal");
  }));
  $("#pickModal").classList.add("show");
}

/* ---------------- output ---------------- */
let KIT = null, DUBL = null, SEL_LANGS = new Set();
function renderOutput() {
  const o = CUR.outputs || {}, F = f => `/files/${CUR.id}/${f}`;
  const prevCard = o.preview ? `<div class="card"><div class="sec-t"><span class="n">${ic("eye")}</span><div><h3>Preview (first scenes)</h3><small>Happy with it? Click Build everything. Not happy? Change voice, look or captions and make the preview again.</small></div></div>
      <video class="main${CUR.preset === "short" ? " tall" : ""}" controls preload="metadata" src="${F(o.preview)}?v=${o.preview_v || 0}"></video></div>` : "";
  if (!o.video && !o.thumbnail && o.preview) { $("#tabBody").innerHTML = prevCard; return; }
  if (!o.video && !o.thumbnail) { $("#tabBody").innerHTML = `<div class="card empty"><div class="big">${ic("film", "lg")}</div>Nothing rendered yet.<br>Click <b>Build everything</b> or run steps 1 to 4.</div>`; return; }
  const thumbs = (o.thumbnails && o.thumbnails.length ? o.thumbnails : (o.thumbnail ? [o.thumbnail] : []));
  const shorts = o.shorts || [], dubs = Object.values(o.dubs || {});
  const Q = t => JSON.stringify(t || "").replace(/"/g, "&quot;");
  $("#tabBody").innerHTML = `${prevCard}
    <div class="card"><div class="sec-t"><span class="n">${ic("film")}</span><div><h3>Video</h3><small>${CUR.preset === "short" ? "9:16 vertical · upload as a YouTube Short" : "16:9 · ready for YouTube"}</small></div></div>
      ${o.video ? `<video class="main${CUR.preset === "short" ? " tall" : ""}" controls preload="metadata" src="${F(o.video)}?v=${o.video_v || 0}"></video>` : `<div class="empty">Video not rendered yet</div>`}
      <div class="actions" style="margin-top:12px"><button class="btn" onclick="openFolder()">${ic("folder", "sm")} Open output folder</button>
      ${o.video ? `<a href="${F(o.video)}" download="${esc(CUR.title)}.mp4" class="btn primary">${ic("download", "sm")} Download video</a>` : ""}
      ${o.subtitles ? `<a href="${F(o.subtitles)}" download class="btn">${ic("file", "sm")} Subtitles (.srt)</a>` : ""}
      ${o.video ? `<button class="btn" onclick="needPro('Publishing') || publishModal()">${ic("upload", "sm")} Publish ${PTAG}</button>` : ""}
      ${o.video ? (o.video_4k ? `<a href="${F(o.video_4k)}" download class="btn">${ic("hd", "sm")} 4K master</a>` : `<button class="btn" onclick="needPro('4K export') || run('export4k', true)">${ic("hd", "sm")} 4K master ${PTAG}</button>`) : ""}</div>
      ${(o.published || []).slice(-3).map(x => `<div class="hint" style="margin-top:6px">${x.when ? "Scheduled" : "Published"} to ${esc(x.platforms.join(", "))} · ${new Date(x.time * 1000).toLocaleString()}</div>`).join("")}
      ${o.export_dir ? `<div class="hint" style="margin-top:10px">Also saved to <span class="path">${esc(o.export_dir)}</span></div>` :
        `<div class="hint" style="margin-top:10px">Tip: choose an output folder in <a onclick="openSettings()">Settings</a> and finished files are copied there automatically.</div>`}</div>
    <div class="card"><div class="sec-t"><span class="n">${ic("sparkles")}</span><div><h3>Titles</h3><small>3 styles. Use one, or test them in YouTube Studio</small></div><div class="grow"></div>
      <button class="btn sm" onclick="newTitles(this)">${ic("refresh", "sm")} New ideas</button></div>
      <div id="titlesBox"><div class="hint">Loading…</div></div></div>
    <div class="card"><div class="sec-t"><span class="n">${ic("image")}</span><div><h3>Thumbnails</h3><small>Upload A, then add B and C in Studio > Test & Compare</small></div></div>
      ${thumbs.length ? `<div class="thumbs3">${thumbs.map((t, i) => { const lb = /cover/.test(t) ? "Shorts cover 9:16" : "Thumbnail " + ((t.match(/_([ABC])\./) || [0, "ABC"[i]])[1]); return `<figure class="${/cover/.test(t) ? "tall" : ""}"><img src="${F(t)}?v=${o.thumb_v || 0}" onclick="viewImage(this.src,'${lb}')"><figcaption>${lb}<a class="btn sm" href="${F(t)}" download>${ic("download", "sm")} Download</a></figcaption></figure>`; }).join("")}</div>` : `<div class="empty">Run 5 · Export</div>`}
      ${(o.warnings || []).map(w => `<div class="warn">${esc(w)}</div>`).join("")}</div>
    <div class="card"><div class="sec-t"><span class="n">${ic("file")}</span><div><h3>Description and tags</h3><small>Paste these in YouTube Studio</small></div></div>
      <div id="metaBox"><div class="hint">Run 5 · Export to write the description and tags.</div></div></div>
    ${CUR.season ? `<div class="card"><div class="sec-t"><span class="n">${ic("tv")}</span><div><h3>Episode trailer</h3><small>30 seconds of the best moments with music, the season title and a "watch now" card. 16:9 for YouTube, 9:16 for Shorts, Reels and TikTok. The ending is never shown.</small></div><div class="grow"></div>
      <button class="btn primary sm" onclick="run('trailer', true)">${ic("sparkles", "sm")} ${o.trailer ? "Make again" : "Make trailer"}</button></div>
      ${o.trailer ? `<div class="trailers">${Object.entries(o.trailer).map(([k, f]) => `<figure class="${k.includes("vertical") ? "tall" : ""}"><video controls preload="metadata" src="${F(f)}?v=${o.trailer_v || 0}"></video><figcaption>${k.includes("vertical") ? "9:16" : "16:9"} · <a href="${F(f)}" download>Download</a></figcaption></figure>`).join("")}</div>` : ""}</div>` : ""}
    <div class="card"><div class="sec-t"><span class="n">${ic("video")}</span><div><h3>Shorts (9:16)</h3><small>Best moments as vertical Shorts with captions, hook, music, a cover image, title and description</small></div><div class="grow"></div>
      <select id="shortCount" style="width:auto;padding:7px 10px">${[3, 5, 7, 10].map(n => `<option ${n === 5 ? "selected" : ""}>${n}</option>`).join("")}</select>
      <button class="btn primary sm" onclick="makeShorts()">${ic("sparkles", "sm")} ${shorts.length ? "Make again" : "Make Shorts"}</button></div>
      ${shorts.length ? `<div class="shorts">${shorts.map((sh, i) => `<div class="sh">
          <div class="shm"><figure><video controls preload="metadata" ${sh.cover ? `poster="${F(sh.cover)}?v=${o.shorts_v || 0}"` : ""} src="${F(sh.file)}?v=${o.shorts_v || 0}"></video><figcaption>Short</figcaption></figure>
          ${sh.cover ? `<figure><img src="${F(sh.cover)}?v=${o.shorts_v || 0}" onclick="viewImage(this.src,'Cover ${i + 1}')"><figcaption>Cover</figcaption></figure>` : ""}</div>
          <div class="shn">Short ${i + 1}</div>
          <b>${esc(sh.title)}</b>
          <p>${esc(sh.description || sh.hashtags || "")}</p>
          <div class="actions"><button class="btn sm" onclick="copyText(${Q(sh.title)})">Copy title</button><button class="btn sm" onclick="copyText(${Q(sh.description || sh.hashtags)})">Copy description</button>
            <a class="btn sm" href="${F(sh.file)}" download>${ic("download", "sm")} Video</a>${sh.cover ? `<a class="btn sm" href="${F(sh.cover)}" download>${ic("download", "sm")} Cover</a>` : ""}</div></div>`).join("")}</div>
        <div class="hint" style="margin-top:8px">Post one Short a day. In the YouTube app pick the cover as the thumbnail and set "Related video" to this video.</div>` : `<div class="hint">Needs the narration (step 1). Takes about 1 minute per Short.</div>`}</div>
    <div class="card"><div class="sec-t"><span class="n">${ic("mic")}</span><div><h3>Dub into other languages</h3><small>Same voice, translated with your local AI. One video, more countries</small></div></div>
      <div id="dubBox"><div class="hint">Loading…</div></div>
      ${dubs.length ? `<div class="dubs">${dubs.map(d => `<div class="dub"><b>${esc(d.name)}</b>
          <audio controls preload="none" src="${F(d.audio)}?v=${o.dub_v || 0}"></audio>
          <div class="actions"><a class="btn sm" href="${F(d.audio)}" download>Audio track</a><a class="btn sm" href="${F(d.video)}" download>Video</a><a class="btn sm" href="${F(d.srt)}" download>Subtitles</a><a class="btn sm" href="${F(d.meta)}" download>Title + how to</a></div></div>`).join("")}</div>` : ""}</div>
    <div class="card"><div class="sec-t"><span class="n">${ic("check")}</span><div><h3>Upload checklist</h3><small>Keeps the channel safe for monetisation</small></div></div><div id="checkBox"></div></div>`;
  loadKit();
  loadDubLangs();
}
function paintMeta(m) {
  const box = $("#metaBox"); if (!box || !m) return;
  const tags = m.tags || [], tagStr = tags.join(", ");
  box.innerHTML = `<div class="grp" style="margin-top:0">Description <button class="btn sm" style="margin-left:8px" onclick="copyText(${JSON.stringify(m.description).replace(/"/g, "&quot;")})">Copy</button></div>
    <pre class="meta desc">${esc(m.description)}</pre>
    <div class="grp">Tags <span class="hint">${tagStr.length}/500 characters</span> <button class="btn sm" style="margin-left:8px" onclick="copyText(${JSON.stringify(tagStr).replace(/"/g, "&quot;")})">Copy tags</button></div>
    <div class="tagchips">${tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>
    ${CUR.outputs.metadata ? `<details style="margin-top:12px"><summary class="hint" style="cursor:pointer">Full YouTube text file (title, description, chapters, tags, checklist)</summary><div class="actions" style="margin:10px 0 6px"><a class="btn sm" href="/files/${CUR.id}/${CUR.outputs.metadata}" download>${ic("download", "sm")} youtube_metadata.txt</a></div></details>` : ""}`;
}
async function loadKit() {
  try { KIT = await api(`/api/projects/${CUR.id}/kit`); } catch (e) { KIT = {}; }
  const pack = KIT.pack;
  if (KIT.meta) paintMeta(KIT.meta);
  if ($("#titlesBox")) $("#titlesBox").innerHTML = pack ? `<div class="titles3">${pack.titles.map(t => `<div class="tt"><span class="chip">${esc(t.style)}</span><b>${esc(t.title)}</b><span class="hint">${t.title.length} chars</span>
      <button class="btn sm" onclick="copyText(${JSON.stringify(t.title).replace(/"/g, "&quot;")})">Copy</button><button class="btn sm" onclick="useTitle(${JSON.stringify(t.title).replace(/"/g, "&quot;")})">Use</button></div>`).join("")}</div>
      ${pack.description_hook ? `<div class="hint" style="margin-top:8px"><b>Description opening:</b> ${esc(pack.description_hook)}</div>` : ""}
      ${pack.ai ? "" : `<div class="hint" style="margin-top:6px">Install "Smart Director (Ollama)" in Setup Center for smarter AI titles.</div>`}`
    : `<div class="hint">Run 5 · Export, or click New ideas.</div>`;
  if ($("#checkBox")) $("#checkBox").innerHTML = (KIT.checklist || []).map(c => `<div class="chk-i ${c.ok ? "ok" : "todo"}"><span>${ic(c.ok ? "check" : "alert", "sm")}</span><div><b>${esc(c.title)}</b><div>${esc(c.text)}</div></div></div>`).join("");
}
async function newTitles(btn) {
  btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Thinking…`;
  try { await api(`/api/projects/${CUR.id}/titles`, {method: "POST"}); await loadKit(); } catch (e) { toast(esc(e.message)); }
  btn.disabled = false; btn.innerHTML = `${ic("refresh", "sm")} New ideas`;
}
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast("Copied")); }
async function useTitle(t) { await patch({title: t}, "Title updated. Run 5 · Export to refresh the YouTube text."); }
async function makeShorts() {
  try { await api(`/api/projects/${CUR.id}/run/shorts`, {method: "POST", body: {count: parseInt($("#shortCount").value)}}); toast("Making Shorts…"); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function loadDubLangs() {
  if (!DUBL) { try { DUBL = await api("/api/dub/langs"); } catch (e) { DUBL = {langs: []}; } }
  const box = $("#dubBox"); if (!box) return;
  const warn = !DUBL.voice_ready ? `Needs <b>Natural voices</b> from Setup Center.` : !DUBL.ai_ready ? `Needs <b>Smart Director (Ollama)</b> from Setup Center for translation.` : "";
  box.innerHTML = `<div class="chips">${DUBL.langs.map(l => `<button class="${SEL_LANGS.has(l.id) ? "on" : ""}" onclick="toggleLang('${l.id}')">${esc(l.name)}</button>`).join("")}</div>
    <div class="actions" style="margin-top:12px"><button class="btn primary sm" onclick="makeDub()" ${warn ? "disabled" : ""}>${ic("mic", "sm")} Dub ${SEL_LANGS.size || ""} language${SEL_LANGS.size === 1 ? "" : "s"}</button>
    <span class="hint">${warn || (DUBL.model_ready ? "Urdu viewers understand the Hindi voice." : "First dub downloads the dubbing voice model once (about 3 GB, with progress). You can also get it now: Setup Center > Dubbing voices.")}</span></div>
    ${SEL_LANGS.size ? `<div class="hint" style="margin-top:6px">${SEL_LANGS.size} language${SEL_LANGS.size === 1 ? "" : "s"}: about ${Math.max(1, Math.round(SEL_LANGS.size * Math.max(2, (CUR.narrated_min || CUR.estimate_min || 5) * 1.3)))} minutes on a good GPU. All are translated first, then voiced one by one. Finished languages are kept if you stop.${SEL_LANGS.size > 5 ? " Tip: start with 3 to 5 big languages (Hindi, Spanish, Arabic, Portuguese, French)." : ""}</div>` : ""}`;
}
function toggleLang(id) { SEL_LANGS.has(id) ? SEL_LANGS.delete(id) : SEL_LANGS.add(id); loadDubLangs(); }
async function makeDub() {
  if (!SEL_LANGS.size) { toast("Pick at least one language"); return; }
  try { await api(`/api/projects/${CUR.id}/run/dub`, {method: "POST", body: {langs: [...SEL_LANGS]}}); toast("Dubbing… (a few minutes per language)"); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function copyMeta() { navigator.clipboard.writeText($("#metaText").textContent).then(() => toast("Copied")); }
async function openFolder(which) { const r = await api(`/api/projects/${CUR.id}/open-folder${which ? "?which=" + which : ""}`, {method: "POST"}); toast("Folder: " + esc(r.path), 6000); }

/* ---------------- voice, look & cast ---------------- */
/* ---------------- storyboard helpers ---------------- */
let VAR_PENDING = null;
function camLabel(k, v) { const o = (CAT.cinema.camera[k] || []).find(x => x.id === v); return o && v ? o.label : ""; }
function camLine(s) {
  const cam = {...(CUR.camera || {}), ...Object.fromEntries(Object.entries(s.camera || {}).filter(([, v]) => v))};
  const bits = ["shot", "angle", "lens", "body", "light"].map(k => camLabel(k, cam[k])).filter(Boolean);
  const mv = s.move ? (CAT.cinema.moves.find(m => m.id === s.move) || {}).label : "";
  if (!bits.length && !mv && !s.hold) return "";
  return `<div class="camline">${bits.map(b => `<span>${esc(b)}</span>`).join("")}${mv && s.media === "video" ? `<span class="m">${esc(mv)}${s.motion_level === "action" ? " · action" : ""}</span>` : ""}${s.hold ? `<span>+${s.hold}s hold</span>` : ""}</div>`;
}
async function runDirector(smart) {
  if (Object.keys(dirty).length) await saveScenes(true);
  try {
    if (smart) { await api(`/api/projects/${CUR.id}/director`, {method: "POST", body: {smart: true}}); toast("Smart Director is reading your script…"); refreshSoon(); return; }
    CUR = await api(`/api/projects/${CUR.id}/director`, {method: "POST", body: {}}); renderScenes();
    toast("Every scene has a camera, lens, light and motion now. Open Shot on any scene to change it.", 6000);
  } catch (e) { toast("Error: " + esc(e.message), 8000); }
}
async function setAutoDirector(on) {
  try {
    CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {auto_director: on}});
    if (on) CUR = await api(`/api/projects/${CUR.id}/director`, {method: "POST", body: {}});
    renderScenes(); toast(on ? "Auto Director on: every new picture gets a fitting camera" : "Auto Director off: scenes keep the camera they have");
  } catch (e) { toast("Error: " + esc(e.message)); }
}
async function replaceImage(sid, input, animate) {
  const f = input.files[0]; if (!f) return;
  const fd = new FormData(); fd.append("file", f);
  toast("Using your image…");
  try {
    CUR = await api(`/api/projects/${CUR.id}/scenes/${sid}/image?animate=${animate ? "true" : "false"}`, {method: "POST", body: fd});
    if (animate) { toast(`Animating ${sid} from your image…`); refreshSoon(); } else toast(`${sid} now uses your image`);
    if ($("#shotModal").classList.contains("show")) openShot(sid); else renderScenes();
  } catch (e) { toast("Error: " + esc(e.message)); }
}
async function toggleDrop(sid) { CUR = await api(`/api/projects/${CUR.id}/music/drop`, {method: "POST", body: {scene_id: sid}}); renderScenes(); toast((CUR.music.drops || []).includes(sid) ? "Needle drop set: music cuts here for a moment" : "Needle drop removed"); }
async function moveScene(sid, dir) {
  if (Object.keys(dirty).length) await saveScenes(true);
  try { CUR = await api(`/api/projects/${CUR.id}/scenes/${sid}/move`, {method: "POST", body: {dir}}); renderScenes(); }
  catch (e) { toast(esc(e.message)); }
}

async function deleteScene(sid) {
  const s = CUR.scenes.find(x => x.id === sid); if (!s) return;
  if (!await confirmBox(`Delete scene ${sid}?`, `<i>"${esc((s.text || "").slice(0, 160))}${(s.text || "").length > 160 ? "…" : ""}"</i><br><br>Its picture, voice and video are deleted and the narration is removed from the video. The script is not changed, so Re-split brings it back. Render again to update the final video.`, "Delete scene", true)) return;
  if (Object.keys(dirty).length) await saveScenes(true);
  try { CUR = await api(`/api/projects/${CUR.id}/scenes/${sid}`, {method: "DELETE"}); renderProject(); toast(`Scene ${sid} deleted. Run 4 · Render to update the video.`); }
  catch (e) { toast("Error: " + esc(e.message)); }
}

/* ---------------- Shot Builder ---------------- */
let SB = null;
function openShot(sid) {
  const s = CUR.scenes.find(x => x.id === sid); if (!s) return;
  SB = {sid, camera: {...(s.camera || {})}, move: s.move || "", speed: s.move_speed || "slow", level: s.motion_level || "calm",
        media: s.media || "image", picture: {...(s.picture || {})}, prompt: s.prompt, motion: s.motion || "", hold: s.hold || 0, trim: s.trim_in || 0};
  renderShot(); $("#shotModal").classList.add("show");
}
const CAM_KEYS = [["shot", "Shot"], ["angle", "Angle"], ["lens", "Lens"], ["body", "Camera"], ["light", "Light"]];
function camOpts(k, sel, click) {
  const opts = CAT.cinema.camera[k], pics = (CAT.cinema.camera_thumbs || 0) > 0;
  if (!pics) return `<div class="chips">${opts.map(o => `<button class="${sel === o.id ? "on" : ""}" title="${esc(o.words || "Let LECCORTUBE choose")}" onclick="${click(o.id)}">${esc(o.label)}</button>`).join("")}</div>`;
  return `<div class="camopts">${opts.map(o => `<button class="camopt ${sel === o.id ? "on" : ""}" title="${esc(o.words || "Let LECCORTUBE choose")}" onclick="${click(o.id)}">
      ${o.thumb ? `<img src="${o.thumb}" loading="lazy" alt="">` : `<span class="ph">${ic(o.id ? "image" : "sparkles", "sm")}</span>`}<span>${esc(o.label)}</span></button>`).join("")}</div>`;
}
function camPaintBar() {
  const sj = CAT.style_job || {}, running = ["queued", "running"].includes(sj.state);
  const have = CAT.cinema.camera_thumbs || 0, total = CAT.cinema.camera_total || 0;
  if (running) return `<span class="chip a" id="camJob"><span class="eq"><i></i><i></i><i></i><i></i></span> ${esc(sj.message || "Painting")}</span>`;
  return `<button class="btn sm" onclick="paintCamera()">${ic("palette", "sm")} ${have ? "Repaint" : "Paint"} example pictures</button>
    <span class="hint">${have ? `${have}/${total} examples.` : "Shows a small picture for every option."} Needs ComfyUI, about 4 minutes on your GPU.</span>`;
}
async function paintCamera() {
  try { await api("/api/styles/generate", {method: "POST", body: {ids: ["cam"]}}); toast("Painting camera examples…"); watchCamera(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function watchCamera() {
  await loadCatalog();
  const st = CAT.style_job.state;
  if (["queued", "running"].includes(st)) { const el = $("#camPaint"); if (el) el.innerHTML = camPaintBar(); setTimeout(watchCamera, 3000); return; }
  if (st === "error") toast("Camera examples: " + esc(CAT.style_job.message), 9000);
  if (VIEW === "project" && TAB === "look") renderLook();
  if ($("#shotModal").classList.contains("show")) renderShot();
}
function sbChips(k) { return camOpts(k, SB.camera[k] || "", id => `SB.camera['${k}']='${id}';renderShot()`); }
function renderShot() {
  const s = CUR.scenes.find(x => x.id === SB.sid), C = CAT.cinema;
  const pic = [["P", "Photographic style", "epic cinematic photography"], ["I", "Imagery / scene", "what is in the frame"], ["C", "Camera composition", "rule of thirds, subject left"],
               ["T", "Timing & lighting", "golden hour, long shadows"], ["U", "Use of film & effects", "35mm grain, haze"], ["R", "Render style", "photoreal, 8k"], ["E", "Extra details", "dust in the air"]];
  const moveOpts = C.move_groups.map(g => `<optgroup label="${esc(g)}">${C.moves.filter(m => m.group === g).map(m => `<option value="${m.id}" ${SB.move === m.id ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</optgroup>`).join("");
  $("#shotBody").innerHTML = `
    <div class="mhead"><div><h2>Shot Builder · ${esc(SB.sid)}</h2><div class="hint" style="margin-top:4px">${esc((s.text || "").slice(0, 160))}${(s.text || "").length > 160 ? "…" : ""}</div></div>
      <button class="btn icon" onclick="closeModal('shotModal')">${ic("x")}</button></div>
    <div class="sb" style="margin-top:12px">
      <div>
        <div class="prev">${s.media === "video" && s.has_video ? `<video controls muted loop src="/files/${CUR.id}/${s.video}?v=${s.video_v || 0}"></video>` : s.image ? `<img src="/files/${CUR.id}/${s.image}?v=${s.image_v || 0}">` : "no image yet"}</div>
        <div class="actions" style="margin-top:10px">
          <button class="btn sm" onclick="sbSave(true)">${ic("refresh", "sm")} Save &amp; new image</button>
          <button class="btn sm" onclick="sbVariations()">${ic("layers", "sm")} 4 options</button>
          <label class="upl"><input type="file" accept="image/*" onchange="replaceImage('${s.id}',this,false)"><span class="btn sm">${ic("upload", "sm")} From my PC</span></label>
          <label class="upl"><input type="file" accept="image/*" onchange="replaceImage('${s.id}',this,true)"><span class="btn sm">${ic("video", "sm")} My image + animate</span></label>
          ${s.image ? `<button class="btn sm" onclick="toCharacter('${s.id}',null)">${ic("user", "sm")} Character sheet from this image</button>` : ""}
        </div>
        ${(s.variants || []).length ? `<div class="grp">4 options</div><div class="vars">${s.variants.map(v => `<div class="var"><img src="/files/${CUR.id}/${v}" onclick="useVariant('${v}')" title="Use this image">
            <div class="va"><button class="btn sm" onclick="useVariant('${v}')">${ic("check", "sm")} Use</button><button class="btn sm" onclick="toCharacter('${s.id}','${v}')" title="Make a character sheet from this image">${ic("user", "sm")} Character</button></div></div>`).join("")}</div>` : ""}
        <div class="grp">Prompt sent to the image model</div>
        <textarea id="sb_prompt" rows="4" oninput="SB.prompt=this.value">${esc(SB.prompt)}</textarea>
        <div class="sent" style="margin-top:8px">${esc(s.effective_prompt || "")}</div>
        <div class="grp">PICTURE formula <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:600">(optional, fills the prompt)</span></div>
        ${pic.map(([k, l, ph]) => `<div class="pic"><b title="${l}">${k}</b><input placeholder="${l}: ${ph}" value="${esc(SB.picture[k] || "")}" oninput="SB.picture['${k}']=this.value"></div>`).join("")}
        <div class="actions" style="margin-top:8px"><button class="btn sm" onclick="sbCompose()">${ic("wand", "sm")} Write into prompt</button></div>
      </div>
      <div>
        <div class="grp" style="margin-top:0">Shot presets</div>
        <div class="chips">${C.presets.map(pr => `<button onclick="sbPreset('${pr.id}')">${esc(pr.name)}</button>`).join("")}</div>
        ${CAM_KEYS.map(([k, l]) => `<div class="camrow"><b>${l}</b>${sbChips(k)}</div>`).join("")}
        <div class="grp">Motion</div>
        <div class="actions"><span class="seg"><button class="${SB.media !== "video" ? "on" : ""}" onclick="SB.media='image';renderShot()">${ic("image", "sm")} Still image</button><button class="${SB.media === "video" ? "on" : ""}" onclick="SB.media='video';renderShot()">${ic("video", "sm")} Video (animate)</button></span></div>
        ${SB.media === "video" ? `
        <div class="row" style="margin-top:10px">
          <div><label style="margin-top:0">Camera move (46)</label><select onchange="SB.move=this.value"><option value="">Auto from the prompt</option>${moveOpts}</select></div>
          <div style="max-width:150px"><label style="margin-top:0">Speed</label><select onchange="SB.speed=this.value">${C.speeds.map(x => `<option ${SB.speed === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        </div>
        <label>Motion level (picks the video model)</label>
        <div class="chips">${Object.entries(C.motion_levels).map(([k, l]) => `<button class="${SB.level === k ? "on" : ""}" onclick="SB.level='${k}';renderShot()">${esc(l)}</button>`).join("")}</div>
        <label>What moves in the scene</label><textarea rows="2" oninput="SB.motion=this.value" placeholder="the boy runs, his hair blows in the wind">${esc(SB.motion)}</textarea>
        <label>Start the clip at (seconds, trims a bad start)</label><input type="number" min="0" max="10" step="0.5" value="${SB.trim}" oninput="SB.trim=parseFloat(this.value)||0">` : ""}
        <div class="grp">Timing</div>
        <div class="row"><div style="max-width:220px"><label style="margin-top:0">Hold after the narration (s)</label><input type="number" min="0" max="20" step="0.5" value="${SB.hold}" oninput="SB.hold=parseFloat(this.value)||0"></div></div>
      </div>
    </div>
    <div class="vsfoot">
      <span class="hint" style="flex:1">Camera words are added to the image prompt. Camera moves go to the video model.</span>
      <button class="btn" onclick="sbSave(false)">${ic("check", "sm")} Save</button>
      <button class="btn primary pill" onclick="sbSave(true)">${ic("refresh", "sm")} Save &amp; regenerate</button>
    </div>`;
}
function sbPreset(id) {
  const pr = CAT.cinema.presets.find(x => x.id === id); if (!pr) return;
  SB.camera = {...pr.camera}; SB.picture = {...SB.picture, ...pr.picture}; renderShot();
}
function sbCompose() {
  const order = ["P", "I", "C", "T", "U", "R", "E"];
  const txt = order.map(k => (SB.picture[k] || "").trim()).filter(Boolean).join(". ");
  if (!txt) { toast("Fill at least one PICTURE line"); return; }
  SB.prompt = txt; $("#sb_prompt").value = txt; toast("Prompt written from the PICTURE formula");
}
async function sbSave(regenAfter) {
  const e = {id: SB.sid, camera: SB.camera, media: SB.media, prompt: SB.prompt, picture: SB.picture, hold: SB.hold,
             move: SB.move, move_speed: SB.speed, motion_level: SB.level, trim_in: SB.trim};
  const s = CUR.scenes.find(x => x.id === SB.sid);
  if (SB.motion !== (s.motion || "")) e.motion = SB.motion;
  try {
    CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: [e]}});
    if (regenAfter) { await api(`/api/projects/${CUR.id}/run/regen`, {method: "POST", body: {scene_ids: [SB.sid]}}); toast(`Regenerating ${SB.sid}…`); closeModal("shotModal"); refreshSoon(); }
    else { toast("Shot saved"); openShot(SB.sid); }
    if (TAB === "scenes") renderScenes();
  } catch (err) { toast("Error: " + esc(err.message)); }
}
async function sbVariations() {
  await sbSave(false);
  try { VAR_PENDING = SB.sid; await api(`/api/projects/${CUR.id}/run/variations`, {method: "POST", body: {scene_id: SB.sid}}); closeModal("shotModal"); toast(`Making 4 options for ${SB.sid}…`); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function toCharacter(sid, file) {
  const cast = CUR.cast || [];
  const img = file ? `/files/${CUR.id}/${file}` : (() => { const s = CUR.scenes.find(x => x.id === sid); return `/files/${CUR.id}/${s.image}?v=${s.image_v || 0}`; })();
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>Character sheet from this image</h2><div class="hint" style="margin-top:4px">LECCORTUBE makes 8 views on grey from this picture, then uses the character in ${esc(sid)} automatically.</div></div>
      <button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <div class="tochar"><img src="${img}">
      <div>
        ${cast.length ? `<div class="grp" style="margin-top:0">Update a character</div><div class="chips">${cast.map(c => `<button onclick="toCharGo('${sid}',${file ? `'${file}'` : "null"},'${c.id}')">${esc(c.name)}</button>`).join("")}</div>` : ""}
        <div class="grp">${cast.length ? "Or a new character" : "New character"}</div>
        <label style="margin-top:0">Name (you write @Name in prompts)</label><input id="tc_name" placeholder="Dawood">
        <label>Look (optional: role, clothes, hair)</label><input id="tc_desc" placeholder="a 70 year old man, white beard, grey sweater, blue knitted cap">
        <div class="actions" style="margin-top:12px"><button class="btn primary" onclick="toCharGo('${sid}',${file ? `'${file}'` : "null"},null)">${ic("layers", "sm")} Make character sheet</button></div>
      </div></div>`;
  $("#pickModal").classList.add("show");
}
async function toCharGo(sid, file, cid) {
  const body = {file, cast_id: cid};
  if (!cid) { body.name = ($("#tc_name").value || "").trim(); body.desc = ($("#tc_desc").value || "").trim(); if (!body.name) { toast("Give the character a name"); return; } }
  try {
    const r = await api(`/api/projects/${CUR.id}/scenes/${sid}/to-character`, {method: "POST", body});
    CUR = r; closeModal("pickModal"); closeModal("shotModal");
    await api(`/api/projects/${CUR.id}/run/sheet`, {method: "POST", body: {cast_id: r.new_cast_id}});
    const c = (CUR.cast || []).find(x => x.id === r.new_cast_id);
    toast(`Making ${esc(c ? c.name : "the")} character sheet. ${esc(sid)} now uses this character as reference.`, 7000);
    renderProject(); refreshSoon();
  } catch (e) { toast("Error: " + esc(e.message)); }
}
async function useVariant(file) {
  try { CUR = await api(`/api/projects/${CUR.id}/scenes/${SB.sid}/variant`, {method: "POST", body: {file}}); toast("Option used"); openShot(SB.sid); renderScenes(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}

/* ---------------- Voice & basics ---------------- */
let PS = null;
function renderSettings() {
  const p = CUR, r = p.recommend;
  PS = {voice: p.voice, speed: p.speed, fx: p.voice_fx, clean: p.voice_clean, where: isCloudVoice(p.voice) ? "cloud" : "pc",
        cprov: isCloudVoice(p.voice) ? p.voice.split(":")[0] : null,
        vcfg: JSON.parse(JSON.stringify({...VS_DEF, ...(p.voice_cfg || {}), eleven: {...VS_DEF.eleven, ...((p.voice_cfg || {}).eleven || {})}}))};
  if (typeof vaStop === "function" && VA.audio) vaStop();
  if (!CV) loadCloudVoices();
  if (p.preset === "rhyme") { $("#tabBody").innerHTML = songCard(p); return; }
  $("#tabBody").innerHTML = `
  <div class="card"><div class="sec-t"><span class="n">${ic("mic")}</span><div><h3>Narrator voice</h3><small>Free on your PC, or studio cloud voices with your own key.</small></div></div>
    <div class="vp-bar" id="vPresets">${vPresetBar()}</div>
    <div class="where" id="vWhere">${voiceWhere()}</div>
    <div id="vBody" style="margin-top:14px">${voiceBody()}</div>
  </div>
  <div class="card"><div class="sec-t"><span class="n">${ic("user")}</span><div><h3>Dialogue</h3><small>Lines written as <code>@Noor: text</code> in the script</small></div></div>
    <div class="seg-cards">
      <div class="scard ${p.dialogue_voices === false ? "on" : ""}" onclick="setDialogue(false)"><b>${ic("mic", "sm")} One storyteller</b><span>The narrator reads everything, like one person telling the story. Best for sleep and history videos.</span></div>
      <div class="scard ${p.dialogue_voices !== false ? "on" : ""}" onclick="setDialogue(true)"><b>${ic("user", "sm")} I will choose on the Cast page</b><span>Every character gets its own voice. Pick each one on the Cast page (3 voices are suggested for you). The narrator reads the rest.</span></div>
    </div>
    ${p.dialogue_voices !== false ? `<button class="btn sm" style="margin-top:10px" onclick="TAB='cast';renderProject()">${ic("user", "sm")} Open Cast page to pick voices</button>` : ""}
    <div class="hint" style="margin-top:8px">Changing this records the dialogue scenes again (only those).</div>
  </div>`;
  if ($("#s_speed")) fill($("#s_speed")); vPickedPaint(); if (PS.where === "cloud" && PS.cprov === "eleven") setTimeout(vUsage, 50);
}
function sPickType(id) { if (id === CUR.preset) return; patch({preset: id}, `Video type: ${esc((CAT.types.find(t => t.id === id) || {}).name || id)}. Pacing, music and captions follow it.`); }
function sSpeed(v) { PS.speed = parseFloat(v); $("#s_sv").innerHTML = PS.speed.toFixed(2) + "<small>x</small>";  vPickedPaint(); }
function sSpeedAuto() { PS.speed = CUR.recommend.speed; $("#s_speed").value = PS.speed; fill($("#s_speed")); sSpeed(PS.speed); }
function sPlay(btn) { vaToggle(PS.where === "cloud" && $("#vTestText") ? "test" : "pc"); }
async function patch(body, msg) {
  try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body}); if (msg !== false) toast(msg || "Saved"); renderProject(); loadProjects(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function saveBasics() { patch({title: $("#s_title").value, thumbnail_text: $("#s_thumb").value}, false); savedTick("basicsSaved"); }
function savedTick(id) { const el = $("#" + id); if (!el) return; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 1800); }
function setupCard(p) {
  return `<div class="card"><div class="sec-t"><span class="n">${ic("film")}</span><div><h3>Video setup</h3><small>Title, type, opening and ending. Changes save by themselves.</small></div><div class="grow"></div><span class="saved" id="basicsSaved">${ic("check", "sm")} Saved</span></div>
    <div class="row">
      <div><label style="margin-top:0">Title</label><input id="s_title" value="${esc(p.title)}" onchange="saveBasics()"></div>
      <div style="max-width:300px"><label style="margin-top:0">Thumbnail text</label><input id="s_thumb" value="${esc(p.thumbnail_text)}" onchange="saveBasics()"></div>
    </div>
    <label>Video type <span class="hint">pacing, crossfades, music level, captions, sound effects and colour</span></label>
    <div class="types" id="s_types">${typeCards(p.preset, "sPickType")}</div>
    <div class="row" style="margin-top:6px">
      <div><label>Opening <span class="hint">changes from video to video so the channel does not look like a template</span></label>
        <div class="chips">${[["fade", "Fade in"], ["title", "Title card"], ["zoom", "Slow zoom"], ["cold", "Cold open"]].map(([k, l]) => `<button class="${(p.intro || "fade") === k ? "on" : ""}" onclick="patch({intro:'${k}'},false)">${l}</button>`).join("")}</div></div>
      <div style="max-width:300px"><label>Ending</label>
        <div class="chips">${[["fade", "Fade to black"], ["hold", "Hold last frame"]].map(([k, l]) => `<button class="${(p.outro || "fade") === k ? "on" : ""}" onclick="patch({outro:'${k}'},false)">${l}</button>`).join("")}</div></div>
    </div>
  </div>`;
}
async function setDialogue(on) { if ((CUR.dialogue_voices !== false) === on) return; await patch({dialogue_voices: on}, on ? "Characters speak with their own voices. Run 1 · Voice to record." : "The narrator reads everything. Run 1 · Voice to record."); }
function saveVoice() { vaStop(); patch({voice: PS.voice, speed: PS.speed, voice_cfg: PS.vcfg}, "Voice saved. Run 1 · Voice (or Build everything) to record it."); }
/* ---- narrator voice: On my PC or Cloud (Pro), voice library, settings, presets, inline players ---- */
let CV = null, CV_Q = "", CV_EDIT = false;
const VS_DEF = {style: "story", style_text: "", eleven: {stability: 0.5, similarity: 0.8, style: 0.0, boost: true}};
async function loadCloudVoices(rerender = true) {
  try { CV = await api("/api/cloud-voice"); } catch (e) { CV = {pro: false, providers: [], voices: {}, eleven: {models: []}, styles: [], presets: []}; }
  if (rerender && VIEW === "project" && TAB === "settings" && $("#vBody")) vRender();
}
function vRender() { const w = $("#vWhere"); if (!w) return; w.innerHTML = voiceWhere(); vBodyPaint(); $("#vPresets").innerHTML = vPresetBar(); }
function vBodyPaint() { const b = $("#vBody"); if (!b) return; b.innerHTML = voiceBody(); if ($("#s_speed")) fill($("#s_speed")); b.querySelectorAll(".vsl input").forEach(fill); vPickedPaint(); vaPaint(); }
function narrMinutes() {
  const words = (CUR.scenes || []).reduce((a, s) => a + ((s.text || "").match(/\b\w+\b/g) || []).length, 0);
  return Math.max(0.5, words / (2.6 * (PS.speed || 1)) / 60);
}
function vName(id) {
  if (isCloudVoice(id) && CV) { const [e] = id.split(":"), v = ((CV.voices || {})[e] || []).find(x => x.id === id), pr = (CV.providers || []).find(x => x.id === e);
    if (v) return `${v.name} · ${pr ? pr.name : e}`; }
  return voiceName(id) || id;
}
function vPickedPaint() {
  const e = $("#vPicked"); if (!e) return;
  const dirty = PS.voice !== CUR.voice || Math.abs(PS.speed - CUR.speed) > 0.001 || JSON.stringify(PS.vcfg) !== JSON.stringify(CUR.voice_cfg || VS_DEF);
  e.innerHTML = `${ic("mic", "sm")} <b>${esc(vName(PS.voice))}</b>${dirty ? ` <span class="vdirty">not saved yet</span>` : ""}`;
  const b = $("#vSave"); if (b) b.classList.toggle("pulse", dirty);
}
/* engine cards */
function voiceWhere() {
  const pro = !CV || CV.pro !== false;
  return orderWhere(`<div class="wh ${PS.where !== "cloud" ? "on" : ""}" onclick="vWhere('pc')"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>On my PC</b>
      <span>Free. Kokoro, natural voices from your own sample and Microsoft Edge voices.</span>
      <div class="actions" style="margin-top:8px"><button class="btn sm" onclick="event.stopPropagation();openVoiceStudio('project')">${ic("headphones", "sm")} Voice Studio</button><small style="margin:0">effects, your own sample, fine tuning</small></div></div></div>
    <div class="wh ${PS.where === "cloud" ? "on" : ""} ${pro ? "" : "nopro"}" onclick="vWhere('cloud')"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>Cloud voices <span class="pro-badge">${ic(pro ? "crown" : "lock")}<i>PRO</i></span></b>
      <span>Studio voices on any PC: Google Gemini, ElevenLabs and OpenAI. Clone your own voice.</span><small>Your own API key, from about $0.81 per hour of narration</small></div></div>`);
}
function vWhere(w) {
  if (w === "cloud" && !proOn()) { needPro("Cloud voices"); return; }
  if (PS.where === w) return;
  vaStop(); PS.where = w;
  if (w === "pc" && isCloudVoice(PS.voice)) PS.voice = isCloudVoice(CUR.voice) ? CUR.recommend.voice : CUR.voice;
  vRender();
}
/* presets */
function vPresetBar() {
  const ps = (CV && CV.presets) || [];
  return `<span class="vp-l">${ic("layers", "sm")} My presets</span>${ps.map(x => `<span class="vp-chip" title="${esc(vName(x.voice))} · ${Number(x.speed).toFixed(2)}x"><button onclick="vPresetApply('${x.id}')">${esc(x.name)}</button><i onclick="vPresetDel('${x.id}')">${ic("x", "sm")}</i></span>`).join("")}
    ${ps.length ? "" : `<span class="hint">Save the voice, speed, effect and settings you like and use them in every video.</span>`}
    <button class="btn sm" onclick="vPresetSave()">${ic("plus", "sm")} Save as preset</button>`;
}
async function vPresetSave() {
  const name = prompt("Name for this voice preset", (CAT.types.find(t => t.id === CUR.preset) || {}).name || "My voice"); if (!name) return;
  try { const r = await api("/api/voice-presets", {method: "POST", body: {name, voice: PS.voice, speed: PS.speed, fx: CUR.voice_fx, clean: CUR.voice_clean, voice_cfg: PS.vcfg}});
    CV.presets = r.presets; $("#vPresets").innerHTML = vPresetBar(); toast(`Preset "${esc(name)}" saved. It is here in every project.`); }
  catch (e) { toast(esc(e.message)); }
}
async function vPresetDel(id) {
  if (!confirm("Delete this preset?")) return;
  try { const r = await api(`/api/voice-presets/${id}`, {method: "DELETE"}); CV.presets = r.presets; $("#vPresets").innerHTML = vPresetBar(); } catch (e) { toast(esc(e.message)); }
}
async function vPresetApply(id) {
  const x = ((CV && CV.presets) || []).find(p => p.id === id); if (!x) return;
  if (isCloudVoice(x.voice) && CV.pro === false) { toast("This preset uses a cloud voice (Pro)."); return; }
  vaStop();
  await patch({voice: x.voice, speed: x.speed, voice_fx: x.fx, voice_clean: x.clean, voice_cfg: x.voice_cfg || {}}, `Preset "${esc(x.name)}" applied. Run 1 · Voice to record.`);
}
/* body */
function voiceBody() {
  if (PS.where !== "cloud") {
    const p = CUR, r = CUR.recommend;
    return `<div class="vpc"><div><label style="margin-top:0">Narrator ${PS.voice === CUR.recommend.voice ? `<span class="rec">RECOMMENDED</span>` : ""}</label>
        <div class="vpc-row"><select id="s_voice" onchange="PS.voice=this.value;vaStop();vPickedPaint()">${voiceOptions(PS.voice, v => !CLOUD_ENG.includes(v.engine))}</select>
        ${vaBtn("pc", "Listen")}</div></div>
      <div class="vfoot">
        <div><label style="margin-top:0">Effect</label><div class="actions"><span class="chip a">${ic("wand", "sm")} ${esc(fxName(p.voice_fx))}</span><span class="chip ${p.voice_clean ? "ok" : ""}">${p.voice_clean ? "Studio clean on" : "No cleaning"}</span><button class="btn sm" onclick="openVoiceStudio('project')">Change</button></div>
          ${vSaveRow()}</div>
        <div>${speedBlock("s", PS.voice, PS.speed, Math.abs(PS.speed - r.speed) < 0.005, r.speed)}</div>
      </div></div>`;
  }
  if (!CV) return `<div class="hint"><span class="eq"><i></i><i></i><i></i><i></i></span> Loading cloud voices…</div>`;
  const provs = CV.providers || [];
  PS.cprov = PS.cprov || (isCloudVoice(PS.voice) ? PS.voice.split(":")[0] : (provs.find(x => x.has_key) || provs[0] || {}).id);
  const P = provs.find(x => x.id === PS.cprov) || {};
  const tabs = provs.map(x => `<button class="${x.id === PS.cprov ? "on" : ""}" onclick="vProv('${x.id}')"><b>${esc(x.name)}</b><small>~$${x.price_hour.toFixed(2)}/h</small>${x.has_key ? ic("check", "sm") : ""}</button>`).join("");
  return `<div class="vprov">${tabs}</div>
    <div class="vcloud-save">${vSaveRow()}</div>
    <div class="vlab"><div class="vlib">${P.has_key && !CV_EDIT ? vLibrary() : vConnect(P)}</div>
      <div class="vset">${P.has_key && !CV_EDIT ? vSettings(P) : vWhy(P)}</div></div>`;
}
function vSaveRow() { return `<div class="actions" style="margin-top:14px"><button class="btn primary" id="vSave" onclick="saveVoice()">${ic("check", "sm")} Save voice</button><span class="vpicked" id="vPicked"></span></div>`; }
function vProv(id) { vaStop(); PS.cprov = id; CV_Q = ""; CV_EDIT = false; vBodyPaint(); if (id === "eleven") vUsage(); }
function vConnect(P) {
  return `<div class="vconnect"><h4>${ic("link", "sm")} Connect ${esc(P.name)}</h4><p>${esc(P.note || "")}</p>
    <label style="margin-top:6px">API key</label><input id="cv_key" type="password" autocomplete="off" placeholder="Paste your ${esc(P.name)} key" onkeydown="if(event.key==='Enter')cvConnect(this)">
    <div class="actions" style="margin-top:10px"><button class="btn primary" onclick="cvConnect(this)">${ic("link", "sm")} Connect</button>
      <a class="btn sm" href="${esc(P.get_key || "#")}" target="_blank" rel="noopener">Get your key</a>${CV_EDIT ? `<button class="btn sm" onclick="CV_EDIT=false;vBodyPaint()">Cancel</button>` : ""}</div>
    <div class="hint" style="margin-top:8px">Saved on this PC only, never shared.</div></div>`;
}
function vWhy(P) {
  const ph = P.price_hour || 1;
  return `<div class="vset-h">Why ${esc(P.name)}</div><div class="vcost">${vCostCells(ph)}</div>
    <div class="hint" style="margin-top:10px">${P.id === "gemini" ? "Cheapest studio voice, 30 voices, 70+ languages, you describe how it should sound. The Google AI Studio key also runs Google research, cloud pictures and Veo video." : P.id === "eleven" ? "The most natural voices and the best voice cloning: upload one or two minutes of your voice and every video speaks in it." : "Clear, natural voices. You describe the tone, pace and emotion in plain words."}</div>`;
}
function vCostCells(ph) {
  const m = narrMinutes(), c = x => money(ph * x / 60);
  return `<div class="on"><span>This video · ${fmtMin(m)}</span><b>${c(m)}</b></div>` + [10, 30, 60].map(x => `<div><span>${x} min</span><b>${c(x)}</b></div>`).join("");
}
function vLibrary() {
  const all = (CV.voices || {})[PS.cprov] || [], q = CV_Q.trim().toLowerCase();
  const list = all.filter(v => !q || (v.name + " " + (v.desc || "")).toLowerCase().includes(q));
  return `<div class="vlib-h"><div class="msel-in">${ic("search", "sm")}<input placeholder="Search ${all.length} voices" value="${esc(CV_Q)}" oninput="CV_Q=this.value;vList()"></div>
      ${PS.cprov === "eleven" ? `<button class="btn sm" title="Reload voices" onclick="cvElevenReload(this)">${ic("refresh", "sm")}</button>` : ""}</div>
    <div class="vlist" id="vList">${vRows(list)}</div>
    ${!all.length && PS.cprov === "eleven" ? `<div class="hint" style="padding:10px">No voices yet. Press reload.</div>` : ""}`;
}
function vList() {
  const all = (CV.voices || {})[PS.cprov] || [], q = CV_Q.trim().toLowerCase(), l = $("#vList");
  if (l) { l.innerHTML = vRows(all.filter(v => !q || (v.name + " " + (v.desc || "")).toLowerCase().includes(q))); vaPaint(); }
}
function vRows(list) {
  return list.map(v => `<div class="vrow ${v.id === PS.voice ? "on" : ""}" data-va="${esc(v.id)}" onclick="cvPick('${esc(v.id)}')">
      <button class="va-btn" onclick="event.stopPropagation();vaToggle('${esc(v.id)}')">${ic("play", "sm")}${ic("pause", "sm")}<span class="eq"><i></i><i></i><i></i></span></button>
      <div class="vrow-t"><b>${esc(v.name)}</b><span>${esc(v.desc || "")}</span></div>
      <canvas class="va-wave" width="140" height="30"></canvas>
      <button class="va-stop" title="Stop" onclick="event.stopPropagation();vaStop()">${ic("stop", "sm")}</button>
      <span class="vrow-use">${v.id === PS.voice ? `${ic("check", "sm")} Selected` : "Use"}</span></div>`).join("");
}
function cvPick(id) { PS.voice = id; vList(); vPickedPaint(); }
function vSettings(P) {
  const S = PS.vcfg, E = S.eleven || VS_DEF.eleven;
  let ctl = "";
  if (P.id === "eleven") {
    const M = CV.eleven || {}, v3 = M.model === "eleven_v3";
    const MI = {eleven_v3: ["Best", "most expressive, emotions"], eleven_multilingual_v2: ["Steady", "very stable, 29 languages"], eleven_flash_v2_5: ["Budget", "half price, fastest"]};
    ctl = `<label style="margin-top:0">Model</label><div class="vmodels">${(M.models || []).map(m => { const t = MI[m.id] || ["", ""]; return `<button class="${m.id === M.model ? "on" : ""}" onclick="cvElevenModel('${m.id}')">
        <span class="vm-tag">${t[0]}</span><b>${esc(m.name.replace(/ \(.*\)/, ""))}</b><small>${t[1]}</small><i>$${(m.per_k * 53).toFixed(2)}<small>/hour</small></i>${m.id === M.model ? `<span class="vm-on">${ic("check", "sm")}</span>` : ""}</button>`; }).join("")}</div>
      <label>Stability <span class="hint">${v3 ? "v3 has three steps" : "lower = more emotion, higher = steadier"}</span></label>
      ${v3 ? `<div class="seg">${[[0, "Creative"], [0.5, "Natural"], [1, "Robust"]].map(([x, n]) => `<button class="${Math.abs(E.stability - x) < 0.26 ? "on" : ""}" onclick="vEl('stability',${x})">${n}</button>`).join("")}</div>` : vSlider("stability", E.stability)}
      <label>Similarity <span class="hint">how close to the original voice</span></label>${vSlider("similarity", E.similarity)}
      <label>Style exaggeration <span class="hint">0 is best for narration</span></label>${vSlider("style", E.style)}
      <label class="chk" style="margin-top:10px"><input type="checkbox" ${E.boost ? "checked" : ""} onchange="vEl('boost', this.checked)"> Speaker boost <span class="hint">clearer, closer to the original</span></label>
      <div class="vclone"><div>${ic("mic")}</div><div><b>Clone your voice</b><span>Upload 1 to 2 minutes of clear speech (no music). It appears in the list as your voice.</span></div>
        <label class="btn sm primary" style="cursor:pointer">${ic("upload", "sm")} Upload<input type="file" accept="audio/*" style="display:none" onchange="cvClone(this.files[0])"></label></div>
      <div class="hint" id="cvUsage" style="margin-top:8px"></div>`;
  } else {
    ctl = `<label style="margin-top:0">Delivery <span class="hint">how it is said, never read aloud</span></label>
      <div class="vstyles">${(CV.styles || []).map(s => `<button class="${!S.style_text && S.style === s.id ? "on" : ""}" title="${esc(s.text)}" onclick="vStyle('${s.id}')">${esc(s.name)}</button>`).join("")}</div>
      ${P.id === "gemini" ? `<div class="hint" style="margin-top:6px">The first play of a Gemini voice takes about 15 to 20 seconds.</div>` : ""}
      <label>Or describe it yourself</label><textarea rows="2" placeholder="${P.id === "gemini" ? "e.g. deep and calm, like a late night radio host, slow with long pauses" : "e.g. Voice: warm and wise. Tone: hopeful. Pacing: slow."}" oninput="PS.vcfg.style_text=this.value;vPickedPaint()">${esc(S.style_text || "")}</textarea>`;
  }
  const test = sampleText(CUR.scenes.slice(0, 2).map(s => s.text).join(" "));
  return `<div class="vset-h">${esc(P.name)} settings <a class="hint" onclick="CV_EDIT=true;vBodyPaint()">change key</a></div>${ctl}
    <label>Test line</label><div class="vtest" data-va="test"><textarea id="vTestText" rows="2">${esc(test)}</textarea>
      <div class="actions"><button class="va-btn wide" onclick="vaToggle('test')">${ic("play", "sm")}${ic("pause", "sm")}<span class="eq"><i></i><i></i><i></i></span> Test with these settings</button><canvas class="va-wave" width="200" height="30"></canvas><button class="va-stop" onclick="vaStop()">${ic("stop", "sm")}</button></div></div>
    <div class="vcost" style="margin-top:12px">${vCostCells(P.price_hour)}</div>`;
}
function vSlider(k, val) { return `<div class="vsl"><input type="range" min="0" max="100" value="${Math.round(val * 100)}" oninput="fill(this);vEl('${k}', this.value/100, true);this.nextElementSibling.textContent=this.value"><span>${Math.round(val * 100)}</span></div>`; }
function vEl(k, v, quiet) { PS.vcfg.eleven = {...(PS.vcfg.eleven || VS_DEF.eleven), [k]: v}; vPickedPaint(); if (!quiet) vBodyPaint(); }
function vStyle(id) { PS.vcfg.style = id; PS.vcfg.style_text = ""; vPickedPaint(); vBodyPaint(); }
async function cvConnect(btn) {
  const k = ($("#cv_key").value || "").trim(); if (!k) { toast("Paste the API key first"); return; }
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Checking…`;
  try { CV = await api("/api/cloud-voice/connect", {method: "POST", body: {provider: PS.cprov, key: k}}); CV_EDIT = false; await loadCatalog(); toast("Connected. Press play on any voice to hear it.", 6000); vRender(); }
  catch (e) { toast(esc(e.message), 9000); btn.disabled = false; btn.innerHTML = old; }
}
async function cvElevenModel(m) { try { CV = await api("/api/cloud-voice/eleven-model", {method: "POST", body: {model: m}}); vBodyPaint(); vUsage(); } catch (e) { toast(esc(e.message)); } }
async function cvElevenReload(btn) {
  btn.disabled = true;
  try { CV = await api("/api/cloud-voice/eleven-reload", {method: "POST"}); await loadCatalog(); vBodyPaint(); vUsage(); toast("Voices reloaded"); }
  catch (e) { toast(esc(e.message), 8000); btn.disabled = false; }
}
async function vUsage() {
  const el = $("#cvUsage"); if (!el) return;
  try { const u = await api("/api/cloud-voice/eleven-usage");
    if (u.limit) { const left = Math.max(0, u.limit - (u.used || 0)), pct = Math.min(100, (u.used || 0) / u.limit * 100);
      el.innerHTML = `<div class="vmeter"><i style="width:${pct}%"></i></div><b>${left.toLocaleString()}</b> characters left this month, about ${Math.round(left / 900)} min of narration${u.tier ? " · " + esc(u.tier) + " plan" : ""}`; } }
  catch (e) {}
}
async function cvClone(file) {
  if (!file) return;
  if (!confirm("Only clone a voice you own or have permission to use. Continue?")) return;
  const name = prompt("Name for this voice", "My voice") || "My voice";
  const fd = new FormData(); fd.append("file", file);
  toast("Cloning your voice, about 30 seconds…", 8000);
  try { await api(`/api/pro/eleven/clone?name=${encodeURIComponent(name)}`, {method: "POST", body: fd}); CV = await api("/api/cloud-voice/eleven-reload", {method: "POST"}); await loadCatalog();
    const mine = ((CV.voices || {}).eleven || []).find(v => v.name === name); if (mine) PS.voice = mine.id;
    vRender(); toast("Voice cloned and selected. Press play to hear it, then Save voice.", 8000); }
  catch (e) { toast("Error: " + esc(e.message), 9000); }
}
/* inline player with a live sound wave */
const VA = {audio: null, ctx: null, an: null, id: null, raf: 0, loading: false};
function vaBtn(id, label) { return `<span class="vtest" data-va="${id}" style="display:inline-flex;align-items:center;gap:8px"><button class="va-btn wide" onclick="vaToggle('${id}')">${ic("play", "sm")}${ic("pause", "sm")}<span class="eq"><i></i><i></i><i></i></span> ${label}</button><canvas class="va-wave" width="120" height="30"></canvas><button class="va-stop" onclick="vaStop()">${ic("stop", "sm")}</button></span>`; }
function vaInit() {
  if (VA.audio) return;
  VA.audio = new Audio(); VA.audio.crossOrigin = "anonymous";
  try { VA.ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = VA.ctx.createMediaElementSource(VA.audio); VA.an = VA.ctx.createAnalyser(); VA.an.fftSize = 64; src.connect(VA.an); VA.an.connect(VA.ctx.destination); } catch (e) { VA.an = null; }
  VA.audio.onended = () => vaStop(); VA.audio.onpause = () => vaPaint(); VA.audio.onplay = () => vaPaint();
}
async function vaUrl(id) {
  if (id.startsWith("cv|")) {  // Cast tab: a character's voice saying a line of its own
    const [, cid, voice] = id.split("|"), c = (CUR.cast || []).find(x => x.id === cid) || {};
    if (voice.startsWith("eleven:") && CV) { const v = ((CV.voices || {}).eleven || []).find(x => x.id === voice); if (v && v.preview) return `/api/cloud-voice/sample?url=${encodeURIComponent(v.preview)}`; }
    const line = ((CUR.script || "").match(new RegExp("@" + (c.name || "").split(" ")[0] + "\\s*:\\s*([^\\n]{8,160})", "i")) || [])[1] || `Hi, I am ${(c.name || "").split(" ")[0]}. This is how I sound in the story.`;
    const r = await api("/api/voice/preview", {method: "POST", body: {voice: voice || CUR.voice, speed: CUR.speed || 1, fx: "none", clean: true, text: line}});
    return r.url;
  }
  if (id.startsWith("eleven:")) { const v = ((CV.voices || {}).eleven || []).find(x => x.id === id); if (v && v.preview) return `/api/cloud-voice/sample?url=${encodeURIComponent(v.preview)}`; }
  const voice = id === "test" || id === "pc" ? PS.voice : id;
  const text = id === "test" && $("#vTestText") ? $("#vTestText").value : sampleText(CUR.scenes.slice(0, 2).map(s => s.text).join(" "));
  const r = await api("/api/voice/preview", {method: "POST", body: {voice, speed: PS.speed, fx: CUR.voice_fx, clean: CUR.voice_clean, voice_cfg: isCloudVoice(voice) ? PS.vcfg : null, text}});
  return r.url;
}
async function vaToggle(id) {
  vaInit(); if (VA.ctx && VA.ctx.state === "suspended") VA.ctx.resume();
  if (VA.id === id && !VA.loading) { if (VA.audio.paused) { await VA.audio.play(); vaDraw(); } else VA.audio.pause(); return; }
  vaStop(); VA.id = id; VA.loading = true; vaPaint();
  try { const url = await vaUrl(id); if (VA.id !== id) return; VA.audio.src = url; VA.loading = false; await VA.audio.play(); vaDraw(); }
  catch (e) { const msg = e.message; VA.loading = false; vaStop(); toast("Voice: " + esc(msg), 9000); }
}
function vaStop() {
  if (VA.audio) { VA.audio.pause(); try { VA.audio.currentTime = 0; } catch (e) {} }
  VA.id = null; VA.loading = false; cancelAnimationFrame(VA.raf);
  document.querySelectorAll(".va-wave").forEach(c => c.getContext("2d").clearRect(0, 0, c.width, c.height));
  vaPaint();
}
function vaPaint() {
  document.querySelectorAll("[data-va]").forEach(el => {
    const on = el.dataset.va === VA.id;
    el.classList.toggle("va-loading", on && VA.loading);
    el.classList.toggle("va-playing", on && !VA.loading && VA.audio && !VA.audio.paused);
    el.classList.toggle("va-paused", on && !VA.loading && VA.audio && VA.audio.paused);
  });
}
function vaDraw() {
  cancelAnimationFrame(VA.raf);
  const el = VA.id && document.querySelector(`[data-va="${CSS.escape(VA.id)}"] .va-wave`);
  if (el && VA.audio && !VA.audio.paused) {
    const g = el.getContext("2d"), W = el.width, H = el.height, n = 24, bw = W / n;
    let d = null; if (VA.an) { d = new Uint8Array(VA.an.frequencyBinCount); VA.an.getByteFrequencyData(d); }
    const live = d && d.some(x => x > 0), t = performance.now() / 160;
    g.clearRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, "#ff2d40"); grad.addColorStop(1, "#ff8a3d"); g.fillStyle = grad;
    for (let i = 0; i < n; i++) {
      const v = live ? d[Math.min(d.length - 1, Math.floor(i * d.length / n / 1.3))] / 255 : 0.25 + 0.5 * Math.abs(Math.sin(t + i * 0.7)) * Math.abs(Math.sin(t * 0.6 + i));
      const h = Math.max(2, v * H);
      g.beginPath(); g.roundRect ? g.roundRect(i * bw + 1, (H - h) / 2, bw - 2.5, h, 2) : g.rect(i * bw + 1, (H - h) / 2, bw - 2.5, h); g.fill();
    }
  }
  if (VA.id && VA.audio && !VA.audio.paused) VA.raf = requestAnimationFrame(vaDraw);
}

/* ---------------- Look: style, default camera, grade, reference board ---------------- */
let REFS = [], GPREV = null;
let CAPV = 0;
const CAP_KEYS = ["font", "size", "color", "highlight", "position", "words", "upper"];
function capBgV(p) { const s = (p.scenes || []).find(x => x.image); return s ? (s.image_v || 1) : (p.style_id || 0); }
function capCard(p) {
  const c = p.caption_settings || {}, styles = p.caption_styles || [];
  return `<div class="sec-t"><span class="n">${ic("file")}</span><div><h3>Captions</h3><small>Words on the video, timed to the voice. subtitles.srt is always exported for YouTube too.</small></div><div class="grow"></div>
      <label class="chk" style="margin:0"><input type="checkbox" id="capOn" ${c.enabled ? "checked" : ""} onchange="capSet({enabled: this.checked})"> <b id="capOnTxt">${c.enabled ? "On" : "Off"}</b></label></div>
    ${c.enabled ? "" : `<div class="hint" style="margin-top:4px">Off. Turn it on to pick a caption style.</div>`}
    <div class="capwrap" ${c.enabled ? "" : 'style="display:none"'}>
      <div class="caplist">${styles.map(st => `<div class="capst ${st.id === c.style ? "on" : ""}" data-cap="${st.id}" onclick="capStyle('${st.id}')" title="${esc(st.desc)}"><img loading="lazy" src="/api/captions/preview?pid=${p.id}&style=${st.id}&thumb=1&v=${capBgV(p)}" alt=""><b>${esc(st.name)}</b></div>`).join("")}</div>
      <div class="capright" id="capRight">${capRight(p)}</div>
    </div>`;
}
function capRight(p) {
  const c = p.caption_settings || {}, st = (p.caption_styles || []).find(x => x.id === c.style) || {};
  const custom = JSON.stringify(Object.fromEntries(CAP_KEYS.map(k => [k, c[k]])));
  return `<div class="capbigwrap"><img class="capbig" id="capBig" src="/api/captions/preview?pid=${p.id}&style=${c.style}&custom=${encodeURIComponent(custom)}&v=${CAPV}" alt=""></div>
      <div class="capname"><b>${esc(st.name || "")}</b><span class="hint">${esc(st.desc || "")}</span></div>
      <div class="capctl">
        <label>Font<select onchange="capSet({font: this.value})">${(p.caption_fonts || []).map(f => `<option value="${f.id}" ${c.font === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></label>
        <label>Size <span class="hint">${(+c.size).toFixed(1)}%</span><input type="range" min="2" max="10" step="0.2" value="${c.size}" onchange="capSet({size: +this.value})"></label>
        <label>Words per caption<input type="number" min="1" max="10" value="${c.words}" onchange="capSet({words: +this.value})"></label>
        <label>Position<select onchange="capSet({position: this.value})">${["bottom", "middle", "top"].map(v => `<option ${c.position === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Text colour<input type="color" value="${c.color}" onchange="capSet({color: this.value})"></label>
        <label>Spoken word colour<input type="color" value="${c.highlight}" onchange="capSet({highlight: this.value})"></label>
        <label class="chk"><input type="checkbox" ${c.upper ? "checked" : ""} onchange="capSet({upper: this.checked})"> UPPERCASE</label>
        <span class="hint">Changes apply at the next 4 · Render (no new images or voice needed).</span>
      </div>`;
}
async function capSet(ch) {
  try {
    CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {captions: ch}}); CAPV++;
    const c = CUR.caption_settings || {};
    if ("enabled" in ch && $("#capCard")) { $("#capCard").innerHTML = capCard(CUR); $("#capCard").classList.toggle("off", !c.enabled); return; }
    $$(".capst").forEach(el => el.classList.toggle("on", el.dataset.cap === c.style));  // the list stays as it is
    if ($("#capOnTxt")) $("#capOnTxt").textContent = c.enabled ? "On" : "Off";
    const right = $("#capRight"); if (!right) return;
    const old = $("#capBig"), h = old ? old.offsetHeight : 0;
    const tmp = document.createElement("div"); tmp.innerHTML = capRight(CUR);
    const img = tmp.querySelector("#capBig");
    if (old && img) {  // swap the big preview only when the new picture is ready: no flash, no jump
      right.style.minHeight = right.offsetHeight + "px";
      const pre = new Image(); pre.onload = pre.onerror = () => { right.innerHTML = tmp.innerHTML; right.style.minHeight = ""; };
      pre.src = img.src;
    } else right.innerHTML = tmp.innerHTML;
  } catch (e) { toast("Error: " + esc(e.message)); }
}
function capStyle(id) { capSet({style: id, ...Object.fromEntries(CAP_KEYS.map(k => [k, null]))}); }
const LOOK_STYLES = ["anime", "anime_cinematic", "handpainted", "storybook", "watercolor", "chibi", "anime_dark", "manga", "comic",
  "pixar3d", "clay", "soft3d", "stick", "cinematic", "documentary", "vintage", "noir", "horror_real", "found_footage", "gothic",
  "darkfantasy", "engraving", "painterly", "oil", "fantasyart", "cyberpunk", "cartoon"];
let LOOK_POLL = 0;
function lookStyles(sel) {
  const ids = LOOK_STYLES.filter(id => CAT.styles.some(s => s.id === id));
  if (sel && !ids.includes(sel) && CAT.styles.some(s => s.id === sel)) ids.unshift(sel);
  return ids.map(id => CAT.styles.find(s => s.id === id));
}
function lookGallery(sel) {
  return `<div class="lstyles">${lookStyles(sel).map(s => `<div class="lstyle ${s.id === sel ? "on" : ""}" onclick="sStyle('${s.id}')" title="${esc(s.prefix)}">
      ${s.preview ? `<img src="${s.preview}" loading="lazy" alt="">` : `<div class="lph"></div>`}<div class="ck">${ic("check")}</div><b>${esc(s.name)}</b></div>`).join("")}</div>`;
}
async function renderLook() {
  const p = CUR, g = p.grade || {};
  if (!p.cloud_mode && !(HEALTH && HEALTH.comfyui && HEALTH.comfyui.ok)) api("/api/comfy/start", {method: "POST"}).then(loadHealth).catch(() => {});  // ready for the sample picture
  $("#tabBody").innerHTML = `
  <div class="card"><div class="sec-t"><span class="n">${ic("palette")}</span><div><h3>Style</h3><small>Every picture follows this look. Pick one and a sample picture is painted for the colour grade below.</small></div></div>
    <div id="stylesProj">${lookGallery(p.style_id)}</div>
    <details class="adv" style="margin-top:12px"><summary>${ic("sliders", "sm")} Advanced</summary>
      <label style="margin-top:10px">Style text <span class="hint">added in front of every picture prompt</span></label>
      <textarea id="s_style" rows="2">${esc(p.style_prefix)}</textarea>
      <label class="chk"><input type="checkbox" id="s_lock" ${p.lock_seed ? "checked" : ""}> Same seed for every picture <span class="hint">more uniform colours, less variety</span></label>
      <label class="chk"><input type="checkbox" id="s_body" ${p.body_check !== false ? "checked" : ""}> Body check <span class="hint">Smart Director checks pictures with people and paints them again when a body is broken. A few seconds per picture.</span></label>
      <div class="actions" style="margin-top:10px"><button class="btn sm primary" onclick="saveLook()">Save</button></div>
    </details>
  </div>
  <div class="card capcard ${(p.caption_settings || {}).enabled ? "" : "off"}" id="capCard">${capCard(p)}</div>
  <div class="card"><div class="sec-t"><span class="n">${ic("sliders")}</span><div><h3>Color grade</h3><small>Film colour, grain, vignette and cinema bars, added when the video renders</small></div></div>
    <div id="lookSample">${lookSampleHtml()}</div>
    <div id="gradePrev" style="margin-bottom:12px">${GPREV ? gradePrevHtml(GPREV) : ""}</div>
    ${(g.lut || "none") === "auto" ? `<div class="infoline">${ic("sparkles", "sm")} Auto picks <b>${esc(p.grade_auto.name)}</b> for this video (${esc(p.grade_auto.why)}). It changes by itself when you change the video type or style.</div>` : ""}
    <div class="grades">${CAT.grade.grades.map(x => `<div class="gcard ${(g.lut || "none") === x.id ? "on" : ""} ${x.id === "auto" ? "auto" : ""}" data-g="${x.id}" onclick="setGrade({lut:'${x.id}'})"><div class="gth"></div><b>${x.id === "auto" ? ic("sparkles", "sm") + " " : ""}${esc(x.name)}</b><span>${x.id === "auto" ? esc(p.grade_auto.name) + " now" : esc(x.desc)}</span></div>`).join("")}</div>
    <div class="row" style="margin-top:14px">
      ${gradeSlider("strength", "Grade strength", g.strength ?? 0.8)}${gradeSlider("grain", "Film grain", g.grain || 0)}${gradeSlider("vignette", "Vignette", g.vignette || 0)}
      <div><label style="margin-top:0">Cinema bars</label><select onchange="setGrade({letterbox:this.value})">${CAT.grade.letterbox.map(x => `<option value="${x}" ${String(g.letterbox || "none") === x ? "selected" : ""}>${x === "none" ? "None (16:9)" : x + ":1"}</option>`).join("")}</select></div>
    </div>
    <details class="adv" style="margin-top:14px" ${p.style_ref || (g.lut === "reference") ? "open" : ""}><summary>${ic("layers", "sm")} Advanced: reference picture</summary>
      <div class="hint" style="margin:8px 0 10px">Drop a trailer or a picture. Use a frame as the style image (new pictures copy its look), or match its colours. Only for look and colour, never copy a film's scenes.</div>
      <div class="actions"><label class="upl"><input type="file" accept="video/*,image/*" onchange="uploadRefVideo(this)"><span class="btn primary sm">${ic("upload", "sm")} Add video or picture</span></label></div>
      <div class="frames" id="refFrames" style="margin-top:12px"></div>
      <label>Style image <span class="hint">optional</span></label>
      <div class="actions">
        <div class="slot ${p.style_ref ? "set" : ""}" onclick="pickStyleRef()">${p.style_ref ? (p.style_ref_url ? `<img src="${p.style_ref_url}">` : `<span class="ph">${ic("alert", "sm")}</span>`) + `<span><b>style</b> · ${esc(p.style_ref_label)}</span>` : `<span class="ph">${ic("plus", "sm")}</span><span>choose from scenes</span>`}</div>
        <label class="upl"><input type="file" accept="image/*" onchange="uploadStyle(this)"><span class="btn sm">${ic("upload", "sm")} Upload</span></label>
        ${p.style_ref ? `<button class="btn sm danger" onclick="setStyleRef('')">${ic("x", "sm")} Remove</button>` : ""}
      </div>
    </details>
  </div>`;
  $$("#tabBody input[type=range]").forEach(fill);
  gradeThumbs();
  if (!GPREV && (p.look_sample || {}).style === p.style_id) gradePreview(true);
  try { REFS = await api(`/api/projects/${CUR.id}/refs`); } catch (e) { REFS = []; }
  paintRefs();
}
let LSAMPLE = null;
function lookSampleHtml() {
  const s = LSAMPLE;
  if (!s || s.state === "idle") return "";
  if (s.state === "running") return `<div class="lsample run"><span class="eq"><i></i><i></i><i></i><i></i></span><div><b>${esc(s.message || "Painting a sample")}</b><span>${CUR.cloud_mode ? "Cloud picture, a few seconds" : "On your GPU, about 20 to 60 seconds (longer the first time ComfyUI starts)"}</span></div></div>`;
  if (s.state === "error") return `<div class="lsample err">${ic("alert", "sm")} <div><b>Could not paint the sample</b><span>${esc(s.message || "")}</span></div><button class="btn sm" onclick="lookSample()">Try again</button></div>`;
  return "";
}
async function lookSample() {
  try { LSAMPLE = await api(`/api/projects/${CUR.id}/look/sample`, {method: "POST", body: {style: CUR.style_id}}); } catch (e) { LSAMPLE = {state: "error", message: e.message}; }
  const box = $("#lookSample"); if (box) box.innerHTML = lookSampleHtml();
  clearTimeout(LOOK_POLL); lookPoll();
}
async function lookPoll() {
  if (!CUR) return;
  try { LSAMPLE = await api(`/api/projects/${CUR.id}/look/sample`); } catch (e) { return; }
  const box = $("#lookSample");
  if (LSAMPLE.state === "running") { if (box) box.innerHTML = lookSampleHtml(); LOOK_POLL = setTimeout(lookPoll, 2000); return; }
  if (LSAMPLE.state === "done") {
    CUR = await api(`/api/projects/${CUR.id}`); LSAMPLE = null;
    if (VIEW === "project" && TAB === "look") { await gradePreview(true); gradeThumbs(); }
    return;
  }
  if (box) box.innerHTML = lookSampleHtml();
}
async function gradeThumbs() {
  try {
    const t = await api(`/api/projects/${CUR.id}/grade/thumbs`);
    $$(".gcard").forEach(el => { const u = t[el.dataset.g]; el.querySelector(".gth").innerHTML = u ? `<img src="${u}" alt="">` : `<span class="ph">${ic("image", "sm")} your frame</span>`; });
  } catch (e) { /* thumbnails are optional */ }
}
function gradeSlider(k, label, v) {
  return `<div><label style="margin-top:0">${label} <b id="gv_${k}">${Math.round(v * 100)}%</b></label><input type="range" min="0" max="1" step="0.05" value="${v}" oninput="fill(this);$('#gv_${k}').textContent=Math.round(this.value*100)+'%'" onchange="setGrade({${k}:parseFloat(this.value)})"></div>`;
}
function gradePrevHtml(r) { return `<div class="ba"><figure><img src="${r.before}"><figcaption>Before</figcaption></figure><figure><img src="${r.url}"><figcaption>After</figcaption></figure></div>`; }
async function setGrade(ch) {
  try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {grade: ch}}); if (GPREV) await gradePreview(true); else renderLook(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function gradePreview(quiet) {
  try { GPREV = await api(`/api/projects/${CUR.id}/grade/preview`, {method: "POST", body: {}}); renderLook(); }
  catch (e) { if (quiet !== true) toast(esc(e.message)); renderLook(); }
}
async function setDefCam(k, v) { const cam = {...(CUR.camera || {}), [k]: v}; try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {camera: cam}}); renderLook(); } catch (e) { toast(esc(e.message)); } }
async function sStyle(id) {
  const s = CAT.styles.find(x => x.id === id); if (!s || id === CUR.style_id) return;
  CUR.style_id = id; $("#s_style").value = s.prefix; $("#stylesProj").innerHTML = lookGallery(id);
  try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {style_id: id, style_prefix: s.prefix}}); } catch (e) { toast(esc(e.message)); return; }
  GPREV = null; const gp = $("#gradePrev"); if (gp) gp.innerHTML = "";
  toast(`Style: ${esc(s.name)}. Painting a sample picture…`);
  lookSample();
}
function saveLook() { patch({style_prefix: $("#s_style").value, style_id: CUR.style_id || "", lock_seed: $("#s_lock").checked, body_check: $("#s_body").checked}); }
function paintRefs() {
  const box = $("#refFrames"); if (!box) return;
  const g = CUR.grade || {};
  box.innerHTML = REFS.length ? REFS.map(f => `<div class="frame ${CUR.style_ref === "ref:" + f.name || g.reference_frame === f.name ? "on" : ""}"><img src="${f.url}" loading="lazy">
      <div class="acts"><button class="btn sm" onclick="refAsStyle('${f.name}')">Style image</button><button class="btn sm" onclick="refAsLut('${f.name}')">Match colours</button><button class="btn sm danger icon" onclick="delRef('${f.name}')">${ic("x", "sm")}</button></div></div>`).join("")
    : `<div class="hint">No frames yet.</div>`;
}
async function uploadRefVideo(input) {
  const f = input.files[0]; if (!f) return;
  const fd = new FormData(); fd.append("file", f);
  toast("Reading frames…", 9000);
  try { const r = await api(`/api/projects/${CUR.id}/refs/video`, {method: "POST", body: fd}); REFS = r.frames; paintRefs(); toast(`${r.added} frame(s) added`); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function delRef(n) { REFS = await api(`/api/projects/${CUR.id}/refs/${encodeURIComponent(n)}`, {method: "DELETE"}); paintRefs(); }
async function refAsStyle(n) { await patch({style_ref: "ref:" + n}, "Frame set as style image: new images copy its look."); }
async function refAsLut(n) {
  try { CUR = await api(`/api/projects/${CUR.id}/grade/reference`, {method: "POST", body: {frame: n}}); toast("Colour grade made from this frame"); await gradePreview(true); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function pickStyleRef() {
  const scenes = CUR.scenes.filter(s => s.image);
  if (!scenes.length) { toast("No scene images yet. Make a few images first, or Upload a style image."); return; }
  openPicker("Style image: every new image copies this art style", [
    {title: "Scene images", items: scenes.map(s => ({key: `scene:${s.id}`, label: s.id, sub: s.text.slice(0, 40), url: `/files/${CUR.id}/${s.image}?v=${s.image_v || 0}`}))}
  ], CUR.style_ref, async key => setStyleRef(key || ""), true);
}
async function setStyleRef(key) { await patch({style_ref: key}, key ? "Style image set. Regenerate a few scenes to check it." : "Style image removed"); }
async function uploadStyle(input) {
  const f = input.files[0]; if (!f) return;
  const fd = new FormData(); fd.append("file", f);
  try { CUR = await api(`/api/projects/${CUR.id}/style/image`, {method: "POST", body: fd}); renderProject(); toast("Style image set"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}

/* ---------------- Cast: character studio ---------------- */
let CK = null, CIM = null, CK_PROV = null, CK_Q = "";
function renderCast(noLoad) {
  const p = CUR, cast = p.cast || [], where = (CK && CK.pid === p.id) ? CK.where : (p.cast_where || (p.cloud_mode ? "cloud" : "local"));
  const todo = cast.filter(c => (c.desc || c.photo) && !c.sheet).length;
  $("#tabBody").innerHTML = `
  <div class="card"><div class="sec-t"><span class="n">${ic("user")}</span><div><h3>Character Studio</h3><small>Same face in every scene: a look or a photo, then a character sheet. Every character gets its own voice.</small></div>
    <div class="grow"></div><button class="btn sm" onclick="openLibrary()">${ic("layers", "sm")} From my library</button><button class="btn sm primary" onclick="addCast()">${ic("plus", "sm")} New character</button></div>
    <div class="where ck-where" id="ckWhere">${castWhere(where)}</div>
    ${cast.length ? `<div class="ck-bar"><span>${cast.length} character${cast.length === 1 ? "" : "s"}${todo ? ` · ${todo} without a sheet` : ""}</span><div class="grow"></div>
      ${todo ? `<button class="btn sm primary" onclick="genAllCast()">${ic("layers", "sm")} Make all sheets (${todo})</button>` : ""}</div>` : ""}
    ${p.dialogue_voices === false && cast.length ? `<div class="infoline">${ic("info", "sm")} Dialogue is set to <b>One storyteller</b>, so the narrator reads every line. <a href="#" onclick="setDialogue(true).then(()=>renderCast());return false">Use character voices</a></div>` : ""}
    ${cast.map(c => castCard(p, c)).join("") || `<div class="empty">No characters yet. Write <code>[CAST: Leo = a 10 year old boy…]</code> in the script, or press New character.</div>`}
    <div class="hint" style="margin-top:10px">Write <code>@Leo</code> in image prompts to use a character, and <code>@Leo: line</code> in the script to give Leo his own voice.</div>
  </div>`;
  if (!noLoad) ckLoad();
  if (where === "cloud" && !CIM) ckLoadModels();
}
function castWhere(where) {
  const pro = !CK || CK.pro !== false;
  return orderWhere(`<button class="wh ${where !== "cloud" ? "on" : ""}" onclick="ckWhere('local')"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>On my PC</b>
      <span>Free. Sheets on your GPU with ComfyUI, voices from Kokoro, Edge and your natural voices.</span><small>Costs nothing, only time</small></div></button>
    <button class="wh ${where === "cloud" ? "on" : ""} ${pro ? "" : "nopro"}" onclick="ckWhere('cloud')"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>Cloud <span class="pro-badge">${ic(pro ? "crown" : "lock")}<i>PRO</i></span></b>
      <span>Sheets from the model you pick on your own key (OpenRouter, Google, OpenAI, Higgsfield), studio voices for every character.</span><small>About $0.01 to $0.13 per picture, 8 pictures per sheet</small></div></button>`);
}
async function ckLoad() {
  const pid = CUR.id;
  try {
    const r = await api(`/api/projects/${pid}/cast/kit`);
    if (!CUR || CUR.id !== pid || TAB !== "cast") return;
    const first = !CK || CK.pid !== pid || CK.where !== r.where;
    CK = {...r, pid}; delete CK.project; CUR = r.project;
    if (first) renderCast(true); else ckPaintVoices();
  } catch (e) { toast("Cast: " + esc(e.message)); }
}
function ckPaintVoices() { (CUR.cast || []).forEach(c => { const el = $("#cvx_" + c.id); if (el) el.innerHTML = castVoice(c); }); vaPaint(); }
async function ckWhere(w) {
  if (w === "cloud" && !proOn()) { needPro("Cloud characters"); return; }
  if (CK && CK.where === w) return;
  vaStop();
  try { const r = await api(`/api/projects/${CUR.id}/cast/kit`, {method: "POST", body: {where: w}}); CK = {...r, pid: CUR.id}; delete CK.project; CUR = r.project; renderCast(true);
    toast(w === "cloud" ? "Cloud: pick the model for character sheets. Voices now come from your cloud voices." : "On my PC: sheets on ComfyUI, free voices.", 6000); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function ckLoadModels(force) {
  if (CIM && !force) return;
  try { CIM = await api("/api/cast/image-models"); } catch (e) { CIM = {providers: [], chosen: "", error: e.message}; }
  (CUR.cast || []).forEach(c => { const el = $("#cmx_" + c.id); if (el) el.innerHTML = castModel(c); });
  (CUR.places || []).forEach(x => { const el = $("#cmx_" + x.id); if (el) el.innerHTML = castModel(x, "place"); });
  if ($("#plWhere")) $("#plWhere").innerHTML = placeWhere();
}
function placeWhereOf(p) { const w = p.place_where || (p.cloud_mode ? "cloud" : "local"); return w === "cloud" && !(CIM && CIM.pro === false) ? "cloud" : "local"; }
function placeWhere() {
  const where = placeWhereOf(CUR), pro = !CIM || CIM.pro !== false;
  return orderWhere(`<button class="wh ${where !== "cloud" ? "on" : ""}" onclick="plWhere('local')"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>On my PC</b>
      <span>Free. Scene sheets on your GPU with ComfyUI.</span><small>Costs nothing, only time</small></div></button>
    <button class="wh ${where === "cloud" ? "on" : ""} ${pro ? "" : "nopro"}" onclick="plWhere('cloud')"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>Cloud <span class="pro-badge">${ic(pro ? "crown" : "lock")}<i>PRO</i></span></b>
      <span>Scene sheets from the model you pick on your own key (OpenRouter, Google, OpenAI, Higgsfield). Fast on any PC.</span><small>2 to 3 pictures per place, about $0.02 to $0.45 a sheet</small></div></button>`);
}
async function plWhere(w) {
  if (w === "cloud" && !proOn()) { needPro("Cloud scene sheets"); return; }
  if (placeWhereOf(CUR) === w) return;
  try { CUR = await api(`/api/projects/${CUR.id}/places/where`, {method: "POST", body: {where: w}}); renderPlaces();
    toast(w === "cloud" ? "Cloud: pick the model for each place's sheet." : "On my PC: scene sheets on ComfyUI.", 5000); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function ckAllModels() { return (CIM && CIM.providers || []).flatMap(p => p.models.map(m => ({...m, prov: p.label, pid: p.id}))); }
function ckModelOf(c) {
  const id = c.sheet_model || (CK && CK.model) || (CIM && CIM.model) || (CIM && CIM.chosen) || "";
  return ckAllModels().find(m => m.id === id) || null;
}
function sheetN(c, kind) { return kind === "place" ? (c.inside !== false ? 3 : 2) : 8; }
function castModel(c, kind) {
  const where = kind === "place" ? placeWhereOf(CUR) : (CK && CK.pid === CUR.id) ? CK.where : "local";
  if (where !== "cloud") return `<div class="cmbox local"><div class="cm-ic">${ic("monitor")}</div><div class="cm-t"><small>${kind === "place" ? "Scene sheet" : "Character sheet"}</small><b>On my PC · ComfyUI</b><span>Free, uses your GPU</span></div></div>`;
  if (!CIM) return `<div class="cmbox"><div class="cm-ic cloud">${ic("cloud")}</div><div class="cm-t"><small>Sheet model</small><b><span class="eq"><i></i><i></i><i></i></span> Loading your models…</b></div></div>`;
  const m = ckModelOf(c);
  return `<button class="cmbox cloud" onclick="ckModelPicker('${c.id}', '${kind || "cast"}')"><div class="cm-ic cloud">${ic("cloud")}</div>
    <div class="cm-t"><small>Sheet model ${c.sheet_model ? "" : "· default"}</small>${m ? `<b>${esc(m.name)}</b><span>${esc(m.prov)}</span><span><i>$${m.price.toFixed(3)}</i>/picture · ~$${(m.price * sheetN(c, kind)).toFixed(2)}/sheet</span>` : `<b class="warn">Pick a model</b><span>Connect a key on the Pro page first</span>`}</div>
    <span class="cm-chg">Change ${ic("chevrons", "sm")}</span></button>`;
}
/* model picker popup: every connected account highlighted, its models with the price per picture */
const CMP = {cid: null, q: "", kind: "cast"};
function cmpItem() { return ((CMP.kind === "place" ? CUR.places : CUR.cast) || []).find(x => x.id === CMP.cid); }
function ckModelPicker(cid, kind) {
  CMP.cid = cid; CMP.q = ""; CMP.kind = kind || "cast";
  const c = cmpItem(); if (!c) return;
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>Sheet model for ${esc(c.name)}</h2><div class="hint">${CMP.kind === "place" ? `${sheetN(c, "place")} pictures per scene sheet` : "8 pictures per sheet"}. The price is per picture, from your own account.</div></div><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <input class="ck-q" id="cmpQ" placeholder="Search models: nano banana, seedream, gpt image…" oninput="CMP.q=this.value;cmpPaint()">
    <div class="cvp-list cmp-list" id="cmpList"></div>`;
  $("#pickModal").classList.add("show"); cmpPaint(); setTimeout(() => $("#cmpQ") && $("#cmpQ").focus(), 50);
}
function cmpPaint() {
  const c = cmpItem() || {}, cur = (ckModelOf(c) || {}).id, q = CMP.q.toLowerCase();
  const provs = (CIM && CIM.providers) || [];
  const on = provs.filter(p => p.connected), off = provs.filter(p => !p.connected);
  const sec = p => {
    const list = p.models.filter(m => !q || (m.name + " " + m.id + " " + (m.note || "")).toLowerCase().includes(q));
    if (q && !list.length) return "";
    return `<div class="cmp-sec"><div class="cmp-h"><span class="cmp-name">${ic("check", "sm")} ${esc(p.label)}</span><small>connected · ${p.models.length} models</small></div>
      ${p.error ? `<div class="warnline">${ic("alert", "sm")} ${esc(p.error)}</div>` : ""}
      ${list.map(m => `<div class="ck-row ${m.id === cur ? "on" : ""}" onclick="cmpUse('${esc(m.id)}')">
        <div class="ck-rt"><b>${esc(m.name)}</b><span>${esc(m.note || "")}</span></div>
        ${m.id === p.best ? `<span class="ck-tag best">Best</span>` : m.id === p.budget ? `<span class="ck-tag">Budget</span>` : "<span></span>"}
        <div class="ck-price"><b>$${m.price.toFixed(3)}</b><small>/picture</small><i>~$${(m.price * sheetN(c, CMP.kind)).toFixed(2)} a sheet</i></div>
        <span class="vrow-use">${m.id === cur ? `${ic("check", "sm")} Selected` : "Use"}</span></div>`).join("")}</div>`;
  };
  $("#cmpList").innerHTML = (on.map(sec).join("") || `<div class="hint" style="padding:14px">${on.length ? "No model matches." : "No image key connected yet."}</div>`)
    + (off.length ? `<div class="cmp-off">${off.map(p => `<button class="btn sm ghost" onclick="closeModal('pickModal');showPro()">${ic("plus", "sm")} Connect ${esc(p.label)}</button>`).join("")}</div>` : "");
}
async function cmpUse(id) {
  closeModal("pickModal");
  const place = CMP.kind === "place";
  try { CUR = await api(`/api/projects/${CUR.id}/${place ? "places" : "cast"}/${CMP.cid}`, {method: "PATCH", body: {sheet_model: id}});
    const c = cmpItem(); $("#cmx_" + c.id).innerHTML = castModel(c, CMP.kind); savedTick((place ? "ps_" : "cs_") + c.id); toast(`${esc(c.name)}: sheet uses ${esc((ckModelOf(c) || {}).name || id)}`); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function castVoice(c) {
  const sug = (CK && CK.voices && CK.voices[c.id]) || [];
  const cur = c.voice || "", inSug = sug.some(v => v.id === cur);
  const tile = (id, name, sub, tag) => { const k = `cv|${c.id}|${id}`; return `<div class="cvt ${id === cur ? "on" : ""}" data-va="${esc(k)}" onclick="ckVoice('${c.id}','${esc(id)}')">
      <button class="va-btn" onclick="event.stopPropagation();vaToggle('${esc(k)}')">${ic("play", "sm")}${ic("pause", "sm")}<span class="eq"><i></i><i></i><i></i></span></button>
      <div class="cvt-t"><b>${esc(name)}</b><span>${esc(sub)}</span></div>${tag ? `<span class="ck-tag ${tag === "Best match" ? "best" : ""}">${tag}</span>` : ""}
      <canvas class="va-wave" width="70" height="22"></canvas>${id === cur ? `<span class="cvt-on">${ic("check", "sm")}</span>` : ""}</div>`; };
  const ENG = {edge: "Edge · free online", kokoro: "Kokoro · free", turbo: "Natural · free", cbx: "Natural · free", eleven: "ElevenLabs", gemini: "Google Gemini", openai: "OpenAI"};
  const short = v => ENG[v.engine] || (v.group || "").replace(/^PRO · /, "").replace(/ \(.*$/, "");
  return `<label>Voice ${sug[0] && sug[0].fit ? `<span class="hint">suggested for a ${esc(sug[0].fit)} voice</span>` : ""}${c.voice_auto ? `<span class="ck-auto">${ic("sparkles", "sm")} picked for you</span>` : ""}</label>
    <div class="cvts">${sug.map((v, i) => tile(v.id, v.label.replace(/ \(.*\)$/, ""), short(v), i === 0 ? "Best match" : "")).join("")}
      ${cur && !inSug ? tile(cur, voiceName(cur).replace(/ · .*$/, "").replace(/ \(.*\)$/, ""), "your pick", "") : ""}
      ${!sug.length ? `<div class="hint"><span class="eq"><i></i><i></i><i></i></span> Finding voices…</div>` : ""}</div>
    <div class="cvt-more"><button class="btn sm" onclick="ckVoicePicker('${c.id}')">${ic("search", "sm")} More voices</button><small>Not happy? Pick any other voice, listen first.</small></div>`;
}
/* voice picker popup for one character: search, filter by engine, listen, use */
const CVP = {cid: null, q: "", eng: "all"};
const CVP_ENG = [["all", "All"], ["turbo", "Natural"], ["edge", "Edge"], ["kokoro", "Kokoro"], ["eleven", "ElevenLabs"], ["gemini", "Gemini"], ["openai", "OpenAI"]];
function ckVoicePicker(cid) {
  const c = CUR.cast.find(x => x.id === cid); if (!c) return;
  CVP.cid = cid; CVP.q = "";
  CVP.eng = (CK && CK.where === "cloud") ? (["eleven", "gemini", "openai"].find(e => VOICES.some(v => v.engine === e)) || "all") : "all";
  const has = new Set(VOICES.map(v => v.engine));
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>Voice for ${esc(c.name)}</h2><div class="hint">${esc((c.desc || "").slice(0, 90))}</div></div><button class="btn icon" onclick="vaStop();closeModal('pickModal')">${ic("x")}</button></div>
    <input class="ck-q" id="cvpQ" placeholder="Search voices: name, accent, male, female…" oninput="CVP.q=this.value;cvpPaint()">
    <div class="cvp-tabs">${CVP_ENG.filter(([e]) => e === "all" || has.has(e)).map(([e, n]) => `<button data-e="${e}" class="${e === CVP.eng ? "on" : ""}" onclick="CVP.eng='${e}';cvpPaint()">${n}<small>${e === "all" ? VOICES.length : VOICES.filter(v => v.engine === e).length}</small></button>`).join("")}</div>
    <div class="cvp-list" id="cvpList"></div>`;
  $("#pickModal").classList.add("show"); cvpPaint(); setTimeout(() => $("#cvpQ") && $("#cvpQ").focus(), 50);
}
function cvpPaint() {
  const c = CUR.cast.find(x => x.id === CVP.cid) || {}, cur = c.voice || "", q = CVP.q.toLowerCase();
  document.querySelectorAll(".cvp-tabs button").forEach(b => b.classList.toggle("on", b.dataset.e === CVP.eng));
  const sug = new Set(((CK && CK.voices && CK.voices[c.id]) || []).map(v => v.id));
  const list = VOICES.filter(v => (CVP.eng === "all" || v.engine === CVP.eng || (CVP.eng === "turbo" && v.engine === "cbx"))
    && (!q || (v.label + " " + v.group).toLowerCase().includes(q)))
    .map((v, i) => [v, (sug.has(v.id) ? 0 : 1) + (v.available === false ? 2 : 0), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
  const row = v => { const k = `cv|${c.id}|${v.id}`, off = v.available === false; return `<div class="vrow ${v.id === cur ? "on" : ""} ${off ? "off" : ""}" data-va="${esc(k)}" onclick="${off ? "" : `cvpUse('${esc(v.id)}')`}">
      <button class="va-btn" ${off ? "disabled" : ""} onclick="event.stopPropagation();vaToggle('${esc(k)}')">${ic("play", "sm")}${ic("pause", "sm")}<span class="eq"><i></i><i></i><i></i></span></button>
      <div class="vrow-t"><b>${esc(v.label)}${sug.has(v.id) ? ` <span class="ck-tag best">Suggested</span>` : ""}</b><span>${esc(v.group.replace(/^PRO · /, ""))}</span></div>
      <canvas class="va-wave" width="140" height="30"></canvas>
      <button class="va-stop" title="Stop" onclick="event.stopPropagation();vaStop()">${ic("stop", "sm")}</button>
      <span class="vrow-use">${v.id === cur ? `${ic("check", "sm")} Selected` : off ? "Not installed" : "Use"}</span></div>`; };
  const narr = `<div class="vrow ${!cur ? "on" : ""}" onclick="cvpUse('')"><span class="va-btn" style="opacity:.5">${ic("mic", "sm")}</span><div class="vrow-t"><b>Narrator voice</b><span>${esc(c.name || "")} speaks with the storyteller's voice</span></div><span></span><span></span><span class="vrow-use">${!cur ? `${ic("check", "sm")} Selected` : "Use"}</span></div>`;
  $("#cvpList").innerHTML = (CVP.eng === "all" && !q ? narr : "") + (list.map(row).join("") || `<div class="hint" style="padding:14px">No voice matches.</div>`);
  vaPaint();
}
async function cvpUse(id) { vaStop(); closeModal("pickModal"); await ckVoice(CVP.cid, id); }
async function ckVoice(cid, v) {
  try { CUR = await api(`/api/projects/${CUR.id}/cast/${cid}`, {method: "PATCH", body: {voice: v}}); const c = CUR.cast.find(x => x.id === cid);
    if (CK && CK.labels) CK.labels[cid] = v ? voiceName(v) : "Narrator voice"; $("#cvx_" + cid).innerHTML = castVoice(c); vaPaint(); savedTick("cs_" + cid); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function castCard(p, c) {
  const url = f => `/files/${p.id}/character/${f}?v=${c.v || 0}`;
  const views = c.views || {};
  return `<div class="cast-card ck-card" id="cast_${c.id}">
    <div class="ck-pic">${c.file ? `<img class="pic" src="${url(c.file)}" onclick="viewImage(this.src,'${esc(c.name)}')">` : `<div class="none">${ic("user", "lg")}<span>No picture yet</span><small>Make a sheet or upload a photo</small></div>`}
      <div class="actions" style="margin-top:8px">
        <label class="upl"><input type="file" accept="image/*" onchange="uploadCastPhoto('${c.id}',this)"><span class="btn sm">${ic("upload", "sm")} Photo</span></label>
        <button class="btn sm" onclick="castFromScene('${c.id}')">${ic("image", "sm")} From scene</button>
      </div>
      ${c.photo ? `<div class="hint" style="margin-top:6px">Photo added. The sheet copies this face.</div>` : ""}
    </div>
    <div>
      <div class="ck-top"><div class="ck-name"><input id="cn_${c.id}" value="${esc(c.name)}" oninput="castDirty('${c.id}')"><span class="hint">@${esc((c.name || "").split(" ")[0])}</span></div>
        <div class="grow"></div><span class="saved" id="cs_${c.id}">${ic("check", "sm")} Saved</span>
        <button class="btn sm danger icon" onclick="deleteCast('${c.id}')" title="Delete">${ic("trash", "sm")}</button></div>
      ${!(c.desc || "").trim() && !c.photo ? `<div class="warnline">${ic("alert", "sm")} No look yet. Without it ${esc(c.name)} can look different in every scene. Write one line below.</div>` : ""}
      <label>Look <span class="hint">starts with the role: "a 10 year old boy…", then hair, clothes</span></label>
      <textarea id="cd_${c.id}" rows="2" oninput="castDirty('${c.id}')" placeholder="a 10 year old boy, short messy black hair, yellow hoodie, dark blue shorts">${esc(c.desc || "")}</textarea>
      <div class="ck-mid"><div class="ck-voice" id="cvx_${c.id}">${castVoice(c)}</div><div class="ck-model" id="cmx_${c.id}">${castModel(c)}</div></div>
      <details class="adv"><summary>Face geometry <span class="hint">optional, keeps the face exact</span></summary>
        <div style="margin-top:8px"><button class="btn sm ghost" onclick="describeFace('${c.id}',this)" ${c.photo || c.file ? "" : "disabled"}>${ic("sparkles", "sm")} Describe from photo (AI)</button></div>
        <textarea id="cf_${c.id}" rows="2" oninput="castDirty('${c.id}')" placeholder="oval face, high cheekbones, thick dark eyebrows, almond brown eyes, straight nose...">${esc(c.face || "")}</textarea></details>
      <div class="actions" style="margin-top:12px">
        <button class="btn sm primary" onclick="makeSheet('${c.id}')">${ic("layers", "sm")} ${c.sheet ? "Make sheet again" : "Make character sheet"} (8 views)</button>
        <button class="btn sm" onclick="genCast('${c.id}')">${ic("sparkles", "sm")} 4 quick options</button>
        <select style="width:auto;padding:6px 10px" onchange="addStage('${c.id}',this.value);this.selectedIndex=0"><option value="">+ Life stage…</option>${Object.keys(CAT.stages).map(k => `<option value="${k}">${k}</option>`).join("")}</select>
        <button class="btn sm ghost" onclick="toLibrary('${c.id}')">${ic("download", "sm")} Save to library</button>
      </div>
      ${Object.keys(views).length ? `<label>Reference used in scenes</label><div class="chips">${CAT.views.filter(v => views[v.id]).map(v => `<button class="${(c.ref_view || "front") === v.id ? "on" : ""}" onclick="setRefView('${c.id}','${v.id}')">${esc(v.label)}</button>`).join("")}</div>` : ""}
      ${c.sheet ? `<div class="sheet-wrap"><img class="sheet-img" src="${url(c.sheet)}" onclick="viewImage(this.src,'${esc(c.name)} · character sheet')" title="Click to see it big"><span class="hint">Click to see it big</span></div>` : ""}
      ${(c.candidates || []).length ? `<div class="cands">${c.candidates.map(n => `<img src="/files/${p.id}/character/${n}" title="Use this one" onclick="chooseCast('${c.id}','${n}')">`).join("")}</div>` : ""}
    </div></div>`;
}
function viewImage(src, title) {
  $("#pickBody").innerHTML = `<div class="mhead"><h2>${title || ""}</h2><div class="actions"><a class="btn sm" href="${src}" download>${ic("download", "sm")} Save</a><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div></div>
    <img src="${src}" style="width:100%;border-radius:14px;margin-top:12px;display:block">`;
  $("#pickModal").classList.add("show");
}
async function saveCast(cid, quiet) {
  if (!$("#cn_" + cid)) return;
  clearTimeout((CAST_DIRTY[cid] || {}).t); delete CAST_DIRTY[cid];
  const before = ((CUR.cast || []).find(x => x.id === cid) || {}).desc || "";
  CUR = await api(`/api/projects/${CUR.id}/cast/${cid}`, {method: "PATCH", body: {name: $("#cn_" + cid).value, desc: $("#cd_" + cid).value, face: $("#cf_" + cid).value}});
  savedTick("cs_" + cid);
  if (!quiet) renderCast(); else if (before !== $("#cd_" + cid).value) ckLoad();  // a new look: new voice suggestions
}
/* Cast saves by itself: every change is stored a moment after you stop typing */
const CAST_DIRTY = {};
function castDirty(cid, wait = 900) {
  const d = CAST_DIRTY[cid] || (CAST_DIRTY[cid] = {});
  clearTimeout(d.t); d.t = setTimeout(() => saveCast(cid, true).catch(e => toast("Error: " + esc(e.message))), wait);
}
async function flushCast() { for (const cid of Object.keys(CAST_DIRTY)) { try { await saveCast(cid, true); } catch (e) {} } }
function castPlay(cid, btn) {
  const v = $("#cv_" + cid).value || CUR.voice;
  playPreview({voice: v, speed: CUR.speed, fx: "none", clean: true, text: "This is my voice. I will say my own lines in the story."}, btn);
}
async function makeSheet(cid) {
  try { await saveCast(cid, true); await api(`/api/projects/${CUR.id}/run/sheet`, {method: "POST", body: {cast_id: cid}}); toast("Making the character sheet (8 views)…"); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function describeFace(cid, btn) {
  btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Looking at the photo…`;
  try { CUR = await api(`/api/projects/${CUR.id}/cast/${cid}/describe`, {method: "POST"}); renderCast(); toast("Face described"); }
  catch (e) { toast(esc(e.message), 9000); btn.disabled = false; btn.innerHTML = "Describe from photo (AI)"; }
}
async function uploadCastPhoto(cid, input) {
  const f = input.files[0]; if (!f) return;
  const fd = new FormData(); fd.append("file", f);
  try { CUR = await api(`/api/projects/${CUR.id}/cast/${cid}/photo`, {method: "POST", body: fd}); renderCast(); toast("Photo added. Now make the character sheet."); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function setRefView(cid, v) { CUR = await api(`/api/projects/${CUR.id}/cast/${cid}`, {method: "PATCH", body: {ref_view: v}}); renderCast(); }
async function addStage(cid, stage) { if (!stage) return; CUR = await api(`/api/projects/${CUR.id}/cast/${cid}/stage`, {method: "POST", body: {stage}}); renderCast(); toast(`Life stage added: ${stage}. Make its sheet.`); }
async function toLibrary(cid) { try { await saveCast(cid, true); await api(`/api/projects/${CUR.id}/cast/${cid}/library`, {method: "POST"}); toast("Saved to your character library. Use it in any project."); } catch (e) { toast("Error: " + esc(e.message)); } }
async function openLibrary() {
  const lib = await api("/api/library/characters");
  $("#pickBody").innerHTML = `<div class="mhead"><h2>Character library</h2><button class="btn sm" onclick="closeModal('pickModal')">Close</button></div>
    ${lib.length ? `<div class="lib" style="margin-top:12px">${lib.map(c => `<div class="it" onclick="fromLibrary('${c.lib_id}')">${c.thumb ? `<img src="${c.thumb}">` : `<div style="aspect-ratio:1;display:grid;place-items:center">${ic("user", "lg")}</div>`}<div>${esc(c.name)}</div></div>`).join("")}</div>`
      : `<div class="empty">Your library is empty. Use "Save to library" on a character.</div>`}`;
  $("#pickModal").classList.add("show");
}
async function fromLibrary(id) { CUR = await api(`/api/projects/${CUR.id}/cast/from-library`, {method: "POST", body: {lib_id: id}}); closeModal("pickModal"); renderCast(); toast("Character added from your library"); }
async function genAllCast() {
  const todo = CUR.cast.filter(c => !c.file && c.desc);
  for (const c of todo) { if ($("#cd_" + c.id)) await saveCast(c.id, true); }
  for (const c of todo) {
    await api(`/api/projects/${CUR.id}/run/sheet`, {method: "POST", body: {cast_id: c.id}}).catch(() => {});
    while (true) { await new Promise(r => setTimeout(r, 1500)); const p = await api(`/api/projects/${CUR.id}`); if (!["running", "queued"].includes(p.status.state)) { CUR = p; break; } }
  }
  renderProject();
}
async function addCast() {
  try { CUR = await api(`/api/projects/${CUR.id}/cast`, {method: "POST", body: {name: `Character ${(CUR.cast || []).length + 1}`}}); renderCast(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function deleteCast(cid) {
  if (!await confirmBox("Delete this character?", "Scenes that use it lose that reference.", "Delete", true)) return;
  CUR = await api(`/api/projects/${CUR.id}/cast/${cid}`, {method: "DELETE"}); renderCast();
}
async function genCast(cid) {
  try { await saveCast(cid, true); await api(`/api/projects/${CUR.id}/run/character`, {method: "POST", body: {cast_id: cid}}); toast("Generating 4 options…"); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function chooseCast(cid, name) {
  try { CUR = await api(`/api/projects/${CUR.id}/cast/${cid}/choose`, {method: "POST", body: {name}}); renderCast(); toast("Character image set"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function castFromScene(cid) {
  const scenes = CUR.scenes.filter(s => s.image);
  if (!scenes.length) { toast("No scene images yet"); return; }
  openPicker(`Use a scene image as this character`, [
    {title: "Scene images", items: scenes.map(s => ({key: s.id, label: s.id, sub: s.text.slice(0, 40), url: `/files/${CUR.id}/${s.image}?v=${s.image_v || 0}`}))}
  ], null, async key => {
    CUR = await api(`/api/projects/${CUR.id}/cast/${cid}/choose`, {method: "POST", body: {scene: key}}); renderCast(); toast("Character image set from " + key);
  }, false);
}

/* ---------------- Places: scene sheets ---------------- */
function renderPlaces() {
  const p = CUR, places = p.places || [];
  const loose = p.scenes.filter(s => !s.place).length;
  $("#tabBody").innerHTML = `
  <div class="card"><div class="sec-t"><span class="n">${ic("map")}</span><div><h3>Places <span class="muted" style="font-weight:600">· scene sheets</span></h3><small>Like character sheets, but for rooms and streets. Every scene in the same place uses its sheet, so the room keeps the same walls, furniture and light.</small></div>
    <div class="grow"></div><button class="btn sm" onclick="findPlaces()">${ic("sparkles", "sm")} Find places in my story</button><button class="btn sm primary" onclick="addPlace()">${ic("plus", "sm")} New place</button></div>
    <div class="infoline">${ic("info", "sm")} A scene without a place word stays where the scene before it was. Change any scene's place on the Storyboard. ${loose ? `${loose} scene(s) have no fixed place.` : ""}</div>
    <div class="where ck-where" id="plWhere">${placeWhere()}</div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" ${p.place_sheets !== false ? "checked" : ""} onchange="patch({place_sheets:this.checked},false)"> Build everything makes a sheet for every place used by 2 or more scenes</label>
    ${places.map(x => placeCard(p, x)).join("") || `<div class="empty">No places yet. Press <b>Find places in my story</b>, or add one.</div>`}
  </div>`;
  if (!CIM) ckLoadModels();
}
function placeCard(p, x) {
  return `<div class="place-card" id="pl_${x.id}">
    <div class="pl-img">${x.sheet_url || x.url ? `<img src="${x.sheet_url || x.url}" onclick="viewImage(this.src,'${esc(x.name)} · scene sheet')" title="Click to see it big">` : `<div class="none">${ic("map", "lg")}<span>No sheet yet</span></div>`}
      <div class="actions" style="margin-top:8px"><button class="btn sm primary" onclick="makePlaceSheet('${x.id}')">${ic("layers", "sm")} ${x.url ? "Make again" : "Make scene sheet"}</button>
        <label class="upl" title="Use your own picture of this place"><input type="file" accept="image/*" onchange="uploadPlace('${x.id}',this)"><span class="btn sm">${ic("upload", "sm")} Picture</span></label></div></div>
    <div>
      <div class="row" style="gap:8px;align-items:flex-end">
        <div style="max-width:240px"><label style="margin-top:0">Name <span class="hint">write @${esc((x.name || "").replace(/\s+/g, ""))} in a prompt to put a scene here</span></label><input id="pn_${x.id}" value="${esc(x.name)}" onchange="savePlace('${x.id}')"></div>
        <div style="max-width:260px"><label style="margin-top:0">This place is</label><span class="seg"><button class="${x.inside !== false ? "on" : ""}" onclick="savePlace('${x.id}',{inside:true})" title="A room: the sheet gets the inside views and the building from outside">${ic("layers", "sm")} Indoor</button><button class="${x.inside === false ? "on" : ""}" onclick="savePlace('${x.id}',{inside:false})" title="A street, field or market: outdoor views only">${ic("map", "sm")} Outdoor</button></span><div class="hint" style="margin-top:6px">${x.inside !== false ? "Indoor: inside views + the outside of the building" : "Outdoor: outdoor views only"}</div></div>
        <div style="display:flex;justify-content:flex-end;gap:6px;align-items:center"><span class="saved" id="ps_${x.id}">${ic("check", "sm")} Saved</span><span class="chip">${x.scenes} scene${x.scenes === 1 ? "" : "s"}</span>
          <button class="btn sm danger icon" onclick="deletePlace('${x.id}')" title="Delete">${ic("trash", "sm")}</button></div>
      </div>
      <div class="ck-mid"><div><label>Look of the place <span class="hint">walls, furniture, colours, light. The same words go into every scene here.</span></label>
      <textarea id="pd_${x.id}" rows="3" onchange="savePlace('${x.id}')" placeholder="a small wooden kitchen, round window, red rug, copper pots on the wall, warm lamp light">${esc(x.desc || "")}</textarea></div>
      <div class="ck-model" id="cmx_${x.id}">${castModel(x, "place")}</div></div>
      <div class="chips" style="margin-top:8px">${CUR.scenes.filter(s => s.place === x.id).slice(0, 18).map(s => `<button onclick="TAB='scenes';renderProject();setTimeout(()=>$('#sc_${s.id}')?.scrollIntoView({behavior:'smooth',block:'center'}),80)">${s.id}</button>`).join("")}</div>
    </div></div>`;
}
async function findPlaces() {
  try { CUR = await api(`/api/projects/${CUR.id}/places/auto`, {method: "POST", body: {}}); renderPlaces(); toast(`${CUR.places.length} place(s) found. Scenes you set by hand are kept.`); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function addPlace() {
  try { CUR = await api(`/api/projects/${CUR.id}/places`, {method: "POST", body: {name: `Place ${(CUR.places || []).length + 1}`}}); renderPlaces(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function savePlace(xid, extra) {
  const body = {name: $("#pn_" + xid).value, desc: $("#pd_" + xid).value, ...(extra || {})};
  try { CUR = await api(`/api/projects/${CUR.id}/places/${xid}`, {method: "PATCH", body}); if (extra) renderPlaces(); else savedTick("ps_" + xid); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function deletePlace(xid) {
  if (!await confirmBox("Delete this place?", "Its scenes keep their pictures but no longer share this sheet.", "Delete", true)) return;
  CUR = await api(`/api/projects/${CUR.id}/places/${xid}`, {method: "DELETE"}); renderPlaces();
}
async function makePlaceSheet(xid) {
  try { await savePlace(xid); await api(`/api/projects/${CUR.id}/run/place_sheet`, {method: "POST", body: {place_id: xid}}); toast("Making the scene sheet…"); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function uploadPlace(xid, input) {
  const f = input.files[0]; if (!f) return;
  const fd = new FormData(); fd.append("file", f);
  try { CUR = await api(`/api/projects/${CUR.id}/places/${xid}/image`, {method: "POST", body: fd}); renderPlaces(); toast("Picture set as this place's sheet"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function placeSelect(s) {
  const pl = CUR.places || [];
  if (!pl.length) return "";
  return `<label class="placesel" title="Where this scene happens">${ic("pin", "sm")}<select onchange="setScenePlace('${s.id}',this.value)">
    <option value="">No fixed place</option>${pl.map(x => `<option value="${x.id}" ${s.place === x.id ? "selected" : ""}>${esc(x.name)}${x.url ? "" : " (sheet on Build)"}</option>`).join("")}</select></label>`;
}
async function setScenePlace(sid, xid) {
  if (Object.keys(dirty).length) await saveScenes(true);
  try { CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes: [{id: sid, place: xid}]}}); renderScenes(); toast(xid ? "Scene moved. Make its image again to see it." : "Scene has no fixed place now"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}

/* ---------------- Music Studio ---------------- */
function sfxCard(p) {
  const f = p.sfx_settings || {enabled: false, volume: 0.7}, plan = p.sfx_plan || [];
  const used = plan.filter(x => x.sounds.length), moods = p.sfx_moods || [];
  const autoName = (moods.find(m => m.id === p.sfx_mood) || {}).name || "";
  const mood = f.mood || "auto", cloud = f.engine === "elevenlabs";
  const c = sfxCost(plan);
  return `<div class="sec-t"><span class="n">${ic("zap")}</span><div><h3>Sound effects</h3><small>Placed by themselves from the story, only sounds that fit the video</small></div>
      <div class="grow"></div><label class="switch big"><input type="checkbox" ${f.enabled ? "checked" : ""} onchange="sfxSet({enabled: this.checked})"><span></span> ${f.enabled ? "On" : "Off"}</label></div>
    ${f.enabled ? `
    <div class="where ck-where sfx-where">${orderWhere(`
      <button class="wh ${!cloud ? "on" : ""}" onclick="sfxSet({engine: 'library'})"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>On my PC</b><span>Free. Real recorded sounds from the built-in library and your own folder.</span><small>Costs nothing</small></div></button>
      <button class="wh ${cloud ? "on" : ""}" onclick="needPro('AI sound effects') || sfxSet({engine: 'elevenlabs'})"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>Cloud ${PTAG}</b><span>ElevenLabs makes a new sound for every scene, written from that scene's words.</span><small>$0.12 per minute of sound · this video ~$${c.usd.toFixed(2)}</small></div></button>
`)}
    </div>
    ${cloud ? sfxCloud(plan, c) : ""}
    <label>Sound mood</label>
    <div class="chips">${[{id: "auto", name: `Auto · ${autoName}`}, ...moods].map(m => `<button class="${mood === m.id ? "on" : ""}" onclick="sfxSet({mood:'${m.id}'})">${esc(m.name)}</button>`).join("")}</div>
    <div class="hint" style="margin-top:6px">Horror gets stings, creaks and a dark drone. Documentary gets clean whooshes, paper and camera sounds. Funny and meme sounds only play in <b>Fun &amp; memes</b>.</div>
    <div class="row" style="align-items:center;gap:14px;margin-top:12px"><label style="flex:1;margin:0">Effects volume <b>${Math.round(f.volume * 100)}%</b><input type="range" min="0" max="1.5" step="0.05" value="${f.volume}" oninput="fill(this)" onchange="sfxSet({volume: +this.value})"></label></div>
    ${cloud ? `<div class="hint" style="margin-top:10px">${ic("info", "sm")} Every AI sound is made once and kept in the project. Building the video again costs nothing. If a sound fails, the library sound is used.</div>` : `
    <label>Library sounds <span class="hint">click to listen</span></label>
    <div class="sfxlib">${(p.sfx_sounds || []).map(x => `<button class="sfxchip ${x.kind}" onclick="playSfx('${x.id}', ${x.count})" title="Listen (${x.count} sound${x.count === 1 ? "" : "s"})">${ic("play", "sm")} ${esc(x.label)}${x.count > 1 ? `<small>${x.count}</small>` : ""}</button>`).join("")}</div>
    <details style="margin-top:10px"><summary class="hint" style="cursor:pointer">${used.length} of ${plan.length} scenes get effects · see which</summary>
      ${used.slice(0, 80).map(x => `<div class="hint" style="margin-top:4px"><b>${x.id}</b> · ${x.sounds.map(esc).join(", ")}</div>`).join("")}</details>
    <details style="margin-top:6px" id="sfxImport"><summary class="hint" style="cursor:pointer">Add your own sound folder</summary>
      <div class="row" style="margin-top:8px;align-items:flex-end"><div><label style="margin-top:0">Folder on this PC</label><input id="sfx_folder" placeholder="E:\\My sounds\\Sound Effects"></div>
        <div style="max-width:200px"><button class="btn primary" onclick="sfxImport()">${ic("download", "sm")} Add sounds</button></div></div>
      <div class="hint" style="margin-top:6px" id="sfxImportMsg">Sounds are copied into your LECCORTUBE library on this PC and sorted by kind (whoosh, riser, impact, clicks, money, glitch, funny). Only use sounds you are allowed to use on YouTube.</div></details>`}` : `<div class="hint">Turn on to add whooshes, rain, horror stings and more where the story needs them.</div>`}`;
}
/* ElevenLabs bills $0.12 per minute of sound: a hit is 2.5 s, an ambience 8 s. Sounds already made are kept. */
function sfxCost(plan) {
  let hits = 0, beds = 0, made = 0;
  plan.forEach(x => (x.kinds || []).forEach((k, i) => { if ((x.made || [])[i]) { made++; return; } if (k === "hit") hits++; else beds++; }));
  const secs = hits * 2.5 + beds * 8;
  return {hits, beds, made, secs, usd: secs / 60 * 0.12};
}
function sfxCloud(plan, c) {
  if (!MUS) setTimeout(() => muLoad().then(() => { if ($("#sfxCard")) $("#sfxCard").innerHTML = sfxCard(CUR); $$("#sfxCard input[type=range]").forEach(fill); }), 0);
  const el = MUS && (MUS.providers || []).find(p => p.id === "eleven"), ok = !MUS || (el && el.connected);
  const used = plan.filter(x => x.sounds.length);
  return `<div class="bd-grid mu-grid" style="margin-top:12px">
      <div class="cmbox"><div class="cm-ic cloud">${ic("zap")}</div><div class="cm-t"><small>Sound model</small><b>ElevenLabs Sound Effects</b>
        <span>${ok ? "ElevenLabs · connected" : `<em class="warnt">ElevenLabs key missing</em>`}</span><span><i>$0.12</i>/minute · hits 2.5 s, ambience 8 s</span></div>
        ${ok ? "" : `<button class="btn sm primary" onclick="showPro()">Connect</button>`}</div>
      <div class="bd-cost"><div class="bc-h"><b>${ic("coins", "sm")} Sound cost</b><span class="bc-total">$${c.usd.toFixed(2)}</span></div>
        <div class="bc-row"><span>Short hits (whoosh, boom, sting)</span><b>${c.hits} × 2.5 s</b><i>$${(c.hits * 2.5 / 60 * 0.12).toFixed(2)}</i></div>
        <div class="bc-row"><span>Ambience (rain, wind, room)</span><b>${c.beds} × 8 s</b><i>$${(c.beds * 8 / 60 * 0.12).toFixed(2)}</i></div>
        <small>${c.made ? `${c.made} sound${c.made === 1 ? " is" : "s are"} already made and cost nothing. ` : ""}Paid to your own ElevenLabs account.</small></div>
    </div>
    <label>AI sounds in this video <span class="hint">${used.length} of ${plan.length} scenes, each one written from the scene's words</span></label>
    <div class="sfx-ai">${used.slice(0, 60).map(x => `<div class="sfx-ai-row"><b>${x.id}</b>${x.sounds.map((n, i) => `<span class="sfxchip ${(x.kinds || [])[i] || ""} ${(x.made || [])[i] ? "made" : ""}">${(x.made || [])[i] ? ic("check", "sm") : ic("sparkles", "sm")} ${esc(n)}</span>`).join("")}</div>`).join("") || `<div class="hint">No scene needs a sound with this mood.</div>`}</div>`;
}
async function sfxSet(ch) {
  try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {sfx: ch}}); if ($("#sfxCard")) { $("#sfxCard").innerHTML = sfxCard(CUR); $$("#sfxCard input[type=range]").forEach(fill); } }
  catch (e) { toast("Error: " + esc(e.message)); }
}
let SFXA = null, SFXI = {};
function playSfx(id, n) { try { if (SFXA) SFXA.pause(); const i = SFXI[id] = ((SFXI[id] ?? -1) + 1) % Math.max(1, n || 1); SFXA = new Audio(`/api/sfx/${id}.wav?i=${i}`); SFXA.volume = 0.8; SFXA.play(); } catch (e) {} }
async function sfxImport() {
  const folder = $("#sfx_folder").value.trim();
  if (!folder) { toast("Paste the folder path first"); return; }
  try { await api("/api/sfx/import", {method: "POST", body: {folder}}); watchSfxImport(); }
  catch (e) { toast(esc(e.message), 8000); }
}
async function watchSfxImport() {
  const r = await api("/api/sfx/library"), j = r.import || {};
  if ($("#sfxImportMsg")) $("#sfxImportMsg").innerHTML = `${j.state === "running" ? `<span class="eq"><i></i><i></i><i></i><i></i></span> ` : ""}${esc(j.message || "")}`;
  if (j.state === "running") setTimeout(watchSfxImport, 1200);
  else if (j.state === "done") { CUR = await api(`/api/projects/${CUR.id}`); if (TAB === "music") renderMusic(); toast(esc(j.message)); }
}
function renderMusic() {
  const p = CUR, m = p.music || {}, secs = m.sections || [];
  const vol = m.volume ?? CFG.music_volume ?? 0.12;
  const made = secs.filter(x => x.file).length, on = m.enabled !== false;
  $("#tabBody").innerHTML = `
  <div class="card"><div class="sec-t"><span class="n">${ic("headphones")}</span><div><h3>Background music</h3><small>A piece for every chapter, free on your PC or from the cloud. It gets quieter by itself while the voice speaks.</small></div>
    <div class="grow"></div><label class="switch big"><input type="checkbox" ${on ? "checked" : ""} onchange="patch({music:{enabled:this.checked}},false)"><span></span> ${on ? "On" : "Off"}</label></div>
    ${on ? `<div class="where ck-where" id="muWhere">${musicWhere()}</div><div id="muCloud">${musicCloud()}</div>
    <div class="music-simple">
      <div class="ms-step"><b>1</b><div><h4>Music level</h4>
        <div class="volwrap"><div class="band" title="Recommended 10 to 15%"></div><input type="range" min="0" max="0.3" step="0.01" value="${vol}" oninput="fill(this);$('#mv').textContent=Math.round(this.value*100)+'%'" onchange="patch({music:{volume:parseFloat(this.value)}},false)"></div>
        <div class="marks"><span>quiet</span><span><b id="mv">${Math.round(vol * 100)}%</b> ${vol >= 0.1 && vol <= 0.15 ? `<span class="rec">RECOMMENDED</span>` : `<a onclick="patch({music:{volume:0.12}},false)">back to 12%</a>`}</span><span>loud</span></div></div></div>
      <div class="ms-step"><b>2</b><div><h4>Make the music</h4><div class="hint">${secs.length} part${secs.length === 1 ? "" : "s"}, one per chapter${made ? `, ${made} ready` : ""}. <b>Build everything</b> makes it for you too.</div>
        <div class="actions" style="margin-top:8px"><button class="btn primary" onclick="makeMusic(null)">${ic("sparkles", "sm")} ${made ? "Make missing music" : "Make music for my video"}</button></div></div></div>
      <div class="ms-step"><b>3</b><div><h4>Listen</h4><div class="hint">40 seconds of the real mix, voice and music together.</div>
        <div class="actions" style="margin-top:8px"><button class="btn" onclick="musicMix(-1,this)">${ic("headphones", "sm")} Listen: voice + music</button></div></div></div>
    </div>
    <details class="adv"><summary>${ic("sliders", "sm")} Change the mood of each part</summary>
      ${secs.map((sec, i) => `<div class="msec">
          <b>${esc((p.chapters[sec.chapter] || {}).title || "Part " + (i + 1))}</b>
          <select onchange="setSection(${i},{mood:this.value})">${CAT.music.moods.map(x => `<option value="${x.id}" ${sec.mood === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
          <input placeholder="extra words: flute, rain, 70 bpm…" value="${esc(sec.custom || "")}" onchange="setSection(${i},{custom:this.value})">
          <div class="actions">${sec.file ? `<button class="btn sm" onclick="playMusic('${sec.file}',this)" title="Music only">${ic("play", "sm")}</button><button class="btn sm" onclick="musicMix(${i},this)" title="With the voice">${ic("headphones", "sm")}</button>` : ""}
            <button class="btn sm ${sec.file ? "" : "primary"}" onclick="makeMusic([${i}])">${ic(sec.file ? "refresh" : "sparkles", "sm")} ${sec.file ? "Again" : "Make"}</button></div></div>`).join("")}
      <div class="actions" style="margin-top:10px"><button class="btn sm" onclick="musicAuto()">${ic("wand", "sm")} Reset moods from the video type</button><span class="hint">${m.where === "cloud" ? "Made in the cloud with the model above." : `Needs "AI Music" from Setup Center.`}</span></div>
      <div class="grp">Needle drops</div>
      <div class="hint">The music stops for a moment at these scenes, for impact.</div>
      <div class="actions" style="margin-top:8px">${(m.drops || []).map(d => `<span class="chip a">${esc(d)} <a onclick="toggleDropM('${d}')">${ic("x", "sm")}</a></span>`).join("") || `<span class="hint">None yet.</span>`}
        <select style="width:auto;padding:6px 10px" onchange="this.value&&toggleDropM(this.value)"><option value="">+ Add a drop at scene…</option>${p.scenes.filter(s => !(m.drops || []).includes(s.id)).map(s => `<option value="${s.id}">${s.id} · ${esc((s.text || "").slice(0, 40))}</option>`).join("")}</select></div>
    </details>` : `<div class="hint">Music is off for this video.</div>`}
  </div>
  <div class="card" id="sfxCard">${sfxCard(p)}</div>`;
  $$("#tabBody input[type=range]").forEach(fill);
}
/* ---------------- Music: on my PC (ACE-Step) / cloud (Lyria, Eleven Music) ---------------- */
let MUS = null;
async function muLoad() {
  try { MUS = await api("/api/cloud-music/state"); } catch (e) { MUS = {pro: false, providers: [], default: ""}; }
  if (TAB === "music" && $("#muWhere")) { setHTML($("#muWhere"), musicWhere()); setHTML($("#muCloud"), musicCloud()); }
}
function musicWhere() {
  const cloud = (CUR.music || {}).where === "cloud", pro = !MUS || MUS.pro !== false;
  if (!MUS) setTimeout(muLoad, 0);
  return orderWhere(`<button class="wh ${!cloud ? "on" : ""}" onclick="muWhere('local')"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>On my PC</b>
      <span>Free. ACE-Step makes the music on your GPU, safe for YouTube.</span><small>Costs nothing, only time</small></div></button>
    <button class="wh ${cloud ? "on" : ""} ${pro ? "" : "nopro"}" onclick="muWhere('cloud')"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>Cloud <span class="pro-badge">${ic(pro ? "crown" : "lock")}<i>PRO</i></span></b>
      <span>Studio music from Google Lyria or ElevenLabs on your own key. Fast on any PC.</span><small>From about $0.08 per part</small></div></button>`);
}
async function muWhere(w) {
  if (w === "cloud" && !proOn()) { needPro("Cloud music"); return; }
  if (((CUR.music || {}).where === "cloud") === (w === "cloud")) return;
  const body = {where: w}; if (w === "cloud" && !(CUR.music || {}).model && MUS && MUS.default) body.model = MUS.default;
  try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {music: body}}); setHTML($("#muWhere"), musicWhere()); setHTML($("#muCloud"), musicCloud());
    toast(w === "cloud" ? "Cloud music: parts you make again use the model below. Music already made stays." : "On my PC: ACE-Step makes the music, free.", 6000); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function muModels() { return ((MUS && MUS.providers) || []).flatMap(p => p.models.map(m => ({...m, prov: p.label}))); }
function muModel() { const id = (CUR.music || {}).model || (MUS && MUS.default); return muModels().find(m => m.id === id) || null; }
function muParts() {  // seconds of each music part (one per chapter) from the scenes
  const secs = (CUR.music || {}).sections || [];
  return secs.map((x, i) => { const sc = CUR.scenes.filter(s => s.chapter === x.chapter);
    const t = sc.reduce((a, s) => a + (s.duration || (s.text || "").split(/\s+/).length / 2.5), 0); return {i, secs: Math.max(30, Math.min(180, t + 4)), made: !!x.file}; });
}
function muCost(m, parts) { if (!m) return 0; return m.unit === "song" ? m.price * parts.length : m.price * parts.reduce((a, p) => a + p.secs, 0) / 60; }
function musicCloud() {
  if ((CUR.music || {}).where !== "cloud") return "";
  if (!MUS) return `<div class="hint" style="margin-top:12px"><span class="eq"><i></i><i></i><i></i></span> Loading the music models…</div>`;
  const m = muModel(), parts = muParts(), left = parts.filter(p => !p.made), all = muCost(m, parts), rest = muCost(m, left);
  return `<div class="bd-grid mu-grid">
      <button class="cmbox cloud" onclick="muPicker()"><div class="cm-ic cloud">${ic("music")}</div>
        <div class="cm-t"><small>Music model</small>${m ? `<b>${esc(m.name)}</b><span>${esc(m.prov)}</span><span><i>$${m.price.toFixed(2)}</i>${m.unit === "song" ? " per piece" : " per minute"} · ${esc(m.note)}</span>` : `<b class="warn">Pick a model</b><span>Connect Google AI Studio or ElevenLabs on the Pro page</span>`}</div>
        <span class="cm-chg">Change ${ic("chevrons", "sm")}</span></button>
      <div class="bd-cost"><div class="bc-h"><b>${ic("coins", "sm")} Music cost</b><span class="bc-total">$${rest.toFixed(2)}</span></div>
        <div class="bc-row"><span>Parts still to make</span><b>${left.length} of ${parts.length}</b><i>$${rest.toFixed(2)}</i></div>
        <div class="bc-row"><span>Whole video again</span><b>${Math.round(parts.reduce((a, p) => a + p.secs, 0) / 60)} min</b><i>$${all.toFixed(2)}</i></div>
        <small>Paid to your own account. Short pieces are looped with a soft crossfade to fill each part.</small></div>
    </div>`;
}
function muPicker() {
  if (!MUS) { muLoad().then(muPicker); return; }
  const cur = (muModel() || {}).id, parts = muParts();
  const provs = MUS.providers || [], on = provs.filter(p => p.connected), off = provs.filter(p => !p.connected);
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>Music model</h2><div class="hint">${parts.length} music part${parts.length === 1 ? "" : "s"} in this video, one per chapter. Instrumental only.</div></div><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <div class="cvp-list cmp-list">${on.map(p => `<div class="cmp-sec"><div class="cmp-h"><span class="cmp-name">${ic("check", "sm")} ${esc(p.label)}</span><small>connected · ${p.models.length} models</small></div>
      ${p.models.map(m => `<div class="ck-row ${m.id === cur ? "on" : ""}" onclick="muUse('${m.id}')"><div class="ck-rt"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></div>
        ${m.id === "lyria-3.5" ? `<span class="ck-tag best">Best value</span>` : m.id === "eleven:music_v2_5" ? `<span class="ck-tag best">Best quality</span>` : "<span></span>"}
        <div class="ck-price"><b>$${m.price.toFixed(2)}</b><small>${m.unit === "song" ? "/piece" : "/minute"}</small><i>this video ~$${muCost(m, parts).toFixed(2)}</i></div>
        <span class="vrow-use">${m.id === cur ? `${ic("check", "sm")} Selected` : "Use"}</span></div>`).join("")}</div>`).join("") || `<div class="hint" style="padding:14px">No music key connected yet.</div>`}
      ${off.length ? `<div class="cmp-off">${off.map(p => `<button class="btn sm ghost" onclick="closeModal('pickModal');showPro()">${ic("plus", "sm")} Connect ${esc(p.label)}</button>`).join("")}</div>` : ""}</div>`;
  $("#pickModal").classList.add("show");
}
async function muUse(id) {
  try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body: {music: {model: id}}}); closeModal("pickModal"); setHTML($("#muCloud"), musicCloud());
    toast(`Music model: ${esc((muModel() || {}).name || id)}. Use "Again" on a part to make it with this model.`, 6000); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function setSection(i, ch) { const secs = (CUR.music.sections || []).map((s, k) => k === i ? {...s, ...ch} : s); await patch({music: {sections: secs}}, false); }
async function musicAuto() { CUR = await api(`/api/projects/${CUR.id}/music/auto`, {method: "POST"}); renderMusic(); toast("Mood plan made from the video type"); }
async function makeMusic(only) {
  try { await api(`/api/projects/${CUR.id}/run/music`, {method: "POST", body: only ? {only} : {}}); toast("Composing music…"); refreshSoon(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function playMusic(file, btn) { const pl = $("#player"); if (PLAYING === file) { stopAudio(); return; } MP_LABEL = "Music"; pl.src = `/files/${CUR.id}/${file}`; pl.play(); PLAYING = file; }
async function musicMix(section, btn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Mixing…`;
  try {
    const r = await api(`/api/projects/${CUR.id}/music/preview`, {method: "POST", body: {section}});
    const pl = $("#player"); MP_LABEL = "Music mix preview (voice + music)"; pl.src = r.url; pl.play(); PLAYING = r.url;
    if (!r.with_voice) toast("No narration yet, so you hear the music alone. Run 1 · Voice to hear the real mix.", 6000);
  } catch (e) { toast(esc(e.message), 8000); }
  btn.disabled = false; btn.innerHTML = old;
}
async function toggleDropM(sid) { CUR = await api(`/api/projects/${CUR.id}/music/drop`, {method: "POST", body: {scene_id: sid}}); renderMusic(); }

/* ---------------- script ---------------- */
function renderScript() {
  const p = CUR, r = p.recommend;
  $("#tabBody").innerHTML = `${setupCard(p)}<div class="card"><div class="sec-t"><span class="n">${ic("file")}</span><div><h3>Script</h3><small>Tags: <code>[CAST: Name = look]</code> characters, <code>[PLACE: Kitchen = small wooden kitchen…]</code> places, <code>[IMG: …]</code> pictures</small></div></div>
    <div class="note">Re-splitting rebuilds all scenes and <b>deletes this project's generated images and narration</b> (your clips stay).</div>
    ${p.preset === "rhyme" ? `<div class="hint" style="margin-top:8px">Rhymes: one picture for every 2 lines, or one per <code>[IMG: …]</code>. After changing the lyrics press Re-split, then Build (the song is sung again).</div>` : `<div class="row" style="margin-top:6px"><div style="max-width:420px">${secsBlock("r", p.scene_seconds, p.scene_seconds === r.scene_seconds, r.scene_seconds)}</div><div></div></div>`}
    ${p.preset !== "rhyme" ? `<label class="chk" style="margin-top:10px"><input type="checkbox" id="r_expl" ${p.explainer ? "checked" : ""}> <b>Explainer cuts</b> <span class="hint">a new still picture for every line (~3 s), hard cuts, hand-lettered text cards for numbers, no captions. Best with the Stick style. Applies when you Re-split.</span></label>` : ""}
    <label>Script</label><textarea id="s_script" rows="22">${esc(p.script)}</textarea>
    <div class="actions" style="margin-top:12px"><button class="btn primary" onclick="improveScript(this)" title="${p.cloud_mode ? "Uses the script AI you picked for Cloud" : "Uses Smart Director (Ollama) on this PC"}">${ic("sparkles", "sm")} Improve script ${p.cloud_mode ? `(Cloud AI) ${PTAG}` : "(AI on this PC)"}</button><button class="btn danger" onclick="resplitProj()">Re-split script</button></div>
    <div class="hint" style="margin-top:6px">Improve script makes weak writing stronger. The story, names, order of events and ending stay the same. You see the new version first.</div>
    <div id="improveBox"></div></div>
  <div class="card"><div class="sec-t"><span class="n">${ic("zap")}</span><div><h3>Hook Doctor</h3><small>The first 30 seconds decide if people stay</small></div><div class="grow"></div>
    <div class="actions hookbtns"><button class="btn sm" onclick="runHook(this, 'local')" title="Ollama on this PC, free">${ic("cpu", "sm")} Check on this PC</button>
      <button class="btn sm primary" id="hookCloud" onclick="runHook(this, 'cloud')" title="OpenRouter or your Script AI key">${ic("sparkles", "sm")} Check in the cloud ${PTAG}</button></div></div><div id="hookBox"></div></div>
  <div class="card"><div class="sec-t"><span class="n">${ic("layers")}</span><div><h3>Originality check</h3><small>Compares this script with your other videos. YouTube does not pay for mass-produced, templated content</small></div><div class="grow"></div>
    <button class="btn sm" onclick="runOrig(this)">${ic("check", "sm")} Check</button></div><div id="origBox"></div></div>`;
  fill($("#r_secs"));
  api(`/api/projects/${CUR.id}/kit`).then(k => { KIT = k; if (k.hook) paintHook(k.hook); if (k.originality) paintOrig(k.originality);
    const hc = $("#hookCloud"); if (hc && !k.cloud_ai) { hc.disabled = true; hc.title = "Needs Pro with OpenRouter or a Script AI key (Pro page)"; } }).catch(() => {});
}
let IMPROVED = null;
async function improveScript(btn) {
  btn.disabled = true; const old = btn.innerHTML;
  btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Improving… (a long script takes a few minutes)`;
  try {
    IMPROVED = await api(`/api/projects/${CUR.id}/improve-script`, {method: "POST", body: {script: $("#s_script").value}});
    paintImproved();
  } catch (e) { toast(esc(e.message), 8000); }
  btn.disabled = false; btn.innerHTML = old;
}
function paintImproved() {
  const r = IMPROVED; if (!r) return;
  $("#improveBox").innerHTML = `<div class="improve">
    <div class="grp">Improved version</div>
    <div class="hint">${r.changed} of ${r.blocks} parts rewritten${r.kept ? `, ${r.kept} kept as they were (the AI changed too much there)` : ""} · ${r.words_before} → ${r.words_after} words</div>
    <textarea id="imp_text" rows="18">${esc(r.script)}</textarea>
    <div class="actions" style="margin-top:10px">
      <button class="btn primary" onclick="useImproved(true)">${ic("check", "sm")} Use it and re-split</button>
      <button class="btn" onclick="useImproved(false)">Put it in the editor</button>
      <button class="btn ghost" onclick="IMPROVED=null;$('#improveBox').innerHTML=''">Discard</button>
    </div></div>`;
}
async function useImproved(resplit) {
  $("#s_script").value = $("#imp_text").value; IMPROVED = null; $("#improveBox").innerHTML = "";
  if (resplit) resplitProj(); else toast("New script is in the editor. Click Re-split script when you are happy with it.");
}
async function runHook(btn, engine) {
  btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Reading…`;
  try { paintHook(await api(`/api/projects/${CUR.id}/hook-doctor?engine=${engine || "auto"}`, {method: "POST"})); } catch (e) { toast(esc(e.message), 8000); }
  btn.disabled = false; btn.innerHTML = old;
}
function paintHook(h) {
  const col = h.score >= 8 ? "ok" : h.score >= 6 ? "" : "bad";
  $("#hookBox").innerHTML = `<div class="score ${col}"><b>${h.score}</b>/10</div>
    <div class="hint" style="margin:8px 0"><b>Your opening:</b> ${esc((h.opening || "").slice(0, 260))}…</div>
    ${(h.problems || []).map(x => `<div class="warn">• ${esc(x)}</div>`).join("")}
    <div class="grp">Better opening lines</div>
    ${(h.hooks || []).map(x => `<div class="hk"><span>${esc(x)}</span><button class="btn sm" onclick="applyHook(${JSON.stringify(x).replace(/"/g, "&quot;")},'replace')">Replace first line</button><button class="btn sm ghost" onclick="applyHook(${JSON.stringify(x).replace(/"/g, "&quot;")},'before')">Add before</button></div>`).join("")}
    <div class="hint" style="margin-top:6px">Only scene 1 is narrated again. ${h.ai ? (h.engine === "cloud" ? "Checked in the cloud." : h.engine === "local" ? "Checked on this PC." : "") : "Install Smart Director (Ollama) for AI written hooks, or check in the cloud with Pro."}</div>`;
}
async function applyHook(line, mode) {
  try { CUR = await api(`/api/projects/${CUR.id}/hook/apply`, {method: "POST", body: {line, mode}}); toast("Scene 1 updated. Run 1 · Voice to record it."); renderScript(); }
  catch (e) { toast(esc(e.message)); }
}
async function runOrig(btn) {
  btn.disabled = true;
  try { paintOrig(await api(`/api/projects/${CUR.id}/originality`, {method: "POST"})); } catch (e) { toast(esc(e.message)); }
  btn.disabled = false;
}
function paintOrig(o) {
  const col = o.score >= 85 ? "ok" : o.score >= 70 ? "" : "bad";
  $("#origBox").innerHTML = `<div class="score ${col}"><b>${o.score}</b>/100</div>
    ${(o.warnings || []).map(x => `<div class="warn">• ${esc(x)}</div>`).join("") || `<div class="hint" style="margin-top:6px">Looks original compared with your other videos.</div>`}
    ${(o.matches || []).length ? `<div class="grp">Similar videos</div>${o.matches.map(m => `<div class="hint">${esc(m.title)}: ${m.overlap}% same lines${m.same_opening ? ", same opening" : ""}</div>`).join("")}` : ""}`;
}
function rSecs(v) { $("#r_secv").innerHTML = v + "<small> s</small>"; }
function rSecsAuto() { $("#r_secs").value = CUR.recommend.scene_seconds; fill($("#r_secs")); rSecs(CUR.recommend.scene_seconds); }
async function resplitProj() {
  if (!await confirmBox("Re-split the script?", "Scenes are rebuilt. Generated images and narration of this project are deleted.", "Re-split", true)) return;
  try {
    CUR = await api(`/api/projects/${CUR.id}/resplit`, {method: "POST", body: {title: CUR.title, script: $("#s_script").value,
      scene_seconds: parseFloat($("#r_secs").value), voice: CUR.voice, speed: CUR.speed, style_prefix: CUR.style_prefix,
      thumbnail_text: CUR.thumbnail_text, preset: CUR.preset, explainer: $("#r_expl") ? $("#r_expl").checked : null}});
    TAB = "scenes"; renderProject(); toast(`${CUR.scenes.length} scenes`);
  } catch (e) { toast("Error: " + esc(e.message)); }
}

/* ---------------- jobs & polling ---------------- */
async function run(step, force, cloud) {
  if (Object.keys(dirty).length) await saveScenes(true);
  const useCloud = cloud === undefined ? !!CUR.cloud_mode : !!cloud;
  if (!force) {
    const pf = await api(`/api/projects/${CUR.id}/preflight/${step}`).catch(() => null);
    if (pf && (pf.missing.length || pf.note)) { missingModal(step, pf); return; }
    const cloudOn = useCloud || (CFG.image_provider && CFG.image_provider !== "local") || (CFG.video_provider && CFG.video_provider !== "local") || /^(eleven|gemini|openai):/.test(CUR.voice || "") || (CUR.sfx_settings || {}).engine === "elevenlabs" || (CUR.music || {}).where === "cloud";
    if (cloudOn && ["all", "images", "videos", "preview", "voice"].includes(step) && PRO && PRO.pro) {
      const c = await api(`/api/projects/${CUR.id}/cost${useCloud ? "?cloud=1" : ""}`).catch(() => null);
      if (c && c.usd > 0) { costModal(step, c, cloud); return; }
    }
  }
  try { await api(`/api/projects/${CUR.id}/run/${step}`, {method: "POST", body: cloud === undefined ? {} : {cloud: !!cloud}}); toast(`Started: ${step}${useCloud ? " (cloud)" : ""}`); refreshSoon(); loadJobChip(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function costModal(step, c, cloud) {
  const cl = cloud === undefined ? "undefined" : String(!!cloud);
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>${PTAG} Cost estimate: about $${c.usd.toFixed(2)}</h2><div class="hint" style="margin-top:4px">${esc(c.note)}</div></div><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    ${c.lines.map(l => `<div class="note info" style="margin-top:8px">${ic("zap")}<div style="flex:1">${esc(l.item)}</div><b>$${l.usd.toFixed(2)}</b></div>`).join("")}
    <div class="vsfoot"><span class="hint" style="flex:1">Switch any part back to "On my PC" on the Pro page to make it free.</span><button class="btn" onclick="closeModal('pickModal');go('pro')">Change providers</button>
      <button class="btn primary pill" onclick="closeModal('pickModal');run('${step}', true, ${cl})">Continue</button></div>`;
  $("#pickModal").classList.add("show");
}
function cloudReady() { return PRO && PRO.pro && PRO.openrouter && PRO.openrouter.connected; }
function cloudBuild() {
  if (needPro("Build in cloud")) return;
  if (!cloudReady()) { toast("Connect OpenRouter on the Pro page first (one click).", 7000); go("pro"); return; }
  run("all", false, true);
}
function missingModal(step, pf) {
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>${pf.missing.length ? "A few things are still missing" : "Heads up"}</h2>
      <div class="hint" style="margin-top:4px">${pf.missing.length ? `To make this video, LECCORTUBE needs ${pf.missing.length === 1 ? "this item" : "these items"} first (about ${pf.size_gb} GB, downloaded once):` : ""}</div></div>
      <button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    ${pf.missing.map(m => `<div class="note info" style="margin-top:8px">${ic("download")}<div><b>${esc(m.name)}</b><br><small>${m.size_gb ? m.size_gb + " GB" : "small"}</small></div></div>`).join("")}
    ${pf.note ? `<div class="note">${ic("alert")}<div>${esc(pf.note)}</div></div>` : ""}
    <div class="vsfoot"><span class="hint" style="flex:1">${pf.missing.length ? "Install now and click the button again when it shows Installed. Downloads resume if the internet drops." : ""}</span>
      <button class="btn" onclick="closeModal('pickModal');go('setup')">${ic("download", "sm")} Open Setup Center</button>
      ${pf.missing.length ? `<button class="btn primary pill" onclick="installMissing(${esc(JSON.stringify(pf.missing.map(m => m.id)))})">${ic("download", "sm")} Install now</button>`
        : `<button class="btn primary pill" onclick="closeModal('pickModal');run('${step}', true)">Continue anyway</button>`}</div>`;
  $("#pickModal").classList.add("show");
}
async function installMissing(ids) {
  closeModal("pickModal");
  try { await api("/api/setup/install-all", {method: "POST", body: {ids}}); toast("Installing in Setup Center. You can keep working.", 6000); go("setup"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function cancelJob() { await stopJob(CUR.id); }
function stopPoll() { clearTimeout(POLL); POLL = null; }
function refreshSoon() { stopPoll(); POLL = setTimeout(poll, 600); }
function maybePoll() { if (["running", "queued"].includes(CUR.status.state)) refreshSoon(); }
async function poll() {
  if (!CUR || VIEW !== "project") return;
  const id = CUR.id;
  let p; try { p = await api(`/api/projects/${id}`); } catch (e) { POLL = setTimeout(poll, 3000); return; }
  if (!CUR || CUR.id !== id || VIEW !== "project") return;
  const prevState = CUR.status.state, prevOutputs = JSON.stringify(CUR.outputs);
  const keep = {style_id: CUR.style_id, _newType: CUR._newType};
  CUR = p; Object.assign(CUR, Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)));
  updateStatus();
  if (TAB === "scenes" && $("#tabBody .grid")) {
    for (const s of p.scenes) {
      const key = sceneKey(s);
      if (lastImgV[s.id] !== key) {
        lastImgV[s.id] = key;
        const box = $("#img_" + s.id); if (box) { const badges = [...box.querySelectorAll(".badge")].map(b => b.outerHTML).join(""); box.innerHTML = sceneImg(s) + badges; }
      }
    }
  }
  if (TAB === "output" && JSON.stringify(p.outputs) !== prevOutputs) renderOutput();
  if (["running", "queued"].includes(p.status.state)) POLL = setTimeout(poll, 1500);
  else {
    POLL = null; loadProjects(); loadJobChip();
    if (prevState !== p.status.state && p.status.state === "done") {
      toast(esc(p.status.message || "Done"));
      if (["render", "export", "all", "shorts", "dub"].includes(p.status.step)) { TAB = "output"; renderProject(); }
      else if (["character", "sheet"].includes(p.status.step)) { TAB = "cast"; renderProject(); }
      else if (p.status.step === "music") { TAB = "music"; renderProject(); }
      else if (p.status.step === "variations") { renderProject(); if (VAR_PENDING) { const sid = VAR_PENDING; VAR_PENDING = null; openShot(sid); } }
      else if (p.status.step === "director") { TAB = "scenes"; renderProject(); }
      else if (TAB === "scenes") renderProject();
    } else if (prevState !== p.status.state && p.status.state === "error") { toast(esc(p.status.message), 9000); renderProject(); }
  }
}

/* ================================================================ VOICE STUDIO */
let VS = null;
async function openVoiceStudio(target) {
  const src = target === "new" ? NEW : {voice: CUR.voice, speed: PS ? PS.speed : CUR.speed, fx: CUR.voice_fx, clean: CUR.voice_clean};
  const type = target === "new" ? NEW.type : CUR.preset;
  const voice = target === "project" && PS && PS.voice ? PS.voice : src.voice;
  const text = target === "new" ? sampleText(NEW.script) : sampleText(CUR.scenes.slice(0, 2).map(s => s.text).join(" "));
  VS = {target, type, voice, speed: src.speed, fx: src.fx || "none", clean: src.clean !== false, preset: null,
        text: (VS && VS.text && VS.target === target) ? VS.text : text};
  $("#voiceModal").classList.add("show");
  renderVS();
  await loadVoiceStatus(); renderVS();
}
function vsStatusChips() {
  if (!VSTAT) return `<span class="chip">Checking…</span>`;
  const c = (ok, n) => `<span class="chip ${ok ? "ok" : "bad"}"><span class="dot"></span>${n}</span>`;
  return c(VSTAT.kokoro, "Kokoro") + c(VSTAT.natural, "Natural voices") + c(VSTAT.ffmpeg, "FFmpeg");
}
function renderVS() {
  const r = rec(VS.type, VS.voice), tp = CAT.types.find(t => t.id === VS.type);
  const presets = CAT.voice_presets || [];
  const blocked = VSTAT && !VSTAT.ready;
  $("#voiceBody").innerHTML = `
    <div class="mhead"><div><h2>Voice Studio</h2><div class="hint" style="margin-top:4px">Pick a template or build your own voice. Everything you hear is exactly how it will sound in the video.</div></div>
      <div class="actions">${vsStatusChips()}<button class="btn icon" onclick="closeModal('voiceModal')">${ic("x")}</button></div></div>
    ${blocked ? `<div class="note bad">${ic("alert")}<div><b>Voice preview can't run yet.</b><br>${VSTAT.problems.map(esc).join("<br>")}</div><button class="btn sm primary" onclick="closeModal('voiceModal');go('setup')">Setup Center</button></div>` : ""}
    ${VSTAT && VSTAT.ready && !VSTAT.natural ? `<div class="note info">${ic("info")}<div>Templates use the fast Kokoro voices now. Install <b>Natural voices</b> in Setup Center and they switch to human-like voices automatically.</div></div>` : ""}
    <div class="sec-t" style="margin:18px 0 10px"><span class="n">${ic("sparkles")}</span><div><h3>Templates</h3><small>One click: voice, speed and effect set and played</small></div></div>
    <div class="vpresets">${presets.map(p => `<div class="vp ${VS.preset === p.id ? "on" : ""}" data-id="${p.id}" onclick="vsPreset('${p.id}')">
        <div class="ic">${ic(p.icon)}</div><b>${esc(p.name)}</b><span>${esc(p.desc)}</span><span class="pl">${ic("play", "sm")}</span></div>`).join("")}</div>
    <div class="vs" style="margin-top:20px">
      <div>
        <div class="sec-t" style="margin-bottom:10px"><span class="n">${ic("mic")}</span><div><h3>Narrator</h3><small>Click a voice, press play to hear it</small></div></div>
        <div class="vlist">${Object.entries(voiceGroups()).map(([g, vs]) => `<div class="vgroup">${esc(g)}</div>` + vs.map(v => `
          <div class="vrow ${v.id === VS.voice ? "cur" : ""} ${v.available === false ? "off" : ""}" onclick="${v.available === false ? `toast('Install Natural voices in Setup Center first.')` : `vsVoice('${esc(v.id)}')`}">
            <button class="btn icon sm" onclick="event.stopPropagation();${v.available === false ? `toast('Install Natural voices in Setup Center first.')` : `vsVoice('${esc(v.id)}',true)`}">${ic("play", "sm")}</button>
            <span class="nm">${esc(v.label)}${v.id === r.voice ? ` <span class="rec">BEST FOR ${esc(tp.name.toUpperCase())}</span>` : ""}</span>
            ${/:(?!default|k_)/.test(v.id) && v.engine === "turbo" ? `<button class="btn icon sm danger" onclick="event.stopPropagation();deleteSample('${esc(v.id.split(":")[1])}')" title="Delete this sample">${ic("trash", "sm")}</button>` : ""}
          </div>`).join("")).join("")}</div>
        <div class="actions" style="margin-top:10px"><label class="upl"><input type="file" accept="audio/*" onchange="uploadSample(this)"><span class="btn sm">${ic("upload", "sm")} Upload my own voice (10 to 30 s)</span></label>
          <span class="hint">Only use a voice you have the rights to.</span></div>
      </div>
      <div>
        <div class="sec-t" style="margin-bottom:10px"><span class="n">${ic("wand")}</span><div><h3>Effect ${VS.fx === r.fx ? `<span class="rec">AUTO</span>` : `<span class="rec off" onclick="vsFx('${r.fx}')">↺ AUTO</span>`}</h3><small>Click to hear it</small></div></div>
        <div class="fxs">${CAT.fx.map(f => `<div class="fx ${f.id === VS.fx ? "on" : ""}" onclick="vsFx('${f.id}')" title="${esc(f.desc)}"><b>${esc(f.name)}</b><span>${esc(f.desc)}</span></div>`).join("")}</div>
        <label class="chk"><input type="checkbox" ${VS.clean ? "checked" : ""} onchange="VS.clean=this.checked;vsPlay()"> Studio clean: removes noise and hiss, softens "s" sounds, same loudness everywhere</label>
        <div style="margin-top:14px">${speedBlockVS(r.speed)}</div>
        <label>Test text</label><textarea id="vs_text" rows="2" oninput="VS.text=this.value">${esc(VS.text)}</textarea>
      </div>
    </div>
    <div class="vsfoot">
      <div class="player">
        <button class="btn primary big" id="vsPlayBtn" onclick="PLAYING ? stopAudio() : vsPlay()" ${blocked ? "disabled" : ""}>${ic("play")}</button>
        <div class="meta"><b>${esc(voiceName(VS.voice))} · ${esc(fxName(VS.fx))} · ${VS.speed.toFixed(2)}x</b><span id="vsMsg">Press play to listen</span></div>
        <div class="wave" id="vsWave">${"<i></i>".repeat(18)}</div>
      </div>
      <button class="btn ghost sm" onclick="vsDefault()" title="Make it the default for new videos">Set as default</button>
      <button class="btn primary pill" style="padding:13px 22px" onclick="vsUse()">${ic("check")} Use this voice</button>
    </div>`;
  fill($("#vs_speed")); paintPlayer();
}
function speedBlockVS(recSpeed) {
  const auto = Math.abs(VS.speed - recSpeed) < 0.005;
  return `<div class="slider"><div class="top-l"><div><span class="muted" style="font-size:12.5px;font-weight:700">Speed</span>
      ${auto ? `<span class="rec">AUTO</span>` : `<span class="rec off" onclick="VS.speed=${recSpeed};renderVS();vsPlay()">↺ AUTO ${recSpeed}x</span>`}</div>
      <span class="val" id="vs_sv">${VS.speed.toFixed(2)}<small>x</small></span></div>
    <input type="range" id="vs_speed" min="0.7" max="1.25" step="0.01" value="${VS.speed}" oninput="fill(this);VS.speed=parseFloat(this.value);VS.preset=null;$('#vs_sv').innerHTML=VS.speed.toFixed(2)+'<small>x</small>'" onchange="renderVS();vsPlay()">
    <div class="marks"><span>0.70</span><span>release to listen</span><span>1.25</span></div></div>`;
}
function vsOpts() { return {voice: VS.voice, speed: VS.speed, fx: VS.fx, clean: VS.clean, text: $("#vs_text") ? $("#vs_text").value : VS.text}; }
function vsPlay(tag) { if (VSTAT && !VSTAT.ready) { paintPlayer("error", esc(VSTAT.problems[0] || "Voice engine not ready")); return; } playPreview(vsOpts(), null, tag); }
function vsVoice(id, play) {
  const oldRec = rec(VS.type, VS.voice).speed;
  const wasAuto = Math.abs(VS.speed - oldRec) < 0.005;
  VS.voice = id; VS.preset = null; if (wasAuto) VS.speed = rec(VS.type, id).speed;
  renderVS(); if (play) vsPlay();
}
function vsFx(id) { VS.fx = id; VS.preset = null; renderVS(); vsPlay(); }
function vsPreset(id) {
  const p = (CAT.voice_presets || []).find(x => x.id === id); if (!p) return;
  if (PLAYING === id) { stopAudio(); return; }
  Object.assign(VS, {voice: p.voice, speed: p.speed, fx: p.fx, clean: true, preset: id});
  renderVS(); vsPlay(id);
}
async function vsUse() {
  closeModal("voiceModal");
  if (VS.target === "new") {
    Object.assign(NEW, {voice: VS.voice, speed: VS.speed, fx: VS.fx, clean: VS.clean});
    NEW.speedAuto = Math.abs(VS.speed - rec(NEW.type, VS.voice).speed) < 0.005;
    renderVoiceNew(); estimateNew(); toast(`Voice: ${esc(voiceName(VS.voice))} · ${esc(fxName(VS.fx))}`);
  } else {
    await patch({voice: VS.voice, speed: VS.speed, voice_fx: VS.fx, voice_clean: VS.clean},
      "Voice saved. Run 1 · Voice or Build everything (effect-only changes take seconds).");
  }
}
async function vsDefault() {
  await api("/api/config", {method: "POST", body: {default_voice: VS.voice, default_speed: VS.speed, default_voice_fx: VS.fx, default_voice_clean: VS.clean}});
  await loadConfig(); toast(`Default for new videos: ${esc(voiceName(VS.voice))}`);
}
async function uploadSample(input) {
  const f = input.files[0]; if (!f) return;
  const fd = new FormData(); fd.append("file", f);
  try { const r = await api("/api/voices/upload", {method: "POST", body: fd}); VOICES = r.voices; VS.voice = r.id; toast(`Sample added (${r.seconds}s). It is selected, press play.`); renderVS(); }
  catch (e) { toast("Error: " + esc(e.message), 8000); }
}
async function deleteSample(name) {
  if (!await confirmBox("Delete voice sample?", `"${esc(name)}" will be removed from this PC.`, "Delete", true)) return;
  const r = await api(`/api/voices/${encodeURIComponent(name)}`, {method: "DELETE"}); VOICES = r.voices; renderVS();
}


/* ================================================================ LECCORTUBE PRO */
let PRO = null;
const PTAG = `<span class="pro-badge sm">${ic("crown")}<i>PRO</i></span>`;
async function loadPro() {
  try { PRO = await api("/api/pro"); } catch (e) { PRO = PRO || {pro: true, owner: true, features: []}; }
  if (!PRO) PRO = {pro: true, owner: true};
  PRO.pro = true;
  PRO.owner = true;
  const d = $("#proDot"); if (d) d.classList.add("on");
  const n = $("#navDocu"); if (n) n.style.display = "";
  return PRO;
}
function proOn() { return true; }
/* Pro users see the Pro (cloud) card first, on the left; free users see the free card first */
function orderWhere(html) {
  if (!proOn()) return html;
  const d = document.createElement("div"); d.innerHTML = html;
  const k = [...d.children];
  if (k.length === 2) d.appendChild(k[0]);
  return d.innerHTML;
}
function needPro(name) {
  return false;
}
async function buyActivate(btn) {
  const key = ($("#buyKey").value || "").trim(); if (!key) { toast("Paste your key first"); return; }
  btn.disabled = true;
  const r = await api("/api/pro/activate", {method: "POST", body: {key}}).catch(e => ({ok: false, error: e.message}));
  btn.disabled = false;
  if (!r.ok) { toast(esc(r.error || "This key is not valid"), 8000); return; }
  await loadPro(); closeModal("pickModal"); toast("LECCORTUBE Pro is active. Thank you!", 6000);
  if (VIEW === "project" && CUR) renderProject(); else if (VIEW === "new") showNew();
}
async function showPro() {
  VIEW = "pro"; markNav();
  await loadPro();
  if (VIEW !== "pro") return;
  const P = PRO, S = P.settings || {}, on = P.pro;
  const key = (k, label, ph) => `<div><label>${label} ${S[k] ? `<span class="chip ok" style="padding:1px 8px">saved</span>` : ""}</label><input type="password" data-pk="${k}" placeholder="${S[k] ? "•••••••• (leave empty to keep)" : esc(ph || "paste key")}"></div>`;
  const sel = (k, label, opts) => `<div><label>${label}</label><select data-pk="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(S[k]) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
  const A = P.accounts || {}, anyCloud = A.openrouter || A.google || A.higgsfield;
  const seg = (k, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? "on" : ""}" onclick="proSet('${k}', '${v}')">${esc(l)}</button>`).join("")}</div>`;
  const lp = S.llm_provider || "ollama", llmName = (LLM_CHOICES.find(x => x[0] === lp) || ["", "Provider"])[1].split(" (")[0];
  const llmNote = lp === "ollama" ? "Free, runs on this PC with Ollama." : lp === "openrouter" ? (A.openrouter ? "Uses your connected OpenRouter account." : "Connect OpenRouter above, no key to copy.")
    : lp === "gemini" && A.google && !S.llm_api_key ? "Uses your connected Google AI key." : "";
  const llmOk = lp !== "ollama" && (lp === "openrouter" ? A.openrouter : lp === "gemini" ? (A.google || S.llm_api_key) : S.llm_api_key);
  $("#main").innerHTML = `
  <div class="card hot"><div class="phead"><div><h2>${PTAG} LECCORTUBE Pro</h2><div class="hint">Same app, more power. Use the best cloud AI with your own API keys (you pay the providers directly, nothing extra to us), on any PC.</div></div>
    <div>${on ? `<span class="chip ok"><span class="dot"></span>Pro active${P.email ? " · " + esc(P.email) : ""}</span>` : `<span class="chip"><span class="dot"></span>Free version</span>`}</div></div>
    ${on ? `<div class="actions" style="margin-top:12px"><span class="hint">License ${esc(P.key_hint || "")}</span><button class="btn sm ghost" onclick="proDeactivate()">Remove license from this PC</button></div>
      ${P.owner ? `<div class="row" style="margin-top:12px;align-items:end"><div style="flex:1"><label>Make a tester key (paste the tester's PC ID)</label><input id="pro_tpc" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></div>
        <button class="btn" onclick="proTesterKey()">${ic("zap", "sm")} Make key</button></div><div id="pro_tkey"></div>` : ""}`
      : `<div class="row" style="margin-top:14px;align-items:end"><div style="flex:1"><label>License key (from your Gumroad email)</label><input id="pro_key" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"></div>
         <button class="btn primary" onclick="proActivate(this)">${ic("zap", "sm")} Activate</button><button class="btn" onclick="openLink('pro')">Get Pro</button></div>
         ${P.on_sale ? "" : `<div class="note info">${ic("info")}<div>LECCORTUBE Pro is launching soon. Join the Discord to get it first.</div></div>`}
         ${P.pc_id ? `<div class="actions" style="margin-top:10px"><span class="hint">This PC's ID: <code>${esc(P.pc_id)}</code></span><button class="btn sm ghost" onclick="navigator.clipboard.writeText('${esc(P.pc_id)}');toast('PC ID copied')">${ic("copy", "sm")} Copy</button></div>` : ""}`}
  </div>
  <div class="card"><div class="sec-t"><span class="n">${ic("sparkles")}</span><h3>What Pro adds</h3></div>
    <div class="profeat">${(P.features || []).map(f => `<div><b>${esc(f.name)}</b><small>${esc(f.desc)}</small></div>`).join("")}</div></div>
  <div class="${on ? "" : "locked"}" id="proSettings">
  <div class="card hot"><div class="sec-t"><span class="n">${ic("link")}</span><div><h3>Connect your AI accounts ${PTAG}</h3><small>Connect once. LECCORTUBE picks the best model on each account by itself. You pay the provider directly, nothing extra to us.</small></div></div>
    <div class="acc-grid">
      <div class="acc"><div class="acc-h"><b>OpenRouter</b>${accChip(A.openrouter)}</div><small>Script AI, research with live web search, Nano Banana pictures and Veo video. One account for everything.</small><div id="orBox"><span class="hint">Checking…</span></div></div>
      ${accTile("google", "Google AI", A.google, "google_key", "Veo 3.1 video, Nano Banana pictures and Gemini script AI.", "AIza...", "aistudio.google.com/apikey", "https://aistudio.google.com/apikey")}
      ${accTile("higgsfield", "Higgsfield", A.higgsfield, "higgsfield_key", "Kling 2.6 video and Grok Image 2 pictures that keep characters the same.", "KEY_ID:KEY_SECRET", "console.higgsfield.ai", "https://console.higgsfield.ai")}
      ${accTile("eleven", "ElevenLabs", A.eleven, "elevenlabs_key", "Premium voices, your own cloned voice and AI sound effects.", "paste key", "elevenlabs.io (Profile, API keys)", "https://elevenlabs.io/app/settings/api-keys",
        A.eleven ? `<span class="hint">${(P.eleven_voices || []).length} voices in every voice picker</span><button class="btn sm" onclick="proTest('eleven', this)">${ic("refresh", "sm")} Reload voices</button><label class="btn sm" style="cursor:pointer">${ic("upload", "sm")} Clone my voice<input type="file" accept="audio/*" style="display:none" onchange="proClone(this.files[0])"></label>` : "")}
    </div></div>
  <div class="soon-grid">
    <div class="card soon"><div class="sec-t"><span class="n">${ic("upload")}</span><div><h3>Auto publish ${PTAG} <span class="chip soon-chip">Coming soon</span></h3><small>Upload to YouTube, TikTok and Instagram on a schedule, straight from LECCORTUBE.</small></div></div></div>
    <div class="card soon"><div class="sec-t"><span class="n">${ic("link")}</span><div><h3>Automation API ${PTAG} <span class="chip soon-chip">Coming soon</span></h3><small>Make videos from a Google Sheet, n8n, Make or Zapier.</small></div></div></div>
  </div>
  <div class="hint" style="margin:4px 4px 0">Keys are saved only on this PC and sent only to their own provider.</div>
  </div>`;
  if (!on) $$("#proSettings input, #proSettings select, #proSettings button").forEach(e => e.disabled = true);
  if (on) orFill(); else { const b = $("#orBox"); if (b) b.innerHTML = `<span class="hint">Available with Pro.</span>`; }
}
const LLM_CHOICES = [["ollama", "This PC (Ollama, free)"], ["openrouter", "OpenRouter (Claude, GPT, Gemini and 300 more)"], ["gemini", "Google Gemini"], ["anthropic", "Claude (Anthropic)"], ["openai", "ChatGPT (OpenAI)"], ["groq", "Groq (very fast)"], ["deepseek", "DeepSeek"], ["xai", "Grok (xAI)"], ["custom", "Custom (OpenAI-compatible URL)"]];
function accChip(on) { return on ? `<span class="chip ok acc-on"><span class="dot"></span>Connected</span>` : `<span class="chip"><span class="dot"></span>Not connected</span>`; }
function accTile(id, name, on, field, desc, ph, where, url, extra) {
  return `<div class="acc ${on ? "on" : ""}"><div class="acc-h"><b>${esc(name)}</b>${accChip(on)}</div><small>${esc(desc)}</small>
    ${on ? `<div class="actions">${extra || ""}<button class="btn sm ghost" onclick="proDisconnect('${field}')">Disconnect</button></div>`
      : `<div class="row" style="margin:8px 0 0"><input type="password" id="k_${id}" placeholder="${esc(ph)}"><button class="btn primary" onclick="proConnect('${id}')">${ic("link", "sm")} Connect</button></div>
         <div class="hint" style="margin-top:6px">Get the key at <a onclick="openUrl('${url}')">${esc(where)}</a></div>`}</div>`;
}
const ACC_FIELD = {google: ["google_key", "google"], higgsfield: ["higgsfield_key", "higgsfield"], eleven: ["elevenlabs_key", "eleven"], llm: ["llm_api_key", "llm"]};
async function proConnect(id) {
  const [field, test] = ACC_FIELD[id], key = ($("#k_" + id) || {}).value || "";
  if (!key.trim()) { toast("Paste the key first"); return; }
  try {
    await api("/api/pro/settings", {method: "POST", body: {[field]: key.trim()}});
    const r = await api(`/api/pro/test/${test}`, {method: "POST"}).catch(e => ({ok: false, message: e.message}));
    if (!r.ok) { await api("/api/pro/settings", {method: "POST", body: {clear_keys: [field]}}); toast("✗ " + esc(r.message || "The key did not work"), 8000); return; }
    toast("✓ " + esc(r.message || "Connected"), 6000);
    if (id === "eleven") await loadCatalog();
    await loadConfig(); showPro();
  } catch (e) { toast("Error: " + esc(e.message), 7000); }
}
async function proDisconnect(field) {
  if (!confirm("Disconnect this account from LECCORTUBE?")) return;
  await api("/api/pro/settings", {method: "POST", body: {clear_keys: [field]}}); await loadConfig(); showPro();
}
async function proSet(k, v) {
  try { PRO = await api("/api/pro/settings", {method: "POST", body: {[k]: v}}); await loadConfig(); showPro(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function proActivate(btn) {
  btn.disabled = true;
  const r = await api("/api/pro/activate", {method: "POST", body: {key: $("#pro_key").value}}).catch(e => ({ok: false, error: e.message}));
  toast(r.ok ? "LECCORTUBE Pro is active. Thank you!" : esc(r.error || "Not valid"), 8000); showPro();
}
async function proTesterKey() {
  const r = await api("/api/pro/tester-key", {method: "POST", body: {pc_id: $("#pro_tpc").value}}).catch(e => ({error: e.message}));
  $("#pro_tkey").innerHTML = r.key ? `<div class="actions" style="margin-top:8px"><code style="font-size:15px">${esc(r.key)}</code><button class="btn sm" onclick="navigator.clipboard.writeText('${esc(r.key)}');toast('Key copied')">${ic("copy", "sm")} Copy</button><span class="hint">Works only on that PC</span></div>`
    : `<div class="hint" style="margin-top:8px">${esc(r.error || "Could not make the key")}</div>`;
}
async function proDeactivate() { if (!confirm("Remove the Pro license from this PC?")) return; await api("/api/pro/deactivate", {method: "POST"}); showPro(); }
function proVals() {
  const v = {};
  $$("#proSettings [data-pk]").forEach(el => {
    let x = el.type === "checkbox" ? el.checked : el.value;
    if (el.dataset.pk === "image_provider" || el.dataset.pk === "video_provider") x = x === "cloud" ? "cloud" : "local";
    v[el.dataset.pk] = x;
  });
  return v;
}
async function proSave(silent) {
  try { PRO = await api("/api/pro/settings", {method: "POST", body: proVals()}); await loadConfig(); if (!silent) { toast("Pro settings saved"); showPro(); } }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function proTest(w, btn) {
  btn.disabled = true; await proSave(true);
  const r = await api(`/api/pro/test/${w}`, {method: "POST"}).catch(e => ({ok: false, message: e.message}));
  toast((r.ok ? "✓ " : "✗ ") + esc(r.message || ""), 8000); btn.disabled = false;
  if (w === "eleven" && r.ok) { await loadCatalog(); showPro(); }
}
async function proModels() {
  await proSave(true);
  const r = await api("/api/pro/test/llm_models", {method: "POST"}).catch(e => ({ok: false, message: e.message}));
  if (!r.ok) { toast("✗ " + esc(r.message || "")); return; }
  $("#llmList").innerHTML = r.models.map(m => `<option value="${esc(m)}">`).join(""); toast(`${r.models.length} models: click the Model box to pick one`);
}
async function proClone(file) {
  if (!file) return;
  const name = prompt("Name for this voice", "My voice") || "My voice";
  const fd = new FormData(); fd.append("file", file);
  try { const r = await api(`/api/pro/eleven/clone?name=${encodeURIComponent(name)}`, {method: "POST", body: fd}); await loadCatalog(); toast("Voice cloned. Pick it in any voice picker (ElevenLabs group).", 8000); showPro(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function proToken() {
  const S = (PRO || {}).settings || {};
  if (!S.api_token) { await api("/api/pro/settings", {method: "POST", body: {api_token: "new"}}); }
  const r = await api("/api/pro/api-token").catch(e => ({token: "", e}));
  if (r.token) { copyText(r.token); toast("API token copied: " + esc(r.token.slice(0, 10)) + "…", 8000); }
}

/* ================================================================ SETUP CENTER */
const COMP_ICON = {vcredist: "layers", webview2: "panel", gpudriver: "zap", engine: "cpu", ffmpeg: "film", comfyui: "layers", img_klein: "image", img_schnell: "image", vid_wan5b: "video", vid_wan14b: "hd", voice_natural: "mic"};
let SETUP_MODE = null;
function setupMode() { if (!SETUP_MODE || (SETUP_MODE === "pro" && !proOn())) SETUP_MODE = proOn() ? "pro" : "free"; return SETUP_MODE; }
function setupSwitch(m) { if (m === "pro" && !proOn()) { needPro("Pro setup"); return; } if (SETUP_MODE === m) return; SETUP_MODE = m; showSetup(); }
function setupWhere() {
  const pro = setupMode() === "pro", on = proOn();
  return `<div class="where">${orderWhere(`<button class="wh ${!pro ? "on" : ""}" onclick="setupSwitch('free')"><div class="wh-ic">${ic("monitor")}</div><div class="wh-tx"><b>${t("setup_free_pc_title", "Free · On my PC")}</b>
      <span>${t("setup_free_pc_desc", "Everything runs on your graphics card: ComfyUI, FLUX pictures, Wan video, AI music and voices. Needs an NVIDIA card with 4 GB or more.")}</span><small>${t("setup_free_pc_sub", "About 40 to 80 GB of downloads")}</small></div></button>
    <button class="wh ${pro ? "on" : ""} ${on ? "" : "nopro"}" onclick="setupSwitch('pro')"><div class="wh-ic cloud">${ic("cloud")}</div><div class="wh-tx"><b>${t("setup_pro_cloud_title", "Pro · Cloud")} <span class="pro-badge">${ic(on ? "crown" : "lock")}<i>PRO</i></span></b>
      <span>${t("setup_pro_cloud_desc", "Only the basics on your PC. Pictures, video clips, music and scripts come from the cloud on your own keys, so any graphics card works.")}</span><small>${t("setup_pro_cloud_sub", "About 3.5 GB of downloads")}</small></div></button>`)}</div>
    ${pro ? `<div class="hint" style="margin-top:10px">${ic("info", "sm")} ${t("setup_pro_hint", "Pro can also make everything free on your PC: switch to <a href=\"#\" onclick=\"setupSwitch('free');return false\">Free · On my PC</a> and install the local models you want.")}</div>` : ""}`;
}
async function showSetup() {
  VIEW = "setup"; markNav();
  if (!PRO) await loadPro();
  const mode = setupMode();
  let S, st, plan;
  try { [S, st, plan] = await Promise.all([api("/api/setup"), api("/api/system"), api(`/api/setup/plan?mode=${mode}`).catch(() => null)]); SYS = st; PLAN = plan; } catch (e) { $("#main").innerHTML = `<div class="card">Error: ${esc(e.message)}</div>`; return; }
  if (VIEW !== "setup") return;
  const g = st.gpu, recWf = (st.recommended.i2v_workflow_file || "");
  const groups = {};
  const proSet = mode === "pro" ? new Set([...(S.pro_ids || []), ...(S.pro_extra || [])]) : null;
  for (const c of S.components) {
    if (proSet && !proSet.has(c.id)) continue;
    const gname = proSet ? ((S.pro_extra || []).includes(c.id) ? "Optional: free voices on your PC" : "Needed for Pro") : c.group;
    (groups[gname] = groups[gname] || []).push(c);
  }
  const ready = mode === "pro" ? S.pro_ready : S.ready;
  const anyRun = S.components.some(c => c.task && c.task.state === "running") || (S.all && S.all.state === "running");
  $("#setupDot").textContent = S.ready ? "" : "setup";
  const tierLabel = (/10 to 12 GB VRAM/i.test(st.tier_label || "")) ? t("tier_mid_label", st.tier_label) : (st.tier_label || "");
  $("#main").innerHTML = `
  <div class="card hot">
    <div class="phead"><div><h2>${t("setup_center_title", "Setup Center")}</h2><div class="hint">${t("setup_center_desc", "Everything LECCORTUBE needs, installed from here. Downloads resume if the internet drops, and files you already have are never downloaded again.")}</div></div>
      <div>${ready ? `<span class="chip ok"><span class="dot"></span>${t("setup_ready_badge", "Ready to create")}</span>` : `<span class="chip bad"><span class="dot"></span>${mode === "pro" ? t("setup_install_pro_badge", "Install the Pro basics") : t("setup_install_core_badge", "Install the Core items")}</span>`}</div></div>
    ${setupWhere()}
  </div>
  ${verdictCard(st, plan)}
  ${allCard(S, plan)}
  <div class="card">
    <div class="sec-t"><span class="n">${ic("cpu")}</span><h3>${t("setup_your_pc", "Your PC")}</h3><div class="grow"></div><span class="tier">${t("setup_tier", "{tier} tier").replace("{tier}", esc(st.tier).toUpperCase())}</span></div>
    <div class="hint">${esc(tierLabel)}</div>
    <div class="sys">
      <div class="sysb"><div class="k">${t("setup_gpu", "Graphics card")}</div><div class="v">${g ? esc(g.name.replace("NVIDIA ", "")) : "Not found"}</div><div class="s">${g ? `${g.vram_gb || "?"} GB VRAM${g.driver ? " · driver " + esc(g.driver) : ""}${g.cuda ? " · CUDA ✓" : " · no CUDA"}` : "Needs NVIDIA RTX for images and video"}</div></div>
      <div class="sysb"><div class="k">${t("setup_cpu", "Processor")}</div><div class="v" style="font-size:14px">${esc(st.cpu.name)}</div><div class="s">${st.cpu.cores || "?"} ${t("cores", "cores")} · ${st.cpu.threads} threads</div></div>
      <div class="sysb"><div class="k">${t("setup_ram", "Memory")}</div><div class="v">${st.ram_gb} GB</div><div class="s">${st.ram_gb >= 32 ? t("ram_great", "Great for video") : st.ram_gb >= 16 ? t("ram_ok", "OK, 32 GB is better for video") : t("ram_low", "Low for AI video")}</div></div>
      <div class="sysb"><div class="k">${t("setup_disk", "Disk free")}</div><div class="v">${st.disk.free_gb ?? "?"} GB</div><div class="s">${esc(st.disk.path)} · ${t("models_need_disk", "models need about 40 GB")}</div></div>
      <div class="sysb"><div class="k">${t("setup_runs_on", "Runs on")}</div><div class="v">${st.device === "cuda" ? "GPU (CUDA)" : "CPU"}</div><div class="s">${esc(st.os)}</div></div>
    </div>
    ${st.warnings.filter(w => mode !== "pro" || !/GPU|NVIDIA|VRAM|Models need/.test(w)).map(w => `<div class="note">${ic("alert")}<div>${esc(w)}</div></div>`).join("")}
    <div class="actions" style="margin-top:14px"><button class="btn primary" onclick="autotune(this)">${ic("zap", "sm")} ${t("setup_autotune", "Auto-tune settings for this PC")}</button><button class="btn" onclick="loadSystem(true).then(showSetup)">↻ ${t("setup_detect_again", "Detect again")}</button>
      <span class="hint">${t("setup_autotune_hint", "Picks image size, video model and length that fit your GPU.").replace("{vram}", g && g.vram_gb ? g.vram_gb + " GB" : "")}</span></div>
  </div>
  ${mode === "pro" ? "" : `  <div class="card">
    <div class="sec-t"><span class="n">${ic("layers")}</span><h3>ComfyUI</h3></div>
    ${S.comfy ? `<div class="hint">Found (${esc(S.comfy.kind)}):</div><div class="path" style="margin-top:6px">${esc(S.comfy.root)}</div>
      <div class="hint" style="margin-top:8px">Models folder: <span class="path" style="display:inline-block;padding:3px 8px">${esc(S.comfy.models)}</span> · models already in there are used as they are.</div>`
      : `<div class="note info">Already have ComfyUI? Pick its folder and LECCORTUBE uses it and its models (nothing is downloaded twice). Don't have it? Install it below.</div>`}
    <div class="actions" style="margin-top:12px">
      <button class="btn" onclick="pickComfy(this)">${ic("folder", "sm")} ${S.comfy ? "Change" : "Pick my"} ComfyUI folder</button>
      ${S.comfy && S.comfy.kind !== "models" ? `<button class="btn" onclick="startComfy(this)">▶ Start ComfyUI</button>` : ""}
      <label class="chk" style="margin:0 0 0 6px"><input type="checkbox" ${CFG.comfy_autostart !== false ? "checked" : ""} onchange="api('/api/config',{method:'POST',body:{comfy_autostart:this.checked}}).then(loadConfig)"> Start ComfyUI automatically when needed</label>
    </div>
  </div>
`}
  <div class="card">
    <div class="sec-t"><span class="n">${ic("download")}</span><h3>${t("setup_comp_title", "Components and models")}</h3></div>
    ${Object.entries(groups).map(([gname, items]) => `<div class="grp">${esc(gname)}</div>` + items.map(c => compRow(c, recWf)).join("")).join("")}
    <div class="hint" style="margin-top:12px">${mode === "pro" ? "That is all Pro needs on this PC. ComfyUI and the local models are only for making things free on your own GPU." : "All models are open-license (Apache 2.0 / MIT). If a download link has moved, the item shows an error: tell Leccorside Ai and an updated catalog.json fixes it without a new version."}</div>
  </div>
  ${mode === "pro" ? `<div class="card hot"><div class="sec-t"><span class="n">${ic("cloud")}</span><div><h3>Connect your cloud keys</h3><small>Pro makes pictures, video clips, voices, music and scripts with your own accounts. One OpenRouter key covers scripts, pictures and video. Add Google AI Studio for Lyria music and Gemini voices, ElevenLabs for studio voices and sound effects.</small></div></div>
    <div class="actions"><button class="btn primary" onclick="go('pro')">${ic("zap", "sm")} Open the Pro page to connect keys</button><span class="hint">You pay the providers directly, usually $0.50 to $2 per video.</span></div></div>` : `<div class="card" id="doctorCard">${doctorCard()}</div>`}
  <div class="card" id="supportCard">${supportCard()}</div>
  <div class="card">
    <div class="sec-t"><span class="n">${ic("folder")}</span><h3>${t("setup_output_title", "Where finished videos go")}</h3></div>
    <div class="hint">${t("setup_output_desc", "Every finished video, thumbnail and YouTube text is copied to <b>&lt;this folder&gt;/&lt;video title&gt;/</b>. Leave empty to keep them only inside the project.")}</div>
    <div class="path" style="margin-top:8px">${esc(CFG.output_dir || "(not set, inside each project folder)")}</div>
    <div class="actions" style="margin-top:10px"><button class="btn" onclick="pickOutput()">${ic("folder", "sm")} ${t("setup_choose_folder", "Choose folder")}</button>${CFG.output_dir ? `<button class="btn ghost" onclick="setOutput('')">${t("clear", "Clear")}</button>` : ""}</div>
  </div>
  ${mode === "pro" ? "" : `<div class="card">
    <div class="sec-t"><span class="n">${ic("palette")}</span><h3>Style previews</h3></div>
    <div class="hint">Paint one real example image for every style in the style picker (needs ComfyUI + an image model, about 1 minute).</div>
    <div style="margin-top:10px" id="stylesSetup">${styleGallery(null, "void")}</div>
    <div class="actions" style="margin-top:10px"><button class="btn" onclick="paintStyles()">${ic("palette", "sm")} ${CAT.styles.some(s => s.preview) ? "Paint again" : "Paint previews"}</button></div>
  </div>`}`;
  clearTimeout(SETUP_POLL);
  if (anyRun) SETUP_POLL = setTimeout(() => { if (VIEW === "setup") showSetup(); }, 1500);
}
let PLAN = null, REPAIR = null;
let DOC = null;
function doctorCard() {
  const D = DOC || {};
  const bad = (D.found || []);
  return `<div class="sec-t"><span class="n">${ic("cpu")}</span><div><h3>Model Doctor</h3><small>FLUX or Wan stuck, or "Error while deserializing header"? A model file is damaged. The doctor finds it, moves it aside and downloads a clean copy. No need to open the ComfyUI folder.</small></div></div>
    <div class="actions">
      <button class="btn" onclick="doctorScan(this)">${ic("eye", "sm")} Check my models</button>
      ${bad.length ? `<button class="btn primary" onclick="doctorFix(this)">${ic("zap", "sm")} Fix ${bad.length} problem${bad.length === 1 ? "" : "s"}</button>` : ""}
      ${D.broken_gb ? `<button class="btn ghost danger" onclick="doctorClear()" title="${esc(D.broken_dir || "")}">${ic("trash", "sm")} Delete moved files (${D.broken_gb} GB)</button>` : ""}
      ${D.message ? `<span class="chip ${bad.length ? "bad" : "ok"}"><span class="dot"></span>${esc(D.message)}</span>` : ""}
    </div>
    ${bad.map(x => `<div class="note bad" style="margin-top:8px">${ic("alert")}<div><b>${esc(x.name)}</b><br><small>${esc(x.why)}${x.gb ? ` · ${x.gb} GB on disk` : ""}</small></div></div>`).join("")}`;
}
async function doctorScan(btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="eq"><i></i><i></i><i></i><i></i></span> Checking…`; }
  try { DOC = await api("/api/setup/doctor"); } catch (e) { toast("Error: " + esc(e.message)); }
  if ($("#doctorCard")) $("#doctorCard").innerHTML = doctorCard();
}
async function doctorFix(btn) {
  btn.disabled = true;
  try { DOC = await api("/api/setup/doctor", {method: "POST"}); toast(esc(DOC.message), 8000); showSetup(); }
  catch (e) { toast(esc(e.message), 8000); btn.disabled = false; }
}
async function doctorClear() {
  if (!await confirmBox("Delete the damaged model files?", "They were moved out of ComfyUI by the Model Doctor and are not used any more.", "Delete", true)) return;
  DOC = await api("/api/setup/doctor/broken", {method: "DELETE"}); if ($("#doctorCard")) $("#doctorCard").innerHTML = doctorCard();
}
function supportCard() {
  const R = REPAIR || {};
  return `<div class="sec-t"><span class="n">${ic("alert")}</span><div><h3>Help and repair</h3><small>Something not working? Repair fixes most problems. Still stuck? Create an error report and send it in the LECCORTUBE Discord.</small></div></div>
    <div class="actions" style="margin-top:12px">
      <button class="btn primary" ${R.state === "running" ? "disabled" : ""} onclick="runRepair()">${ic("zap", "sm")} ${R.state === "running" ? "Repairing…" : "Repair LECCORTUBE"}</button>
      <button class="btn" onclick="makeReport(this)">${ic("download", "sm")} Create error report</button>
      <button class="btn ghost" onclick="openLink('instagram')">Instagram @leccorsideai</button>
    </div>
    ${(R.steps || []).map(x => `<div class="note ${x.ok ? "info" : "bad"}" style="margin-top:8px">${ic(x.ok ? "check" : "alert")}<div><b>${esc(x.name)}</b><br><small>${esc(x.detail || "")}</small></div></div>`).join("")}`;
}
async function runRepair() {
  try { REPAIR = await api("/api/support/repair", {method: "POST"}); } catch (e) { toast("Error: " + esc(e.message)); return; }
  const tick = async () => { try { REPAIR = await api("/api/support/repair"); } catch (e) {} if ($("#supportCard")) $("#supportCard").innerHTML = supportCard(); if (REPAIR.state === "running") setTimeout(tick, 1500); else toast(REPAIR.message, 6000); };
  tick();
}
async function makeReport(btn) {
  btn.disabled = true;
  try { const r = await api("/api/support/report", {method: "POST"}); toast(`Saved on your Desktop: <b>${esc(r.name)}</b>. Send this file in the LECCORTUBE Discord.`, 10000); }
  catch (e) { toast("Error: " + esc(e.message)); }
  btn.disabled = false;
}
function verdictCard(st, plan) {
  const v = (plan && plan.verdict) || st.verdict;
  if (!v) return "";
  const cls = v.level === "full" ? "ok" : v.level === "limited" ? "warn" : "bad";
  const icon = v.level === "full" ? "check" : "alert";
  let title = v.title;
  if (/ready for LECCORTUBE/i.test(title)) title = t("verdict_ready_title", "Your PC is ready for LECCORTUBE");
  const reasons = (v.reasons || []).map(r => {
    let text = r;
    text = text.replace(/images, video, voices and music all run on your GPU\.?/i, t("verdict_gpu_run", "images, video, voices and music all run on your GPU."));
    return `<small style="display:block;margin-top:3px">${esc(text)}</small>`;
  }).join("");
  return `<div class="card verdict ${cls}"><div class="sec-t" style="margin:0"><span class="n">${ic(icon)}</span><div><h3>${esc(title)}</h3>
    ${reasons}</div></div></div>`;
}
function allCard(S, plan) {
  const A = S.all || {}, running = A.state === "running";
  const v = (plan && plan.verdict) || {};
  if (v.level === "unsupported") return "";
  const byId = Object.fromEntries(S.components.map(c => [c.id, c]));
  const ids = plan ? plan.items : S.components.filter(c => c.required && !c.installed).map(c => c.id);
  const show = running || A.state === "done" || A.state === "error" || A.state === "cancelled" ? (A.items && A.items.length ? A.items : ids) : ids;
  const stepCls = id => A.current === id ? "run" : (byId[id] && byId[id].installed) || (A.done || []).includes(id) ? "ok" : (A.failed || []).includes(id) ? "bad" : "";
  const left = ids.length;
  const time = plan ? (plan.minutes_fast >= 60 ? `${Math.round(plan.minutes_fast / 6) / 10} - ${Math.round(plan.minutes_slow / 6) / 10} h` : `${plan.minutes_fast} - ${plan.minutes_slow} min`) : "";
  const space = plan && plan.size_gb > plan.free_gb - 2 ? `<div class="note">${ic("alert")}<div>Needs about ${plan.size_gb} GB but only ${plan.free_gb} GB is free on this drive. Free up space first.</div></div>` : "";
  const title = plan && plan.mode === "pro" ? (left ? t("setup_pro_title", "Pro setup: download the basics") : t("setup_pro_installed_title", "Everything Pro needs is installed")) : left ? t("setup_auto_title", "Auto setup: download everything for this PC") : t("setup_installed_title", "Everything for this PC is installed");
  const desc = left ? t("setup_auto_desc", "LECCORTUBE picked {left} items that fit your PC · about {gb} GB · {time} depending on your internet. One after another, resumes after an internet drop. You can keep using the app.").replace("{left}", left).replace("{gb}", plan ? plan.size_gb : "?").replace("{time}", time) : t("setup_ready_extras", "LECCORTUBE is ready. Optional extras are below.");
  const btnLabel = running ? t("setup_installing", "Installing…") : A.state === "cancelled" || A.state === "error" ? t("setup_continue", "Continue") : t("setup_auto_btn", "Auto setup");

  return `<div class="card ${left ? "hot" : ""}">
    <div class="allbar"><div class="grow">
      <div class="sec-t" style="margin:0"><span class="n">${ic(left ? "zap" : "check")}</span><div><h3>${title}</h3>
        <small>${desc}</small></div></div>
      ${running || A.state === "done" || A.state === "error" ? `<div class="progress ${running ? "run" : ""}"><div style="width:${Math.round((A.progress || 0) * 100)}%"></div></div><div class="hint" style="margin-top:6px">${Math.round((A.progress || 0) * 100)}% · ${esc(A.message || "")}</div>` : ""}
      <div class="steps">${show.map(id => byId[id] ? `<span class="${stepCls(id)}">${stepCls(id) === "ok" ? "✓ " : ""}${esc(byId[id].name.split(" (")[0])}</span>` : "").join("")}</div>
      ${space}
    </div>
    ${left ? `<button class="btn primary" ${running ? "disabled" : ""} onclick="installAll(this)">${ic("download", "sm")} ${btnLabel}</button>` : ""}</div></div>`;
}
async function installAll(btn) { btn.disabled = true; try { await api("/api/setup/install-all", {method: "POST", body: {auto: true, mode: setupMode()}}); } catch (e) { toast("Error: " + esc(e.message)); } showSetup(); }
function compRow(c, recWf) {
  const t = c.task || {}, running = t.state === "running";
  const recd = (c.id === "vid_wan5b" && recWf.includes("5b")) || (c.id === "vid_wan14b" && recWf.includes("14b"));
  let btn;
  if (running) btn = `<button class="btn danger sm" onclick="setupCancel('${c.id}')">⏸ ${window.t("setup_pause", "Pause")}</button>`;
  else if (c.installed) btn = `<span class="chip ok">${ic("check", "sm")} ${window.t("setup_installed", "Installed")}</span>` + (c.kind === "models" || c.kind === "python" ? ` <button class="btn ghost sm" onclick="setupInstall('${c.id}')" title="Check again / repair">↻</button>` : "");
  else if (c.kind === "gpudriver") btn = `<button class="btn sm" onclick="setupInstall('${c.id}')">${t.state === "error" ? "↻ " + window.t("setup_retry", "Check again") : "Get driver"}</button>`;
  else btn = `<button class="btn ${c.required || recd ? "primary" : ""} sm" onclick="setupInstall('${c.id}')">${t.state === "cancelled" || c.partial ? window.t("setup_continue", "Continue") : t.state === "error" ? "↻ " + window.t("setup_retry", "Retry") : "⬇ " + window.t("setup_install", "Install")}</button>`;
  return `<div class="comp ${c.installed ? "done" : ""}">
    <div class="ic">${ic(COMP_ICON[c.id] || "download")}</div>
    <div style="min-width:0"><div class="nm">${esc(c.name)} ${c.required ? `<span class="chip" style="padding:1px 7px">${window.t("setup_core", "core")}</span>` : ""} ${recd ? `<span class="rec">${window.t("setup_best_for_pc", "BEST FOR YOUR PC")}</span>` : ""}</div>
      <div class="ds">${esc(c.desc)} · ${c.size_gb} GB</div>
      <div class="ds" style="margin-top:2px">${esc(c.detail || "")}</div>
      ${c.files ? `<div class="files">${c.files.map(f => `<span>${f.present ? "✓" : "·"} ${esc(f.name)}</span>`).join("")}</div>` : ""}
      ${running || t.state === "error" || t.state === "cancelled" ? `<div class="progress ${running ? "run" : ""}"><div style="width:${Math.round((t.progress || 0) * 100)}%"></div></div>
        <div class="ds" style="margin-top:4px;${t.state === "error" ? "color:var(--bad)" : ""}">${esc(t.message || "")}</div>
        ${(t.log || []).length ? `<details class="log"><summary>Details</summary><pre>${esc(t.log.join("\n"))}</pre></details>` : ""}` : ""}
    </div>
    <div class="actions">${btn}</div></div>`;
}
async function setupInstall(id) { try { await api(`/api/setup/${id}/install`, {method: "POST"}); showSetup(); } catch (e) { toast("Error: " + esc(e.message)); } }
async function setupCancel(id) { await api(`/api/setup/${id}/cancel`, {method: "POST"}); toast("Pausing. Click Continue to resume later."); setTimeout(showSetup, 800); }
async function autotune(btn) {
  btn.disabled = true;
  try { const r = await api("/api/system/autotune", {method: "POST"}); await loadConfig(); toast(`Tuned for ${esc(r.system.tier.toUpperCase())}: images ${r.config.image_width}×${r.config.image_height}, video ${esc(r.config.i2v_workflow_file)}`, 7000); }
  catch (e) { toast("Error: " + esc(e.message)); }
  btn.disabled = false;
}
async function pickComfy(btn) {
  btn.disabled = true; toast("A folder window opened on your PC (it may be behind the browser).", 6000);
  try { const r = await api("/api/setup/comfy-dir", {method: "POST", body: {pick: true}}); if (r.ok) { toast("ComfyUI folder saved"); await loadConfig(); } }
  catch (e) { toast("Error: " + esc(e.message), 9000); }
  btn.disabled = false; showSetup(); loadHealth();
}
async function startComfy(btn) {
  btn.disabled = true; btn.innerHTML = "Starting… (up to a minute)";
  try { await api("/api/comfy/start", {method: "POST"}); toast("ComfyUI is running"); } catch (e) { toast("Error: " + esc(e.message), 9000); }
  loadHealth(); showSetup();
}
async function pickOutput() {
  toast("A folder window opened on your PC (it may be behind the browser).", 6000);
  try { const r = await api("/api/setup/output-dir", {method: "POST", body: {pick: true}}); CFG = {...CFG, ...r.config}; if (r.ok) toast("Output folder saved"); }
  catch (e) { toast("Error: " + esc(e.message)); }
  if (VIEW === "setup") showSetup(); else if ($("#settingsModal").classList.contains("show")) openSettings();
}
async function setOutput(path) {
  try { const r = await api("/api/setup/output-dir", {method: "POST", body: {path}}); CFG = {...CFG, ...r.config}; toast(path ? "Output folder saved" : "Output folder cleared"); }
  catch (e) { toast("Error: " + esc(e.message)); }
  if (VIEW === "setup") showSetup(); else if ($("#settingsModal").classList.contains("show")) openSettings();
}

/* ================================================================ SETTINGS */
function openSettings() {
  const c = CFG;
  const curLang = (typeof I18N !== "undefined" && I18N.getLang) ? I18N.getLang() : (c.language || "pt-BR");
  const num = (k, label, step = 1) => `<div><label>${label}</label><input type="number" step="${step}" data-k="${k}" value="${c[k]}"></div>`;
  const sel = (k, label, opts) => `<div><label>${label}</label><select data-k="${k}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(c[k]) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select></div>`;
  $("#settingsBody").innerHTML = `
    <div class="mhead"><h2>${t("settings_title", "Settings")}</h2><button class="btn sm" onclick="closeModal('settingsModal')">${t("close", "Close")}</button></div>
    <div class="hint">${t("settings_hint", "Applies to new jobs. Use Setup Center > Auto-tune to pick the best values for your PC.")}</div>

    <div class="grp">${t("sec_language", "Language")}</div>
    <label>${t("label_language", "App Language")}</label>
    <div class="actions" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn sm ${curLang === 'pt-BR' ? 'primary' : ''}" onclick="setLanguage('pt-BR')">🇧🇷 Português (Brasil)</button>
      <button type="button" class="btn sm ${curLang === 'en' ? 'primary' : ''}" onclick="setLanguage('en')">🇺🇸 English</button>
      <button type="button" class="btn sm ${curLang === 'es' ? 'primary' : ''}" onclick="setLanguage('es')">🇪🇸 Español</button>
    </div>
    <input type="hidden" data-k="language" value="${esc(curLang)}">

    <div class="grp">${t("sec_look_folders", "Look & folders")}</div>
    <label>${t("label_theme", "Theme")}</label><div class="themes" style="max-width:420px">${Object.entries(THEMES).map(([k, [n, c1, c2]]) => `<button class="${k === document.documentElement.dataset.theme ? "on" : ""}" onclick="setTheme('${k}');openSettings()"><i style="background:linear-gradient(135deg,${c1},${c2})"></i><b>${n}</b></button>`).join("")}</div>
    <label>${t("label_output_folder", "Output folder (finished videos are copied here)")}</label>
    <div class="actions"><div class="path" style="flex:1">${esc(c.output_dir || t("output_folder_default", "(inside each project)"))}</div><button class="btn sm" onclick="pickOutput()">${ic("folder", "sm")} ${t("choose", "Choose")}</button>${c.output_dir ? `<button class="btn sm ghost" onclick="setOutput('')">${t("clear", "Clear")}</button>` : ""}</div>
    <div class="grp">${t("sec_images", "Images (ComfyUI)")}</div>
    <div class="row"><div><label>${t("label_comfy_url", "ComfyUI URL")}</label><input data-k="comfy_url" value="${esc(c.comfy_url)}"></div>
      ${sel("workflow_file", t("label_image_workflow", "Image workflow"), c._workflows)}</div>
    <div class="row">${num("image_width", t("label_image_width", "Image width"), 64)}${num("image_height", t("label_image_height", "Image height"), 64)}${num("image_timeout_sec", t("label_timeout", "Timeout (s)"))}</div>
    <div class="grp">${t("sec_final_video", "Final video")}</div>
    <div class="row">${num("video_width", t("label_width", "Width"))}${num("video_height", t("label_height", "Height"))}${num("fps", t("label_fps", "FPS"))}${sel("encoder", t("label_encoder", "Encoder"), [["auto", t("enc_auto", "Auto (GPU if possible)")], ["h264_nvenc", t("enc_nvenc", "NVIDIA GPU")], ["libx264", t("enc_cpu", "CPU")]])}</div>
    <div class="row">${num("crossfade_sec", t("label_crossfade", "Crossfade (s)"), 0.1)}${num("motion_strength", t("label_motion_strength", "Motion strength (0 to 2)"), 0.1)}${num("scene_gap_sec", t("label_scene_gap", "Pause between scenes (s)"), 0.1)}${num("tail_sec", t("label_tail_sec", "End silence (s)"), 0.5)}</div>
    <div class="row">${sel("chapter_titles_on_screen", t("label_chapter_titles", "Chapter titles on screen"), [["true", t("yes", "Yes")], ["false", t("no", "No")]])}
      <div><label>${t("label_font_path", "Title font (optional .ttf path)")}</label><input data-k="font_path" value="${esc(c.font_path)}" placeholder="C:\\Windows\\Fonts\\georgia.ttf"></div></div>
    <div class="hint" style="margin-top:6px">${t("video_types_hint", "Video types (Sleep, Documentary…) adjust crossfades, pauses and music level on top of these.")}</div>
    <div class="grp">${t("sec_video_scenes", "Video scenes (image to video)")}</div>
    <div class="row">${sel("i2v_workflow_file", t("label_i2v_workflow", "Video model workflow"), c._vworkflows || [])}${num("i2v_max_segments", t("label_i2v_max_clips", "Max clips chained per scene"))}
      ${sel("clip_end", t("label_clip_end", "When a clip ends before the narration"), [["hold", t("clip_hold", "Hold last frame with slow zoom")], ["loop", t("clip_loop", "Loop the clip")]])}</div>
    <div class="row">${num("i2v_width", t("label_i2v_width", "Width (0 = default)"), 16)}${num("i2v_height", t("label_i2v_height", "Height (0 = default)"), 16)}${num("i2v_frames", t("label_i2v_frames", "Frames (0 = default)"), 4)}</div>
    <label>${t("label_i2v_negative", "Negative prompt for video")}</label><textarea data-k="i2v_negative" rows="2">${esc(c.i2v_negative)}</textarea>
    <div class="actions" style="margin-top:10px"><button class="btn sm" onclick="checkModels(this)">${ic("check", "sm")} ${t("btn_check_models", "Check models in ComfyUI")}</button><span class="hint">${t("check_models_hint", "Checks every node and model file the workflows need.")}</span></div>
    <div id="checkBox"></div>
    <div class="grp">${t("sec_video_shape", "Video shape")}</div>
    <div class="actions">${[["16:9 YouTube", 1920, 1080], ["9:16 Shorts / Reels / TikTok", 1080, 1920], ["1:1 Instagram square", 1080, 1080]].map(([l, w, h]) => `<button class="btn sm ${+c.video_width === w && +c.video_height === h ? "primary" : ""}" onclick="setShape(${w},${h})">${l}</button>`).join("")}</div>
    <div class="grp">${t("sec_stock_footage", "Stock footage (free, works without a GPU)")}</div>
    <div class="hint">${t("stock_hint", "Real video clips for documentary and faceless videos. Get a free key at pixabay.com/api/docs or pexels.com/api and paste it here.")}</div>
    <div class="row"><div><label>Pexels API key</label><input type="password" data-k="pexels_api_key" value="${esc(c.pexels_api_key || "")}" placeholder="paste key"></div>
      <div><label>Pixabay API key</label><input type="password" data-k="pixabay_api_key" value="${esc(c.pixabay_api_key || "")}" placeholder="paste key"></div></div>
    <div class="grp">${t("sec_audio", "Audio")}</div>
    <div class="row">${num("music_volume", t("label_music_volume", "Music volume (0 to 1)"), 0.01)}${sel("tts_device", t("label_voice_device", "Voice runs on"), [["auto", t("device_auto", "Auto")], ["cuda", t("device_cuda", "GPU")], ["cpu", t("device_cpu", "CPU")]])}</div>
    <div class="row">${num("cbx_exaggeration", t("label_cbx_exaggeration", "Natural voice emotion (0.25 calm to 0.7 dramatic)"), 0.05)}${num("cbx_cfg_weight", t("label_cbx_pacing", "Natural voice pacing (lower = slower)"), 0.05)}${num("voice_temperature", t("label_cbx_variation", "Natural voice variation"), 0.05)}${num("sentence_pause_sec", t("label_sentence_pause", "Pause between sentences (s)"), 0.05)}</div>
    <div class="hint" style="margin-top:6px">${t("music_hint", "Background music: put royalty-free .mp3 files in assets/music (one is picked per video), or music.mp3 inside a project folder.")}</div>
    <div class="grp">${t("sec_defaults", "Defaults for new videos")}</div>
    <div class="row"><div><label>${t("label_default_voice", "Voice")}</label><select data-k="default_voice">${voiceOptions(c.default_voice)}</select></div>
      ${sel("default_voice_fx", t("label_default_voice_fx", "Voice effect"), CAT.fx.map(f => [f.id, f.name]))}${sel("default_voice_clean", t("label_default_voice_clean", "Studio clean"), [["true", t("on", "On")], ["false", t("off", "Off")]])}</div>
    <div class="grp">${t("sec_backup", "Backup")}</div>
    <div class="actions"><a class="btn sm" href="/api/config/export" download="leccortube_settings.json">${ic("download", "sm")} ${t("btn_export_settings", "Export settings")}</a>
      <label class="btn sm" style="cursor:pointer">${ic("upload", "sm")} ${t("btn_import_settings", "Import settings")}<input type="file" accept=".json" style="display:none" onchange="importSettings(this.files[0])"></label>
      <label class="chk" style="margin:0 0 0 8px"><input type="checkbox" data-k="notify_done" ${c.notify_done !== false ? "checked" : ""} onchange="this.value=this.checked"> ${t("chk_notify_done", "Sound and taskbar flash when a video is ready")}</label></div>
    <div class="hint">${t("backup_hint", "API keys are never included in the export.")}</div>
    <div class="actions" style="margin-top:18px;justify-content:flex-end"><button class="btn" onclick="closeModal('settingsModal')">${t("close", "Close")}</button><button class="btn primary" onclick="saveGlobal()">${t("save", "Save")}</button></div>`;
  const nd = $("#settingsBody [data-k=notify_done]"); if (nd) nd.value = String(nd.checked);
  $("#settingsModal").classList.add("show");
}
async function checkModels(btn) {
  btn.disabled = true; $("#checkBox").innerHTML = `<div class="hint" style="margin-top:6px">Asking ComfyUI…</div>`;
  try {
    await saveGlobal(true);
    const r = await api("/api/check-workflows");
    $("#checkBox").innerHTML = !r.results.length ? `<div class="warn">${esc(r.comfy)}</div>` : r.results.map(x => `
      <div style="margin-top:6px">${x.ok ? "✓" : "✕"} <b>${esc(x.label)}</b> <span class="hint">${esc(x.workflow)}</span>
      ${x.problems.map(pr => `<div class="warn" style="margin:2px 0 0 24px">${esc(pr)}</div>`).join("")}</div>`).join("");
  } catch (e) { $("#checkBox").innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
  btn.disabled = false;
}
async function setShape(w, h) { await api("/api/config", {method: "POST", body: {video_width: w, video_height: h}}); await loadConfig(); openSettings(); toast(`Video shape ${w}x${h} for new renders`); }
async function importSettings(file) {
  if (!file) return;
  try { const vals = JSON.parse(await file.text()); await api("/api/config/import", {method: "POST", body: vals}); await loadConfig(); openSettings(); toast(t("toast_settings_imported", "Settings imported")); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function saveGlobal(keepOpen) {
  const vals = {};
  $$("#settingsBody [data-k]").forEach(el => {
    let v = el.value; const k = el.dataset.k;
    if (el.type === "number") v = parseFloat(v);
    if (v === "true") v = true; else if (v === "false") v = false;
    vals[k] = v;
  });
  if (vals.language && typeof setLanguage === "function" && vals.language !== (I18N && I18N.getLang())) {
    setLanguage(vals.language, false);
  }
  try { await api("/api/config", {method: "POST", body: vals}); await loadConfig(); if (keepOpen !== true) { closeModal("settingsModal"); toast(t("toast_settings_saved", "Settings saved")); } loadHealth(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}

/* ================================================================ DESKTOP WINDOW + UPDATES */
let DESK = false, UPD = null, UPD_POLL = null;
function winApi() { return window.pywebview && window.pywebview.api; }
function initDesktop() {
  if (DESK || !winApi() || !winApi().drag) return;
  DESK = true;
  try { winApi().log("desktop ready " + Object.keys(winApi()).join(",")); } catch (e) {}
  document.body.classList.add("desktop");
  $("#tbMin").innerHTML = `<svg viewBox="0 0 24 24">${ICONS.winmin}</svg>`;
  $("#tbMax").innerHTML = `<svg viewBox="0 0 24 24">${ICONS.winmax}</svg>`;
  $("#tbClose").innerHTML = `<svg viewBox="0 0 24 24">${ICONS.winx}</svg>`;
  $("#tbVer").textContent = "v" + shortV(APP.version);
  $("#tbDrag").addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    if (e.target.closest("button")) return;
    if (e.detail >= 2) { winMax(); return; }
    try { const p = winApi().drag(); if (p && p.catch) p.catch(err => winApi().log && winApi().log("drag error " + err)); } catch (err) { winApi().log && winApi().log("drag throw " + err); }
  });
  $$(".rz").forEach(el => el.addEventListener("mousedown", e => { if (e.button === 0) { e.preventDefault(); winApi().resize(el.dataset.e); } }));
  paintUpdate();
}
window.addEventListener("pywebviewready", initDesktop);
setTimeout(initDesktop, 600); setTimeout(initDesktop, 2000);
function winMin() { winApi() && winApi().minimize(); }
async function winMax() {
  if (!winApi()) return;
  const m = await winApi().toggle_maximize();
  document.body.classList.toggle("maxed", !!m);
  winMaxIcon(m);
}
function winMaxIcon(m) {
  $("#tbMax").innerHTML = `<svg viewBox="0 0 24 24">${m ? ICONS.winres : ICONS.winmax}</svg>`;
  $("#tbMax").title = m ? "Restore" : "Maximise";
}
async function winClose() {
  let busy = false;
  try { const q = await api("/api/queue"); busy = !!q.active; } catch (e) {}
  if (busy && !(await confirmBox("Close LECCORTUBE?", "A video is still being made. Closing stops it (you can continue it later).", "Close anyway", true))) return;
  winApi() && winApi().close();
}
function setWhere(t) { const el = $("#tbWhere"); if (el) el.textContent = t || ""; }

async function checkUpdate(force) {
  try { UPD = await api("/api/update" + (force ? "?force=true" : "")); } catch (e) { UPD = null; }
  paintUpdate();
  return UPD;
}
function paintUpdate() {
  const u = UPD, btn = $("#tbUpd"), chip = $("#updChip");
  const hot = u && u.available, ready = hot && u.state === "ready";
  const label = ready ? `Restart to update` : hot ? (u.state === "downloading" ? `Updating ${Math.round((u.progress || 0) * 100)}%` : `Update to v${esc(u.latest)}`) : (u && u.latest ? "Up to date" : "Check for updates");
  if (btn) { btn.className = "tb-upd" + (hot ? " hot" : ""); btn.innerHTML = `${ic(hot ? "download" : "check", "sm")}<span>${label}</span>`; btn.title = hot ? "A new version of LECCORTUBE is ready" : "Check for updates"; }
  if (chip) chip.innerHTML = hot && !DESK ? `<button class="btn primary sm" onclick="openUpdate()">${ic("download", "sm")} ${label}</button>` : "";
}
async function openUpdate() {
  $("#updModal").classList.add("show");
  $("#updBody").innerHTML = `<div class="hint">Checking for updates…</div>`;
  await checkUpdate(true);
  renderUpdate();
}
function renderUpdate() {
  const u = UPD || {};
  const notes = (u.notes || []).map(n => `<li>${esc(n)}</li>`).join("");
  let body, actions;
  if (!UPD) { body = `<div class="note">${ic("alert")}<div>Could not reach the update server. Check the internet connection.</div></div>`; actions = `<button class="btn" onclick="openUpdate()">↻ Try again</button>`; }
  else if (u.error && !u.available) { body = `<div class="note">${ic("alert")}<div>${esc(u.error)}</div></div>`; actions = `<button class="btn" onclick="openUpdate()">↻ Try again</button>`; }
  else if (!u.available) { body = `<div class="note info">${ic("check")}<div>You have the latest version.</div></div>`; actions = ""; }
  else if (u.state === "downloading") {
    body = `<div class="progress run"><div style="width:${Math.round((u.progress || 0) * 100)}%"></div></div><div class="hint" style="margin-top:8px">${esc(u.message || "Downloading…")}</div>`;
    actions = "";
  } else if (u.state === "ready") {
    body = `<div class="note info">${ic("check")}<div>Version ${esc(u.latest)} is downloaded. LECCORTUBE restarts for a few seconds to finish. Projects, models and settings stay as they are.</div></div>`;
    actions = u.managed ? `<button class="btn primary" onclick="restartUpdate(this)">${ic("refresh", "sm")} Restart and update</button>`
      : `<span class="hint">Close LECCORTUBE and start it again from LECCORTUBE.exe to finish.</span>`;
  } else {
    body = (u.error ? `<div class="note">${ic("alert")}<div>${esc(u.error)}</div></div>` : "") + `<div class="hint">Downloads only the changed app files (${u.size_mb || "a few"} MB). No reinstall.</div>`;
    actions = `<button class="btn primary" onclick="downloadUpdate(this)">${ic("download", "sm")} Download update</button>`;
  }
  $("#updBody").innerHTML = `
    <div class="upd-head"><img src="/static/brand/app_icon.png" alt=""><div><h2 style="margin:0">${u.available ? "New version available" : "LECCORTUBE updates"}</h2>
      <div class="upd-vers">v${esc(shortV(u.current || APP.version))} ${u.available ? `→ <b>v${esc(shortV(u.latest))}${shortV(u.latest) === shortV(u.current || APP.version) ? " update" : ""}</b>${u.date ? ` · ${esc(u.date)}` : ""}` : ""}</div></div></div>
    ${notes ? `<div class="upd-notes"><b>What's new</b><ul>${notes}</ul></div>` : ""}
    <div style="margin-top:14px">${body}</div>
    <div class="actions" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" onclick="closeModal('updModal')">Later</button>${actions}</div>`;
  clearTimeout(UPD_POLL);
  if (u.state === "downloading") UPD_POLL = setTimeout(async () => { try { UPD = await api("/api/update"); } catch (e) {} paintUpdate(); if ($("#updModal").classList.contains("show")) renderUpdate(); }, 1000);
}
async function downloadUpdate(btn) {
  btn.disabled = true;
  try { UPD = await api("/api/update/download", {method: "POST"}); } catch (e) { toast("Error: " + esc(e.message)); }
  paintUpdate(); renderUpdate();
}
async function restartUpdate(btn) {
  btn.disabled = true;
  try { await api("/api/update/apply", {method: "POST"}); }
  catch (e) { toast("Error: " + esc(e.message), 8000); btn.disabled = false; return; }
  closeModal("updModal");
  $("#updating").classList.add("show");
  const want = UPD.latest, t0 = Date.now();
  await new Promise(r => setTimeout(r, 2500));
  const poll = async () => {
    try { const a = await api("/api/app"); if (a.version === want || Date.now() - t0 > 60000) { location.reload(); return; } } catch (e) {}
    if (Date.now() - t0 > 180000) { $("#updatingMsg").textContent = "This is taking long. If LECCORTUBE does not come back, start it again from LECCORTUBE.exe."; }
    setTimeout(poll, 1500);
  };
  poll();
}
$("#updModal").addEventListener("mousedown", e => { if (e.target.id === "updModal") closeModal("updModal"); });

/* ================================================================ START */
(async () => {
  try { APP = await api("/api/app"); } catch (e) {}
  await loadConfig(); await loadCatalog();
  if (CFG && CFG.language && !localStorage.getItem("ot_lang") && typeof setLanguage === "function") { setLanguage(CFG.language, false); }
  paintShell();
  $("#ver").textContent = `LECCORTUBE v${shortV(APP.version) || "1"} · © Leccorside Ai`;
  loadVoiceStatus().then(() => { if (VIEW === "new" && NEW) renderVoiceNew(); });
  setTheme(THEMES[CFG.theme] ? CFG.theme : document.documentElement.dataset.theme, false);
  loadHealth(); await loadSystem(); loadPro();
  const list = await loadProjects();
  let setup = null; try { setup = await api("/api/setup"); } catch (e) {}
  if (setup && !setup.ready) { $("#setupDot").textContent = "setup"; go("setup"); toast(t("toast_welcome", "Welcome to LECCORTUBE. Install the Core items once, then create your first video."), 8000); }
  else if (list.length) openProject(list[0].id); else go("new");
  loadJobChip();
  initDesktop(); checkUpdate();
  setInterval(() => checkUpdate(), 3 * 3600 * 1000);
  setInterval(loadHealth, 30000);
  setInterval(loadJobChip, 4000);
  setInterval(() => { if (VIEW !== "project" || !POLL) loadProjects().catch(() => {}); }, 8000);
})();
