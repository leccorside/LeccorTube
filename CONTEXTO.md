# CONTEXTO — LeccorTube

## Estado atual
- Repositório publicado em `https://github.com/leccorside/LeccorTube` (branch `main`).
- Configuração do motor de IA fica em `config.json` (local, **não versionado**). O modelo versionado é `config.example.json`, com todas as chaves (`*_key`, `*_token`) vazias.

## Histórico de implementações
- 2026-10-14 — Primeiro push para o GitHub. O `config.json` saiu do versionamento e foi criado o `config.example.json`.
- 2026-10-15 — Splash renomeado de "OMNITUBE / by Haris Ai" para "LECCORTUBE / by Leccorside Ai", com patch direto nas constantes de `engine/window.pyc` (via `marshal`, Python 3.12 do `runtime/`). Backup do original no scratchpad da sessão.
- 2026-10-15 — Marca trocada para "LeccorTube" / "Leccorside Ai" no título da janela principal (constante `TITLE` em `engine/window.pyc`) e no launcher `LECCORTUBE.exe` (título "LeccorTube by Leccorside Ai", cabeçalho, mensagens de erro e de instalação; as referências ao "OMNITUBE Discord" foram trocadas por "check logs\...log"). O launcher é um **Nuitka onefile**: os textos ficam na tabela de constantes do `launcher.dll`, dentro do payload zstd embutido no `.exe`. O patch é reproduzível com `tools/rebrand_launcher.py OMNITUBE.exe LECCORTUBE.exe` (precisa de `zstandard`). Identificadores técnicos foram mantidos de propósito: as variáveis `OMNITUBE_HOME`/`OMNITUBE_PORT`/`OMNITUBE_LAUNCHER` (lidas pelo `app.pyd`), o mutex `Local\OMNITUBE_launcher`, `omnitube.ico` e `omnitube.json`. Testado: o motor sobe (HTTP 200 na porta 7860), a janela principal mostra "LeccorTube" e a janela de erro mostra "LeccorTube by Leccorside Ai". O `OMNITUBE.exe` (idêntico ao original) fica como backup.

## Erros e correções conhecidas
- **"OMNITUBE could not start (code 103)" após mover o projeto de pasta**: o `logs/server.log` mostrava `No Python at 'H:\Meu Drive\PROJETOS\ominitubeclone\runtime\python\...\python.exe'`. Os `pyvenv.cfg` de `.venv` e `venv_voice` guardavam o caminho absoluto antigo (`H:\Meu Drive\PROJETOS\ominitubeclone`). Correção: trocar o caminho por `D:\0000000-PROJETOS\LeccorTube` nos dois `pyvenv.cfg`. **Ao mover o projeto de novo, repetir essa troca**, ou recriar os venvs pelo Setup Center → Repair.
- **Splash continuava "OMNITUBE / by Haris Ai" mesmo com `engine/window.py` já editado**: o launcher (`LECCORTUBE.exe`, cópia idêntica do `OMNITUBE.exe`) carrega o compilado legado `engine/window.pyc`, não o `.py`. Alterar só o `.py` não muda o app. Correção: substituir as strings no próprio `.pyc` e apagar o `engine/__pycache__/window.cpython-312.pyc` obsoleto.
- **Push bloqueado pelo GitHub Push Protection (GH013)**: o commit inicial levava o `config.json` com a `google_key` em texto puro (linha 81, "GCP API Key Bound to a Service Account"). Correção: `config.json` incluído no `.gitignore`, removido do índice (`git rm --cached`) e os commits locais que continham o arquivo (`3b0a18a`, depois `ced5acc`) foram desfeitos antes do push, então o segredo nunca chegou ao GitHub. As demais chaves do arquivo estão no formato `dpapi:` (criptografadas pelo Windows por usuário), mas também não devem ir para o repositório.

## Pendências / próximos passos
- Avaliar a rotação da `google_key` no Google Cloud Console por precaução. O push foi rejeitado, então a chave não chegou a ser publicada.

- Ainda restam referências à marca antiga em binários:
  - o ID de app `HarisAi.OMNITUBE` no `window.pyc` (agrupamento na barra de tarefas);
  - os textos de interface do `app.cp312-win_amd64.pyd` (mensagens "OMNITUBE Pro" etc.);
  - o `engine/voice_worker.pyc`;
  - o recurso de versão do `LECCORTUBE.exe` (Propriedades → Detalhes: "OMNITUBE AI video engine by Haris Ai") e o caminho de extração `Haris Ai\OMNITUBE` no stub do Nuitka.

  Trocar só se o usuário pedir.

## Limitações conhecidas
- Os `*.pyc` e os `*.exe` estão no `.gitignore`, então os patches de marca existem só localmente. Num clone novo, o `engine/window.pyc` precisa ser modificado de novo e o `LECCORTUBE.exe` precisa ser regerado com `tools/rebrand_launcher.py`.
- Os offsets do `tools/rebrand_launcher.py` valem só para o `OMNITUBE.exe` 1.4.2.0 original. Outra versão do launcher exige mapear de novo o payload e o bloco `__main__`.
- O `config.json` precisa ser recriado manualmente em outra máquina, a partir do `config.example.json` ou pela interface do app.
