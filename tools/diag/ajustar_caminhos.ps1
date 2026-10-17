<#
Depois de mover a pasta do LeccorTube, aponta os ambientes Python e o config.json para o novo local.

Os venvs e o config.json guardam caminhos absolutos. Se ficarem com o caminho antigo, o app falha
("could not start (code 103)", "Voice worker did not answer", ComfyUI pelo caminho errado).

Uso (com o LeccorTube FECHADO):
    powershell -ExecutionPolicy Bypass -File tools\diag\ajustar_caminhos.ps1            # só mostra
    powershell -ExecutionPolicy Bypass -File tools\diag\ajustar_caminhos.ps1 -Corrigir  # corrige

A raiz nova é descoberta pela localização deste script (tools\diag -> raiz). Backups dos arquivos
alterados ficam em _backup_original\caminhos_<data>\.
#>
param([switch]$Corrigir)

$novo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$antigos = @('D:\0000000-PROJETOS\LeccorTube', 'H:\Meu Drive\PROJETOS\ominitubeclone') | Where-Object { $_ -ne $novo }
Write-Output "Pasta atual do projeto: $novo"
Write-Output "Caminhos antigos procurados: $($antigos -join ' | ')"

$alvos = @(
  '.venv\pyvenv.cfg',
  'venv_voice\pyvenv.cfg',
  'venv_voice\Lib\site-packages\_sleepy_main_torch.pth',
  'config.json'
) + (Get-ChildItem (Join-Path $novo '.venv\Scripts'), (Join-Path $novo 'venv_voice\Scripts') -Filter 'activate*' -File -ErrorAction SilentlyContinue |
     ForEach-Object { $_.FullName.Substring($novo.Length + 1) })

if ($Corrigir) {
  $app = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like "$novo\*" -and $_.Name -match 'python|LECCORTUBE' }
  if ($app) { Write-Output 'ATENÇÃO: o LeccorTube parece estar aberto. Feche o app e rode de novo (ele regravaria o config.json).'; exit 1 }
  $bk = Join-Path $novo ("_backup_original\caminhos_{0:yyyyMMdd-HHmmss}" -f (Get-Date))
  New-Item -ItemType Directory -Force $bk | Out-Null
}

$total = 0
foreach ($rel in $alvos) {
  $f = Join-Path $novo $rel
  if (-not (Test-Path -LiteralPath $f)) { Write-Output ("  (não existe) {0}" -f $rel); continue }
  $txt = [IO.File]::ReadAllText($f)
  $n = $txt; $achados = 0
  foreach ($a in $antigos) {
    # mesma pasta em 3 formas: C:\x\y, C:/x/y e C:\\x\\y (escapada no JSON)
    $pares = @(
      @($a.Replace('\', '\\'), $novo.Replace('\', '\\')),
      @($a, $novo),
      @($a.Replace('\', '/'), $novo.Replace('\', '/'))
    )
    foreach ($par in $pares) {
      $c = ([regex]::Matches($n, [regex]::Escape($par[0]))).Count
      if ($c) { $achados += $c; $n = $n.Replace($par[0], $par[1]) }
    }
  }
  if ($achados) {
    $total += $achados
    if ($Corrigir) {
      Copy-Item -LiteralPath $f (Join-Path $bk ($rel -replace '[\\/]', '__'))
      [IO.File]::WriteAllText($f, $n)
      Write-Output ("  CORRIGIDO  {0} ({1} ocorrência(s))" -f $rel, $achados)
    } else { Write-Output ("  PRECISA   {0} ({1} ocorrência(s))" -f $rel, $achados) }
  } else { Write-Output ("  ok        {0}" -f $rel) }
}
if (-not $total) { Write-Output 'Nada a corrigir: todos os caminhos já apontam para a pasta atual.' }
elseif (-not $Corrigir) { Write-Output 'Rode de novo com -Corrigir (com o app fechado) para aplicar.' }
else { Write-Output "Backups em: $bk" }
