# CONTEXTO — LeccorTube

Resumo vivo do projeto para retomar o trabalho em outra sessão, pasta ou máquina. Última atualização: 2026-10-17.

## ▶️ Como retomar (leia primeiro)

**Situação em 2026-10-17 (15:10):** projeto **movido para `C:\Users\Johnathan Amorim\Documents\PROJETOS-GERAIS\LeccorTube`** (SSD). Esta é a pasta oficial agora. A cópia original continua em `D:\0000000-PROJETOS\LeccorTube` (HD externo USB com falhas de leitura) e pode ser apagada pelo usuário depois de confirmar que está tudo certo aqui.

Resultado da mudança: `robocopy` copiou 123.861 arquivos / 13.854 pastas / 48,2 GB com 0 falhas (1h29, com travamentos do D: no meio). `ajustar_caminhos.ps1 -Corrigir` corrigiu 13 arquivos (backup em `_backup_original\caminhos_20261017-150841\`). Testes no novo local: `.venv` e `venv_voice` funcionam (torch do `.venv` do C:; chatterbox importa em 19 s a frio, contra 237 s no D:); **ComfyUI sobe em 47 s** (no D: não subia nem em 9 min); `LECCORTUBE.exe` abre em 3 s, `/api/app` → `home` no C:, Central de Ajustes sem referências ao D:/H:.

Checklist para uma próxima mudança de pasta (com o LeccorTube **fechado**):

1. Abrir um terminal na nova pasta e rodar:
   `powershell -ExecutionPolicy Bypass -File tools\diag\ajustar_caminhos.ps1` — mostra o que ainda aponta para o caminho antigo.
   Depois `... ajustar_caminhos.ps1 -Corrigir` — troca pelo caminho novo (backup em `_backup_original\caminhos_<data>\`).
   Ele cobre: `.venv\pyvenv.cfg`, `venv_voice\pyvenv.cfg`, `venv_voice\Lib\site-packages\_sleepy_main_torch.pth`, `comfy_dir` no `config.json` e os `Scripts\activate*` dos dois venvs.
2. Abrir o `LECCORTUBE.exe`. Se der "could not start (code 103)", ver `logs\server.log` (normalmente caminho antigo em `pyvenv.cfg`).
3. Conferir que o ComfyUI aponta para a pasta nova: Central de Ajustes, ou `GET http://127.0.0.1:7860/api/setup` → `comfy.root`.
4. Confirmar que o disco novo não tem erros: `Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='disk';Id=153} -MaxEvents 5` (não deve aparecer o disco do projeto).
5. Testar a voz: `venv_voice\Scripts\python.exe tools\diag\voice_test.py <pasta_saida>` (importa torch/chatterbox, carrega o Turbo e gera um wav).
6. Retomar o projeto **CAROLINE** (id `20261016-164745-untitled`): voz pronta (7/7 cenas, 2,8 min), mas a **cena 1 foi editada depois da narração** (Hook Doctor) e precisa ser narrada de novo ("1 · Voz"). Depois, seguir de **Imagens** (a pré-visualização falhou só porque o ComfyUI não subiu no disco D:). Ver também "Erros e correções" → CAROLINE às 17:55.
7. Acompanhar a geração: `powershell -ExecutionPolicy Bypass -File tools\diag\monitor_geracao.ps1 -Id 20261016-164745-untitled` — para e avisa em erro, lentidão (> 10 min sem progresso), queda do ComfyUI, Traceback/OOM no log do ComfyUI ou fim; grava em `logs\monitor_geracao.log`.

Arquivos fora do projeto (não vão junto na cópia, mas continuam valendo no mesmo PC):
- Cache de modelos Hugging Face em `C:\Users\<usuário>\.cache\huggingface\hub` (Chatterbox, Chatterbox Turbo, Kokoro…). Os arquivos grandes de `models--ResembleAI--*` são links simbólicos para `hub\blobs\xx\...` — é normal aparecerem com 0 bytes no Explorer.
- `config.json` fica na raiz do projeto (vai junto), mas **não está no Git**.

## Como o app funciona (para trabalhar por fora da interface)

- `LECCORTUBE.exe` (launcher Nuitka) sobe o servidor `python -m uvicorn app.main:app` na porta **7860** (usando `.venv`) e a janela `engine\window.pyc` (WebView2). O motor está compilado em `app.cp312-win_amd64.pyd` (Nuitka); a interface é `static\` (HTML/JS).
- Tudo que a interface faz passa por uma API HTTP local, então dá para criar e gerar vídeos por script ou pelo Claude, sem abrir a janela (o servidor precisa estar rodando — app aberto ou `.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 7860` na raiz):
  - `GET /api/projects` (lista), `GET /api/projects/{id}` (projeto, com `status.step/state/progress/message/log`).
  - `GET /api/projects/{id}/preflight/{etapa}` → `{missing, size_gb, note}`; `POST /api/projects/{id}/run/{etapa}` com `{}` (etapas: `all`, `preview`, `voice`, `images`, `videos`, `render`, `export`…). É o que os botões fazem (`run()` em `static/app.js`).
  - `GET /api/app` (nome/versão), `GET/POST /api/config` (POST mescla e salva o `config.json`), `GET /api/setup` (Central de Ajustes), `GET /api/queue`, `GET /api/update?force=true`.
- Voz natural: processo separado `venv_voice\Scripts\python.exe -u engine\voice_worker.pyc` (Chatterbox/Turbo), log em `logs\voice_worker.log`; o `venv_voice` usa o `torch` do `.venv` via `_sleepy_main_torch.pth`.
- Imagens/vídeo: ComfyUI em `ComfyUI_windows_portable\` (Python 3.13 próprio em `python_embeded\`), porta 8188, log em `logs\comfyui.log`. O app espera ~3 min a subida do ComfyUI (`_comfy_ready` em `app.jobs`, sem opção no config) e desiste com "ComfyUI did not answer in time".
- Logs: `logs\server.log`, `logs\window.log`, `logs\voice_worker.log`, `logs\comfyui.log`, `logs\setup.log`.

## Estado atual
- Repositório em `https://github.com/leccorside/LeccorTube` (branch `main`). Commits feitos manualmente pelo usuário (o Claude só redige a mensagem, em pt-BR, salvo pedido explícito).
- Configuração do motor em `config.json` (local, **não versionado**); modelo versionado: `config.example.json` (chaves vazias).
- Marca: tudo que aparece ao usuário diz **LeccorTube / Leccorside Ai** (splash, títulos, janela de erro, recurso de versão do .exe, textos do motor, logo de raposa, links para leccorside.com.br e Instagram negociosleccorside). Busca de atualizações do servidor original desativada.
- Interface traduzida para **pt-BR e es** (camada `static/i18n_dom.js` + dicionário `static/i18n_dict.js`).
- Projeto de teste **CAROLINE** (`projects\20261016-164745-untitled`, tipo Terror e Mistério, voz George/Chatterbox Turbo): voz pronta; imagens/vídeos/render pendentes.

## Histórico da conversa e das implementações (cronológico)

### 2026-10-14 — Publicação no GitHub
- Primeiro push bloqueado pelo GitHub Push Protection (GH013): `config.json` tinha a `google_key` em texto puro. `config.json` foi para o `.gitignore`, criado `config.example.json`, commits locais com o segredo desfeitos (`3b0a18a`, depois `ced5acc`) e push refeito. O segredo nunca chegou ao GitHub.

### 2026-10-15 — Rebrand OMNITUBE/Haris Ai → LeccorTube/Leccorside Ai
- **Splash** (`engine/window.pyc`, constantes via `marshal`): "LECCORTUBE / by Leccorside Ai". O `window.py` existe mas o launcher carrega o `.pyc`.
- **Erro 103 ao abrir** depois de mover o projeto de `H:\Meu Drive\PROJETOS\ominitubeclone` para `D:\…`: `pyvenv.cfg` dos dois venvs com caminho antigo; corrigido.
- **Título da janela** (`TITLE` no `window.pyc`) e **launcher** `LECCORTUBE.exe` (Nuitka onefile; textos no `launcher.dll` dentro do payload zstd): título "LeccorTube by Leccorside Ai", mensagens de erro/instalação, referências ao "OMNITUBE Discord" trocadas por "check logs\...". Reproduzível com `tools/rebrand_launcher.py OMNITUBE.exe LECCORTUBE.exe`. `OMNITUBE.exe` (original) mantido como backup.
- **Textos do motor** (`app.cp312-win_amd64.pyd`, tabela de constantes Nuitka): 44 trocas (mensagens "LeccorTube Pro feature", requisitos do PC, Setup Center, updater, títulos CapCut/Premiere, página do OpenRouter, `APP_NAME`/`APP_BY`). Reproduzível com `tools/rebrand_app_pyd.py` a partir de `_backup_original/app.cp312-win_amd64.pyd`.
- **Links**: site e comunidade → `https://leccorside.com.br/`; Instagram → `https://www.instagram.com/negociosleccorside/`; HTTP-Referer do OpenRouter e user-agent de pesquisa → leccorside.com.br. Mantido o Gumroad (licença Pro é do autor original).
- **Logo**: raposa de `favi.png` em `static/brand/` (`app_icon.png`, `orb.png`, `favicon.png`), `assets/omnitube.ico` e ícone do `LECCORTUBE.exe` (`tools/set_exe_icon.py`).
- **Busca de atualizações desativada**: `UPDATE_URL` → `http://127.0.0.1:7860/static/update.json` (manifesto local que anuncia a própria versão 1.4.2). `"update_url"` no `config.json` tem prioridade, para um servidor próprio no futuro.
- **Recurso de versão do .exe** (Propriedades → Detalhes) com `tools/set_exe_version.py`: CompanyName "Leccorside Ai", ProductName "LeccorTube", etc. (o Nuitka grava `wValueLength` em bytes; o parser trata isso).

### 2026-10-16 — Tradução completa da interface (pt-BR e es)
- O `static/i18n.js` (`t(chave, fallback)`, ~320 chaves) cobria só parte da UI. Criada a camada `static/i18n_dom.js`: `MutationObserver` que traduz textos e atributos (`title`/`placeholder`/`aria-label`/`alt`/`data-tip`) pelo dicionário `static/i18n_dict.js` — busca exata → padrões `{n}` (parte variável limitada e sem "cara de frase") → símbolos nas pontas → partes separadas por " · "/frases → fragmentos de mensagens do servidor (só em textos ≤ 300 caracteres). Guarda o original de cada nó: `setLanguage` troca de idioma sem recarregar. Ignora `textarea`/`input`/`code`/`pre`/`contenteditable`/`[data-noi18n]`; traduz também `alert`/`confirm`/`prompt`.
- Pipeline em `tools/i18n/`: `extract_js.mjs` (acorn) + `extract_pyd.py` → `build_sources.py` → `translations.json` (3.609 textos, en → pt/es, 11 lotes) + `manual.json` → `build_dict.py` (valida marcadores/tags e gera o dicionário). `audit_ui.mjs` (Chrome headless + puppeteer-core) lista o que sobra em inglês; `switch_test.mjs` testa a troca de idioma; `try.cjs` testa no terminal.
- Auditoria (pt-BR, 13 telas/abas, 740 textos): inglês visível caiu de 331 para 3 esperados. Troca pt-BR → en → es → pt-BR testada.
- Bug corrigido: `static/update.json` com `notes` em texto quebrava o modal de atualização (precisa ser lista `[]`).

### 2026-10-16 — Erros na geração do CAROLINE
- **Voz em erro "Voice worker did not answer in 1800 s"**: `venv_voice\…\_sleepy_main_torch.pth` ainda apontava para o `.venv` no Google Drive (`H:`), que continuava montado → torch/transformers carregados pelo Drive. Corrigido (e `activate*`). Voz do CAROLINE regerada: 7/7 cenas em 2,6 min.
- **`comfy_dir` no `config.json` apontava para o ComfyUI no Google Drive**: corrigido via `POST /api/config`.
- **Pré-visualização falhou: "ComfyUI did not answer in time" (17:53)**. Monitor + `py-spy` mostraram o ComfyUI parado em `importlib.metadata.files()` fazendo `stat` em 15.720 arquivos do `comfyui_embedded_docs`, com acessos isolados de 12–21 s. **Causa: falha de hardware/conexão do disco D:** (ver abaixo). Não é problema do app.

### 2026-10-17 — Decisão
- O usuário vai **mover o projeto manualmente para o SSD `C:`**. Criados `tools/diag/ajustar_caminhos.ps1` (corrige caminhos após mover), `tools/diag/monitor_geracao.ps1` (monitor de geração), `tools/diag/voice_test.py` (teste da voz natural) e `tools/diag/stat_probe.py` (mede acessos lentos a arquivos de pacotes Python).
- Perguntado se o Claude pode gerar vídeos sem abrir a interface: **sim**, pela API local (seção "Como o app funciona"), desde que o servidor esteja rodando; as etapas de imagem/vídeo dependem do ComfyUI subir a tempo (por isso a mudança para o C:).

### 2026-10-17 (tarde) — CAROLINE retomado no C:, pela API
- Servidor iniciado à mão (`uvicorn`, log em `logs\server_manual.log`).
- Título e texto da miniatura: `PATCH /api/projects/{id}` → "What really happened in CAROLINE?" (em inglês, igual à narração).
- Cena 1: `PUT /api/projects/{id}/scenes` com o hook aplicado uma vez só → "What really happened in CAROLINE? The answer is stranger than you think. STORY: An eerie introduction to a mysterious story set in a small Norwegian town." Editar o texto zera o `audio` da cena.
- Voz: `run/voice` narrou só a cena 1 (as outras 6 vieram do cache) em 0,7 min, com 11,9 s de áudio. Narração total: 2,6 min.
- Imagens: `run/images` com `monitor_geracao.ps1` ligado. **7/7 imagens em 1,5 min** (15:40:33 → 15:42:04, ~9 s por imagem, GPU em 11,7/12 GB, ComfyUI subiu sem demora); "Body check" ok em 4 imagens com pessoas. Primeira geração de imagens concluída desde a mudança para o C:.
- Achado de conteúdo: o roteiro do CAROLINE é um prompt de gerador de vídeo, não uma narração. A voz lê instruções como "NEGATIVE PROMPT" e "NO narration", e o estilo fica misturado: a cena 1 saiu em desenho 2D, porque o texto pede cartoon vintage, enquanto as cenas 3 e 7 saíram realistas, por causa do `style_id` `horror_real`. Serve como teste técnico; para publicar, trocar o roteiro por uma narração de verdade e escolher um estilo só.
- Vídeos: 1 clipe (cena 2, 704x1280, 97 quadros, `wan22_5b_i2v_api.json`) em **14,6 min**, a ~35 s por passo (20 passos), GPU a 100% com ~7,8/12 GB. O monitor parou no meio por engano (ver "Erros e correções"); a geração seguiu normalmente.
- Render e Export disparados em sequência às ~16:19, com o monitor corrigido.

## Erros e correções conhecidas
- **Monitor acusava "LENTIDÃO" em vídeos longos (2026-10-17)**: o `monitor_geracao.ps1` só considerava progresso quando o status do projeto mudava. Na etapa de Vídeos, o app mostra "Animating 1 scenes" do início ao fim (~15 min), então o monitor desistia aos 10 min, mesmo com o ComfyUI avançando os passos. Corrigido: o crescimento de `logs\comfyui.log` também conta como progresso. Uma parada real (ComfyUI sem escrever nada) continua sendo detectada.
- **CAROLINE editado às 16/10 17:55 (achado ao testar o novo local)**: título e texto da miniatura viraram "O que realmente aconteceu em CAROLINE? A resposta é mais estranha do que você imagina." (versão traduzida na tela da sugestão do Hook Doctor; colada pela interface) e a cena 1 ficou com "The answer is stranger than you think." repetido. A repetição vem de clicar mais de uma vez em "Replace first line": a sugestão tem 2 frases e o servidor (`POST /api/projects/{id}/hook/apply`) troca só a 1ª frase da cena a cada clique. Nenhuma alteração veio da camada de tradução (o `applyHook` envia a frase original em inglês). Corrigir à mão o título, a miniatura e a cena 1 e narrar de novo.
- **Risco corrigido na camada de tradução (2026-10-17)**: `copyMeta()` (`app.js`) copia para a área de transferência o texto de `#metaText` lido da tela; se a camada traduzisse trechos desse texto gerado, a cópia sairia alterada. `#metaText` entrou no `SKIP_SEL` do `static/i18n_dom.js`. Observação: textos do usuário exibidos como texto comum (ex.: cenas no Storyboard) ainda podem receber tradução **só na exibição** quando uma frase coincide com uma frase da interface (ex.: as sugestões do Hook Doctor); o dado salvo não muda. Se incomodar, marcar o contêiner com `data-noi18n`.
- **⚠️ Disco D: (HD externo USB "USB3.0 high speed", 1,8 TB, Disco 1) com falhas de E/S (2026-10-16)**: 4.764 eventos `disk` ID 153 ("A operação de E/S … para o Disco 1 foi repetida") em 10 dias, desde 06/10 (picos de 1.200+/dia), um a cada ~20–30 s; cada um trava a leitura por ~20 s. Sintomas: ComfyUI não sobe em 3 min; 1ª importação do chatterbox em ~4 min; o mesmo arquivo responde em 0,04 s no 2º acesso. Diagnóstico: `Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='disk';Id=153}`. Recomendações: mover o projeto para o SSD `C:` (em andamento); revisar cabo/porta USB (direto na placa-mãe, sem hub), fonte do HD, saúde do disco (CrystalDiskInfo) e **fazer backup** do conteúdo desse HD.
- **"Voice worker did not answer in 1800 s"**: caminho antigo no `_sleepy_main_torch.pth` do `venv_voice` (ver Histórico). Resolvido por `tools/diag/ajustar_caminhos.ps1`.
- **"ComfyUI did not answer in time"**: o app espera ~3 min. Causas vistas: disco lento (acima) ou `comfy_dir` apontando para pasta errada. Para investigar: `logs\comfyui.log`, iniciar o ComfyUI à mão (`ComfyUI_windows_portable\python_embeded\python.exe -s ComfyUI\main.py --port 8188 --windows-standalone-build`, na pasta `ComfyUI_windows_portable`) e, se travar, `py-spy dump --pid <pid>`. Se o ComfyUI já estiver respondendo na 8188, o app o reaproveita.
- **"OMNITUBE could not start (code 103)"**: `logs\server.log` com `No Python at '<caminho antigo>'` → `pyvenv.cfg` com caminho antigo. Resolvido por `tools/diag/ajustar_caminhos.ps1`.
- **Splash/título continuavam com a marca antiga**: o launcher carrega `engine/window.pyc`, não o `.py`. Editar o `.pyc` (constantes via `marshal`) e apagar `engine/__pycache__/window.cpython-312.pyc`.
- **Modal de atualização quebrado** (`(u.notes || []).map is not a function`): `notes` do `static/update.json` precisa ser lista.
- **Push bloqueado (GH013)**: segredo no `config.json` — ver Histórico 2026-10-14.
- Os `.exe` de `.venv\Scripts\` e `venv_voice\Scripts\` (pip.exe, uvicorn.exe, hf.exe…) têm o Python do primeiro local embutido; o app não os usa (chama `python -m …`/`uv.exe`). À mão, use `python -m pip`.

## Pendências / próximos passos
1. ~~Mover o projeto para o `C:`~~ (feito em 2026-10-17) e ~~retomar o CAROLINE até Imagens~~ (feito: voz e imagens prontas).
2. CAROLINE: seguir com Vídeos (a cena 2 está com `media: video`), Render e Export, ou antes reescrever o roteiro como narração (ver Histórico 2026-10-17 tarde).
3. Avaliar o HD do `D:` (cabo/porta/saúde) e fazer backup dele.
4. Avaliar a rotação da `google_key` no Google Cloud Console (precaução; nunca foi publicada).
5. Opcional (só se o usuário pedir): referências restantes à marca antiga — ID `HarisAi.OMNITUBE` no `window.pyc` (agrupamento na barra de tarefas), `engine/voice_worker.pyc`, caminho de extração `Haris Ai\OMNITUBE` no stub Nuitka. Mantidos de propósito no `app.pyd`: entropia DPAPI `OMNITUBE` do `app.secretstore` (trocar invalida as chaves salvas), variáveis `OMNITUBE_*`, cabeçalho `X-OMNITUBE-Key`, extensão `.omnitube`, user-agent `OMNITUBE-downloader/1.0`, link do Gumroad.

## Limitações conhecidas
- `*.pyc`, `*.pyd` e `*.exe` estão no `.gitignore`: os patches de marca existem só localmente. Originais em `_backup_original/` (também ignorado). Num clone novo, regerar com `tools/rebrand_launcher.py`, `tools/rebrand_app_pyd.py`, `tools/set_exe_icon.py`, `tools/set_exe_version.py` e editar o `engine/window.pyc`.
- Os offsets de `tools/rebrand_launcher.py` e `tools/rebrand_app_pyd.py` (`BLOB_OFF = 0xd77c50`) valem só para a versão 1.4.2 original; no `app.pyd` o saldo de bytes das trocas precisa ficar ≤ 0 (sem docstrings para usar como folga).
- Tradução: prompts de estilo de imagem ficam em inglês de propósito (são o texto enviado ao gerador); conteúdo do usuário nunca é traduzido; textos novos no app.js/pyd exigem rodar o pipeline de novo (itens de `source_en.json` ausentes de `translations.json`); mensagens do servidor montadas com valores no meio podem sair metade traduzidas.
- Ferramentas de auditoria da tradução (`acorn`, `acorn-walk`, `puppeteer-core`) e o `py-spy` não estão versionados: instalar numa pasta à parte (`npm install acorn acorn-walk puppeteer-core` com `PUPPETEER_SKIP_DOWNLOAD=1`; `uv pip install --target <pasta> py-spy`) e apontar `ACORN_DIR`/`PUPPETEER_DIR`.
- O manifesto local de atualização usa a porta 7860 fixa; em outra porta a checagem falha (sem baixar nada).
- O `config.json` precisa ser recriado em outra máquina (a partir do `config.example.json` ou pela interface); as chaves `dpapi:` só abrem no mesmo usuário do Windows.
