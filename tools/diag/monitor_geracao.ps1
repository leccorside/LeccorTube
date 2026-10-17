<#
Monitora a geração de um projeto do LeccorTube e para (avisando) quando houver erro, lentidão,
queda do ComfyUI, Traceback/OOM no log do ComfyUI ou fim da geração.

Uso (com o app aberto ou o servidor rodando na porta 7860):
    powershell -File tools\diag\monitor_geracao.ps1 -Id <id_do_projeto> [-StallMin 10] [-MaxMin 180]

O id do projeto é o nome da pasta em projects\ (ex.: 20261016-164745-untitled = CAROLINE).
Saída: linhas com data/hora no console e em logs\monitor_geracao.log.
#>
param(
  [Parameter(Mandatory = $true)][string]$Id,
  [int]$StallMin = 10,
  [int]$MaxMin = 180,
  [string]$Base = 'http://127.0.0.1:7860'
)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # tools\diag -> raiz do projeto
$out = Join-Path $root 'logs\monitor_geracao.log'
$comfyLog = Join-Path $root 'logs\comfyui.log'
$t0 = Get-Date
$lastKey = ''; $lastChange = Get-Date; $lastGpu = Get-Date '2000-01-01'; $comfyPos = 0; $sawRunning = $false
if (Test-Path $comfyLog) { $comfyPos = (Get-Item $comfyLog).Length }

function W($msg) { $line = "[{0:HH:mm:ss}] {1}" -f (Get-Date), $msg; Add-Content -Path $out -Value $line -Encoding utf8; Write-Output $line }
function Fim($motivo) { W "=== FIM DO MONITOR: $motivo ==="; exit 0 }

W "=== monitor iniciado (projeto $Id, lentidão > $StallMin min, raiz $root) ==="
while ($true) {
  $now = Get-Date
  if (($now - $t0).TotalMinutes -gt $MaxMin) { Fim "tempo máximo de $MaxMin min" }
  try { $p = Invoke-RestMethod "$Base/api/projects/$Id" -TimeoutSec 30 } catch { W "AVISO: servidor não respondeu ($($_.Exception.Message))"; Start-Sleep 15; continue }
  $s = $p.status
  $msg = ($s.message -replace '\s+', ' ')
  $key = "{0}|{1}|{2:N3}|{3}" -f $s.step, $s.state, [double]$s.progress, $msg
  if ($key -ne $lastKey) {
    W ("{0} | {1} | {2:P0} | {3}" -f $s.step, $s.state, [double]$s.progress, $msg.Substring(0, [Math]::Min(160, $msg.Length)))
    $lastKey = $key; $lastChange = $now
  }
  if ($s.state -in 'running', 'queued') { $sawRunning = $true }
  if ($s.state -eq 'error') { W 'ERRO no projeto:'; W (($s.log | Select-Object -Last 3) -join "`n"); Fim 'ERRO' }
  if ($sawRunning -and $s.state -in 'done', 'idle', 'stopped', 'cancelled') { W 'últimas linhas do log:'; W (($s.log | Select-Object -Last 4) -join "`n"); Fim "geração terminou ($($s.state))" }
  if ($s.state -in 'running', 'queued' -and ($now - $lastChange).TotalMinutes -gt $StallMin) { Fim ("LENTIDÃO: sem progresso há {0:N0} min em '{1}'" -f ($now - $lastChange).TotalMinutes, $msg) }

  # ComfyUI: processo e log
  $comfy = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'ComfyUI\\main\.py' }
  if ($sawRunning -and -not $comfy -and $msg -match 'image|picture|video|clip|ComfyUI|Painting|frame') { W 'ALERTA: processo do ComfyUI não encontrado durante etapa que precisa dele'; Fim 'ComfyUI caiu' }
  if (Test-Path $comfyLog) {
    $len = (Get-Item $comfyLog).Length
    if ($len -lt $comfyPos) { $comfyPos = 0 }
    if ($len -gt $comfyPos) {
      $fs = [IO.File]::Open($comfyLog, 'Open', 'Read', 'ReadWrite'); $fs.Seek($comfyPos, 'Begin') | Out-Null
      $new = (New-Object IO.StreamReader($fs)).ReadToEnd(); $fs.Close(); $comfyPos = $len
      $lastChange = $now   # log do ComfyUI andando (ex.: passos do vídeo) também conta como progresso
      $bad = $new -split "`n" | Where-Object { $_ -match 'Traceback|Error|out of memory|OutOfMemory|CUDA error|Exception|Killed' -and $_ -notmatch 'DeprecationWarning|FutureWarning' }
      if ($bad) { W 'ComfyUI log:'; $bad | Select-Object -First 15 | ForEach-Object { W "   $_" }
        if ($bad -match 'Traceback|out of memory|OutOfMemory|CUDA error') { Fim 'ERRO no ComfyUI' } }
      $tail = ($new -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
      if ($tail) { W "   comfy> $($tail.Trim().Substring(0,[Math]::Min(150,$tail.Trim().Length)))" }
    }
  }
  if (($now - $lastGpu).TotalSeconds -ge 60) {
    $g = (nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu --format=csv,noheader,nounits) -split ',\s*'
    W ("   GPU: {0}/{1} MiB, uso {2}%, {3} C" -f $g[0], $g[1], $g[2], $g[3]); $lastGpu = $now
  }
  Start-Sleep 15
}
