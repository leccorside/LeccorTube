/* Menu lateral compartilhado do LeccorTubeAgent (todas as telas usam este mesmo arquivo).
 *
 * Uso na página: <aside id="menuLateral"></aside><script src="/ui/sidebar.js"></script>
 * O script roda na hora (síncrono), então os IDs abaixo já existem quando o JS da página roda:
 *   sidebarChannelTitle, sidebarChannelSubs, sidebarChannelDot, sidebarChannelCount,
 *   sidebarCreatedCount, sidebarAgentsBadge, sidebarGpu, sidebarTemp, sidebarAgentes.
 * Ações que só existem em algumas telas (modal de canais, parar esteira) são chamadas se a
 * página tiver a função; senão o item leva para a Esteira de Produção.
 */
(function () {
  const caminho = location.pathname.replace(/\/+$/, "") || "/";
  const ativo = caminho === "/videos" || caminho === "/agent/videos" ? "videos"
    : caminho === "/models" || caminho === "/agent/models" ? "models"
    : "esteira";
  const naEsteira = ativo === "esteira";
  const ou = (fn) => `window.${fn} ? ${fn}() : (location.href='/agent')`;

  const css = `
    #menuLateral { width: 270px; height: 100vh; position: sticky; top: 0; flex-shrink: 0; background: #0d111a;
      border-right: 1px solid #1c2638; display: flex; flex-direction: column; justify-content: space-between; z-index: 40; user-select: none; }
    #menuLateral nav > a { gap: 8px; white-space: nowrap; }
    #menuLateral nav > a > div:first-child { min-width: 0; }
    #menuLateral nav > a > div:first-child > span:last-child { overflow: hidden; text-overflow: ellipsis; }
    #menuLateral nav > a > :last-child:not(div) { flex-shrink: 0; }`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  const item = (id, href, onclick, icone, texto, direita) => {
    const on = ativo === id;
    const attrs = onclick ? `href="javascript:void(0)" onclick="${onclick}"` : `href="${href}"`;
    return `<a ${attrs} ${on ? 'aria-current="page"' : ""} class="px-3 py-2.5 rounded-lg flex items-center justify-between text-[13px] group cursor-pointer transition-all ${on
      ? "bg-gradient-to-r from-amber-500/15 via-[#141d30] to-[#141d30] border-l-2 border-amber-500 text-slate-100 font-semibold shadow-sm"
      : "text-slate-400 hover:bg-[#111726] hover:text-slate-100"}">
      <div class="flex items-center gap-3"><span class="material-symbols-outlined text-[19px] ${on ? "text-amber-400" : "text-slate-400 group-hover:text-amber-400"} transition-colors">${icone}</span>
        <span class="${on ? "text-amber-300 font-medium" : ""}">${texto}</span></div>${direita || ""}</a>`;
  };
  const badge = (id, txt) => `<span id="${id}" class="px-1.5 py-0.5 rounded-full bg-[#111726] text-slate-400 font-mono text-[10px]">${txt}</span>`;

  document.getElementById("menuLateral").innerHTML = `
  <div class="flex flex-col p-4 space-y-4">
    <div class="flex items-center gap-3 px-2 py-1">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center p-1 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
        <svg class="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      <div class="flex flex-col">
        <div class="flex items-center gap-1.5">
          <span class="text-[16px] text-slate-100 font-bold tracking-tight font-sans">LeccorTube</span>
          <span class="px-1.5 rounded bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 text-[9px] border border-amber-500/30 font-semibold tracking-wider font-mono">v4.2</span>
        </div>
        <span class="text-[9px] text-slate-400 tracking-widest uppercase font-mono">Autonomous Studio</span>
      </div>
    </div>

    <div onclick="${ou("openChannelModal")}" class="p-2.5 rounded-xl bg-[#111726] border border-[#1c2638] flex items-center justify-between hover:border-amber-500/40 transition-colors cursor-pointer group shadow-sm" title="Gerenciar canais e políticas">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0"><span class="material-symbols-outlined text-[16px]">smart_display</span></div>
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <span id="sidebarChannelTitle" class="text-[13px] text-slate-200 font-semibold truncate group-hover:text-amber-400 transition-colors">Carregando…</span>
            <span id="sidebarChannelDot" class="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0"></span>
          </div>
          <span id="sidebarChannelSubs" class="text-[10px] text-slate-400 font-mono truncate">—</span>
        </div>
      </div>
      <span class="material-symbols-outlined text-slate-400 text-[16px] group-hover:text-slate-200">unfold_more</span>
    </div>

    <nav class="space-y-1 pt-1">
      <div class="px-2 pb-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-mono">Orquestração</div>
      ${item("esteira", "/agent", null, "bolt", "Esteira de Produção", `<span class="w-2 h-2 rounded-full ${naEsteira ? "bg-amber-400" : "bg-amber-400/50 group-hover:bg-amber-400"}"></span>`)}
      ${item("videos", "/videos", null, "video_library", "Vídeos Criados", badge("sidebarCreatedCount", "—"))}
      ${item("models", "/models", null, "neurology", "Agentes &amp; Modelos", badge("sidebarAgentsBadge", "—"))}
      ${item("canais", null, ou("openChannelModal"), "connected_tv", "Canais Conectados", `<span id="sidebarChannelCount" class="text-[10px] text-slate-400 font-mono">—</span>`)}
      <div class="px-2 pt-3 pb-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-mono">Sistema</div>
      ${item("config", null, ou("openChannelModal"), "settings", "Configurações", `<span class="material-symbols-outlined text-[15px] text-slate-500">chevron_right</span>`)}
    </nav>
  </div>

  <div class="p-3 border-t border-[#1c2638] space-y-3 bg-[#0a0d15]">
    <div class="p-2.5 rounded-xl bg-[#111726] border border-[#1c2638] space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[9px] text-slate-400 uppercase tracking-wider font-semibold font-mono">GPU local</span>
        <span id="sidebarGpu" class="text-[10px] text-cyan-400 font-mono truncate">—</span>
      </div>
      <div class="flex items-center justify-between text-[11px] font-mono gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span id="sidebarAgentesDot" class="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0"></span>
          <span id="sidebarAgentes" class="font-bold tracking-tight text-slate-300 truncate">— AGENTES REAIS</span>
        </div>
        <span id="sidebarTemp" class="text-slate-400 text-[10px] flex-shrink-0">—</span>
      </div>
    </div>
    <div class="p-2 rounded-xl bg-[#141d30]/60 flex items-center justify-between">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">OP</div>
        <div class="flex flex-col min-w-0">
          <span class="text-[13px] text-slate-200 font-medium leading-none truncate">Operador</span>
          <span class="text-[10px] text-slate-400 leading-tight mt-0.5 truncate font-mono">Este computador</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <a href="/simples" class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="Modo manual (LeccorTube Simples)"><span class="material-symbols-outlined text-[17px]">tune</span></a>
        ${naEsteira
          ? `<button onclick="window.openStopModal && openStopModal()" class="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors" title="Parar esteira"><span class="material-symbols-outlined text-[17px]">power_settings_new</span></button>`
          : `<a href="/agent" class="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors" title="Ir para a Esteira"><span class="material-symbols-outlined text-[17px]">bolt</span></a>`}
      </div>
    </div>
  </div>`;

  const $id = (i) => document.getElementById(i);
  // canal (a página pode sobrescrever depois com os próprios dados)
  fetch("/api/automation/channels").then(r => r.json()).then(cs => {
    $id("sidebarChannelCount").textContent = `${cs.length} ${cs.length === 1 ? "canal" : "canais"}`;
    if (!cs.length) { $id("sidebarChannelTitle").textContent = "Nenhum canal"; return; }
    const c = cs[0];
    $id("sidebarChannelTitle").textContent = c.title;
    $id("sidebarChannelSubs").textContent = `${(c.subscribers_count || 0).toLocaleString("pt-BR")} inscritos • ${({manual: "manual", assisted: "assistido", automatic: "automático"})[c.mode] || c.mode}`;
    $id("sidebarChannelDot").className = "w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0";
  }).catch(() => { $id("sidebarChannelTitle").textContent = "Canais indisponíveis"; });
  // agentes, vídeos e GPU
  fetch("/api/automation/sidebar").then(r => r.json()).then(d => {
    const reais = d.agentes_reais + d.agentes_parciais;
    $id("sidebarAgentsBadge").textContent = `${reais}/${d.agentes_total}`;
    $id("sidebarAgentsBadge").title = `${d.agentes_reais} real, ${d.agentes_parciais} parciais, ${d.agentes_total - reais} simulados`;
    if (d.videos !== null) $id("sidebarCreatedCount").textContent = d.videos;
    $id("sidebarAgentes").textContent = `${reais}/${d.agentes_total} AGENTES REAIS`;
    $id("sidebarAgentes").className = "font-bold tracking-tight text-cyan-300 truncate";
    $id("sidebarAgentesDot").className = "w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0";
    const g = d.gpu || {};
    $id("sidebarGpu").textContent = g.online ? g.detalhe.replace("NVIDIA GeForce ", "") : "sem GPU";
    $id("sidebarTemp").textContent = g.online ? `${g.temperatura_c} °C` : "—";
  }).catch(() => {});
})();
