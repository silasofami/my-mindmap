param(
    [string]$Provider
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.git'))) {
    Write-Host 'Git repository not found. Initializing Git...'
    git init
    if ($LASTEXITCODE -ne 0) {
        throw 'git init failed.'
    }
}

if ([string]::IsNullOrWhiteSpace($Provider)) {
    $Provider = Read-Host 'Enter provider: github or gitee'
}

$Provider = $Provider.Trim().ToLowerInvariant()
if ($Provider -notin @('github', 'gitee')) {
    throw 'Provider must be github or gitee.'
}

$remoteUrl = Read-Host "Enter the empty $Provider repository URL"
if ([string]::IsNullOrWhiteSpace($remoteUrl)) {
    throw 'Remote URL cannot be empty.'
}

git add -A
if ($LASTEXITCODE -ne 0) {
    throw 'git add failed.'
}

Write-Host ''
Write-Host 'Files staged for the initial commit:' -ForegroundColor Yellow
git diff --cached --name-only
if ($LASTEXITCODE -ne 0) {
    throw 'Could not list staged files.'
}

$confirmation = Read-Host 'Review the file list. Type COMMIT to continue'
if ($confirmation -cne 'COMMIT') {
    Write-Host 'Stopped before commit.'
    exit 0
}

git commit -m 'Initial commit'
if ($LASTEXITCODE -ne 0) {
    throw 'git commit failed. Check your Git user.name and user.email settings.'
}

git branch -M main
if ($LASTEXITCODE -ne 0) {
    throw 'Could not set the branch name to main.'
}

$existingRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($existingRemote -join ''))) {
    git remote set-url origin $remoteUrl
}
else {
    git remote add origin $remoteUrl
}
if ($LASTEXITCODE -ne 0) {
    throw 'Could not configure the origin remote.'
}

git push -u origin main
if ($LASTEXITCODE -ne 0) {
    throw 'Push failed. Check the remote URL, account permissions, and authentication.'
}

Write-Host 'Initial commit pushed to origin/main.' -ForegroundColor Green
