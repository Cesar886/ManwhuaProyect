#!/usr/bin/env bash

set -Eeuo pipefail

# Despliegue directo a produccion.
DEPLOY_HOST="${PRODUCTION_DEPLOY_HOST:-178.128.8.41}"
DEPLOY_USER="${DEPLOY_USER:-root}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/manhwa-nextjs"
BACKEND_DIR="${ROOT_DIR}/manhwa-api"

FRONTEND_REMOTE_DIR="${FRONTEND_REMOTE_DIR:-/var/www/manhwa-nextjs}"
BACKEND_REMOTE_DIR="${BACKEND_REMOTE_DIR:-/var/www/manhwa-api}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-manhwa-nextjs}"
BACKEND_SERVICE="${BACKEND_SERVICE:-manhwa-api}"

FRONTEND_ARCHIVE="$(mktemp /tmp/manhwa-nextjs-deploy.XXXXXX.tar.gz)"
BACKEND_ARCHIVE="$(mktemp /tmp/manhwa-api-deploy.XXXXXX.tar.gz)"

cleanup() {
  rm -f -- "${FRONTEND_ARCHIVE}" "${BACKEND_ARCHIVE}"
}
trap cleanup EXIT

log() {
  printf '\n==> %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Error: se requiere el comando "%s".\n' "$1" >&2
    exit 1
  fi
}

for command_name in npm tar ssh scp; do
  require_command "${command_name}"
done

if [[ ! -f "${FRONTEND_DIR}/package.json" ]]; then
  printf 'Error: no se encontro %s/package.json\n' "${FRONTEND_DIR}" >&2
  exit 1
fi

if [[ ! -f "${BACKEND_DIR}/package.json" ]]; then
  printf 'Error: no se encontro %s/package.json\n' "${BACKEND_DIR}" >&2
  exit 1
fi

log "Comprobando acceso SSH a ${REMOTE}"
ssh -o BatchMode=yes "${REMOTE}" true

log "Compilando frontend"
cd "${FRONTEND_DIR}"
rm -rf -- .next
npm run build

if [[ ! -d .next/standalone ]]; then
  printf 'Error: Next.js no genero .next/standalone.\n' >&2
  exit 1
fi

mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static
cp -a public .next/standalone/public

log "Empaquetando frontend"
tar -C .next/standalone \
  --exclude='./.env' \
  --exclude='./.env.*' \
  -czf "${FRONTEND_ARCHIVE}" .

if tar -tzf "${FRONTEND_ARCHIVE}" | grep -Eq '^\./\.env($|\.)'; then
  printf 'Error: el artefacto frontend contiene un archivo de entorno.\n' >&2
  exit 1
fi

log "Empaquetando backend"
tar \
  -C "${ROOT_DIR}" \
  --exclude='manhwa-api/node_modules' \
  --exclude='manhwa-api/.git' \
  --exclude='manhwa-api/.env' \
  --exclude='manhwa-api/.env.*' \
  --exclude='manhwa-api/uploads' \
  --exclude='manhwa-api/data' \
  --exclude='manhwa-api/logs' \
  --exclude='manhwa-api/tmp' \
  --exclude='manhwa-api/temp' \
  -czf "${BACKEND_ARCHIVE}" \
  manhwa-api

if tar -tzf "${BACKEND_ARCHIVE}" | grep -Eq '^manhwa-api/(\.env($|\.)|uploads/|data/|logs/|tmp/|temp/)'; then
  printf 'Error: el artefacto backend contiene secretos o datos persistentes.\n' >&2
  exit 1
fi

log "Subiendo artefactos"
scp "${FRONTEND_ARCHIVE}" "${REMOTE}:/root/manhwa-nextjs-deploy.tar.gz"
scp "${BACKEND_ARCHIVE}" "${REMOTE}:/root/manhwa-api.tar.gz"

log "Desplegando backend"
ssh "${REMOTE}" bash -s -- \
  "${BACKEND_REMOTE_DIR}" \
  "${BACKEND_SERVICE}" <<'REMOTE_BACKEND'
set -Eeuo pipefail

deploy_dir="$1"
service_name="$2"
service_stopped=0
restart_after_error() {
  if [[ "${service_stopped}" -eq 1 ]]; then
    systemctl start "${service_name}" || true
  fi
}
trap restart_after_error ERR

mkdir -p "${deploy_dir}"
if [[ ! -f "${deploy_dir}/.env" ]]; then
  printf 'Error: falta el archivo persistente %s/.env\n' "${deploy_dir}" >&2
  exit 1
fi
mkdir -p "${deploy_dir}/uploads" "${deploy_dir}/data" "${deploy_dir}/logs"
systemctl stop "${service_name}"
service_stopped=1
tar -xzf /root/manhwa-api.tar.gz -C "${deploy_dir}" --strip-components=1 \
  --exclude='.env' --exclude='.env.*' \
  --exclude='uploads' --exclude='uploads/*' \
  --exclude='data' --exclude='data/*' \
  --exclude='logs' --exclude='logs/*' \
  --exclude='tmp' --exclude='tmp/*' \
  --exclude='temp' --exclude='temp/*'
cd "${deploy_dir}"
npm install --omit=dev
chown -R www-data:www-data "${deploy_dir}"
runuser -u www-data -- node scripts/migrate-and-verify-007-009.js
systemctl start "${service_name}"
service_stopped=0
systemctl --no-pager --full status "${service_name}"
REMOTE_BACKEND


log "Desplegando frontend"
ssh "${REMOTE}" bash -s -- \
  "${FRONTEND_REMOTE_DIR}" \
  "${FRONTEND_SERVICE}" <<'REMOTE_FRONTEND'
set -Eeuo pipefail

deploy_dir="$1"
service_name="$2"

mkdir -p "${deploy_dir}"
if [[ ! -f "${deploy_dir}/.env" ]]; then
  printf 'Error: falta el archivo persistente %s/.env\n' "${deploy_dir}" >&2
  exit 1
fi
systemctl stop "${service_name}"
# Conservar configuracion y cache generada entre despliegues.
find "${deploy_dir}" -mindepth 1 -maxdepth 1 \
  ! -name '.env' ! -name '.next' -exec rm -rf -- {} +
tar -xzf /root/manhwa-nextjs-deploy.tar.gz -C "${deploy_dir}" \
  --exclude='./.env' --exclude='./.env.*' --exclude='.env' --exclude='.env.*'
mkdir -p "${deploy_dir}/.next/cache"
chown -R www-data:www-data "${deploy_dir}"
systemctl start "${service_name}"
systemctl --no-pager --full status "${service_name}"
REMOTE_FRONTEND

log "Deploy de produccion completado correctamente"
