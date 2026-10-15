# CONTEXTO — LeccorTube

## Estado atual
- Repositório publicado em `https://github.com/leccorside/LeccorTube` (branch `main`).
- Configuração do motor de IA fica em `config.json` (local, **não versionado**). O modelo versionado é `config.example.json`, com todas as chaves (`*_key`, `*_token`) vazias.

## Histórico de implementações
- 2026-10-14 — Primeiro push para o GitHub. O `config.json` saiu do versionamento e foi criado o `config.example.json`.

## Erros e correções conhecidas
- **Push bloqueado pelo GitHub Push Protection (GH013)**: o commit inicial levava o `config.json` com a `google_key` em texto puro (linha 81, "GCP API Key Bound to a Service Account"). Correção: `config.json` incluído no `.gitignore`, removido do índice (`git rm --cached`) e os commits locais que continham o arquivo (`3b0a18a`, depois `ced5acc`) foram desfeitos antes do push, então o segredo nunca chegou ao GitHub. As demais chaves do arquivo estão no formato `dpapi:` (criptografadas pelo Windows por usuário), mas também não devem ir para o repositório.

## Pendências / próximos passos
- Avaliar a rotação da `google_key` no Google Cloud Console por precaução. O push foi rejeitado, então a chave não chegou a ser publicada.

## Limitações conhecidas
- O `config.json` precisa ser recriado manualmente em outra máquina, a partir do `config.example.json` ou pela interface do app.
