@echo off
rem Abre o LeccorTube Simples (interface enxuta, voz oficial em portugues) no navegador.
cd /d "%~dp0"
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7861/api/status -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "LeccorTube Simples" /min ".venv\Scripts\python.exe" -m uvicorn simples.server:app --host 127.0.0.1 --port 7861
  powershell -NoProfile -Command "for ($i=0; $i -lt 30; $i++) { try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7861/api/status -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 1 } }"
)
start "" http://127.0.0.1:7861/
