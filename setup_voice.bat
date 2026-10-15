@echo off
setlocal
cd /d "%~dp0"
title LECCORTUBE - natural voice setup
echo.
echo  ===== Natural voices (Chatterbox, MIT license) =====
echo  Installs human-sounding voices into their own folder (venv_voice).
echo  It REUSES the PyTorch that setup.bat already downloaded, so no 3.5 GB download.
echo  LECCORTUBE runs this for you from Setup Center.
echo.

if exist ".venv\Scripts\python.exe" goto have_main
echo Start LECCORTUBE once first (it installs the engine).
pause
exit /b 1
:have_main

rem ---------- 1. voice venv made from the same Python as the main app ----------
if not exist "venv_voice\Scripts\python.exe" goto make_venv
rem an older setup may have made venv_voice with a different Python version: rebuild it then
".venv\Scripts\python.exe" -c "import sys,subprocess;v=subprocess.run([r'venv_voice\Scripts\python.exe','-c','import sys;print(sys.version_info[:2])'],capture_output=True,text=True).stdout.strip();sys.exit(0 if v==str(sys.version_info[:2]) else 1)"
if not errorlevel 1 goto have_venv
echo      Old venv_voice uses another Python version, rebuilding it...
rmdir /s /q venv_voice
:make_venv
echo [1/4] Creating venv_voice (no output for a minute is normal)...
".venv\Scripts\python.exe" -m venv venv_voice
if errorlevel 1 goto fail
:have_venv
set "VPY=venv_voice\Scripts\python.exe"
"%VPY%" -m pip install --upgrade pip --disable-pip-version-check -q
"%VPY%" -c "import sys,platform;print('     Python',sys.version.split()[0],platform.architecture()[0])"

rem ---------- 2. PyTorch: reuse the main app's copy ----------
set "TV="
rem (no quotes around the exe inside for /f: cmd strips them and the command breaks)
for /f "delims=" %%v in ('.venv\Scripts\python.exe -c "import torch;print(torch.__version__.split('+')[0])" 2^>nul') do set "TV=%%v"
if not defined TV goto torch_download
echo [2/4] Reusing PyTorch %TV% from the main app
(echo %CD%\.venv\Lib\site-packages)> "venv_voice\Lib\site-packages\_sleepy_main_torch.pth"
"%VPY%" -c "import torchaudio" >nul 2>&1
if not errorlevel 1 goto torch_ok
echo      Installing torchaudio %TV% (small download)...
"%VPY%" -m pip install torchaudio==%TV% --no-deps --index-url https://download.pytorch.org/whl/cu128
"%VPY%" -c "import torch, torchaudio" >nul 2>&1
if not errorlevel 1 goto torch_ok
"%VPY%" -m pip install torchaudio==%TV% --no-deps
"%VPY%" -c "import torch, torchaudio" >nul 2>&1
if not errorlevel 1 goto torch_ok
echo      Could not get a matching torchaudio, falling back to a full PyTorch download.
del "venv_voice\Lib\site-packages\_sleepy_main_torch.pth" >nul 2>&1

:torch_download
rem Fast path: 8 parallel connections, resumes after a power cut or internet drop.
for /f "delims=" %%t in ('%VPY% -c "import sys;print('cp%%d%%d' %% sys.version_info[:2])"') do set "CP=%%t"
if not defined CP set "CP=cp312"
echo      Python tag: %CP%
if not exist wheels mkdir wheels
echo [2/4] Downloading PyTorch 2.8 (3.5 GB) with 8 connections. Stop anytime, run again to continue.
"%VPY%" tools\fastdl.py "https://download.pytorch.org/whl/cu128/torch-2.8.0%%2Bcu128-%CP%-%CP%-win_amd64.whl" "wheels\torch-2.8.0+cu128-%CP%-%CP%-win_amd64.whl" 8
if errorlevel 1 goto fail_torch
"%VPY%" tools\fastdl.py "https://download.pytorch.org/whl/cu128/torchaudio-2.8.0%%2Bcu128-%CP%-%CP%-win_amd64.whl" "wheels\torchaudio-2.8.0+cu128-%CP%-%CP%-win_amd64.whl" 4
if errorlevel 1 goto fail_torch
"%VPY%" -m pip install "wheels\torch-2.8.0+cu128-%CP%-%CP%-win_amd64.whl"
if errorlevel 1 goto fail_torch
"%VPY%" -m pip install "wheels\torchaudio-2.8.0+cu128-%CP%-%CP%-win_amd64.whl" --no-deps
if errorlevel 1 goto fail_torch
:torch_ok
"%VPY%" -c "import torch, torchaudio; print('     PyTorch', torch.__version__, '| GPU:', torch.cuda.is_available())"
if errorlevel 1 goto fail_torch

rem ---------- 3. Chatterbox ----------
echo [3/4] Installing Chatterbox (about 300 MB of small packages)...
rem --no-deps: Chatterbox pins an old PyTorch that does not support RTX 50 cards
"%VPY%" -m pip install chatterbox-tts==0.1.7 --no-deps
if errorlevel 1 goto fail
rem s3tokenizer without deps: it wants onnx, which has no build for some Python versions (handled below)
"%VPY%" -m pip install s3tokenizer==0.3.0 --no-deps
if errorlevel 1 goto fail
"%VPY%" -m pip install librosa==0.11.0 transformers==5.2.0 diffusers==0.29.0 resemble-perth conformer==0.3.2 safetensors==0.5.3 pyloudnorm omegaconf einops tqdm soundfile huggingface_hub "setuptools<81"
if errorlevel 1 goto fail
"%VPY%" -c "import onnx" >nul 2>&1
if not errorlevel 1 goto onnx_ok
"%VPY%" -m pip install onnx --only-binary=:all: -q
if not errorlevel 1 goto onnx_ok
echo      onnx has no build for this Python, using a small stub (Chatterbox does not need it)
xcopy /e /i /y "tools\onnx_stub" "venv_voice\Lib\site-packages\onnx" >nul
:onnx_ok

rem Files damaged by a power cut, a full disk or an antivirus ("source code string cannot contain null bytes")
rem still count as installed for pip, so check that everything imports and rebuild venv_voice once if not.
"%VPY%" -c "import librosa, perth, s3tokenizer, chatterbox" >nul 2>&1
if not errorlevel 1 goto deps_ok
if defined OMNI_REBUILT goto fail_import
echo      Some installed voice files are damaged. Rebuilding venv_voice once (PyTorch is kept)...
set "OMNI_REBUILT=1"
rmdir /s /q venv_voice
goto make_venv
:deps_ok

rem ---------- 4. download the model and test ----------
if not exist logs mkdir logs
echo [4/4] Downloading the voice model (about 2 GB, it resumes if interrupted) and testing it...
"%VPY%" -c "import torch, soundfile as sf; from chatterbox.tts_turbo import ChatterboxTurboTTS; d='cuda' if torch.cuda.is_available() else 'cpu'; m=ChatterboxTurboTTS.from_pretrained(device=d); w=m.generate('LECCORTUBE natural voice is ready.'); sf.write('logs/voice_test.wav', w.squeeze().cpu().numpy(), m.sr); print(); print('Chatterbox Turbo OK on', torch.cuda.get_device_name(0) if d=='cuda' else 'CPU (slow)')"
if errorlevel 1 goto fail_test

del "venv_voice\needs_repair" >nul 2>&1
echo.
echo  ===== Done. Open Voice Studio in LECCORTUBE and listen. =====
echo  Test file: logs\voice_test.wav
echo.
pause
exit /b 0

:fail_torch
echo.
echo  PyTorch install failed. Just run setup_voice.bat again: the download continues
echo  from where it stopped (files are kept in the "wheels" folder).
pause
exit /b 1

:fail_import
echo.
echo  Natural voices still cannot load after a clean rebuild. Scroll up for the error:
"%VPY%" -c "import librosa, perth, s3tokenizer, chatterbox"
pause
exit /b 1

:fail_test
echo.
echo  The voice test failed. Scroll up for the error.
echo  If the download stopped: just run setup_voice.bat again, it continues.
pause
exit /b 1

:fail
echo.
echo  Setup failed at the step above. Scroll up to see the error, then run setup_voice.bat again.
pause
exit /b 1
