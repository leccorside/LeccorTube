// LECCORTUBE Pro: documentary Timeline tab. Review every shot, graphic and sound before the final render,
// fix what you want, render, then export to Premiere Pro or CapCut if you want to finish in an editor.
let TL = null;
const TLS = {zoom: 36, sel: null, t: 0, dirty: {shots: {}, overlays: {}, sfx: {}}, mix: {}, pid: null};
const TL_MOVES = {push_in: "Push in", pull_out: "Pull out", pan_left: "Pan left", pan_right: "Pan right", tilt_up: "Tilt up", tilt_down: "Tilt down"};
const TL_SPEEDS = {fast_slow: "Fast, then slow", slow_fast: "Slow, then fast", smooth: "Smooth"};
const TL_GCOL = {title: "#e8323c", chapter: "#9b5de5", article: "#f4d35e", quote: "#00bbf9", label: "#f15bb5", year: "#fee440",
  number: "#00f5d4", kinetic: "#ff6b35", place: "#4cc9f0", stamp: "#c9ada7", board: "#e23b3b", spec: "#38bdf8",
  source: "#ffd166", newspaper: "#f4d35e", post: "#9b5de5", hud: "#2ee6d6", circle: "#ffd23f", timeline: "#fee440",
  bubble: "#ffffff", transcript: "#ff8c42"};
const TL_SFX = ["whoosh", "swish", "riser", "impact", "hit", "tick", "typewriter", "shutter", "paper", "glitch", "pop", "boom"];
const tlTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const tlFile = p => p ? `/files/${CUR.id}/${p}` : "";
function tlDirty() { const d = TLS.dirty; return Object.keys(d.shots).length + Object.keys(d.overlays).length + Object.keys(d.sfx).length + Object.keys(TLS.mix).length; }

async function renderDocTimeline(fresh) {
  if (TLS.pid !== CUR.id) { TLS.pid = CUR.id; TLS.sel = null; TLS.t = 0; TLS.dirty = {shots: {}, overlays: {}, sfx: {}}; TLS.mix = {}; }
  if (!TL || fresh !== "keep") $("#tabBody").innerHTML = `<div class="card empty">${ic("layers", "lg")}<br>Planning the timeline...</div>`;
  let r;
  try { r = await api(`/api/projects/${CUR.id}/docu/timeline${fresh === true ? "?fresh=1" : ""}`); }
  catch (e) { $("#tabBody").innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }
  if (!r.ready) { $("#tabBody").innerHTML = voiceChoice(r.message); return; }
  TL = r; paintTL();
}

function paintTL() {
  const P = TL.plan, total = P.total, z = TLS.zoom, W = Math.ceil(total * z) + 40;
  const shots = P.shots, ovs = P.overlays, sfx = P.sfx;
  const on = shots.filter(s => !s.off);
  const fastN = on.filter(s => s.start < P.fast_end), slowN = on.filter(s => s.start >= P.fast_end);
  const avg = a => a.length ? (a.reduce((x, s) => x + (s.end - s.start), 0) / a.length).toFixed(1) : "-";
  const nd = tlDirty(), ex = TL.exports || {};
  const look = TL.looks.find(l => l.id === TL.look) || {};
  const ruler = [];
  const step = z >= 60 ? 5 : z >= 24 ? 10 : z >= 10 ? 30 : 60;
  for (let t = 0; t <= total; t += step) ruler.push(`<span class="tl-tick" style="left:${t * z}px">${tlTime(t)}</span>`);
  const block = (cls, a, b, inner, attrs, css) => `<div class="tl-b ${cls}" style="left:${a * z}px;width:${Math.max(3, (b - a) * z - 1)}px;${css || ""}" ${attrs}>${inner}</div>`;
  const rowShots = shots.map(s => block(`shot ${s.off ? "off" : ""} ${TLS.sel === "s:" + s.id ? "sel" : ""}`, s.start, s.end,
    `<i style="background-image:url('${tlFile((s.src || {}).path)}')"></i>${s.inset ? "<em>inset</em>" : ""}`,
    `onclick="tlSel(event,'s:${s.id}',${s.start})" title="${esc(TL_MOVES[s.move] || s.move)} · ${esc(TL_SPEEDS[s.speed] || "")} · ${Math.round((s.opacity || 0.9) * 100)}%"`)).join("");
  const rowG = ovs.map(o => block(`gfx ${o.off ? "off" : ""} ${TLS.sel === "g:" + o.id ? "sel" : ""}`, o.start, o.end,
    `<b>${esc(o.type || o.kind)}</b> ${esc(String(o.spec.text || o.spec.title || (o.spec.value !== undefined ? (o.spec.prefix || "") + o.spec.value + (o.spec.suffix || "") : "")).slice(0, 40))}`,
    `onclick="tlSel(event,'g:${o.id}',${o.start})"`, `--c:${TL_GCOL[o.type || o.kind] || "#888"}`)).join("");
  const rowV = TL.scenes.map(s => block("voice", s.start, s.start + s.dur, esc(s.text.slice(0, 120)), `onclick="tlSeek(${s.start})" title="${esc(s.text)}"`)).join("");
  const rowS = sfx.map((e, i) => `<div class="tl-sfx ${e.off ? "off" : ""} ${TLS.sel === "x:" + i ? "sel" : ""}" style="left:${e.t * z}px" onclick="tlSel(event,'x:${i}',${e.t})" title="${esc(e.kind)}">${esc(e.kind[0].toUpperCase())}</div>`).join("");
  $("#tabBody").innerHTML = `
  <div class="card"><div class="sec-t"><span class="n">${ic("layers")}</span><div><h3>Documentary timeline <span class="protag">PRO</span></h3>
    <small>Look: <b>${esc(look.name || TL.look)}</b> (like ${esc(look.like || "")}). ${on.length} shots: about ${avg(fastN)} s each in the fast opening (until ${tlTime(P.fast_end)}), ${avg(slowN)} s after. ${ovs.filter(o => !o.off).length} motion graphics, ${sfx.filter(e => !e.off).length} sound effects.${P.edited ? " Your edits are kept." : ""}</small></div></div>
    <div class="actions">
      <select style="width:auto;min-width:200px" onchange="tlLook(this.value)" title="Change the look (re-plans the timeline)">${TL.looks.map(l => `<option value="${l.id}" ${l.id === TL.look ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select>
      <button class="btn ${nd ? "primary" : ""}" ${nd ? "" : "disabled"} onclick="tlSave()">${ic("check", "sm")} Save ${nd ? `(${nd})` : ""}</button>
      <button class="btn" onclick="tlFresh()" title="Plan again from the voice. Your edits are dropped.">${ic("refresh", "sm")} New plan</button>
      <button class="btn primary" onclick="tlRender()">${ic("film", "sm")} Render video</button>
      <span class="grow"></span>
      <button class="btn" onclick="tlExport('premiere')" title="Premiere Pro XML with all pictures, motion graphics (alpha) and audio stems">${ic("download", "sm")} Premiere Pro</button>
      <button class="btn" onclick="tlExport('capcut')" title="CapCut draft (best effort) with the same media">${ic("download", "sm")} CapCut</button>
      ${Object.keys(ex).map(k => `<button class="btn ghost sm" onclick="tlOpenExport('${k}')">${ic("folder", "sm")} ${k === "premiere" ? "Premiere" : "CapCut"} folder</button>`).join("")}
    </div></div>
  <div class="card tl-view">
    <div class="tl-prev">
      <div><div class="hint">Frame at <b id="tlT">${tlTime(TLS.t)}</b> (before colour grade)</div><img id="tlImg" src="/api/projects/${CUR.id}/docu/frame.jpg?t=${TLS.t.toFixed(2)}&w=960" alt=""></div>
      ${TL.video ? `<div><div class="hint">Last render${TL.stale ? ` <span class="chip bad">older than your edits</span>` : ""}</div><video id="tlVid" controls preload="metadata" src="${TL.video}" ontimeupdate="tlVidTime(this)"></video></div>` :
        `<div class="empty" style="align-self:center">${ic("film", "lg")}<br>Not rendered yet. Check the timeline, then click Render video.</div>`}
    </div>
    <div class="actions" style="margin:10px 0 6px"><span class="hint">Zoom</span><input type="range" min="4" max="120" value="${z}" oninput="TLS.zoom=+this.value;paintTL()" style="width:180px">
      <span class="grow"></span><span class="hint">Click a block to edit it. Click the voice row to jump there.</span></div>
    <div class="tl-wrap" id="tlWrap"><div class="tl-in" style="width:${W}px">
      <div class="tl-row ruler" onclick="tlRowSeek(event)">${ruler.join("")}<div class="tl-fast" style="width:${P.fast_end * z}px" title="Fast opening"></div></div>
      <div class="tl-row g"><span class="tl-lbl">Graphics</span>${rowG}</div>
      <div class="tl-row s"><span class="tl-lbl">Shots</span>${rowShots}</div>
      <div class="tl-row v"><span class="tl-lbl">Voice</span>${rowV}</div>
      <div class="tl-row x"><span class="tl-lbl">Sound FX</span>${rowS}</div>
      <div class="tl-ph" id="tlPh" style="left:${TLS.t * z}px"></div>
    </div></div>
    <div class="row" style="margin-top:12px">
      <div><label>Sound effects volume</label><input type="range" min="0" max="150" value="${Math.round((TLS.mix.sfx_volume ?? P.sfx_volume) * 100)}" oninput="TLS.mix.sfx_volume=this.value/100;tlMark()"></div>
      <div><label>Music ducking (music goes down under the voice)</label><input type="range" min="0" max="100" value="${Math.round((TLS.mix.music_duck ?? P.music_duck) * 100)}" oninput="TLS.mix.music_duck=this.value/100;tlMark()"></div>
    </div>
  </div>
  <div id="tlInsp">${tlInspector()}</div>`;
  const wrap = $("#tlWrap"); if (wrap && TLS.scroll) wrap.scrollLeft = TLS.scroll;
  if (wrap) wrap.onscroll = () => { TLS.scroll = wrap.scrollLeft; };
}
function tlMark() { const b = document.querySelector("#tabBody .btn[onclick='tlSave()']"); const n = tlDirty(); if (b) { b.disabled = !n; b.classList.toggle("primary", !!n); b.innerHTML = `${ic("check", "sm")} Save (${n})`; } }

function tlSeek(t, noVideo) {
  TLS.t = Math.max(0, Math.min(TL.plan.total - 0.05, t));
  const ph = $("#tlPh"); if (ph) ph.style.left = TLS.t * TLS.zoom + "px";
  if ($("#tlT")) $("#tlT").textContent = tlTime(TLS.t);
  clearTimeout(tlSeek._h);
  tlSeek._h = setTimeout(() => { const im = $("#tlImg"); if (im) im.src = `/api/projects/${CUR.id}/docu/frame.jpg?t=${TLS.t.toFixed(2)}&w=960&r=${Date.now() % 1e6}`; }, 250);
  const v = $("#tlVid"); if (v && !noVideo && Math.abs(v.currentTime - TLS.t) > 0.3) { try { v.currentTime = TLS.t; } catch (e) {} }
}
function tlRowSeek(ev) { const r = ev.currentTarget.getBoundingClientRect(); tlSeek((ev.clientX - r.left) / TLS.zoom); }
function tlVidTime(v) { if (!v.paused) { TLS.t = v.currentTime; const ph = $("#tlPh"); if (ph) ph.style.left = TLS.t * TLS.zoom + "px"; if ($("#tlT")) $("#tlT").textContent = tlTime(TLS.t); } }
function tlSel(ev, key, t) {
  ev.stopPropagation(); TLS.sel = key;
  const it = tlItem(key);
  tlSeek(key[0] === "g" && it ? (it.start + Math.min(it.end - it.start, 2.5) * 0.6) : t + 0.4);
  document.querySelectorAll(".tl-b.sel,.tl-sfx.sel").forEach(e => e.classList.remove("sel"));
  ev.currentTarget.classList.add("sel");
  $("#tlInsp").innerHTML = tlInspector();
}
function tlItem(key) {
  if (!key || !TL) return null;
  const id = key.slice(2), P = TL.plan;
  return key[0] === "s" ? P.shots.find(s => s.id === id) : key[0] === "g" ? P.overlays.find(o => o.id === id) : P.sfx[+id];
}
function tlSet(key, field, val, sub) {
  const it = tlItem(key), id = key.slice(2), D = TLS.dirty;
  if (!it) return;
  if (key[0] === "s") { it[field] = val; (D.shots[id] = D.shots[id] || {})[field] = val; }
  else if (key[0] === "g") {
    const d = (D.overlays[id] = D.overlays[id] || {});
    if (sub) { it.spec[field] = val; (d.spec = d.spec || {})[field] = val; }
    else if (field === "dur") { it.end = Math.min(TL.plan.total, it.start + Math.max(1, +val)); d.dur = +val; d.start = it.start; }
    else if (field === "start") { const du = it.end - it.start; it.start = Math.max(0, +val); it.end = it.start + du; d.start = it.start; d.dur = du; }
    else { it[field] = val; d[field] = val; }
  } else { it[field] = val; (D.sfx[id] = D.sfx[id] || {})[field] = val; }
  tlMark();
}
function tlInspector() {
  const key = TLS.sel, it = tlItem(key);
  if (!it) return `<div class="card"><div class="hint">${ic("info", "sm")} Select a shot, a graphic or a sound in the timeline to change it.</div></div>`;
  const K = `'${key}'`;
  if (key[0] === "s") {
    const sc = TL.scenes.find(s => s.id === it.scene) || {media: []};
    const cur = (it.src || {}).path;
    return `<div class="card"><div class="sec-t"><span class="n">${ic("image")}</span><div><h3>Shot ${esc(it.id)} · ${tlTime(it.start)} to ${tlTime(it.end)} (${(it.end - it.start).toFixed(1)} s)</h3><small>${esc(sc.text || "")}</small></div></div>
      <label>Picture</label><div class="tl-pics">${sc.media.map(m => `<button class="tl-pic ${m.path === cur ? "on" : ""}" onclick="tlSet(${K},'src',{kind:'${m.kind}',path:'${esc(m.path)}'});paintTL()">${m.kind === "clip" ? `<span>${ic("video", "sm")} clip</span>` : `<img src="${tlFile(m.path)}">`}</button>`).join("") || `<span class="hint">Only one picture for this line.</span>`}</div>
      <div class="row">
        <div><label>Camera move</label><select onchange="tlSet(${K},'move',this.value)">${Object.entries(TL_MOVES).map(([k, v]) => `<option value="${k}" ${it.move === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label>Speed ramp</label><select onchange="tlSet(${K},'speed',this.value)">${Object.entries(TL_SPEEDS).map(([k, v]) => `<option value="${k}" ${it.speed === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label>Opacity <b id="tlOp">${Math.round(it.opacity * 100)}%</b></label><input type="range" min="50" max="100" value="${Math.round(it.opacity * 100)}" oninput="$('#tlOp').textContent=this.value+'%';tlSet(${K},'opacity',this.value/100)"></div>
        <div><label>Move amount</label><input type="range" min="0" max="30" value="${Math.round((it.amount || 0.1) * 100)}" oninput="tlSet(${K},'amount',this.value/100)"></div>
      </div>
      <div class="actions" style="margin-top:8px"><label class="chk"><input type="checkbox" ${it.inset ? "checked" : ""} onchange="tlSet(${K},'inset',this.checked);paintTL()"> <span>Framed picture on the background (inset)</span></label>
        <label class="chk"><input type="checkbox" ${it.off ? "checked" : ""} onchange="tlSet(${K},'off',this.checked);paintTL()"> <span>Remove this shot (the shot before plays longer)</span></label></div></div>`;
  }
  if (key[0] === "g") {
    const s = it.spec, f = (name, lab, long) => `<div ${long ? 'style="grid-column:1/-1"' : ""}><label>${lab}</label>${long ? `<textarea rows="3" onchange="tlSet(${K},'${name}',this.value,true)">${esc(s[name] || "")}</textarea>` : `<input value="${esc(s[name] || "")}" onchange="tlSet(${K},'${name}',this.value,true)">`}</div>`;
    const fields = {article: [["source", "Source"], ["title", "Headline"], ["keyword", "Highlighted word"], ["text", "Text", 1]], chapter: [["kicker", "Small line"], ["text", "Chapter title"]],
      quote: [["text", "Quote", 1], ["sub", "Who said it"]], number: [["prefix", "Before the number"], ["value", "Number"], ["suffix", "After the number"], ["sub", "Caption"]]}[it.kind] || [["text", "Text"], ["sub", "Second line"]];
    return `<div class="card"><div class="sec-t"><span class="n" style="color:${TL_GCOL[it.kind] || "inherit"}">${ic("sparkles")}</span><div><h3>${esc(it.kind[0].toUpperCase() + it.kind.slice(1))} graphic · ${tlTime(it.start)}</h3><small>Edit the words, timing, or switch it off. The preview above shows it.</small></div></div>
      <div class="row">${fields.map(x => f(...x)).join("")}
        <div><label>Starts at (s)</label><input type="number" step="0.1" min="0" value="${it.start.toFixed(1)}" onchange="tlSet(${K},'start',this.value);paintTL()"></div>
        <div><label>Length (s)</label><input type="number" step="0.1" min="1" max="12" value="${(it.end - it.start).toFixed(1)}" onchange="tlSet(${K},'dur',this.value);paintTL()"></div></div>
      <div class="actions" style="margin-top:8px"><label class="chk"><input type="checkbox" ${it.off ? "checked" : ""} onchange="tlSet(${K},'off',this.checked);paintTL()"> <span>Switch this graphic off</span></label>
        <button class="btn sm" onclick="tlSeek(${it.start + 1.2})">${ic("eye", "sm")} Preview</button></div></div>`;
  }
  return `<div class="card"><div class="sec-t"><span class="n">${ic("headphones")}</span><div><h3>Sound effect · ${tlTime(it.t)}</h3><small>Made by LECCORTUBE, free to use.</small></div></div>
    <div class="row"><div><label>Sound</label><select onchange="tlSet(${K},'kind',this.value);paintTL()">${TL_SFX.map(k => `<option ${it.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
      <div><label>Volume</label><input type="range" min="0" max="150" value="${Math.round((it.vol ?? 0.8) * 100)}" oninput="tlSet(${K},'vol',this.value/100)"></div></div>
    <div class="actions" style="margin-top:8px"><label class="chk"><input type="checkbox" ${it.off ? "checked" : ""} onchange="tlSet(${K},'off',this.checked);paintTL()"> <span>Mute this sound</span></label></div></div>`;
}

async function tlSave(quiet) {
  if (!tlDirty()) return true;
  try {
    await api(`/api/projects/${CUR.id}/docu/timeline`, {method: "PATCH", body: {...TLS.dirty, ...TLS.mix}});
    TLS.dirty = {shots: {}, overlays: {}, sfx: {}}; TLS.mix = {};
    if (!quiet) toast("Timeline saved. Click Render video to see it in the video.");
    await renderDocTimeline("keep"); return true;
  } catch (e) { toast("Error: " + esc(e.message)); return false; }
}
async function tlFresh() {
  if (!confirm("Make a new plan from the voice? Your edits on this timeline are dropped.")) return;
  TLS.dirty = {shots: {}, overlays: {}, sfx: {}}; TLS.mix = {}; TLS.sel = null; renderDocTimeline(true);
}
async function tlLook(look) {
  if (tlDirty() && !confirm("Changing the look makes a new plan. Your unsaved edits are dropped. Continue?")) { paintTL(); return; }
  try { TL = await api(`/api/projects/${CUR.id}/docu/look`, {method: "POST", body: {look}}); TLS.dirty = {shots: {}, overlays: {}, sfx: {}}; TLS.mix = {}; TLS.sel = null; CUR.docu_look = look; paintTL(); toast("New look applied. Render to see it."); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function tlRender() { if (await tlSave(true)) run("render"); }
async function tlExport(kind) {
  if (!(await tlSave(true))) return;
  try { await api(`/api/projects/${CUR.id}/run/nle`, {method: "POST", body: {kind}}); toast(`Making the ${kind === "premiere" ? "Premiere Pro" : "CapCut"} project. You can watch the progress at the top.`); refreshSoon(); loadJobChip(); }
  catch (e) { toast("Error: " + esc(e.message)); }
}
async function tlOpenExport(kind) { try { const r = await api(`/api/projects/${CUR.id}/docu/open-export?kind=${kind}`, {method: "POST"}); toast("Folder: " + esc(r.path), 6000); } catch (e) { toast(esc(e.message)); } }
