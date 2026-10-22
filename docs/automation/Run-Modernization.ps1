param([switch]$CheckOnly, [switch]$SmokeTest)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$state = Get-Content -LiteralPath (Join-Path $root 'progress.json') -Raw | ConvertFrom-Json
if ($state.paused) { Write-Output 'Modernization is paused in progress.json'; exit 0 }
New-Item -ItemType Directory -Force -Path (Join-Path $root 'runs') | Out-Null
$lockPath = Join-Path $root 'run.lock'
try { $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
catch { Write-Output 'Another modernization run holds the lock; skipped.'; exit 0 }
$clock = [Diagnostics.Stopwatch]::StartNew()
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$runRoot = Join-Path $root ('runs/' + $runId)
New-Item -ItemType Directory -Path $runRoot | Out-Null
$script:results = @()
function Quote-Arg([string]$value) {
  '"' + [regex]::Replace([regex]::Replace($value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Invoke-Bounded([string]$exe, [string[]]$arguments, [string]$cwd, [string]$inputText = '') {
  $remaining = 2700 - [int]$clock.Elapsed.TotalSeconds
  if ($remaining -le 0) { throw 'Run exceeded its 45-minute limit' }
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = $exe
  $info.Arguments = ($arguments | ForEach-Object { Quote-Arg $_ }) -join ' '
  $info.WorkingDirectory = $cwd
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.RedirectStandardInput = $true
  $process = New-Object Diagnostics.Process
  $process.StartInfo = $info
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEndAsync()
  $stderr = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($inputText)
  $process.StandardInput.Close()
  if (!$process.WaitForExit($remaining * 1000)) {
    & taskkill.exe /PID $process.Id /T /F | Out-Null
    $process.WaitForExit()
    throw 'Execution timed out; isolated checkout retained for recovery'
  }
  $code = $process.ExitCode
  # Tool output is deliberately not saved: it can contain credentials or private data.
  $output = $stdout.GetAwaiter().GetResult()
  [void]$stderr.GetAwaiter().GetResult()
  $script:results += @{command=[IO.Path]::GetFileName($exe);exitCode=$code}
  $process.Dispose()
  if ($code -ne 0) { throw ('Command failed: ' + [IO.Path]::GetFileName($exe) + ' (exit ' + $code + ')') }
  return $output
}
try {
  $codex = (Get-Command codex -ErrorAction Stop).Source
  $git = (Get-Command git -ErrorAction Stop).Source
  $gh = (Get-Command gh -ErrorAction Stop).Source
  $login = Invoke-Bounded $gh @('api','user','--jq','.login') $root
  if ($login.Trim() -ne 'shivansh-verma13') { throw 'Unexpected GitHub account; no repositories modified' }
  [void](Invoke-Bounded $codex @('login','status') $root)
  $policy = Get-Content -LiteralPath (Join-Path $root 'workflow.md') -Raw
  if ($CheckOnly) { Write-Output 'Authenticated prerequisites and exclusive lock verified.' }
  else {
    foreach ($repo in $state.repositories) {
      if ($repo -notin $state.allowlist -or $repo -notmatch '^[A-Za-z0-9_.-]+$') { throw 'Repository outside allowlist' }
      $destination = Join-Path $runRoot $repo
      [void](Invoke-Bounded $git @('clone','--single-branch','--branch',$state.branch,('https://github.com/shivansh-verma13/' + $repo + '.git'),$destination) $root)
      [void](Invoke-Bounded $git @('-C',$destination,'config','user.name','Shivansh Verma') $root)
      [void](Invoke-Bounded $git @('-C',$destination,'config','user.email','115868006+shivansh-verma13@users.noreply.github.com') $root)
    }
    $summaryPath = Join-Path $runRoot 'summary.md'
    $prompt = $policy + "`nRun checkout: $runRoot`nActive product: $($state.product). Branch: $($state.branch). Read both repositories and their UPGRADE_LOG.md before choosing the next task."
    if ($SmokeTest) { $prompt = 'Read the two repository upgrade logs only. Do not modify files, commit, push, create a PR, deploy or call providers. Summarize the active task and known blockers. This tests authenticated noninteractive execution. Never include credentials.' }
    [void](Invoke-Bounded $codex @('exec','--approve-for-me','--skip-git-repo-check','-C',$runRoot,'--output-last-message',$summaryPath,'-') $runRoot $prompt)
    if (!(Test-Path -LiteralPath $summaryPath)) { throw 'Agent completed without a run summary' }
    Write-Output (Get-Content -LiteralPath $summaryPath -Raw)
  }
  @{id=$runId;status='completed';smokeTest=[bool]$SmokeTest;elapsedSeconds=[int]$clock.Elapsed.TotalSeconds;commands=$script:results} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runRoot 'result.json')
} catch {
  @{id=$runId;status='failed';elapsedSeconds=[int]$clock.Elapsed.TotalSeconds;error=$_.Exception.Message;commands=$script:results} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runRoot 'result.json')
  Write-Error $_.Exception.Message
  exit 1
} finally { $lock.Dispose() }
