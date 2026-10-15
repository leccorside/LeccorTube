# CONTEXTO — LeccorTube

## Estado atual
- Repositório publicado em `https://github.com/leccorside/LeccorTube` (branch `main`).
- Configuração do motor de IA fica em `config.json` (local, **não versionado**). O modelo versionado é `config.example.json`, com todas as chaves (`*_key`, `*_token`) vazias.

## Histórico de implementações
- 2026-10-14 — Primeiro push para o GitHub. O `config.json` saiu do versionamento e foi criado o `config.example.json`.
- 2026-10-15 — Splash renomeado de "OMNITUBE / by Haris Ai" para "LECCORTUBE / by Leccorside Ai", com patch direto nas constantes de `engine/window.pyc` (via `marshal`, Python 3.12 do `runtime/`). Backup do original no scratchpad da sessão.

## Erros e correções conhecidas
- **"OMNITUBE could not start (code 103)" após mover o projeto de pasta**: o `logs/server.log` mostrava `No Python at 'H:\Meu Drive\PROJETOS\ominitubeclone\runtime\python\...\python.exe'`. Os `pyvenv.cfg` de `.venv` e `venv_voice` guardavam o caminho absoluto antigo (`H:\Meu Drive\PROJETOS\ominitubeclone`). Correção: trocar o caminho por `D:\0000000-PROJETOS\LeccorTube` nos dois `pyvenv.cfg`. **Ao mover o projeto de novo, repetir essa troca**, ou recriar os venvs pelo Setup Center → Repair.
- **Splash continuava "OMNITUBE / by Haris Ai" mesmo com `engine/window.py` já editado**: o launcher (`LECCORTUBE.exe`, cópia idêntica do `OMNITUBE.exe`) carrega o compilado legado `engine/window.pyc`, não o `.py`. Alterar só o `.py` não muda o app. Correção: substituir as strings no próprio `.pyc` e apagar o `engine/__pycache__/window.cpython-312.pyc` obsoleto.
- **Push bloqueado pelo GitHub Push Protection (GH013)**: o commit inicial levava o `config.json` com a `google_key` em texto puro (linha 81, "GCP API Key Bound to a Service Account"). Correção: `config.json` incluído no `.gitignore`, removido do índice (`git rm --cached`) e os commits locais que continham o arquivo (`3b0a18a`, depois `ced5acc`) foram desfeitos antes do push, então o segredo nunca chegou ao GitHub. As demais chaves do arquivo estão no formato `dpapi:` (criptografadas pelo Windows por usuário), mas também não devem ir para o repositório.

## Pendências / próximos passos
- Avaliar a rotação da `google_key` no Google Cloud Console por precaução. O push foi rejeitado, então a chave não chegou a ser publicada.

- Ainda restam referências à marca antiga em binários: o ID de app `HarisAi.OMNITUBE` no `window.pyc` (agrupamento na barra de tarefas), o `app.cp312-win_amd64.pyd`, o `engine/voice_worker.pyc` e a descrição do `LECCORTUBE.exe` ("OMNITUBE AI video engine by Haris Ai"). Trocar só se o usuário pedir.

## Limitações conhecidas
- Os `*.pyc` estão no `.gitignore` (`*.py[cod]`), então o patch do splash existe só localmente. Num clone novo, o `engine/window.pyc` precisa ser copiado ou modificado de novo.
- O `config.json` precisa ser recriado manualmente em outra máquina, a partir do `config.example.json` ou pela interface do app.
