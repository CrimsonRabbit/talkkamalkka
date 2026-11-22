# 탈까말까 개발 환경 점검·설치 스크립트 (Windows)
# - Git, Node.js(24 이상), Python 3, 코드 편집기를 확인하고 없는 것만 winget으로 설치합니다.
# - 설치 전에 항상 물어봅니다. 설치 중 Windows 관리자 승인 창이 뜨면 직접 승인해 주세요.
# - 결과는 같은 폴더의 setup-result.txt에 저장됩니다.

$ErrorActionPreference = 'Continue'

$Root = Split-Path -Parent $PSScriptRoot
$LogPath = Join-Path $PSScriptRoot 'setup-result.txt'
$NodeMinMajor = 24
$Results = [ordered]@{}

function Write-Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  [!] $text" -ForegroundColor Yellow }

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Get-FirstLine([string]$cmd, [string[]]$cmdArgs = @('--version')) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $found) { return $null }
    try {
        $out = & $found.Source @cmdArgs 2>&1 | Select-Object -First 1
        $text = "$out".Trim()
        if ($text) { return $text } else { return $null }
    } catch { return $null }
}

function Confirm-Yes([string]$question, [bool]$defaultYes = $true) {
    $hint = if ($defaultYes) { '(Y/n)' } else { '(y/N)' }
    $answer = Read-Host "  $question $hint"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $defaultYes }
    return $answer.Trim().ToLower().StartsWith('y')
}

function Install-WithWinget([string]$id, [string]$label) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Warn "winget이 없어 $label 을(를) 설치할 수 없습니다. Microsoft Store에서 '앱 설치 관리자'를 설치한 뒤 다시 실행해 주세요."
        return $false
    }
    Write-Host "  winget install --id $id ..." -ForegroundColor DarkGray
    winget install --id $id -e --source winget --accept-package-agreements --accept-source-agreements | Out-Host
    Update-SessionPath
    return $true
}

function Get-NodeMajor {
    $v = Get-FirstLine 'node'
    if ($v -match 'v(\d+)\.') { return [int]$Matches[1] }
    return $null
}

function Get-PythonVersion {
    # Microsoft Store 별칭(WindowsApps\python.exe)은 실제 Python이 아니므로 제외합니다.
    $py = Get-Command python -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($py -and $py.Source -notmatch 'WindowsApps') {
        $v = Get-FirstLine 'python'
        if ($v -match 'Python 3') { return @{ Cmd = @($py.Source); Version = $v } }
    }
    $launcher = Get-Command py -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($launcher) {
        $v = Get-FirstLine 'py' @('-3', '--version')
        if ($v -match 'Python 3') { return @{ Cmd = @($launcher.Source, '-3'); Version = $v } }
    }
    return $null
}

Write-Host '탈까말까 개발 환경 점검을 시작합니다.' -ForegroundColor White
Write-Host "프로젝트 폴더: $Root"

# 1. Git ------------------------------------------------------------------
Write-Step '1/5 Git'
$git = Get-FirstLine 'git'
if ($git) {
    Write-Ok $git
} elseif (Confirm-Yes 'Git이 없습니다. 설치할까요?') {
    Install-WithWinget 'Git.Git' 'Git' | Out-Null
    $git = Get-FirstLine 'git'
    if ($git) { Write-Ok $git } else { Write-Warn '설치 후에도 git을 찾지 못했습니다. 창을 닫고 다시 실행해 보세요.' }
}
$Results['Git'] = if ($git) { $git } else { '없음' }

# 2. Node.js ----------------------------------------------------------------
Write-Step "2/5 Node.js ($NodeMinMajor 이상 필요)"
$nodeMajor = Get-NodeMajor
if ($nodeMajor -and $nodeMajor -ge $NodeMinMajor) {
    Write-Ok "node $(Get-FirstLine 'node'), npm $(Get-FirstLine 'npm' @('-v'))"
} else {
    if ($nodeMajor) {
        Write-Warn "지금 Node.js는 $nodeMajor 버전입니다. 앱인토스 SDK 3.x 개발 도구는 $NodeMinMajor 이상이 필요합니다."
        if (Get-Command nvm -ErrorAction SilentlyContinue) {
            Write-Warn 'nvm이 설치돼 있습니다. 이 경우 직접 "nvm install lts" 후 "nvm use lts"를 실행하는 것을 권장합니다.'
        }
        $q = 'Node.js LTS를 설치(업그레이드)할까요?'
    } else {
        $q = 'Node.js가 없습니다. Node.js LTS를 설치할까요?'
    }
    if (Confirm-Yes $q) {
        Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS' | Out-Null
        $nodeMajor = Get-NodeMajor
        if ($nodeMajor -and $nodeMajor -ge $NodeMinMajor) {
            Write-Ok "node $(Get-FirstLine 'node'), npm $(Get-FirstLine 'npm' @('-v'))"
        } else {
            Write-Warn '설치 후에도 Node.js 24 이상을 찾지 못했습니다. 창을 닫고 다시 실행하거나, 예전 Node.js를 제거한 뒤 다시 실행해 주세요.'
        }
    }
}
$Results['Node.js'] = if (Get-NodeMajor) { "$(Get-FirstLine 'node') (npm $(Get-FirstLine 'npm' @('-v')))" } else { '없음' }

# 3. Python -------------------------------------------------------------------
Write-Step '3/5 Python 3'
$python = Get-PythonVersion
if ($python) {
    Write-Ok $python.Version
} elseif (Confirm-Yes 'Python 3이 없습니다. Python 3.12를 설치할까요?') {
    Install-WithWinget 'Python.Python.3.12' 'Python 3.12' | Out-Null
    $python = Get-PythonVersion
    if ($python) { Write-Ok $python.Version } else { Write-Warn '설치 후에도 Python을 찾지 못했습니다. 창을 닫고 다시 실행해 보세요.' }
}
$Results['Python'] = if ($python) { $python.Version } else { '없음' }

# 4. 코드 편집기 ----------------------------------------------------------------
Write-Step '4/5 코드 편집기 (VS Code 또는 Cursor)'
$editors = @()
$vscodePath = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'
$cursorPath = Join-Path $env:LOCALAPPDATA 'Programs\cursor\Cursor.exe'
if ((Get-Command code -ErrorAction SilentlyContinue) -or (Test-Path $vscodePath) -or (Test-Path 'C:\Program Files\Microsoft VS Code\Code.exe')) { $editors += 'VS Code' }
if ((Get-Command cursor -ErrorAction SilentlyContinue) -or (Test-Path $cursorPath)) { $editors += 'Cursor' }
if ($editors.Count -gt 0) {
    Write-Ok ($editors -join ', ')
} elseif (Confirm-Yes '코드 편집기를 찾지 못했습니다. VS Code를 설치할까요?') {
    Install-WithWinget 'Microsoft.VisualStudioCode' 'VS Code' | Out-Null
    $editors += 'VS Code(방금 설치)'
}
$Results['편집기'] = if ($editors.Count -gt 0) { $editors -join ', ' } else { '없음' }

# 5. 프로젝트 준비 ----------------------------------------------------------------
Write-Step '5/5 프로젝트 준비 (Git 저장소, Python 가상환경)'

if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitName = git config --global user.name 2>$null
    $gitEmail = git config --global user.email 2>$null
    if (-not $gitName) {
        $inputName = Read-Host '  Git에 기록할 이름을 입력하세요 (영문 권장, 건너뛰려면 Enter)'
        if ($inputName) { git config --global user.name "$inputName"; $gitName = $inputName }
    }
    if (-not $gitEmail) {
        $inputEmail = Read-Host '  Git에 기록할 이메일을 입력하세요 (GitHub 계정 이메일 권장, 건너뛰려면 Enter)'
        if ($inputEmail) { git config --global user.email "$inputEmail"; $gitEmail = $inputEmail }
    }
    $Results['Git 사용자'] = if ($gitName) { "$gitName <$gitEmail>" } else { '미설정' }

    if (-not (Test-Path (Join-Path $Root '.git'))) {
        git -C "$Root" init -b main | Out-Null
        Write-Ok 'Git 저장소를 만들었습니다 (브랜치 main).'
    } else {
        Write-Ok '이미 Git 저장소입니다.'
    }
    $Results['Git 저장소'] = if (Test-Path (Join-Path $Root '.git')) { '있음' } else { '없음' }
}

$venvPython = Join-Path $Root '.venv\Scripts\python.exe'
$requirements = Join-Path $Root 'analysis\requirements.txt'
if ($python) {
    if (-not (Test-Path $venvPython)) {
        if (Confirm-Yes 'Python 가상환경(.venv)을 만들고 분석 패키지를 설치할까요? 몇 분 걸릴 수 있습니다.') {
            $pyExe = $python.Cmd[0]
            $pyArgs = @()
            if ($python.Cmd.Count -gt 1) { $pyArgs = $python.Cmd[1..($python.Cmd.Count - 1)] }
            & $pyExe @pyArgs -m venv (Join-Path $Root '.venv')
        }
    }
    if (Test-Path $venvPython) {
        & $venvPython -m pip install --upgrade pip --quiet
        & $venvPython -m pip install -r $requirements
        if ($LASTEXITCODE -eq 0) { Write-Ok '분석 패키지 설치 완료' } else { Write-Warn '패키지 설치 중 오류가 있었습니다. 위 메시지를 확인해 주세요.' }
        $Results['가상환경'] = (& $venvPython --version 2>&1 | Select-Object -First 1)
    } else {
        $Results['가상환경'] = '만들지 않음'
    }
}

# 결과 저장 -------------------------------------------------------------------
$lines = @("탈까말까 개발 환경 점검 결과", "점검 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "Windows: $([Environment]::OSVersion.VersionString)", '')
foreach ($k in $Results.Keys) { $lines += ('{0}: {1}' -f $k, $Results[$k]) }
$lines | Out-File -FilePath $LogPath -Encoding utf8

Write-Host ''
Write-Host '점검이 끝났습니다. 결과:' -ForegroundColor White
$lines | Select-Object -Skip 4 | ForEach-Object { Write-Host "  $_" }
Write-Host ''
Write-Host "결과 파일: $LogPath"
Write-Host '설치한 프로그램이 다른 창에서 인식되지 않으면, 열려 있는 터미널·편집기를 닫았다가 다시 여세요.'
