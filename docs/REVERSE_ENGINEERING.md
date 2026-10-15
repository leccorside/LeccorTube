# Documentação de Engenharia Reversa - LECCORTUBE Clone

Este documento descreve a análise técnica e o processo de clonagem e engenharia reversa do software **LECCORTUBE**, realizado utilizando a suíte **REA (Reverse Engineering Assistant)** como MCP e ferramentas de introspecção estática e dinâmica de bytecode.

---

## 1. Configuração do Servidor MCP REA

O projeto REA localizado em `D:\0000000-PROJETOS\rea` foi configurado e validado como servidor MCP via stdio:

- **Comando do servidor:** `node D:\0000000-PROJETOS\rea\scripts\rea.mjs --mcp`
- **Validação com REA Doctor:**
  - 206 ferramentas MCP registradas com integridade SHA-256 verificada.
  - 6 prompts MCP disponíveis.
  - Protocolo MCP 2025-11-25.
- **Configuração de integração:**
  - Adicionado ao arquivo global `~/.gemini/config/mcp_config.json`.
  - Adicionado ao repositório local `.agents/mcp_config.json`.

---

## 2. Anatomia e Arquitetura do LECCORTUBE

O LECCORTUBE é um gerador de vídeos automatizado local para YouTube com IA (geração de roteiro, imagens, áudio/vozes naturais, trilha sonora e cenas em movimento).

### 2.1 Camadas do Sistema

1. **Camada de Apresentação (GUI Desktop):**
   - Baseado em `pywebview` usando o runtime Microsoft Edge WebView2 (`EBWebView`).
   - Janela sem bordas (*frameless*) customizada via APIs Win32 (`user32.dll`) com suporte a redimensionamento de bordas, arraste (`WM_SYSCOMMAND / SC_MOVE_DRAG`), minimização e maximização respeitando a área de trabalho (`rcWork`).
   - Implementado em [window.py](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/engine/window.py).

2. **Frontend Web:**
   - Localizado em [static/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/static).
   - Componentes principais:
     - `index.html`: Shell da aplicação.
     - `app.js`: Lógica principal da interface e comunicação com API.
     - `nle.js`: Editor não-linear (Non-Linear Editor / Timeline).
     - `doctl.js` e `docu.js`: Controladores de documentários e presets.
     - `style.css`: Design system dark mode com temas dinâmicos (Crimson, etc.).

3. **Backend API (FastAPI):**
   - Servidor HTTP Uvicorn escutando em `http://127.0.0.1:7860`.
   - **160 endpoints REST** detalhadamente mapeados em [openapi.json](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/docs/openapi.json).
   - Módulo compilado via Nuitka (`app.cp312-win_amd64.pyd`) contendo 52 submódulos internos especializados (ComfyUI bridge, TTS, FFmpeg render, projeto, temporadas, catálogo, personagens, etc.).
   - Mapeamento completo dos módulos disponível em [modules_map.json](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/docs/modules_map.json).

4. **Motor de Vozes Naturais (Voice Worker):**
   - Processo worker em background [voice_worker.py](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/engine/voice_worker.py).
   - Suporte a modelos Chatterbox Turbo / Multilingual / TTS com aceleração CUDA via PyTorch e patch float32 para drivers modernos.
   - Comunicação via JSON-RPC sobre stdio (comandos `ping`, `synth`, `quit`).

5. **Workflows de IA (ComfyUI & FFmpeg):**
   - Localizados em [workflows/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/workflows):
     - `klein_api.json`: FLUX.2 Klein para geração de imagens.
     - `wan22_5b_i2v_api.json`: Wan 2.2 5B Image-to-Video.
     - `wan22_14b_i2v_fast_api.json`: Wan 2.2 14B Image-to-Video.
     - `ace_step_music_api.json`: Geração de trilhas sonoras.

---

## 3. Código Fonte Descompilado

Os arquivos `.pyc` pré-compilados do diretório `engine/` foram desmontados e convertidos em código legível com fidelidade absoluta:
- [engine/window.py](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/engine/window.py): Gerenciador da janela PyWebView e bindings Win32.
- [engine/voice_worker.py](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/engine/voice_worker.py): Worker do Chatterbox TTS.

---

## 4. Como Executar o Clone

### Opção A: Executável Original
```powershell
.\LECCORTUBE.exe
```

### Opção B: Script Python Nativo
```powershell
python run.py
```
*(Inicia o servidor FastAPI em http://127.0.0.1:7860 e abre a interface desktop automaticamente)*
