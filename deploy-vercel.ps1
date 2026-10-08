param(
  [string]$SupabaseUrl = $env:SHINIAN_SUPABASE_URL,
  [string]$SupabaseAnonKey = $env:SHINIAN_SUPABASE_ANON_KEY
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  throw '先设置 SHINIAN_SUPABASE_URL 与 SHINIAN_SUPABASE_ANON_KEY 环境变量（只能使用公开 anon/publishable key）。'
}

$env:SHINIAN_SUPABASE_URL = $SupabaseUrl
$env:SHINIAN_SUPABASE_ANON_KEY = $SupabaseAnonKey
node .\scripts\build.mjs --require-config
if ($LASTEXITCODE -ne 0) { throw '静态构建失败。' }

if (-not (Test-Path -LiteralPath '.\dist\.vercel\project.json')) {
  npx vercel link --cwd .\dist
  if ($LASTEXITCODE -ne 0) { throw 'Vercel 项目关联失败。' }
}

npx vercel deploy --prod --cwd .\dist
if ($LASTEXITCODE -ne 0) { throw 'Vercel 部署失败。请先用 npx vercel login 登录，并链接 Vercel 项目。' }
