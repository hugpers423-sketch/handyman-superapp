#!/bin/bash
# Script de desarrollo para Facturación WhatsApp Bot
# Uso: ./dev.sh [--no-docker] [--only-db] [--test]

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() { echo -e "${CYAN}[$(date +%H:%M:%S)] ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✅ $1${NC}"; }
warning() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠️  $1${NC}"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ❌ $1${NC}"; }

NO_DOCKER=false
ONLY_DB=false
RUN_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-docker) NO_DOCKER=true ;;
        --only-db) ONLY_DB=true ;;
        --test) RUN_TESTS=true ;;
        *) error "Opción desconocida: $1"; exit 1 ;;
    esac
    shift
done

if [[ "$RUN_TESTS" == true ]]; then
    info "Ejecutando tests..."
    python run_tests.py
    exit $?
fi

if [[ "$NO_DOCKER" == true ]]; then
    info "Modo sin Docker - requiere PostgreSQL y Redis locales"
    info "Iniciando API con hot reload..."
    export PYTHONPATH=$(pwd)
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    exit
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    error "Docker no está instalado"
    exit 1
fi

# Verificar .env
if [[ ! -f ".env" ]]; then
    warning "Archivo .env no encontrado. Copiando desde .env.example..."
    cp .env.example .env
    info "Edita .env con tus credenciales antes de continuar"
    ${EDITOR:-nano} .env
fi

# Levantar servicios base
info "Levantando PostgreSQL y Redis..."
docker-compose up -d postgres redis

# Esperar a que estén listos
info "Esperando a que los servicios estén saludables..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && \
       docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        success "Servicios listos"
        break
    fi
    sleep 2
done

if [[ $i -eq 30 ]]; then
    error "Timeout esperando servicios"
    exit 1
fi

if [[ "$ONLY_DB" == true ]]; then
    success "Solo base de datos levantada. Para API: uvicorn app.main:app --reload"
    exit
fi

# Iniciar API
info "Iniciando API con hot reload..."
success "API disponible en: http://localhost:8000"
success "Docs en: http://localhost:8000/docs"
success "Dashboard en: http://localhost:8000/dashboard/"
info "Webhook para ngrok: http://localhost:8000/api/v1/webhook"
info ""
info "Para exponer webhook localmente:"
info "  ngrok http 8000"
info "  Luego usa la URL https://xxx.ngrok-free.app/api/v1/webhook en Meta Developers"

export PYTHONPATH=$(pwd)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000