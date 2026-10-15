/* ================================================================ Timeline editor (Pro)
   An editor like Premiere: a monitor with a live preview (no render needed) and tracks for captions, pictures &
   videos, voice, sound effects and music. Link / unlink picture and voice, drag pauses and sounds, edit the words
   and the captions, drop pictures, clips, sounds and music from the PC onto the tracks. */
const NL = {pid: null, d: null, z: 22, t: 0, sel: null, playing: false, t0: 0, p0: 0, prevT: 0, scroll: 0,
  mode: "live", drag: null, undo: [], mute: {voice: false, clip: false, sfx: false, music: false}, aud: {}, fx: {}, mus: {}, tail: 0, snap: true,
  link: (() => { try { return localStorage.getItem("nl_link") !== "0"; } catch (e) { return true; } })(), fonts: false};
const NL_ROWS = [["c", "sparkles", "T1", "Captions"], ["v", "film", "V1", "Pictures & videos"], ["a", "mic", "A1", "Voice"], ["ca", "video", "A2", "Clip audio"], ["x", "zap", "A3", "SFX"], ["m", "music", "A4", "Music"]];
const NL_MUTE = {a: "voice", ca: "clip", x: "sfx", m: "music"};

function renderTimelineLocked() {
  $("#tabBody").innerHTML = `<div class="card tl-lock"><div class="tl-lock-art">${["Captions", "Pictures", "Voice", "Sound FX", "Music"].map((l, i) =>
      `<div class="tl-lock-row"><span>${l}</span><i style="width:${[70, 92, 80, 60, 96][i]}%"></i></div>`).join("")}</div>
    <div><h3>Timeline ${PTAG}</h3><p class="hint" style="margin:6px 0 12px">Edit your video like in Premiere: a live preview, captions, pictures, voice, sound effects and music on their own tracks. Drag, trim, edit the words and drop your own files from the PC, then render.</p>
      <button class="btn primary" onclick="go('pro')">${ic("zap", "sm")} Unlock with Pro</button></div></div>`;
}

async function renderProjTimeline() {
  const same = NL.pid === CUR.id && NL.d && $("#nlRoot");
  if (NL.drag) return;
  if (NL.pid !== CUR.id) { nlStop(); Object.assign(NL, {pid: CUR.id, d: null, t: 0, sel: null, scroll: 0, undo: [], aud: {}, fx: {}, mus: {}, mode: "live"}); }
  if (!same) $("#tabBody").innerHTML = `<div class="card empty">${ic("layers", "lg")}<br>Laying out the timeline...</div>`;
  let r;
  try { r = await api(`/api/projects/${CUR.id}/timeline`); } catch (e) { $("#tabBody").innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }
  if (TAB !== "timeline" || NL.drag) return;
  if (!r.ready) { nlStop(); NL.d = null; $("#tabBody").innerHTML = voiceChoice(r.message); return; }
  const key = JSON.stringify(r);
  if (same && key === NL.key) return;          // nothing changed (polling): keep the editor as it is
  NL.key = key; nlLoad(r);
  if (same) { nlPaintTracks(); nlPaintInsp(true); } else nlPaint();
}
function nlLoad(r) {
  NL.d = r; const S = r.scenes, L = S[S.length - 1];
  NL.tail = Math.max(0, r.total - (L.start + L.dur + r.gap + L.hold));
  if (NL.t > r.total) NL.t = 0;
  if (NL.sel && !nlSelObj()) NL.sel = null;
  nlFonts();
}
function nlFonts() {  // the caption fonts, so the preview shows the real look
  if (NL.fonts || !NL.d.captions) return; NL.fonts = true;
  const st = document.createElement("style");
  st.textContent = NL.d.captions.fonts.map(f => `@font-face{font-family:"cap_${f.id}";src:url("/capfonts/${f.file}");font-weight:${f.weight};font-display:swap}`).join("\n");
  document.head.appendChild(st);
}
/* positions from durations, pauses and offsets, so a drag shows at once (same math as the render) */
function nlLayout() {
  const D = NL.d, S = D.scenes; let t = D.lead;
  S.forEach(s => { s.start = t; t += s.dur + D.gap + s.hold; });
  D.total = t + NL.tail;
  S.forEach((s, i) => { s.vis_start = i ? s.start : 0; s.vis_end = i < S.length - 1 ? S[i + 1].start : D.total; });
  D.sfx.forEach(e => { const s = nlScene(e.scene); if (s) e.t = s.start + e.at * s.dur; });
  const ch = S.filter(s => s.chapter != null).map(s => s.vis_start), parts = D.music.parts;
  const st = ch.slice(0, parts.length); if (!st.length) st.push(0); while (st.length < parts.length) st.push(st[st.length - 1]);
  parts.forEach((p, k) => { p.start = st[k]; p.end = k + 1 < st.length ? st[k + 1] : D.total; });
  D.music.drops.forEach(d => { const s = nlScene(d.scene); if (s) d.t = s.start; });
}
const nlScene = id => NL.d.scenes.find(s => s.id === id);
const nlTC = t => { t = Math.max(0, t); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor((t % 1) * 10)}`; };
function nlSceneAt(t) { const S = NL.d.scenes; return S.find(s => t >= s.vis_start && t < s.vis_end) || S[S.length - 1]; }
function nlVoiceAt(t) { return NL.d.scenes.find(s => t >= s.start - 0.05 && t <= s.start + s.dur + 0.05); }
function nlSelObj() {
  const s = NL.sel; if (!s || !NL.d) return null;
  if (s.type === "sfx") return NL.d.sfx.find(e => e.scene === s.id && e.k === s.k);
  if (s.type === "music") return NL.d.music.parts[s.k];
  return nlScene(s.id);
}
const nlPlain = t => String(t || "").replace(/\[[^\]]*\]/g, " ").replace(/@\w+:\s*/g, "").replace(/\s+/g, " ").trim();

/* ---------------------------------------------------------------- paint */
function nlPaint() {
  const D = NL.d; nlLayout();
  const S = D.scenes, hits = D.sfx.filter(e => !e.bed), beds = D.sfx.filter(e => e.bed);
  $("#tabBody").innerHTML = `<div id="nlRoot" class="nle">
    <div class="nle-top">
      <div class="nle-mon card">
        <div class="nle-modes"><button class="${NL.mode === "live" ? "on" : ""}" onclick="nlMode('live')">${ic("eye", "sm")} Live preview</button>
          <button class="${NL.mode === "render" ? "on" : ""}" ${D.video ? "" : "disabled title='Render the video first'"} onclick="nlMode('render')">${ic("film", "sm")} Rendered video</button>
          <span class="grow"></span><span class="hint">${S.length} scenes · ${hits.length} sounds${beds.length ? ` + ${beds.length} ambience` : ""} · captions ${D.captions.on ? "on" : "off"}</span></div>
        <div class="nle-screen" id="nlScreen" style="aspect-ratio:${D.w || 16}/${D.h || 9}">${NL.mode === "render" && D.video
          ? `<video id="nlVid" src="${D.video}" preload="metadata" ontimeupdate="nlVidTime(this)" onplay="NL.playing=true;nlTransport()" onpause="NL.playing=false;nlTransport()"></video>`
          : `<img id="nlImg" alt=""><video id="nlClip" muted playsinline preload="auto"></video><div class="nle-cap" id="nlCap"></div><div class="nle-noimg" id="nlNo">${ic("image", "lg")}<br>No picture yet</div>`}</div>
        <div class="nle-transport">
          <button class="btn icon sm" onclick="nlSeek(0)" title="Start (Home)">${ic("skip-back", "sm")}</button>
          <button class="btn icon sm" onclick="nlStepScene(-1)" title="Previous scene (←)">${ic("chevron-left", "sm")}</button>
          <button class="btn primary nle-play" id="nlPlay" onclick="nlToggle()" title="Play / pause (Space)">${ic("play")}</button>
          <button class="btn icon sm" onclick="nlStepScene(1)" title="Next scene (→)">${ic("chevron-right", "sm")}</button>
          <div class="nle-tc"><b id="nlTc">${nlTC(NL.t)}</b><span>/ ${nlTC(D.total)}</span></div>
          <span class="grow"></span>
          <button class="btn sm" onclick="run('render')">${ic("film", "sm")} Render video</button>
        </div>
      </div>
      <div class="nle-insp card" id="nlInsp">${nlInspector()}</div>
    </div>
    <div class="nle-bar">
      <button class="btn sm nle-link ${NL.link ? "on" : ""}" id="nlLink" onclick="nlLinkToggle()" title="Linked: picture and voice of a scene are selected together. Unlinked: each on its own.">${ic(NL.link ? "link" : "unlink", "sm")} ${NL.link ? "Linked" : "Unlinked"}</button>
      <label class="btn sm nle-imp" title="Add pictures, video clips, sounds or music from your PC (or drag files onto the tracks)">${ic("upload", "sm")} Add from my PC<input type="file" multiple accept="image/*,video/*,audio/*" onchange="nlImport(this)"></label>
      <div class="nle-zoom"><button class="btn icon sm" onclick="nlZoom(NL.z/1.4)" title="Zoom out (-)">${ic("minus", "sm")}</button>
        <input type="range" id="nlZ" min="2" max="120" value="${NL.z}" oninput="nlZoom(+this.value, true)" style="--p:${(NL.z - 2) / 118 * 100}%">
        <button class="btn icon sm" onclick="nlZoom(NL.z*1.4)" title="Zoom in (+)">${ic("plus", "sm")}</button>
        <button class="btn sm ghost" onclick="nlFit()">Fit</button></div>
      <label class="chk nle-snap"><input type="checkbox" ${NL.snap ? "checked" : ""} onchange="NL.snap=this.checked"> Snap</label>
      <span class="grow"></span>
      <button class="btn sm ghost" id="nlUndo" onclick="nlUndo()" ${NL.undo.length ? "" : "disabled"} title="Undo (Ctrl+Z)">${ic("refresh", "sm")} Undo</button>
    </div>
    <div class="nle-tl card" id="nlTl">
      <div class="nle-heads"><div class="nle-hd ruler"><span class="hint" id="nlLen">${nlTC(D.total)}</span></div>
        ${NL_ROWS.map(([k, icn, tag, name]) => `<div class="nle-hd ${k} ${NL_MUTE[k] && NL.mute[NL_MUTE[k]] ? "muted" : ""}" data-hd="${k}"><i>${tag}</i>${ic(icn, "sm")}<b title="${name}">${name}</b>
          ${NL_MUTE[k] ? `<button class="nle-mute ${NL.mute[NL_MUTE[k]] ? "on" : ""}" title="Mute in the preview" onclick="nlMute('${NL_MUTE[k]}')">M</button>`
            : k === "c" ? `<button class="nle-mute ${D.captions.on ? "" : "on"}" title="Captions on / off" onclick="nlCapSet({enabled:${!D.captions.on}})">${D.captions.on ? "On" : "Off"}</button>` : ""}</div>`).join("")}</div>
      <div class="nle-scroll" id="nlScroll"><div class="nle-in" id="nlIn"></div></div>
      <div class="nle-dropmsg" id="nlDropMsg">${ic("upload")} Drop pictures or clips on <b>V1</b>, sounds on <b>SFX</b>, music on <b>Music</b></div>
    </div>
  </div>`;
  nlPaintTracks();
  const sc = $("#nlScroll");
  sc.scrollLeft = NL.scroll; sc.onscroll = () => { NL.scroll = sc.scrollLeft; };
  sc.addEventListener("wheel", nlWheel, {passive: false});
  const tl = $("#nlTl");
  tl.addEventListener("dragover", nlDragOver); tl.addEventListener("dragleave", nlDragLeave); tl.addEventListener("drop", nlDrop);
  $$("#nlInsp input[type=range]").forEach(fill);
  nlShow(NL.t);
}
function nlPaintTracks() {
  const D = NL.d, z = NL.z; nlLayout();
  const W = Math.ceil(D.total * z) + 200, sel = NL.sel || {};
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find(s => s * z >= 70) || 600;
  const ticks = []; for (let t = 0; t <= D.total + step; t += step) ticks.push(`<span class="nle-tick" style="left:${t * z}px">${nlTC(t).replace(/\.0$/, "")}</span>`);
  const minor = []; const ms = step / 5; for (let t = 0; t <= D.total; t += ms) minor.push(`<i style="left:${t * z}px"></i>`);
  const S = D.scenes;
  const vSel = s => sel.id === s.id && (sel.type === "scene" || sel.type === "pic" || (NL.link && sel.type === "ca"));
  const aSel = s => sel.id === s.id && (sel.type === "scene" || sel.type === "voice");
  const caSel = s => sel.id === s.id && (sel.type === "scene" || sel.type === "ca" || (NL.link && sel.type === "pic"));
  const chaps = S.filter(s => s.chapter != null).map(s => `<div class="nle-chap" style="left:${s.vis_start * z}px" title="${esc(s.chapter || "")}">${esc(s.chapter || "Chapter")}</div>`).join("");
  const caps = D.captions.on ? D.captions.chunks.map(c => { const v = nlVoiceAt((c.s + c.e) / 2) || nlSceneAt(c.s);
      return `<div class="nle-capb ${sel.type === "cap" && v && sel.id === v.id ? "sel" : ""}" style="left:${c.s * z}px;width:${Math.max(3, (c.e - c.s) * z - 1)}px" onpointerdown="nlDown(event,'cap','${v ? v.id : ""}')" title="${esc(c.text)}">${esc(c.text)}</div>`; }).join("")
    : `<span class="hint nle-off" onclick="nlSelect({type:'cap',id:'${S[0].id}'})" style="cursor:pointer">Captions are off. Click to turn them on and style them.</span>`;
  const pics = S.map(s => {
    const img = s.image_url || "";
    return `<div class="nle-clip v ${vSel(s) ? "sel" : ""} ${img || s.clip_url ? "" : "noimg"} ${s.clip_url ? "vid" : ""}" data-id="${s.id}" style="left:${s.vis_start * z}px;width:${Math.max(4, (s.vis_end - s.vis_start) * z - 2)}px"
      onpointerdown="nlDown(event,'pic','${s.id}')">${img ? `<div class="nle-strip" style="background-image:url('${img}')"></div>` : ""}
      <span class="nle-lbl">${s.clip_url ? ic("video", "sm") : ic("image", "sm")} ${esc(s.id)}${s.own_clip || s.user_image ? " · mine" : ""}</span>
      ${s.hold ? `<span class="nle-hold" style="width:${s.hold * z}px" title="Pause ${s.hold.toFixed(1)} s"></span>` : ""}
      <span class="nle-h r" title="Drag: longer or shorter pause after this line" onpointerdown="nlDown(event,'hold','${s.id}')"></span></div>`;
  }).join("");
  const clipA = S.filter(s => s.ca_has).map(s => `<div class="nle-clip ca ${caSel(s) ? "sel" : ""} ${s.ca_on ? "" : "off"}" data-id="${s.id}" style="left:${s.vis_start * z}px;width:${Math.max(4, (s.vis_end - s.vis_start) * z - 2)}px" onpointerdown="nlDown(event,'ca','${s.id}')">
      ${s.ca_on ? `<canvas data-ca="${s.id}"></canvas>` : ""}<span class="nle-lbl">${ic(NL.link ? "link" : "unlink", "sm")} ${esc(s.id)} sound${s.ca_on ? (s.ca_vol !== 1 ? ` · ${Math.round(s.ca_vol * 100)}%` : "") : " · removed"}</span></div>`).join("");
  const voice = S.filter(s => !s.silent).map(s => `<div class="nle-clip a ${aSel(s) ? "sel" : ""} ${s.pending ? "pending" : ""}" data-id="${s.id}" style="left:${s.start * z}px;width:${Math.max(4, s.dur * z - 1)}px" onpointerdown="nlDown(event,'voice','${s.id}')">
      ${s.pending ? "" : `<canvas data-v="${s.id}"></canvas>`}<span class="nle-lbl">${s.pending ? `${ic("mic", "sm")} not recorded yet · ` : ""}${esc(nlPlain(s.text).slice(0, 80))}</span></div>`).join("");
  const fx = D.sfx.map(e => {
    const on = sel.type === "sfx" && sel.id === e.scene && sel.k === e.k;
    if (e.bed) { const s = nlScene(e.scene); return s ? `<div class="nle-bed ${on ? "sel" : ""}" style="left:${s.vis_start * z}px;width:${Math.max(4, (s.vis_end - s.vis_start) * z - 2)}px" onpointerdown="nlDown(event,'sfxsel','${e.scene}',${e.k})" title="${esc(e.label)} (ambience)"><span>${esc(e.label)}</span></div>` : ""; }
    return `<div class="nle-hit ${on ? "sel" : ""} ${e.user ? "mine" : ""}" style="left:${e.t * z}px" onpointerdown="nlDown(event,'sfx','${e.scene}',${e.k})" title="${esc(e.label)}: drag to move"><span>${esc(e.label)}</span></div>`;
  }).join("");
  const mus = D.music.on ? D.music.parts.map(p => `<div class="nle-clip m ${sel.type === "music" && sel.k === p.i ? "sel" : ""} ${p.file ? "" : "nofile"}" style="left:${p.start * z}px;width:${Math.max(4, (p.end - p.start) * z - 2)}px" onpointerdown="nlDown(event,'music','m',${p.i})">
      <span class="nle-gain" style="bottom:${Math.min(1, p.gain / 2) * 100}%"></span><span class="nle-lbl">${ic("music", "sm")} ${esc(p.mood)}${p.file ? "" : " · not made yet"}</span></div>`).join("")
      + D.music.drops.map(d => `<span class="nle-drop" style="left:${d.t * z}px" title="Music drop"></span>`).join("")
    : `<span class="hint nle-off">Music is off for this video</span>`;
  $("#nlIn").style.width = W + "px";
  $("#nlIn").innerHTML = `<div class="nle-row ruler" onpointerdown="nlDown(event,'seek')"><div class="nle-minor">${minor.join("")}</div>${ticks.join("")}${chaps}</div>
    <div class="nle-row c" data-row="c">${caps}</div>
    <div class="nle-row v" data-row="v">${pics}</div><div class="nle-row a ${NL.mute.voice ? "muted" : ""}" data-row="a">${voice}</div>
    <div class="nle-row ca ${NL.mute.clip ? "muted" : ""}" data-row="ca">${clipA || `<span class="hint nle-off">The sound of your own video clips shows here</span>`}</div>
    <div class="nle-row x ${NL.mute.sfx ? "muted" : ""}" data-row="x">${fx || `<span class="hint nle-off">No sound effects. Drop a sound file here.</span>`}</div><div class="nle-row m ${NL.mute.music ? "muted" : ""}" data-row="m">${mus}</div>
    <div class="nle-ph" id="nlPh" style="left:${NL.t * z}px" onpointerdown="nlDown(event,'seek')"><i></i></div>
    <div class="nle-guide" id="nlGuide"></div>`;
  $$("#nlIn canvas[data-v]").forEach(nlWave); $$("#nlIn canvas[data-ca]").forEach(nlWave);
  const u = $("#nlUndo"); if (u) u.disabled = !NL.undo.length;
  const tc = $(".nle-tc span"); if (tc) tc.textContent = "/ " + nlTC(D.total);
  const ln = $("#nlLen"); if (ln) ln.textContent = nlTC(D.total);
}
function nlWave(c) {
  const ca = !!c.dataset.ca, s = nlScene(c.dataset.v || c.dataset.ca), w = Math.max(4, Math.floor((ca ? s.vis_end - s.vis_start : s.dur) * NL.z - 2)), h = ca ? 30 : 44, pk = (ca ? s.ca_peaks : s.peaks) || [];
  const dpr = window.devicePixelRatio || 1; c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px";
  const g = c.getContext("2d"); g.scale(dpr, dpr);
  g.fillStyle = getComputedStyle(c.parentNode).getPropertyValue("--wave") || "#7ee2a8";
  const n = pk.length; if (!n) return;
  for (let x = 0; x < w; x += 2) { const v = pk[Math.min(n - 1, Math.floor(x / w * n))] || 0, bh = Math.max(1, v * (h - 8)); g.fillRect(x, (h - bh) / 2, 1.4, bh); }
}
function nlZoom(z, fromSlider) {
  const sc = $("#nlScroll"), mid = sc ? (sc.scrollLeft + sc.clientWidth / 2) / NL.z : 0;
  NL.z = Math.max(2, Math.min(120, z));
  const r = $("#nlZ"); if (r) { if (!fromSlider) r.value = NL.z; r.style.setProperty("--p", (NL.z - 2) / 118 * 100 + "%"); }
  nlPaintTracks(); if (sc) sc.scrollLeft = mid * NL.z - sc.clientWidth / 2;
}
function nlFit() { const sc = $("#nlScroll"); if (sc) { nlZoom((sc.clientWidth - 40) / NL.d.total); sc.scrollLeft = 0; } }
function nlWheel(e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); nlZoom(NL.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }
function nlMode(m) { nlStop(); NL.mode = m; nlPaint(); }
function nlMute(k) {
  NL.mute[k] = !NL.mute[k];
  $$(".nle-mute").forEach(b => { const m = (b.getAttribute("onclick").match(/nlMute\('(\w+)'\)/) || [])[1]; if (m) b.classList.toggle("on", NL.mute[m]); });
  Object.entries(NL_MUTE).forEach(([row, m]) => { $$(`[data-row="${row}"], [data-hd="${row}"]`).forEach(el => el.classList.toggle("muted", NL.mute[m])); });
  if (NL.playing) nlAudioSync(NL.t, true); nlShow(NL.t);
}
function nlLinkToggle() {
  NL.link = !NL.link; try { localStorage.setItem("nl_link", NL.link ? "1" : "0"); } catch (e) {}
  const b = $("#nlLink"); if (b) { b.classList.toggle("on", NL.link); b.innerHTML = `${ic(NL.link ? "link" : "unlink", "sm")} ${NL.link ? "Linked" : "Unlinked"}`; }
  if (NL.sel && ["scene", "pic", "voice"].includes(NL.sel.type)) nlSelect({type: NL.link ? "scene" : "pic", id: NL.sel.id});
  toast(NL.link ? "Linked: picture and voice are selected together" : "Unlinked: pick the picture or the voice on its own", 3000);
}

/* ---------------------------------------------------------------- pointer: select, seek, drag */
function nlX(ev) { const r = $("#nlIn").getBoundingClientRect(); return Math.max(0, (ev.clientX - r.left) / NL.z); }
function nlDown(ev, kind, id, k) {
  if (ev.button !== 0) return;
  ev.stopPropagation(); ev.preventDefault();
  const scenePick = t => NL.link ? "scene" : t;
  if (kind === "seek") { nlSeek(nlX(ev)); NL.drag = {kind}; }
  else if (kind === "hold") { const s = nlScene(id); nlSelect({type: scenePick("pic"), id}); NL.drag = {kind, id, x0: ev.clientX, h0: s.hold, moved: false}; }
  else if (kind === "sfx") { const e = NL.d.sfx.find(x => x.scene === id && x.k === k); nlSelect({type: "sfx", id, k}); NL.drag = {kind, id, k, x0: ev.clientX, at0: e.at, moved: false}; }
  else if (kind === "sfxsel") { nlSelect({type: "sfx", id, k}); }
  else if (kind === "music") { nlSelect({type: "music", id: "m", k}); nlSeek(Math.max(NL.d.music.parts[k].start, nlX(ev))); }
  else if (kind === "cap") { if (id) nlSelect({type: "cap", id}); nlSeek(nlX(ev)); }
  else if (kind === "ca") { nlSelect({type: NL.link ? "scene" : "ca", id}); nlSeek(nlX(ev)); }
  else { nlSelect({type: scenePick(kind), id}); nlSeek(nlX(ev)); }
  if (NL.drag) { document.addEventListener("pointermove", nlMove); document.addEventListener("pointerup", nlUp, {once: true}); }
}
function nlSnap(t, except) {
  if (!NL.snap) return t;
  const near = 8 / NL.z, pts = [NL.t, ...NL.d.scenes.flatMap(s => [s.start, s.start + s.dur, s.vis_start])];
  let best = t, bd = near; pts.forEach(p => { if (p !== except && Math.abs(p - t) < bd) { bd = Math.abs(p - t); best = p; } });
  const g = $("#nlGuide"); if (g) { g.style.display = best !== t ? "block" : "none"; g.style.left = best * NL.z + "px"; }
  return best;
}
function nlMove(ev) {
  const d = NL.drag; if (!d) return;
  if (d.kind === "seek") { nlSeek(nlX(ev)); return; }
  const dt = (ev.clientX - d.x0) / NL.z; if (Math.abs(ev.clientX - d.x0) > 2) d.moved = true;
  if (d.kind === "hold") {
    const s = nlScene(d.id), end = nlSnap(s.start + s.dur + NL.d.gap + d.h0 + dt);
    s.hold = Math.round(Math.max(0, Math.min(10, end - s.start - s.dur - NL.d.gap)) * 10) / 10;
    nlPaintTracks(); nlTip(ev, `Pause after the line: ${s.hold.toFixed(1)} s`);
  } else if (d.kind === "sfx") {
    const e = NL.d.sfx.find(x => x.scene === d.id && x.k === d.k), s = nlScene(d.id);
    const t = nlSnap(s.start + d.at0 * s.dur + dt);
    e.at = Math.round(Math.max(0, Math.min(1, (t - s.start) / s.dur)) * 1000) / 1000;
    nlPaintTracks(); nlTip(ev, `${e.label} at ${nlTC(s.start + e.at * s.dur)}`);
  }
}
async function nlUp() {
  document.removeEventListener("pointermove", nlMove);
  const d = NL.drag; NL.drag = null; nlTip(); const g = $("#nlGuide"); if (g) g.style.display = "none";
  if (!d || !d.moved) { if (d && d.kind !== "seek") nlPaintTracks(); return; }
  if (d.kind === "hold") {
    const s = nlScene(d.id); if (s.hold === d.h0) return;
    NL.undo.push({scenes: [{id: s.id, hold: d.h0}]}); await nlSave([{id: s.id, hold: s.hold}], `Pause after ${s.id}: ${s.hold.toFixed(1)} s`);
  } else if (d.kind === "sfx") {
    const e = NL.d.sfx.find(x => x.scene === d.id && x.k === d.k); if (e.at === d.at0) return;
    const before = nlFxList(d.id); if (before[d.k]) before[d.k].at = d.at0;
    NL.undo.push({scenes: [{id: d.id, sfx: before}]}); await nlSave([{id: d.id, sfx: nlFxList(d.id)}], `${e.label} moved`);
  }
}
function nlTip(ev, text) {
  let el = $("#nlTipF"); if (!ev) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "nlTipF"; el.className = "nle-ftip"; document.body.appendChild(el); }
  el.textContent = text; el.style.left = ev.clientX + 14 + "px"; el.style.top = ev.clientY - 34 + "px";
}
function nlSelect(sel) { NL.sel = sel; nlPaintTracks(); nlPaintInsp(); }
function nlPaintInsp(keepTyping) {
  const ins = $("#nlInsp"); if (!ins) return;
  if (keepTyping && ins.contains(document.activeElement) && /TEXTAREA|INPUT/.test(document.activeElement.tagName)) return;
  ins.innerHTML = nlInspector(); $$("#nlInsp input[type=range]").forEach(fill);
}

/* ---------------------------------------------------------------- saving + undo */
function nlFxList(sid) { return NL.d.sfx.filter(e => e.scene === sid).sort((a, b) => a.k - b.k).map(e => ({n: e.name, at: e.at})); }
async function nlSave(scenes, msg) {
  try { CUR = await api(`/api/projects/${CUR.id}/scenes`, {method: "PUT", body: {scenes}}); if (msg) toast(msg + ". The preview shows it now, Render to bake it in.", 3500); }
  catch (e) { toast("Error: " + esc(e.message)); }
  await nlReload();
}
async function nlReload() {
  try { const r = await api(`/api/projects/${CUR.id}/timeline`); if (r.ready) { NL.key = JSON.stringify(r); nlLoad(r); nlPaintTracks(); nlPaintInsp(); } }
  catch (e) { /* keep what is shown */ }
}
async function nlUndo() {
  const u = NL.undo.pop(); if (!u) return;
  if (u.scenes) await nlSave(u.scenes, "Undone");
  else if (u.music) { await nlPatch({music: u.music}); toast("Undone"); }
  else if (u.captions) { await nlPatch({captions: u.captions}); toast("Undone"); }
}
async function nlPatch(body) {
  try { CUR = await api(`/api/projects/${CUR.id}`, {method: "PATCH", body}); } catch (e) { toast("Error: " + esc(e.message)); }
  await nlReload();
}
async function nlHold(id, v) { const s = nlScene(id); NL.undo.push({scenes: [{id, hold: s.hold}]}); await nlSave([{id, hold: +v}], `Pause after ${id}: ${(+v).toFixed(1)} s`); }
async function nlMove2(id, v) { await nlSave([{id, move: v}], "Camera move saved"); }
async function nlText(id) {
  const ta = $("#nlTxt"), s = nlScene(id); if (!ta || !s) return;
  const txt = ta.value.trim(); if (!txt || txt === s.text) { toast("Nothing changed"); return; }
  NL.undo.push({scenes: [{id, text: s.text}]});
  await nlSave([{id, text: txt}], `Line ${id} changed`);
  if (await confirmBox("Record the new line now?", "Only this line is spoken again. The rest of the voice stays as it is.", "Record now")) run("voice");
}
async function nlFxSet(sid, list, msg) { NL.undo.push({scenes: [{id: sid, sfx: nlFxList(sid)}]}); await nlSave([{id: sid, sfx: list}], msg); }
function nlFxDel(sid, k) { const l = nlFxList(sid); const e = l[k]; l.splice(k, 1); NL.sel = {type: NL.link ? "scene" : "pic", id: sid}; nlFxSet(sid, l, `${e ? esc(nlFxLabel(e.n)) : "Sound"} removed`); }
function nlFxAdd(sid, name, at) {
  if (!name) return; const s = nlScene(sid), l = nlFxList(sid);
  if (at == null) at = NL.t >= s.start && NL.t <= s.start + s.dur ? Math.round((NL.t - s.start) / s.dur * 1000) / 1000 : 0.1;
  l.push({n: name, at}); NL.sel = {type: "sfx", id: sid, k: l.length - 1}; nlFxSet(sid, l, `${esc(nlFxLabel(name))} added`);
}
function nlFxSwap(sid, k, name) { const l = nlFxList(sid); l[k].n = name; nlFxSet(sid, l, `Sound changed to ${esc(nlFxLabel(name))}`); }
function nlFxAt(sid, k, v) { const l = nlFxList(sid); l[k].at = +v; nlFxSet(sid, l, "Sound moved"); }
async function nlFxAuto(sid) { NL.undo.push({scenes: [{id: sid, sfx: nlFxList(sid)}]}); await nlSave([{id: sid, sfx: null}], "Automatic sounds again"); }
const nlFxLabel = n => ((NL.d.sfx_lib || []).find(x => x.id === n) || {label: String(n).replace(/^user:/, "My sound: ").replace(/\.wav$/, "")}).label;
async function nlGain(k, v) {
  const secs = (CUR.music.sections || []).map(x => ({...x})); if (!secs[k]) return;
  NL.undo.push({music: {sections: (CUR.music.sections || []).map(x => ({...x}))}});
  secs[k].gain = +v; await nlPatch({music: {sections: secs}}); toast("Music level saved");
}
async function nlVol(v) { NL.undo.push({music: {volume: NL.d.music.volume}}); await nlPatch({music: {volume: +v}}); toast("Music volume saved"); }
async function nlDrop(sid, on) {
  const cur = (CUR.music.drops || []).slice(); NL.undo.push({music: {drops: cur.slice()}});
  await nlPatch({music: {drops: on ? [...new Set([...cur, sid])] : cur.filter(x => x !== sid)}}); toast(on ? "Music drops out at this line" : "Music drop removed");
}
async function nlCapSet(ch, quiet) {
  const old = {}; Object.keys(ch).forEach(k => { old[k] = (CUR.captions || {})[k] === undefined ? null : CUR.captions[k]; });
  NL.undo.push({captions: old}); await nlPatch({captions: ch});
  if (!quiet) toast("Captions saved. The preview shows them, Render to burn them in.", 3500);
  const h = $$(".nle-hd.c .nle-mute")[0]; if (h) { h.textContent = NL.d.captions.on ? "On" : "Off"; h.classList.toggle("on", !NL.d.captions.on); h.setAttribute("onclick", `nlCapSet({enabled:${!NL.d.captions.on}})`); }
}
function nlCapStyle(id) { nlCapSet({style: id, font: null, size: null, color: null, highlight: null, position: null, words: null, upper: null}); }
async function nlCapText(id, reset) {
  const ta = $("#nlCapTxt"), s = nlScene(id); if (!s) return;
  NL.undo.push({scenes: [{id, caption: s.caption || ""}]});
  await nlSave([{id, caption: reset ? "" : (ta ? ta.value : "")}], reset ? "Captions use the spoken words again" : "Caption text saved");
}

/* ---------------------------------------------------------------- files from the PC */
function nlKind(f) { const t = f.type || "", n = (f.name || "").toLowerCase(); return t.startsWith("image/") ? "image" : t.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/.test(n) ? "video" : t.startsWith("audio/") || /\.(wav|mp3|m4a|ogg|flac|aac)$/.test(n) ? "audio" : ""; }
async function nlUpScene(sid, f) {
  const k = nlKind(f), fd = new FormData(); fd.append("file", f);
  toast(`Adding ${esc(f.name)} to ${sid}…`);
  try {
    if (k === "image") await api(`/api/projects/${CUR.id}/scenes/${sid}/image`, {method: "POST", body: fd});
    else if (k === "video") await api(`/api/projects/${CUR.id}/scenes/${sid}/clip`, {method: "POST", body: fd});
    else { toast("Use a picture or a video clip here"); return; }
    toast(`${k === "image" ? "Picture" : "Video clip"} from your PC is on ${sid}`, 4000);
  } catch (e) { toast("Error: " + esc(e.message)); }
  await nlReload();
}
async function nlRemoveClip(sid) { try { await api(`/api/projects/${CUR.id}/scenes/${sid}/clip`, {method: "DELETE"}); toast("Your clip was removed"); } catch (e) { toast(esc(e.message)); } await nlReload(); }
async function nlUpSound(sid, f, at) {
  const fd = new FormData(); fd.append("file", f); toast(`Adding ${esc(f.name)}…`);
  try { const r = await api(`/api/projects/${CUR.id}/sfx-user`, {method: "POST", body: fd}); (NL.d.sfx_lib = NL.d.sfx_lib || []).unshift({id: r.name, label: r.label, kind: "hit", user: true}); nlFxAdd(sid, r.name, at); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function nlUpMusic(k, f) {
  const fd = new FormData(); fd.append("file", f); toast(`Adding ${esc(f.name)} as music part ${k + 1}…`);
  try { NL.undo.push({music: {sections: (CUR.music.sections || []).map(x => ({...x}))}}); CUR = await api(`/api/projects/${CUR.id}/music/${k}/upload`, {method: "POST", body: fd}); toast("Your music is on the timeline", 4000); }
  catch (e) { toast("Error: " + esc(e.message)); }
  await nlReload();
}
function nlFileBtn(label, accept, fn) { return `<label class="btn sm">${ic("upload", "sm")} ${label}<input type="file" accept="${accept}" hidden onchange="if(this.files[0])${fn}(this.files[0])"></label>`; }
async function nlImport(input) {
  const files = [...input.files]; input.value = "";
  const sc = NL.sel && nlScene(NL.sel.id) || nlSceneAt(NL.t);
  const media = files.filter(f => ["image", "video"].includes(nlKind(f)));
  if (media.length > 1) { for (const f of media) await nlAddMedia(f, ""); files.splice(0, files.length, ...files.filter(f => !media.includes(f))); }
  for (const f of files) {
    const k = nlKind(f);
    if (k === "image" || k === "video") { nlMediaChoice(f, NL.sel && nlScene(NL.sel.id) ? sc : null); return; }
    else if (k === "audio") { const v = nlVoiceAt(NL.t) || sc; await nlUpSound(v.id, f); }
    else toast(`${esc(f.name)}: not a picture, video or sound`);
  }
}
function nlDropRow(ev) { const el = document.elementFromPoint(ev.clientX, ev.clientY); const r = el && el.closest(".nle-row[data-row], .nle-hd"); if (!r) return null; return r.dataset.row || ["c", "v", "a", "x", "m"].find(k => r.classList.contains(k)); }
function nlDragOver(ev) {
  if (!ev.dataTransfer || ![...ev.dataTransfer.types].includes("Files")) return;
  ev.preventDefault(); $("#nlTl").classList.add("dropping");
  $$(".nle-row.drop").forEach(r => r.classList.remove("drop")); const row = nlDropRow(ev); const el = row && $(`.nle-row[data-row="${row}"]`); if (el) el.classList.add("drop");
}
function nlDragLeave(ev) { if (!$("#nlTl").contains(ev.relatedTarget)) { $("#nlTl").classList.remove("dropping"); $$(".nle-row.drop").forEach(r => r.classList.remove("drop")); } }
async function nlDrop(ev) {
  ev.preventDefault(); $("#nlTl").classList.remove("dropping"); $$(".nle-row.drop").forEach(r => r.classList.remove("drop"));
  const files = [...(ev.dataTransfer.files || [])]; if (!files.length) return;
  const row = nlDropRow(ev), t = nlX(ev), f = files[0], k = nlKind(f);
  if (row === "m" || (row !== "x" && row !== "a" && k === "audio" && row === "m")) {
    if (k !== "audio") { toast("Drop a music file (mp3, wav…) on the Music track"); return; }
    const p = NL.d.music.parts.find(x => t >= x.start && t < x.end); if (!p) { toast("This video has no music parts. Turn music on in the Music tab."); return; }
    return nlUpMusic(p.i, f);
  }
  if (k === "audio") { const v = nlVoiceAt(t) || nlSceneAt(t); const at = Math.round(Math.max(0, Math.min(1, (t - v.start) / v.dur)) * 1000) / 1000; return nlUpSound(v.id, f, at); }
  if (k === "image" || k === "video") { const S = NL.d.scenes, last = S[S.length - 1]; return t > last.vis_end - 0.05 ? nlAddMedia(f, "") : nlMediaChoice(f, nlSceneAt(t)); }
  toast("Drop pictures, video clips or sounds");
}

/* ---------------------------------------------------------------- inspector */
function nlInspector() {
  const D = NL.d, s = NL.sel, o = nlSelObj();
  if (!s || !o) return `<div class="nle-ih">${ic("sliders")}<div><b>Inspector</b><small>Click a caption, picture, voice line, sound or music part</small></div></div>
    <div class="nle-keys"><div><kbd>Space</kbd> play / pause</div><div><kbd>←</kbd><kbd>→</kbd> previous / next scene</div><div><kbd>Del</kbd> remove the selected sound</div>
      <div><kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</div><div><kbd>Ctrl</kbd>+wheel zoom</div><div>${ic("link", "sm")} Linked selects picture and voice together</div>
      <div>${ic("upload", "sm")} Drag files from your PC onto the tracks</div></div>`;
  if (s.type === "music") {
    return `<div class="nle-ih m">${ic("music")}<div><b>Music · part ${o.i + 1}</b><small>${nlTC(o.start)} to ${nlTC(o.end)} · ${esc(o.mood)}</small></div></div>
      ${o.file ? "" : `<div class="note info" style="margin:8px 0">${ic("info")}<div>No music here yet. Make it on the Music tab or use your own.</div></div>`}
      <label>Level of this part: <b id="nlGv">${Math.round(o.gain * 100)}%</b></label>
      <input type="range" min="0" max="2" step="0.05" value="${o.gain}" oninput="fill(this);$('#nlGv').textContent=Math.round(this.value*100)+'%'" onchange="nlGain(${o.i}, this.value)">
      <label>Music volume (whole video): <b id="nlMv">${Math.round(D.music.volume * 100)}%</b></label>
      <input type="range" min="0" max="1" step="0.01" value="${D.music.volume}" oninput="fill(this);$('#nlMv').textContent=Math.round(this.value*100)+'%'" onchange="nlVol(this.value)">
      <div class="actions" style="margin-top:12px">${nlFileBtn("Use my own music", "audio/*", `(f=>nlUpMusic(${o.i},f))`)}
        <button class="btn sm" onclick="setTab('music')">${ic("headphones", "sm")} Music tab</button>
        <button class="btn sm ghost" onclick="nlSeek(${o.start});nlPlay()">${ic("play", "sm")} Play</button></div>
      <div class="hint" style="margin-top:8px">Your own music is looped and faded to fit this part. Only use music you have the rights to.</div>`;
  }
  if (s.type === "sfx") {
    const sc = nlScene(o.scene), lib = (D.sfx_lib || []).some(x => x.id === o.name) ? D.sfx_lib : [{id: o.name, label: o.label, kind: o.bed ? "bed" : "hit"}, ...(D.sfx_lib || [])];
    return `<div class="nle-ih x">${ic("zap")}<div><b>${esc(o.label)}</b><small>${o.bed ? "Ambience under the whole scene" : `Sound effect at ${nlTC(o.t)}`} · scene ${esc(o.scene)}</small></div></div>
      ${sc.own_sfx ? "" : `<div class="hint" style="margin:6px 0">Chosen automatically. Changing it makes this scene's sounds yours.</div>`}
      ${o.bed ? "" : `<label>Where on the line: <b id="nlAv">${Math.round(o.at * 100)}%</b></label>
        <input type="range" min="0" max="1" step="0.01" value="${o.at}" oninput="fill(this);$('#nlAv').textContent=Math.round(this.value*100)+'%'" onchange="nlFxAt('${o.scene}', ${o.k}, this.value)">`}
      <label>Sound</label><select onchange="nlFxSwap('${o.scene}', ${o.k}, this.value)">${lib.filter(x => (x.kind === "bed") === o.bed).map(x => `<option value="${esc(x.id)}" ${x.id === o.name ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select>
      <div class="actions" style="margin-top:12px"><button class="btn sm" onclick="nlPlayFx('${o.file}')">${ic("play", "sm")} Hear it</button>
        <button class="btn sm danger" onclick="nlFxDel('${o.scene}', ${o.k})">${ic("trash", "sm")} Remove</button>
        ${sc.own_sfx ? `<button class="btn sm ghost" onclick="nlFxAuto('${o.scene}')">Automatic again</button>` : ""}</div>`;
  }
  if (s.type === "cap") return nlCapInsp(o);
  if (s.type === "ca") return `<div class="nle-ih ca">${ic("video")}<div><b>Clip sound · ${esc(o.id)}</b><small>${nlTC(o.vis_start)} to ${nlTC(o.vis_end)} · sound of its video clip</small></div></div>${nlCaSec(o)}`;
  const sc = o, parts = (s.type === "scene" ? ["pic", "voice", "ca", "sfx"] : s.type === "pic" ? ["pic", "ca", "sfx"] : ["voice"]).filter(x => !(x === "voice" && sc.silent) && !(x === "ca" && !sc.ca_has));
  const head = s.type === "voice" ? `${ic("mic")}<div><b>Voice · ${esc(sc.id)}</b><small>${nlTC(sc.start)} to ${nlTC(sc.start + sc.dur)} · ${sc.dur.toFixed(1)} s${sc.pending ? " · not recorded yet" : ""}</small></div>`
    : `${ic(sc.clip_url ? "video" : "image")}<div><b>${s.type === "pic" ? "Picture · " : "Scene "}${esc(sc.id)}${sc.chapter != null ? ` · ${esc(sc.chapter || "Chapter")}` : ""}</b><small>${nlTC(sc.vis_start)} to ${nlTC(sc.vis_end)} · voice ${sc.dur.toFixed(1)} s</small></div>`;
  const fx = D.sfx.filter(e => e.scene === sc.id), drop = D.music.drops.some(d => d.scene === sc.id), lib = D.sfx_lib || [];
  return `<div class="nle-ih ${s.type === "voice" ? "a" : ""}">${head}</div>
    ${parts.includes("voice") ? `<label>Spoken line ${sc.pending ? `<span class="nle-pend">not recorded yet</span>` : ""}</label>
      <textarea id="nlTxt" rows="3" class="nle-ta">${esc(sc.text)}</textarea>
      <div class="actions" style="margin-top:6px"><button class="btn sm primary" onclick="nlText('${sc.id}')">${ic("check", "sm")} Save line</button>
        ${sc.pending ? `<button class="btn sm" onclick="run('voice')">${ic("mic", "sm")} Record changed lines</button>` : `<button class="btn sm" onclick="nlHearLine('${sc.id}')">${ic("play", "sm")} Hear this line</button>`}</div>` : ""}
    ${parts.includes("pic") ? `<div class="nle-picrow">${sc.image ? `<img src="${sc.image_url}" alt="">` : `<div class="nle-pic0">${ic("image")}</div>`}
      <div class="actions">${nlFileBtn("Picture or clip from my PC", "image/*,video/*", `(f=>nlUpScene('${sc.id}',f))`)}
        <button class="btn sm" onclick="regen('${sc.id}')">${ic("refresh", "sm")} New picture</button>
        ${sc.own_clip ? `<button class="btn sm ghost" onclick="nlRemoveClip('${sc.id}')">${ic("x", "sm")} Remove my clip</button>` : ""}</div></div>
      <label>Camera move</label><select onchange="nlMove2('${sc.id}', this.value)"><option value="">Automatic</option>${(D.moves || []).map(m => `<option value="${m.id}" ${sc.move === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>` : ""}
    ${parts.includes("ca") ? nlCaSec(sc) : ""}
    ${sc.silent ? `<div class="hint" style="margin-top:10px">${ic("info", "sm")} Added from your PC: no narration, it plays for ${sc.dur.toFixed(1)} s.</div>` : ""}
    <label>Pause after ${sc.silent ? "this clip" : "the line"}: <b id="nlHv">${sc.hold.toFixed(1)} s</b></label>
    <input type="range" min="0" max="10" step="0.1" value="${sc.hold}" oninput="fill(this);$('#nlHv').textContent=(+this.value).toFixed(1)+' s'" onchange="nlHold('${sc.id}', this.value)">
    ${parts.includes("sfx") ? `<label>Sound effects</label>
      <div class="nle-fxl">${fx.map(e => `<span class="nle-fxc ${e.bed ? "bed" : ""}" onclick="nlSelect({type:'sfx',id:'${sc.id}',k:${e.k}})">${esc(e.label)}<i onclick="event.stopPropagation();nlFxDel('${sc.id}', ${e.k})">${ic("x", "sm")}</i></span>`).join("") || `<span class="hint">None</span>`}
        <select class="nle-add" onchange="nlFxAdd('${sc.id}', this.value)"><option value="">+ Add a sound</option>${lib.map(x => `<option value="${esc(x.id)}">${esc(x.label)}${x.kind === "bed" ? " (ambience)" : ""}</option>`).join("")}</select>
        ${nlFileBtn("From my PC", "audio/*", `(f=>nlUpSound('${sc.id}',f))`)}</div>
      ${D.music.on ? `<label class="chk" style="margin-top:10px"><input type="checkbox" ${drop ? "checked" : ""} onchange="nlDrop('${sc.id}', this.checked)"> Music drops out when this line starts</label>` : ""}` : ""}
    <div class="actions" style="margin-top:12px"><button class="btn sm" onclick="nlSeek(${sc.vis_start});nlPlay()">${ic("play", "sm")} Play from here</button>
      <button class="btn sm ghost" onclick="nlSelect({type:'cap',id:'${sc.id}'})">${ic("sparkles", "sm")} Captions</button>
      <button class="btn sm ghost" onclick="ptlStoryboard('${sc.id}')">${ic("layers", "sm")} Storyboard</button>
      ${s.type !== "voice" ? `<button class="btn sm danger" onclick="nlDelScene('${sc.id}')">${ic("trash", "sm")} Remove ${sc.user_media ? "clip" : "scene"}</button>` : ""}</div>`;
}
function nlCaSec(sc) {
  return `<div class="nle-casec"><label>${ic("video", "sm")} Sound of the video clip ${sc.ca_on ? "" : `<span class="nle-pend">removed</span>`}</label>
    ${sc.ca_on ? `<label>Volume: <b id="nlCv">${Math.round(sc.ca_vol * 100)}%</b></label>
      <input type="range" min="0" max="2" step="0.05" value="${sc.ca_vol}" oninput="fill(this);$('#nlCv').textContent=Math.round(this.value*100)+'%'" onchange="nlCa('${sc.id}',{clip_vol:+this.value})">` : ""}
    <div class="actions" style="margin-top:8px"><button class="btn sm ${sc.ca_on ? "" : "primary"}" onclick="nlCa('${sc.id}',{clip_audio:${!sc.ca_on}})">${sc.ca_on ? `${ic("x", "sm")} Remove the sound` : `${ic("refresh", "sm")} Bring the sound back`}</button>
      ${sc.ca_url ? `<button class="btn sm ghost" onclick="nlPlayFx('${sc.ca_url}')">${ic("play", "sm")} Hear it</button>` : ""}</div>
    <div class="hint" style="margin-top:6px">${NL.link ? "Linked to its video. Unlink (top left) to pick the sound on its own." : "Unlinked: the sound is selected on its own."}</div></div>`;
}
async function nlCa(id, ch) {
  const s = nlScene(id); NL.undo.push({scenes: [{id, clip_audio: s.ca_on, clip_vol: s.ca_vol}]});
  await nlSave([{id, ...ch}], "clip_audio" in ch ? (ch.clip_audio ? "Clip sound is back" : "Clip sound removed") : "Clip volume saved");
}
async function nlDelScene(id) {
  const s = nlScene(id); if (!s) return;
  if (!await confirmBox(s.user_media ? "Remove this clip?" : "Remove this scene?", s.user_media ? "The clip you added from your PC leaves the timeline." : "Its picture, voice and clip leave the video. Re-split on the Script tab brings it back.", "Remove", true)) return;
  nlStop();
  try { CUR = await api(`/api/projects/${CUR.id}/scenes/${id}`, {method: "DELETE"}); NL.sel = null; toast(`${id} removed`); } catch (e) { toast("Error: " + esc(e.message)); }
  await nlReload();
}
/* a picture or clip from the PC: replace the scene under it, or add it as a new clip */
function nlMediaChoice(f, sc) {
  if (!sc) return nlAddMedia(f, "");
  window._nlF = f;
  const S = NL.d.scenes, last = S[S.length - 1];
  $("#pickBody").innerHTML = `<div class="mhead"><div><h2>Add "${esc(f.name)}"</h2><div class="hint">${nlKind(f) === "video" ? "Video clip" : "Picture"} from your PC</div></div><button class="btn icon" onclick="closeModal('pickModal')">${ic("x")}</button></div>
    <div class="nle-choice">
      <button onclick="closeModal('pickModal');nlAddMedia(window._nlF,'${sc.id}')">${ic("plus")}<b>Add as a new clip after ${esc(sc.id)}</b><span>Everything after it moves right. Nothing is replaced.</span></button>
      ${sc.id !== last.id ? `<button onclick="closeModal('pickModal');nlAddMedia(window._nlF,'')">${ic("chevron-right")}<b>Add at the end</b><span>After ${esc(last.id)}, the last clip.</span></button>` : ""}
      <button onclick="closeModal('pickModal');nlUpScene('${sc.id}',window._nlF)">${ic("refresh")}<b>Replace the picture of ${esc(sc.id)}</b><span>Its voice stays. Only the picture or clip changes.</span></button>
    </div>`;
  $("#pickModal").classList.add("show");
}
async function nlAddMedia(f, after) {
  const fd = new FormData(); fd.append("file", f); toast(`Adding ${esc(f.name)} as a new clip…`);
  try {
    const before = new Set(NL.d.scenes.map(s => s.id));
    CUR = await api(`/api/projects/${CUR.id}/scenes/add-media?after=${encodeURIComponent(after || "")}`, {method: "POST", body: fd});
    const nw = CUR.scenes.find(s => !before.has(s.id)); if (nw) NL.sel = {type: NL.link ? "scene" : "pic", id: nw.id};
    toast(`New clip ${nw ? nw.id : ""} added${after ? " after " + after : " at the end"}`, 4000);
  } catch (e) { toast("Error: " + esc(e.message)); }
  await nlReload();
}
function nlCapInsp(sc) {
  const C = NL.d.captions, c = C.set, on = C.on;
  const pos = ["top", "middle", "bottom"].map(x => `<button class="${c.position === x ? "on" : ""}" onclick="nlCapSet({position:'${x}'})">${x[0].toUpperCase() + x.slice(1)}</button>`).join("");
  return `<div class="nle-ih c">${ic("sparkles")}<div><b>Captions</b><small>${on ? `${esc((C.styles.find(x => x.id === c.style) || {}).name || c.style)} style · line ${esc(sc.id)}` : "Off for this video"}</small></div>
      <label class="nle-sw"><input type="checkbox" ${on ? "checked" : ""} onchange="nlCapSet({enabled:this.checked})"><i></i></label></div>
    <label>Caption text for line ${esc(sc.id)} ${sc.caption ? `<span class="nle-pend">edited</span>` : ""}</label>
    <textarea id="nlCapTxt" rows="3" class="nle-ta" placeholder="The spoken words">${esc(sc.caption || nlPlain(sc.text))}</textarea>
    <div class="actions" style="margin-top:6px"><button class="btn sm primary" onclick="nlCapText('${sc.id}')">${ic("check", "sm")} Save text</button>
      ${sc.caption ? `<button class="btn sm ghost" onclick="nlCapText('${sc.id}', true)">Use the spoken words</button>` : ""}<span class="hint">Fix a spelling or shorten it. The voice does not change.</span></div>
    <label>Style</label><select onchange="nlCapStyle(this.value)">${C.styles.map(x => `<option value="${x.id}" ${x.id === c.style ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
    <div class="row"><div><label>Font</label><select onchange="nlCapSet({font:this.value})">${C.fonts.map(f => `<option value="${f.id}" ${f.id === c.font ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div>
      <div style="max-width:110px"><label>Text</label><input type="color" value="${c.color}" onchange="nlCapSet({color:this.value})"></div>
      <div style="max-width:110px"><label>Spoken word</label><input type="color" value="${c.highlight}" onchange="nlCapSet({highlight:this.value})"></div></div>
    <label>Size: <b id="nlCs">${(+c.size).toFixed(1)}</b></label>
    <input type="range" min="2" max="12" step="0.1" value="${c.size}" oninput="fill(this);$('#nlCs').textContent=(+this.value).toFixed(1);NL.d.captions.set.size=+this.value;nlShow(NL.t)" onchange="nlCapSet({size:+this.value},true)">
    <label>Words per caption: <b id="nlCw">${c.words}</b></label>
    <input type="range" min="1" max="10" step="1" value="${c.words}" oninput="fill(this);$('#nlCw').textContent=this.value" onchange="nlCapSet({words:+this.value},true)">
    <label>Position</label><div class="chips">${pos}</div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" ${c.upper ? "checked" : ""} onchange="nlCapSet({upper:this.checked})"> UPPERCASE</label>`;
}
function ptlStoryboard(id) {
  nlStop(); setTab("scenes").then(() => setTimeout(() => { const el = document.querySelector(`[data-sid="${id}"]`) || document.getElementById("sc_" + id); if (el) el.scrollIntoView({behavior: "smooth", block: "center"}); }, 300));
}

/* ---------------------------------------------------------------- live preview (voice, pictures, clips, sounds, music, captions) */
function nlAud(map, key, url, loop) { if (!url) return null; let a = map[key]; if (!a || a._u !== url) { if (a) a.pause(); a = new Audio(url); a._u = url; a.loop = !!loop; a.preload = "auto"; map[key] = a; } return a; }
function nlPlayFx(url) { const a = new Audio(url); a.volume = 0.8; a.play().catch(() => {}); }
function nlHearLine(id) { const s = nlScene(id); if (s && s.audio) { nlPause(); const a = new Audio(s.audio); a.play().catch(() => {}); } }
function nlToggle() { if (NL.mode === "render") { const v = $("#nlVid"); if (v) v.paused ? v.play() : v.pause(); return; } NL.playing ? nlPause() : nlPlay(); }
function nlPlay() {
  if (NL.mode === "render") { const v = $("#nlVid"); if (v) { v.currentTime = NL.t; v.play(); } return; }
  if (NL.t >= NL.d.total - 0.05) NL.t = 0;
  NL.playing = true; NL.t0 = performance.now(); NL.p0 = NL.t; NL.prevT = NL.t; nlTransport(); nlAudioSync(NL.t, true); requestAnimationFrame(nlFrame);
}
function nlPause() { NL.playing = false; nlTransport(); nlSilence(); const c = $("#nlClip"); if (c) c.pause(); }
function nlStop() { NL.playing = false; nlSilence(); }
function nlSilence() { [NL.aud, NL.fx, NL.mus].forEach(m => Object.values(m).forEach(a => { try { a.pause(); } catch (e) {} })); }
function nlTransport() { const b = $("#nlPlay"); if (b) b.innerHTML = ic(NL.playing ? "pause" : "play"); }
function nlFrame() {
  if (!NL.playing || TAB !== "timeline" || !$("#nlRoot")) { if (NL.playing) nlStop(); return; }
  const t = NL.p0 + (performance.now() - NL.t0) / 1000;
  if (t >= NL.d.total) { NL.t = NL.d.total; nlPause(); nlShow(NL.t); return; }
  nlAudioSync(t, false); NL.prevT = t; NL.t = t; nlShow(t, true);
  requestAnimationFrame(nlFrame);
}
function nlAudioSync(t, hard) {
  const D = NL.d;
  D.scenes.forEach(s => {   // voice
    const a = nlAud(NL.aud, s.id, s.pending ? null : s.audio), inside = t >= s.start && t < s.start + s.dur;
    if (!a) return;
    if (inside && !NL.mute.voice) { const want = t - s.start; if (a.paused || hard || Math.abs(a.currentTime - want) > 0.3) { a.currentTime = want; a.play().catch(() => {}); } }
    else if (!a.paused) a.pause();
  });
  D.sfx.forEach(e => {      // sound effects: hits fire once, ambience loops under its scene
    const key = e.scene + ":" + e.k;
    if (e.bed) {
      const s = nlScene(e.scene), a = nlAud(NL.fx, key, e.file, true), on = s && t >= s.vis_start && t < s.vis_end && !NL.mute.sfx;
      if (!a) return; a.volume = 0.3;
      if (on && a.paused) a.play().catch(() => {}); else if (!on && !a.paused) a.pause();
    } else if (!NL.mute.sfx && NL.playing && ((NL.prevT < e.t && e.t <= t) || (hard && Math.abs(e.t - t) < 0.05))) {
      const a = new Audio(e.file); a.volume = 0.75; a.play().catch(() => {});
    }
  });
  const drop = D.music.drops.some(d => t >= d.t - 0.15 && t < d.t + 2.5);
  D.music.parts.forEach(p => {   // music: one part at a time, looped to fill it
    const a = nlAud(NL.mus, "m" + p.i, p.file, true), on = D.music.on && t >= p.start && t < p.end && !NL.mute.music;
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, D.music.volume * p.gain * 0.9 * (drop ? 0 : 1)));
    if (on) { if (a.paused || hard) { const len = a.duration || 0; a.currentTime = len ? (t - p.start) % len : 0; a.play().catch(() => {}); } }
    else if (!a.paused) a.pause();
  });
}
function nlCaption(t) {  // the caption at time t, styled like the render (font, size, colours, position, spoken word)
  const cap = $("#nlCap"), C = NL.d.captions; if (!cap) return;
  const ch = C.on && C.chunks.find(c => t >= c.s && t < c.e + 0.12);
  if (!ch) { cap.style.opacity = 0; return; }
  const c = C.set, scr = $("#nlScreen"), H = scr ? scr.clientHeight : 300, words = ch.text.split(" ");
  const k = Math.min(words.length - 1, Math.floor((t - ch.s) / Math.max(0.05, ch.e - ch.s) * words.length));
  const f = C.fonts.find(x => x.id === c.font) || {};
  cap.style.fontFamily = `"cap_${c.font}", Urbanist, sans-serif`; cap.style.fontWeight = f.weight || 800;
  cap.style.fontSize = Math.max(9, H * c.size / 100) + "px"; cap.style.color = c.color;
  cap.style.top = c.position === "top" ? "8%" : c.position === "middle" ? "50%" : "auto"; cap.style.bottom = c.position === "bottom" ? "7%" : "auto";
  cap.style.transform = c.position === "middle" ? "translateY(-50%)" : "none";
  cap.style.textTransform = c.upper ? "uppercase" : "none";
  cap.innerHTML = words.map((w, i) => i === k ? `<b style="color:${c.highlight}">${esc(w)}</b>` : esc(w)).join(" ");
  cap.style.opacity = 1;
}
function nlShow(t, follow) {
  const D = NL.d; if (!D) return;
  const ph = $("#nlPh"); if (ph) ph.style.left = t * NL.z + "px";
  const tc = $("#nlTc"); if (tc) tc.textContent = nlTC(t);
  if (follow) { const sc = $("#nlScroll"); if (sc) { const x = t * NL.z; if (x > sc.scrollLeft + sc.clientWidth - 60 || x < sc.scrollLeft) sc.scrollLeft = x - 120; } }
  if (NL.mode !== "live") return;
  const s = nlSceneAt(t), img = $("#nlImg"), clip = $("#nlClip"), no = $("#nlNo");
  if (!img) return;
  const p = Math.max(0, Math.min(1, (t - s.vis_start) / Math.max(0.1, s.vis_end - s.vis_start)));
  if (s.clip_url) {
    img.style.display = "none"; clip.style.display = "block"; if (no) no.style.display = "none";
    if (clip._u !== s.clip_url) { clip._u = s.clip_url; clip.src = s.clip_url; }
    clip.muted = !(s.ca_has && s.ca_on && !NL.mute.clip); clip.volume = Math.max(0, Math.min(1, s.ca_vol || 1));
    const want = (s.trim_in || 0) + (t - s.vis_start);
    if (NL.playing) { if (clip.paused) clip.play().catch(() => {}); if (Math.abs(clip.currentTime - want) > 0.35 && clip.duration && want < clip.duration) clip.currentTime = want; }
    else { clip.pause(); if (clip.duration ? want < clip.duration : true) try { clip.currentTime = want; } catch (e) {} }
  } else {
    clip.style.display = "none"; if (!clip.paused) clip.pause();
    if (s.image) { img.style.display = "block"; if (no) no.style.display = "none"; const u = s.image_url; if (img._u !== u) { img._u = u; img.src = u; }
      img.style.transform = `scale(${1.04 + 0.08 * p}) translate(${(p - 0.5) * -1.5}%, ${(p - 0.5) * -1}%)`; }
    else { img.style.display = "none"; if (no) no.style.display = "block"; }
  }
  nlCaption(t);
}
function nlSeek(t) {
  NL.t = Math.max(0, Math.min(NL.d.total, t));
  if (NL.mode === "render") { const v = $("#nlVid"); if (v) v.currentTime = NL.t; }
  if (NL.playing) { NL.t0 = performance.now(); NL.p0 = NL.t; NL.prevT = NL.t; nlAudioSync(NL.t, true); }
  nlShow(NL.t);
}
function nlVidTime(v) { NL.t = v.currentTime; const ph = $("#nlPh"); if (ph) ph.style.left = NL.t * NL.z + "px"; const tc = $("#nlTc"); if (tc) tc.textContent = nlTC(NL.t); }
function nlStepScene(dir) {
  const S = NL.d.scenes, cur = nlSceneAt(NL.t), i = S.indexOf(cur);
  const j = dir < 0 ? (NL.t - cur.vis_start > 0.5 ? i : Math.max(0, i - 1)) : Math.min(S.length - 1, i + 1);
  nlSeek(S[j].vis_start); nlSelect({type: NL.sel && NL.sel.type === "cap" ? "cap" : NL.link ? "scene" : (NL.sel && NL.sel.type === "voice" ? "voice" : "pic"), id: S[j].id});
}
document.addEventListener("keydown", e => {
  if (VIEW !== "project" || TAB !== "timeline" || !$("#nlRoot")) return;
  if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "") || $(".modal.show")) return;
  if (e.code === "Space") { e.preventDefault(); nlToggle(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); e.shiftKey ? nlSeek(NL.t - 5) : nlStepScene(-1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); e.shiftKey ? nlSeek(NL.t + 5) : nlStepScene(1); }
  else if (e.key === "Home") { e.preventDefault(); nlSeek(0); }
  else if ((e.key === "Delete" || e.key === "Backspace") && NL.sel && NL.sel.type === "sfx") { e.preventDefault(); nlFxDel(NL.sel.id, NL.sel.k); }
  else if ((e.key === "Delete" || e.key === "Backspace") && NL.sel && NL.sel.type === "ca") { e.preventDefault(); nlCa(NL.sel.id, {clip_audio: false}); }
  else if ((e.key === "Delete" || e.key === "Backspace") && NL.sel && ["scene", "pic"].includes(NL.sel.type) && (nlScene(NL.sel.id) || {}).user_media) { e.preventDefault(); nlDelScene(NL.sel.id); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); nlUndo(); }
  else if (e.key === "+" || e.key === "=") nlZoom(NL.z * 1.4);
  else if (e.key === "-") nlZoom(NL.z / 1.4);
  else if (e.key.toLowerCase() === "l" && !e.ctrlKey) nlLinkToggle();
});
