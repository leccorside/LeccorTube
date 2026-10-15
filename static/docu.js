/* ================================================================ LECCORTUBE Pro: Documentary Studio + OpenRouter */
let DOCU = null, DOCU_HOME = null, DOCU_POLL = null;
const LIC = {green: ["ok", "Free to use"], own: ["ok", "Your file"], yellow: ["a", "Credit needed"], red: ["bad", "Not free"]};
const CLAIM = {verified: ["ok", "Verified · 2+ websites"], encyclopedia: ["ok", "Wikipedia"], single: ["a", "One website"], disputed: ["bad", "Disputed"], unsupported: ["", "Not used"]};
const STAGE_NAME = {new: "Starting", researched: "Research done", collected: "Media collected", scanned: "Folder scanned",
  understood: "Pictures understood", story: "Story ready for review", built: "Project created"};

async function showDocu() {
  VIEW = "docu"; markNav(); setWhere("Documentary Studio"); clearTimeout(DOCU_POLL); CUR = null; RP_LAST = {}; $("#main").scrollTop = 0;
  try { DOCU_HOME = await api("/api/docu"); } catch (e) { $("#main").innerHTML = `<div class="card">Error: ${esc(e.message)}</div>`; return; }
  if (VIEW !== "docu") return;
  const H = DOCU_HOME;
  const engNote = H.engine === "openrouter" ? `<span class="chip ok"><span class="dot"></span>AI: OpenRouter (your account)</span>`
    : H.engine === "ollama" ? `<span class="chip ok"><span class="dot"></span>AI: Smart Director on this PC (free)</span>`
    : `<span class="chip bad"><span class="dot"></span>No AI writer yet</span>`;
  $("#main").innerHTML = `
  <div class="card hot"><div class="phead"><div><h2>${PTAG} Documentary Studio</h2>
    <div class="hint">A full documentary from a topic (researched, every fact checked against its sources) or from your own folder of photos and clips. Nothing is paid for before you approve the preview.</div></div>
    </div>
    ${!H.pro ? `<div class="note info" style="margin-top:12px">${ic("zap")}<div>The Documentary Studio is part of LECCORTUBE Pro. <a onclick="go('pro')">Activate Pro</a></div></div>` : ""}
    ${!H.engine ? `<div class="note" style="margin-top:12px">${ic("alert")}<div>To write documentaries LECCORTUBE needs an AI writer: install <b>Smart Director</b> in <a onclick="go('setup')">Setup Center</a> (free, on this PC) or <a onclick="go('pro')">connect OpenRouter</a> (cloud, faster, better writing).</div></div>` : ""}
  </div>
  <div class="dgrid">
    <div class="card dmode"><div class="sec-t"><span class="n">${ic("book")}</span><div><h3>From a topic</h3><small>LECCORTUBE researches it, checks every fact, finds free-to-use photos, maps and clips, and writes the script.</small></div></div>
      <label>Topic</label><input id="dz_topic" placeholder="e.g. Rashid Minhas, the Pakistani pilot who died in 1971">
      <div class="row"><div><label>Language</label><select id="dz_lang">${H.langs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select></div>
        <div><label>Length (minutes)</label><input id="dz_min" type="number" min="1" max="40" value="10"></div></div>
      ${aiPicker("dz", "Research and writing AI")}
      <div><label>Channel style</label><input type="hidden" id="dz_look" value=""><button type="button" class="lookbtn" id="dz_lookbtn" onclick="lookPicker(undefined, 'dz')">${lookBtnInner("")}</button></div>
      ${H.local_weak ? `<div class="hint" style="margin-top:6px">${ic("info", "sm")} For better research on this PC, install a writing model: <code>ollama pull qwen3:14b</code> (9 GB, fits a 12 to 16 GB GPU).</div>` : ""}
      <div class="actions" style="margin-top:12px"><button class="btn primary pill" onclick="docuNew('topic')" ${H.pro ? "" : "disabled"}>${ic("sparkles", "sm")} Start research</button></div></div>
    <div class="card dmode"><div class="sec-t"><span class="n">${ic("folder")}</span><div><h3>From my folder</h3><small>Point to a folder with your photos, clips, audio and notes. LECCORTUBE watches everything, finds the story and builds the documentary.</small></div></div>
      <label>Folder</label><div class="row" style="margin-top:0"><input id="dz_folder" placeholder="C:\\Users\\you\\Pictures\\Trip to Hunza"><button class="btn" onclick="docuBrowse()">${ic("folder", "sm")} Browse</button></div>
      <div class="row"><div><label>What is it about? (optional)</label><input id="dz_ftopic" placeholder="e.g. Our trip to Hunza valley"></div>
        <div><label>Length (minutes)</label><input id="dz_fmin" type="number" min="1" max="40" value="6"></div></div>
      ${aiPicker("dzf", "Story and writing AI")}
      <div><label>Channel style</label><input type="hidden" id="dzf_look" value=""><button type="button" class="lookbtn" id="dzf_lookbtn" onclick="lookPicker(undefined, 'dzf')">${lookBtnInner("")}</button></div>
      <div class="actions" style="margin-top:12px"><button class="btn primary pill" onclick="docuNew('folder')" ${H.pro ? "" : "disabled"}>${ic("layers", "sm")} Scan my folder</button></div>
      <div class="hint" style="margin-top:8px">Your files stay where they are. Nothing leaves this PC unless you choose the cloud later.</div></div>
  </div>
  <div class="card"><div class="sec-t"><span class="n">${ic("film")}</span><h3>Your documentaries</h3></div>
    ${H.items.length ? H.items.map(x => `<div class="drow" onclick="openDocu('${x.id}')"><div class="ic">${ic(x.mode === "topic" ? "book" : "folder")}</div>
      <div style="flex:1;min-width:0"><b>${esc(x.title)}</b><small>${x.mode === "topic" ? "From a topic" : "From a folder"} · ${esc(STAGE_NAME[x.stage] || x.stage)}${["queued", "running"].includes(x.job) ? " · working…" : ""}</small></div>
      ${x.project_id ? `<button class="btn sm" onclick="event.stopPropagation();openProject('${x.project_id}')">Open project</button>` : ""}
      <button class="btn sm ghost" onclick="event.stopPropagation();docuDelete('${x.id}')">${ic("trash", "sm")}</button></div>`).join("")
      : `<div class="hint">Nothing yet. Start with a topic or a folder above.</div>`}</div>`;
}
// ---- which AI researches and writes: this PC (Ollama model), OpenRouter (model), or the Script AI key from the Pro page
function aiPicker(p, label) {
  const A = (DOCU_HOME && DOCU_HOME.ai) || {}, def = A.openrouter ? "cloud" : "local";
  return `<div class="row aipick"><div><label>${label}</label><select id="${p}_ai" onchange="aiModelFill('${p}')">
      <option value="local" ${def === "local" ? "selected" : ""}>This PC with Ollama (free)</option>
      <option value="cloud" ${A.openrouter ? (def === "cloud" ? "selected" : "") : "disabled"}>OpenRouter${A.openrouter ? " (live web search)" : " (connect on the Pro page)"}</option>
      <option value="key" ${A.key ? "" : "disabled"}>${A.key ? esc(A.key.name) + " (your Script AI key)" : "Claude / ChatGPT / Gemini key (add on the Pro page)"}</option></select></div>
    <div><label>Model</label><div id="${p}_modelbox">${aiModelField(p, def)}</div></div></div>`;
}
function aiModelField(p, kind) {
  const A = (DOCU_HOME && DOCU_HOME.ai) || {};
  if (kind === "cloud") return `<select id="${p}_model" onchange="if(this.value==='other'){const m=prompt('OpenRouter model id (for example openai/gpt-5.1)');if(m){const o=document.createElement('option');o.value=m;o.textContent=m;this.insertBefore(o,this.lastChild);this.value=m}else this.value=''}">${(A.or_models || []).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}<option value="other">Other OpenRouter model…</option></select>`;
  if (kind === "key") return `<input disabled value="${esc((A.key || {}).model || "")}" title="Change it on the Pro page (Script AI)">`;
  const have = A.ollama || [];
  if (!have.length) return `<input disabled value="No Ollama model yet" title="Install Smart Director in Setup Center">`;
  return `<select id="${p}_model">${have.map(m => `<option value="${esc(m)}" ${m === A.ollama_best ? "selected" : ""}>${esc(m)}${m === A.ollama_best ? " (best)" : ""}</option>`).join("")}</select>`;
}
function aiModelFill(p) { $("#" + p + "_modelbox").innerHTML = aiModelField(p, $("#" + p + "_ai").value); }
function aiValues(p) {
  const kind = $("#" + p + "_ai").value, m = ($("#" + p + "_model") || {}).value || "";
  return {research_ai: kind, cloud_ok: kind === "cloud", ...(kind === "cloud" && m && m !== "other" ? {ai_model: m} : {}), ...(kind === "local" && m ? {local_model: m} : {})};
}
async function docuBrowse() {
  const r = await api("/api/pick-folder", {method: "POST", body: {title: "Choose the folder with your photos and clips"}}).catch(() => ({}));
  if (r.path) $("#dz_folder").value = r.path;
}
async function docuNew(mode) {
  const body = mode === "topic"
    ? {mode, topic: $("#dz_topic").value.trim(), settings: {language: $("#dz_lang").value, minutes: +$("#dz_min").value || 10,
        ...aiValues("dz"), ...($("#dz_look").value ? {look: $("#dz_look").value} : {})}}
    : {mode, folder: $("#dz_folder").value.trim(), topic: $("#dz_ftopic").value.trim(), settings: {minutes: +$("#dz_fmin").value || 6,
        ...aiValues("dzf"), ...($("#dzf_look").value ? {look: $("#dzf_look").value} : {})}};
  try { const d = await api("/api/docu", {method: "POST", body}); openDocu(d.id); }
  catch (e) { toast("Error: " + esc(e.message), 7000); }
}
async function docuDelete(id) {
  if (!await confirmBox("Delete this documentary?", "Its research, downloaded media and script are deleted. Your own folder and any created project are not touched.", "Delete", true)) return;
  await api(`/api/docu/${id}`, {method: "DELETE"}); showDocu();
}
async function openDocu(id) {
  const fresh = !DOCU || DOCU.id !== id || VIEW !== "docu" || !!$("#main .dmode");
  VIEW = "docu"; markNav(); clearTimeout(DOCU_POLL); RP_LAST = {};
  try { DOCU = await api(`/api/docu/${id}`); } catch (e) { toast("Error: " + esc(e.message)); return; }
  setWhere(docuTitle()); renderDocu(); docuPoll();
  if (fresh) $("#main").scrollTop = 0;
}
function docuTitle() { return (DOCU.story && DOCU.story.title) || DOCU.subject || DOCU.topic; }
function docuRunning() { return ["queued", "running"].includes(DOCU.job.state); }
function docuPoll() {
  clearTimeout(DOCU_POLL);
  if (!DOCU || !docuRunning()) return;
  DOCU_POLL = setTimeout(async () => {
    if (VIEW !== "docu" || !DOCU) return;
    const prev = DOCU.job.state, prevStage = DOCU.stage;
    try { DOCU = await api(`/api/docu/${DOCU.id}`); } catch (e) { docuPoll(); return; }
    if (DOCU.job.state !== prev || DOCU.stage !== prevStage) renderDocu(); else docuStatus();
    if (!docuRunning() && DOCU.job.state === "error") toast(esc(DOCU.job.message), 9000);
    docuPoll();
  }, 1500);
}
function docuStatus() {
  const j = DOCU.job, run = docuRunning();
  if (!$("#dbar")) return;
  $("#dbar").style.width = Math.round((j.progress || 0) * 100) + "%";
  $("#dwrap").classList.toggle("run", run);
  $("#dmsg").textContent = j.message || "";
  $("#dlog").textContent = (j.log || []).join("\n");
  $("#dstop").disabled = !run;
}
async function docuRun(step, body) {
  try { await api(`/api/docu/${DOCU.id}/run/${step}`, {method: "POST", body: body || {}}); DOCU = await api(`/api/docu/${DOCU.id}`); renderDocu(); docuPoll(); }
  catch (e) { toast("Error: " + esc(e.message), 7000); }
}
async function docuSet(values, rerender) {
  try { DOCU = await api(`/api/docu/${DOCU.id}/settings`, {method: "PATCH", body: values}); if (rerender) renderDocu(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
function aThumb(a, shot) {
  const t = shot != null && a.shots ? (a.shots[shot] || {}).thumb : a.thumb;
  return t ? `/docufiles/${DOCU.id}/${t}` : "";
}
function assetById(id) { return (DOCU.assets || []).find(a => a.id === id); }

function renderDocu() {
  const D = DOCU, run = docuRunning(), st = D.settings;
  const folders = ["Research", "Images", "Videos", "Sources", "Final Documentary"].map(f => `<button class="btn sm ghost" onclick="api('/api/docu/${D.id}/open?sub=${encodeURIComponent(f)}',{method:'POST'})">${ic("folder", "sm")} ${f}</button>`).join("");
  let body = "";
  if (D.mode === "topic") {
    if (D.research && D.research.claims) body += researchCard(D);
    if (["researched", "collected", "story", "built"].includes(D.stage)) body += settingsCard(D);
    if (D.stage === "researched" && !run) body += `<div class="card"><div class="actions" style="justify-content:flex-end"><span class="hint" style="flex:1">Next: LECCORTUBE searches Wikimedia Commons, NASA and other free archives for photos, maps and clips, and saves each with its licence.</span><button class="btn primary pill" onclick="docuRun('collect')">${ic("image", "sm")} Find photos and clips</button></div></div>`;
    if (["collected", "story", "built"].includes(D.stage)) body += mediaCard(D);
    if (D.stage === "collected" && !run) body += writeCard();
  } else {
    if (D.scan) body += scanCard(D);
    if (D.stage === "scanned" && !run) body += understandCard(D);
    if (["understood", "story", "built"].includes(D.stage)) { body += mediaCard(D); body += settingsCard(D); }
    if (D.stage === "understood" && !run) body += writeCard();
  }
  if (D.story && D.story.chapters && ["story", "built"].includes(D.stage)) body += storyCard(D);
  $("#main").innerHTML = `
  <div class="card hot"><div class="phead"><div style="min-width:0;flex:1">
      <div class="actions"><a class="chip" style="cursor:pointer" onclick="showDocu()">${ic("chevrons", "sm")} Documentary Studio</a><span class="chip a">${ic(D.mode === "topic" ? "book" : "folder", "sm")} ${D.mode === "topic" ? "From a topic" : "From my folder"}</span><span class="chip">${esc(STAGE_NAME[D.stage] || D.stage)}</span>${D.spent_usd ? `<span class="chip">research cost $${D.spent_usd}</span>` : ""}</div>
      <h2 style="margin-top:10px">${esc(docuTitle())}</h2>${D.mode === "folder" ? `<div class="path">${esc(D.folder)}</div>` : ""}</div>
      <div class="actions">${D.project_id ? `<button class="btn primary" onclick="openProject('${D.project_id}')">${ic("film", "sm")} Open project</button>` : ""}</div></div>
    <div class="actions" style="margin-top:10px">${folders}</div>
    <div class="progress ${run ? "run" : ""}" id="dwrap"><div id="dbar"></div></div>
    <div class="statusline"><span id="dmsg" class="muted"></span><button class="btn danger sm" id="dstop" onclick="api('/api/docu/${D.id}/cancel',{method:'POST'})">${ic("stop", "sm")} Stop</button></div>
    <details class="log"><summary>Log</summary><pre id="dlog"></pre></details>
    ${D.job.state === "error" && !run ? `<div class="note" style="margin-top:10px">${ic("alert")}<div>${esc(D.job.message)}<br><button class="btn sm" style="margin-top:8px" onclick="docuRun('${D.job.step}')">Try again</button></div></div>` : ""}
  </div>${body}`;
  docuStatus();
}

function researchCard(D) {
  const R = D.research, cs = R.claims || [];
  const n = k => cs.filter(c => c.status === k).length;
  const src = Object.fromEntries((R.sources || []).map(s => [s.id, s]));
  return `<div class="card"><div class="sec-t"><span class="n">${ic("book")}</span><div><h3>Research</h3><small>${esc(R.years || "")} · ${(R.sources || []).length} sources · AI: ${esc(R.engine || "")}</small></div></div>
    <div class="hint" style="font-size:14px;color:var(--text)">${esc(R.summary || "")}</div>
    <div class="actions" style="margin:12px 0"><span class="chip ok">${n("verified")} verified</span><span class="chip a">${n("single")} one source</span><span class="chip bad">${n("disputed")} disputed</span>${n("unsupported") ? `<span class="chip">${n("unsupported")} not used</span>` : ""}</div>
    <div class="facts">${cs.map(c => `<div class="fact"><span class="chip ${CLAIM[c.status][0]}">${CLAIM[c.status][1]}</span><div style="flex:1">${c.date ? `<b>${esc(c.date)}</b> ` : ""}${esc(c.text)}${c.note ? `<div class="hint">${esc(c.note)}</div>` : ""}
      <div class="srcs">${c.sources.map(i => src[i] ? `<a title="${esc(src[i].title)}" onclick="openUrl('${esc(src[i].url)}')">${esc(i)} · ${esc(src[i].domain)}</a>` : "").join("")}</div></div></div>`).join("")}</div>
    <details style="margin-top:10px"><summary class="hint">All sources</summary>${(R.sources || []).map(s => `<div class="hint" style="margin-top:4px">${esc(s.id)} · <a onclick="openUrl('${esc(s.url)}')">${esc(s.title)}</a> (${esc(s.domain)})</div>`).join("")}</details></div>`;
}
function openUrl(u) { try { window.open(u, "_blank"); } catch (e) {} }

function settingsCard(D) {
  const H = DOCU_HOME || {styles: [], langs: [], narration: []}, st = D.settings, best = (D.research || {}).best_style;
  const locked = ["built"].includes(D.stage);
  return `<div class="card"><div class="sec-t"><span class="n">${ic("palette")}</span><div><h3>Documentary style</h3><small>${best ? `Recommended for this topic: <b>${esc((H.styles.find(s => s.id === best) || {}).name || best)}</b>. ${esc((D.research || {}).why_style || "")}` : "How the documentary should feel."}</small></div></div>
    <div class="dstyles">${H.styles.map(s => `<button class="dstyle ${(st.style || best || "historical") === s.id ? "on" : ""}" ${locked ? "disabled" : ""} onclick="docuSet({style:'${s.id}'}, true)"><b>${esc(s.name)}${s.id === best ? ` <span class="protag">BEST</span>` : ""}</b><small>${esc(s.desc)}</small></button>`).join("")}</div>
    <div class="row">
      <div><label>Language</label><select ${locked ? "disabled" : ""} onchange="docuSet({language:this.value})">${H.langs.map(l => `<option value="${l.id}" ${st.language === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></div>
      <div><label>Length (minutes)</label><input type="number" min="1" max="40" value="${st.minutes}" ${locked ? "disabled" : ""} onchange="docuSet({minutes:+this.value})"></div>
      <div><label>Narration</label><select ${locked ? "disabled" : ""} onchange="docuSet({narration:this.value})">${H.narration.map(n => `<option value="${n.id}" ${st.narration === n.id ? "selected" : ""}>${esc(n.name)}</option>`).join("")}</select></div>
      <div><label>Audience</label><input value="${esc(st.audience || "")}" ${locked ? "disabled" : ""} onchange="docuSet({audience:this.value})"></div></div></div>${lookCard(D, H, best, locked)}`;
}
function lookCard(D, H, best, locked) {
  const looks = H.looks || [];
  if (!looks.length) return "";
  const st = D.settings, auto = (H.look_for_style || {})[st.style || best || "historical"] || looks[0].id;
  const cur = st.look || auto;
  if (!H.pro) return `<div class="card"><div class="sec-t"><span class="n">${ic("sparkles")}</span><div><h3>Pro look <span class="protag">PRO</span></h3><small>Motion graphics, name labels, years and numbers that animate, article clippings, a grid and colour grade, 3 second cuts and sound effects. ${looks.length} looks inspired by top documentary channels.</small></div></div></div>`;
  const tile = l => `<button class="dlook ${cur === l.id ? "on" : ""}" ${locked ? "disabled" : ""} onclick="docuSet({look:'${l.id}'}, true)">
      ${lookThumb(l.id)}
      <b>${esc(l.name)}${l.id === auto ? ` <span class="protag">AUTO</span>` : ""}</b><small class="like">Like ${esc(l.like)}</small><small>${esc(l.desc)}</small></button>`;
  return `<div class="card"><div class="sec-t"><span class="n">${ic("sparkles")}</span><div><h3>Pro look</h3><small>Motion graphics, labels, article clippings, grid, grade, sound effects and 3 second pacing (fast start, then calmer). Every look is made by LECCORTUBE, nothing copied.</small></div></div>
    <div class="dlooks">${looks.map(tile).join("")}
      <button class="dlook ${cur === "off" ? "on" : ""}" ${locked ? "disabled" : ""} onclick="docuSet({look:'off'}, true)"><span class="sw" style="background:#333"></span><b>Classic</b><small>The plain documentary render, no motion graphics</small></button></div></div>`;
}
// ---- channel style picker: real preview frames made by the engine (hover shows the look's signature graphic)
function lookThumb(id) {
  return `<span class="lthumb"><img loading="lazy" src="/api/docu-looks/${id}/a.jpg" alt=""><img loading="lazy" class="b" src="/api/docu-looks/${id}/b.jpg" alt=""></span>`;
}
function lookBtnInner(id) {
  const l = ((DOCU_HOME && DOCU_HOME.looks) || []).find(x => x.id === id);
  if (!l) return `<span class="lthumb auto">${ic("sparkles")}</span><span class="lb-t"><b>Choose for me</b><small>Picked from the topic. Click to see all ${((DOCU_HOME && DOCU_HOME.looks) || []).length} styles</small></span>`;
  return `${lookThumb(l.id)}<span class="lb-t"><b>${esc(l.name)}</b><small>Like ${esc(l.like)} · click to change</small></span>`;
}
let LOOK_TARGET = "dz";
function lookPicker(cur, target) {
  if (target) LOOK_TARGET = target;
  let m = document.getElementById("lookModal");
  if (!m) {
    m = document.createElement("div");
    m.className = "modal"; m.id = "lookModal";
    m.innerHTML = `<div class="sheet glass wide lsheet" id="lookBody"></div>`;
    m.addEventListener("click", e => { if (e.target === m) m.classList.remove("show"); });
    document.body.appendChild(m);
  }
  const looks = (DOCU_HOME && DOCU_HOME.looks) || [];
  const sel = cur === undefined ? (($("#" + LOOK_TARGET + "_look") || {}).value || "") : cur;
  const card = l => `<button class="lcard ${sel === l.id ? "on" : ""}" onclick="lookChoose('${l.id}')">${lookThumb(l.id)}
      <span class="lc-t"><b>${esc(l.name)}</b>${l.ai_first ? `<span class="chip" style="padding:1px 7px">Mostly AI pictures</span>` : ""}<small class="like">Like ${esc(l.like)}</small><small>${esc(l.desc)}</small></span></button>`;
  $("#lookBody").innerHTML = `<div class="mhead"><div><h2>Channel style</h2><small class="hint">Real frames from LECCORTUBE in each style. Hover a style to see its signature graphic. Names and text on the samples are made up.</small></div>
      <button class="btn sm ghost" onclick="document.getElementById('lookModal').classList.remove('show')">${ic("x", "sm")}</button></div>
    <div class="lgrid"><button class="lcard ${sel ? "" : "on"}" onclick="lookChoose('')"><span class="lthumb auto">${ic("sparkles")}</span>
      <span class="lc-t"><b>Choose for me</b><small>LECCORTUBE picks the style that fits the topic (history, war, business, science...).</small></span></button>
      ${looks.map(card).join("")}</div>`;
  m.classList.add("show");
}
function lookChoose(id) {
  const m = document.getElementById("lookModal");
  if (m) m.classList.remove("show");
  const inp = $("#" + LOOK_TARGET + "_look");
  if (inp) { inp.value = id; $("#" + LOOK_TARGET + "_lookbtn").innerHTML = lookBtnInner(id); }
}
function mediaCard(D) {
  const as = D.assets || [];
  const c = D.collect || {};
  const tiles = as.slice(0, 160).map(a => {
    const L = LIC[(a.license || {}).status] || ["", ""];
    return `<div class="dtile" title="${esc((a.desc || a.name || "").slice(0, 300))}"><div class="im">${aThumb(a) ? `<img loading="lazy" src="${aThumb(a)}">` : ic(a.kind === "clip" ? "video" : "file", "lg")}${a.kind === "clip" ? `<span class="badge">${ic("video", "sm")} ${Math.round(a.duration || 0)}s · ${(a.shots || []).length} shots</span>` : ""}</div>
      <div class="tx"><b>${esc(a.id)}</b> ${L[1] ? `<span class="chip ${L[0]}" style="padding:1px 7px">${L[1]}</span>` : ""}<small>${esc((a.desc || a.name || "").slice(0, 90))}</small></div></div>`;
  }).join("");
  return `<div class="card"><div class="sec-t"><span class="n">${ic("image")}</span><div><h3>Material</h3><small>${D.mode === "topic"
      ? `${c.images || 0} photos and ${c.clips || 0} clips saved in the Images and Videos folders. ${c.green || 0} free to use, ${c.yellow || 0} need a credit (listed in Sources/credits.csv)${c.red_skipped ? `, ${c.red_skipped} not free so not downloaded` : ""}.`
      : `${as.filter(a => a.kind === "image").length} photos and ${as.filter(a => a.kind === "clip").length} clips. Hover a picture to see what LECCORTUBE understood.`}</small></div><div class="grow"></div>
      ${D.mode === "topic" && !docuRunning() && D.stage !== "built" ? `<button class="btn sm" onclick="docuRun('collect')">${ic("refresh", "sm")} Search again</button>` : ""}</div>
    <div class="dtiles">${tiles || `<div class="hint">No media yet.</div>`}</div>
    ${D.mode === "topic" ? `<div class="note info" style="margin-top:10px">${ic("info")}<div>Old photos can be public domain in Pakistan or India but still protected in the USA, and YouTube follows US law. Those are marked "Credit needed". When in doubt, swap them for an AI picture in the story below.</div></div>` : ""}</div>`;
}
function scanCard(D) {
  const s = D.scan;
  return `<div class="card"><div class="sec-t"><span class="n">${ic("layers")}</span><h3>Your folder</h3></div>
    <div class="actions"><span class="chip">${s.images} photos</span><span class="chip">${s.clips} clips · ${s.shots} shots</span><span class="chip">${s.audio} audio</span><span class="chip">${s.documents} documents</span>
      ${s.skipped && (s.skipped.dupe || s.skipped.small || s.skipped.broken) ? `<span class="hint">skipped: ${s.skipped.dupe} duplicates, ${s.skipped.small} too small, ${s.skipped.broken} unreadable</span>` : ""}</div></div>`;
}
function understandCard(D) {
  const or = DOCU_HOME && DOCU_HOME.openrouter, eng = DOCU_HOME && DOCU_HOME.engine;
  const n = (D.scan.images || 0) + (D.scan.shots || 0);
  return `<div class="card"><div class="sec-t"><span class="n">${ic("eye")}</span><div><h3>Let LECCORTUBE look at every picture</h3><small>${n} pictures and shots. This is how it knows what to show on every line.</small></div></div>
    <label class="chk"><input type="radio" name="dvis" value="local" ${!D.settings.cloud_ok ? "checked" : ""} ${eng === "ollama" || !or ? "" : ""}> <span><b>On this PC</b> (Smart Director, free, about ${Math.max(1, Math.round(n * 6 / 60))} min). Nothing leaves your computer.</span></label>
    <label class="chk"><input type="radio" name="dvis" value="cloud" ${D.settings.cloud_ok ? "checked" : ""} ${or ? "" : "disabled"}> <span><b>In the cloud</b> (your OpenRouter account, about $${(n * 0.0004).toFixed(2)}, faster). Small copies of your pictures are sent to OpenRouter.${or ? "" : ` <a onclick="go('pro')">Connect OpenRouter</a> to use this.`}</span></label>
    <div class="actions" style="justify-content:flex-end;margin-top:10px"><button class="btn primary pill" onclick="docuUnderstand()">${ic("eye", "sm")} Understand my pictures</button></div></div>`;
}
async function docuUnderstand() {
  const v = (document.querySelector("input[name=dvis]:checked") || {}).value || "local";
  await docuSet({cloud_ok: v === "cloud"});
  docuRun("understand");
}
function writeCard() {
  return `<div class="card"><div class="actions" style="justify-content:flex-end"><span class="hint" style="flex:1">Next: the AI plans the chapters and writes the narration, picking a photo or shot for every line.</span><button class="btn primary pill" onclick="docuRun('write')">${ic("file", "sm")} Write the story</button></div></div>`;
}

function storyCard(D) {
  const S = D.story, built = D.stage === "built", run = docuRunning();
  let n = 0;
  const chapters = S.chapters.map((c, ci) => `<div class="dch"><div class="dch-t">${ci + 1}. ${esc(c.title)}</div>${c.beats.map((b, bi) => {
    n++;
    const p = b.pick, a = p ? assetById(p.aid) : null, th = a ? aThumb(a, p.shot) : "";
    return `<div class="dbeat"><div class="dpic" onclick="${built ? "" : `docuSwap(${ci},${bi})`}" title="${built ? "" : "Click to choose another picture"}">${th ? `<img loading="lazy" src="${th}">${p.kind === "clip" ? `<span class="badge">${ic("video", "sm")}</span>` : ""}` : `<div class="ai">${ic("sparkles")}<span>AI picture</span></div>`}</div>
      <div class="dtxt"><div class="dnum">${n}</div><div ${built ? "" : `contenteditable="true" onblur="docuText(${ci},${bi},this.innerText)"`} class="dline">${esc(b.text)}</div>
        ${b.check && !built ? `<div class="dcheck" title="These details are not in your files or the checked research. The AI may have made them up. Edit the line, or keep it if you know it is right.">${ic("alert", "sm")} Check: ${b.check.map(esc).join(", ")}</div>` : ""}
        <small>${p ? esc(p.ref) + " · " + esc(((p.shot != null && a && a.shots ? a.shots[p.shot].desc : a && a.desc) || "").slice(0, 110)) : "AI picture: " + esc(b.visual || "")}</small></div></div>`;
  }).join("")}</div>`).join("");
  const folderAsk = D.mode === "folder" && !S.improved && !built && !run && S.weaknesses && S.weaknesses.length;
  return `<div class="card hot"><div class="sec-t"><span class="n">${ic("film")}</span><div><h3>${esc(S.title)}</h3><small>${esc(S.logline || "")}</small></div></div>
    <div class="actions"><span class="chip">${S.chapters.length} chapters</span><span class="chip">${S.beats} scenes</span><span class="chip">about ${S.minutes} min</span><span class="chip ${S.gaps ? "a" : "ok"}">${S.beats - S.gaps} real pictures · ${S.gaps} AI pictures</span>${S.improved ? `<span class="chip ok">improved</span>` : ""}${S.unchecked ? `<span class="chip a" title="Lines with numbers, times or quotes that are not in your files. Check them before you approve.">${S.unchecked} lines to check</span>` : ""}</div>
    <div class="dgrid" style="margin-top:12px">
      <div><b>Strong</b>${(S.strengths || []).map(x => `<div class="hint">+ ${esc(x)}</div>`).join("") || `<div class="hint">-</div>`}</div>
      <div><b>Weak or missing</b>${(S.weaknesses || []).map(x => `<div class="hint">- ${esc(x)}</div>`).join("") || `<div class="hint">-</div>`}</div></div>
    ${(S.suggestions || []).length ? `<div style="margin-top:10px"><b>Suggestions</b>${S.suggestions.map(x => `<div class="hint">→ ${esc(x)}</div>`).join("")}</div>` : ""}
    ${(S.changes || []).length ? `<div style="margin-top:10px"><b>What changed</b>${S.changes.map(x => `<div class="hint">✓ ${esc(x)}</div>`).join("")}</div>` : ""}
    ${folderAsk ? `<div class="note info" style="margin-top:12px">${ic("sparkles")}<div style="flex:1"><b>I have looked at your folder.</b> ${esc(S.weaknesses[0])}${S.suggestions && S.suggestions[0] ? " I suggest: " + esc(S.suggestions[0]) : ""}<br><b>Would you like me to improve the story before making the documentary?</b>
       <div class="actions" style="margin-top:8px"><button class="btn primary sm" onclick="docuRun('improve')">Yes, improve the story</button><button class="btn sm" onclick="docuKeep()">No, keep my story</button></div></div></div>` : ""}
  </div>
  <div class="card"><div class="sec-t"><span class="n">${ic("layers")}</span><div><h3>Script and pictures</h3><small>${built ? "This is what went into the project. Change pictures and lines in the project's Storyboard now." : "Click a line to edit it. Click a picture to choose another one or an AI picture."}</small></div><div class="grow"></div>
    ${!built && !run && D.mode === "topic" ? `<button class="btn sm" onclick="docuImprovePrompt()">${ic("wand", "sm")} Improve the story</button><button class="btn sm" onclick="docuRun('write')">${ic("refresh", "sm")} Write again</button>` : ""}</div>${chapters}</div>
  ${built ? `<div class="card"><div class="note info">${ic("check")}<div style="flex:1"><b>The documentary project is ready.</b> Open it, check the Storyboard, then press <b>Build everything</b> (or <b>Build in cloud</b>). When it is rendered, the video is copied to the Final Documentary folder too.
     <div class="actions" style="margin-top:8px"><button class="btn primary" onclick="openProject('${D.project_id}')">${ic("film", "sm")} Open project</button></div></div></div></div>` : (!run ? `<div class="card" id="dcost"><div class="hint">Working out the cost…</div></div>` : "")}`;
}
async function docuKeep() { await docuSet({}); DOCU.story.improved = true; renderDocu(); docuCost(); }
async function docuImprovePrompt() {
  const note = prompt("Anything special to improve? (optional, e.g. 'shorter intro, more about his childhood')", "") ;
  if (note === null) return;
  docuRun("improve", {note});
}
async function docuText(ci, bi, text) {
  const b = DOCU.story.chapters[ci].beats[bi];
  if ((text || "").trim() === b.text) return;
  try { DOCU = await api(`/api/docu/${DOCU.id}/pick`, {method: "POST", body: {ci, bi, text}}); toast("Line saved"); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function docuSwap(ci, bi) {
  const r = await api(`/api/docu/${DOCU.id}/alts?ci=${ci}&bi=${bi}`).catch(() => ({items: []}));
  const b = DOCU.story.chapters[ci].beats[bi];
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>Choose the picture</h2><div class="hint" style="margin-top:4px">${esc(b.text)}</div></div><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <div class="dtiles" style="margin-top:12px">${r.items.map(it => `<div class="dtile pick" onclick="docuPickRef(${ci},${bi},'${it.ref}')"><div class="im"><img src="/docufiles/${DOCU.id}/${it.thumb}">${it.kind === "clip" ? `<span class="badge">${ic("video", "sm")}</span>` : ""}</div><div class="tx"><b>${esc(it.ref)}</b><small>${esc(it.desc || "")}</small></div></div>`).join("")}
      <div class="dtile pick" onclick="docuPickRef(${ci},${bi},'')"><div class="im"><div class="ai">${ic("sparkles", "lg")}<span>AI picture</span></div></div><div class="tx"><small>Make a new picture for this line</small></div></div></div>`;
  $("#pickModal").classList.add("show");
}
async function docuPickRef(ci, bi, ref) {
  closeModal("pickModal");
  try { DOCU = await api(`/api/docu/${DOCU.id}/pick`, {method: "POST", body: {ci, bi, ref: ref || null}}); renderDocu(); docuCost(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function docuCost() {
  const box = $("#dcost"); if (!box) return;
  const c = await api(`/api/docu/${DOCU.id}/estimate`).catch(() => null);
  if (!c || !$("#dcost")) return;
  const S = DOCU.story;
  box.innerHTML = `<div class="sec-t"><span class="n">${ic("zap")}</span><div><h3>Before you approve: cost</h3><small>${esc(c.note)}</small></div></div>
    ${c.lines.map(l => `<div class="note ${l.usd ? "info" : ""}" style="margin-top:6px">${ic(l.usd ? "zap" : "check")}<div style="flex:1">${esc(l.item)} <span class="hint">· ${esc(l.who)}</span></div><b>${l.usd ? "$" + l.usd.toFixed(2) : "free"}</b></div>`).join("")}
    ${S.gaps && c.openrouter ? `<label class="chk" style="margin-top:10px"><input type="checkbox" ${DOCU.settings.cloud_build ? "checked" : ""} onchange="docuSet({cloud_build:this.checked}).then(docuCost)"> Make the ${S.gaps} AI pictures in the cloud (OpenRouter) instead of on this PC</label>` : ""}
    <div class="actions" style="justify-content:flex-end;margin-top:12px"><span class="hint" style="flex:1">Total from your accounts: <b>${c.usd ? "$" + c.usd.toFixed(2) : "nothing"}</b>${c.spent_research ? ` · research already used about $${c.spent_research}` : ""}</span>
      <button class="btn" onclick="showDocu()">Later</button><button class="btn primary pill" onclick="docuRun('build')">${ic("check", "sm")} Approve and create the documentary</button></div>`;
}
const _renderDocu0 = renderDocu;
renderDocu = function () { _renderDocu0(); if (DOCU && DOCU.stage === "story" && !docuRunning()) docuCost(); };

/* ---------------- OpenRouter card (Pro page) ---------------- */
async function orFill() {
  const box = $("#orBox"); if (!box) return;
  const s = await api("/api/openrouter").catch(() => ({connected: false}));
  if (!$("#orBox")) return;
  box.innerHTML = s.connected
    ? `<div class="actions"><span class="hint">${esc(s.key || "")}</span>${s.balance != null ? `<span class="chip">Balance $${s.balance}</span>` : ""}${s.usage != null ? `<span class="hint">used $${(+s.usage).toFixed(2)}</span>` : ""}
        <button class="btn sm" onclick="openUrl('https://openrouter.ai/credits')">Add credit</button><button class="btn sm ghost" onclick="orDisconnect()">Disconnect</button></div>`
    : `<div class="actions"><button class="btn primary" onclick="orConnect()">${ic("link", "sm")} Connect OpenRouter</button><span class="hint">Log in and click Authorize. No key to copy.</span></div>
       ${s.error ? `<div class="note" style="margin-top:8px">${ic("alert")}<div>${esc(s.error)}</div></div>` : ""}
       <details style="margin-top:10px"><summary class="hint">Or paste a key by hand</summary><div class="row"><input type="password" id="orKey" placeholder="sk-or-..."><button class="btn" onclick="orPaste()">Save key</button></div></details>`;
}
async function orConnect() {
  try { await api("/api/openrouter/connect", {method: "POST"}); toast("Approve in your browser, then come back here.", 9000); let n = 0;
    const t = setInterval(async () => { n++; const s = await api("/api/openrouter").catch(() => ({})); if (s.connected || n > 120) { clearInterval(t); if (s.connected) { toast("OpenRouter connected"); if (VIEW === "pro") showPro(); else { orFill(); loadPro(); } } } }, 2500);
  } catch (e) { toast("Error: " + esc(e.message), 7000); }
}
async function orPaste() {
  try { await api("/api/openrouter/key", {method: "POST", body: {key: $("#orKey").value}}); toast("OpenRouter connected"); if (VIEW === "pro") showPro(); else { orFill(); loadPro(); } }
  catch (e) { toast("Error: " + esc(e.message), 7000); }
}
async function orDisconnect() { await api("/api/openrouter/disconnect", {method: "POST"}); if (VIEW === "pro") showPro(); else { orFill(); loadPro(); } }
