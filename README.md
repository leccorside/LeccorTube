# LECCORTUBE Clone

Repositório clonado e documentado através de engenharia reversa do **LECCORTUBE** (sistema de automação e geração de vídeos com IA local), integrado com a suíte **REA** configurada como servidor MCP.

---

## 🚀 Como Iniciar

### 1. Pré-requisitos
- Python 3.12 64-bit
- Placa de vídeo NVIDIA (opcional para aceleração de ComfyUI e Chatterbox TTS)
- Dependências Python:
```powershell
pip install -r requirements.txt
```

### 2. Executando o Projeto
Você pode executar o LECCORTUBE de duas formas:

- **Via Python:**
```powershell
python run.py
```
- **Via Executável:**
```powershell
.\LECCORTUBE.exe
```

A aplicação iniciará o servidor FastAPI local na porta `7860` e abrirá a interface desktop integrada.

---

## 📁 Estrutura do Projeto

- [assets/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/assets): Presets de estilos artísticos, categorias de vídeos e vozes.
- [engine/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/engine): 
  - [window.py](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/engine/window.py): Interface desktop via PyWebView com janelas customizadas e integração Win32.
  - [voice_worker.py](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/engine/voice_worker.py): Worker do motor de síntese de voz natural (Chatterbox).
- [static/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/static): Interface web completa da aplicação (SPA, timeline NLE, editor de roteiros).
- [workflows/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/workflows): Workflows JSON do ComfyUI (FLUX.2 Klein, Wan 2.2, geração de música).
- [tools/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/tools): Ferramentas utilitárias (download paralelo rápido, stubs onnx).
- [docs/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/docs):
  - [openapi.json](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/docs/openapi.json): Especificação completa dos 160 endpoints do backend FastAPI.
  - [modules_map.json](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/docs/modules_map.json): Mapeamento de todos os 52 submódulos do core compilado.
  - [REVERSE_ENGINEERING.md](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/docs/REVERSE_ENGINEERING.md): Análise detalhada da engenharia reversa.
- [config.json](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/config.json): Arquivo de configurações do motor de IA.
- [run.py](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/run.py): Script de inicialização unificado (API + Desktop GUI).
- [.agents/](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/.agents): Configuração do MCP `rea` para sessões do agente.

---

## 🌐 Suporte a Múltiplos Idiomas (i18n)

O sistema possui suporte nativo a múltiplos idiomas, selecionáveis diretamente na aba **Settings / Configurações**:
- 🇧🇷 **Português do Brasil** (`pt-BR`)
- 🇺🇸 **Inglês** (`en`)
- 🇪🇸 **Espanhol** (`es`)

A preferência é salva no `localStorage` do navegador e sincronizada no [config.json](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/config.json).

---

## 🛠️ MCP REA Configurado

O servidor MCP da suíte REA (`D:\0000000-PROJETOS\rea`) está registrado em [.agents/mcp_config.json](file:///h:/Meu%20Drive/PROJETOS/ominitubeclone/.agents/mcp_config.json) e globalmente em `~/.gemini/config/mcp_config.json`.
