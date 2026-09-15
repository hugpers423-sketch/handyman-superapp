<# 
.SYNOPSIS
    Script de desarrollo para Facturación WhatsApp Bot
.DESCRIPTION
    Levanta la base de datos, Redis y la API en modo desarrollo con hot reload
#>

param(
    [switch]$NoDocker,
    [switch]$OnlyDb,
    [switch]$Test
)

# Colores para output
function Write-Info { param($msg) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ℹ️  $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ $msg" -ForegroundColor Red }
function Write-Warning { param($msg) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️  $msg" -ForegroundColor Yellow }

# Verificar Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker no está instalado. Instala Docker Desktop para Windows."
    exit 1
}

# Verificar .env
if (-not (Test-Path ".env")) {
    Write-Warning "Archivo .env no encontrado. Copiando desde .env.example..."
    Copy-Item ".env.example" ".env"
    Write-Info "Edita .env con tus credenciales antes de continuar"
    notepad .env
}

if ($Test) {
    Write-Info "Ejecutando tests..."
    python run_tests.py
    exit $LASTEXITCODE
}

if ($NoDocker) {
    Write-Info "Modo sin Docker - requiere PostgreSQL y Redis locales"
    Write-Info "Iniciando API con hot reload..."
    $env:PYTHONPATH = (Get-Location).Path
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    exit
}

# Levantar servicios base
Write-Info "Levantando PostgreSQL y Redis..."
docker-compose up -d postgres redis

# Esperar a que estén listos
Write-Info "Esperando a que los servicios estén saludables..."
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    $pg = docker-compose exec -T postgres pg_isready -U postgres 2>$null
    $rd = docker-compose exec -T redis redis-cli ping 2>$null
    if ($pg -and $rd -and $rd -match "PONG") {
        Write-Success "Servicios listos"
        break
    }
    Start-Sleep 2
    $attempt++
}

if ($attempt -ge $maxAttempts) {
    Write-Error "Timeout esperando servicios"
    exit 1
}

if ($OnlyDb) {
    Write-Success "Solo base de datos levantada. Para API: `uvicorn app.main:app --reload`"
    exit
}

# Iniciar API
Write-Info "Iniciando API con hot reload..."
Write-Success "API disponible en: http://localhost:8000"
Write-Success "Docs en: http://localhost:8000/docs"
Write-Success "Dashboard en: http://localhost:8000/dashboard/"
Write-Info "Webhook para ngrok: http://localhost:8000/api/v1/webhook"
Write-Info ""
Write-Info "Para exponer webhook localmente:"
Write-Info "  ngrok http 8000"
Write-Info "  Luego usa la URL https://xxx.ngrok-free.app/api/v1/webhook en Meta Developers"

$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000