#!/usr/bin/env bash

set -Eeuo pipefail

# Despliegue directo a produccion.
DEPLOY_HOST="${PRODUCTION_DEPLOY_HOST:-178.128.8.41}"
DEPLOY_USER="${DEPLOY_USER:-root}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/manhwa-nextjs"
BACKEND_DIR="${ROOT_DIR}/manhwa-api"
PRESENCE_DIR="${ROOT_DIR}/presence-server"

FRONTEND_REMOTE_DIR="${FRONTEND_REMOTE_DIR:-/var/www/manhwa-nextjs}"
BACKEND_REMOTE_DIR="${BACKEND_REMOTE_DIR:-/var/www/manhwa-api}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-manhwa-nextjs}"
BACKEND_SERVICE="${BACKEND_SERVICE:-manhwa-api}"
PRESENCE_REMOTE_DIR="${PRESENCE_REMOTE_DIR:-/var/www/manhwa-presence}"
PRESENCE_SERVICE="${PRESENCE_SERVICE:-manhwa-presence}"
export NEXT_PUBLIC_PRESENCE_URL="${NEXT_PUBLIC_PRESENCE_URL:-wss://manhwaimperial.site/presence}"

FRONTEND_ARCHIVE="$(mktemp /tmp/manhwa-nextjs-deploy.XXXXXX.tar.gz)"
BACKEND_ARCHIVE="$(mktemp /tmp/manhwa-api-deploy.XXXXXX.tar.gz)"
PRESENCE_ARCHIVE="$(mktemp /tmp/manhwa-presence-deploy.XXXXXX.tar.gz)"

cleanup() {
  rm -f -- "${FRONTEND_ARCHIVE}" "${BACKEND_ARCHIVE}" "${PRESENCE_ARCHIVE}"
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

for command_name in npm tar ssh rsync; do
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

if [[ ! -f "${PRESENCE_DIR}/package.json" ]]; then
  printf 'Error: no se encontro %s/package.json\n' "${PRESENCE_DIR}" >&2
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

log "Empaquetando servicio de presencia"
tar \
  -C "${ROOT_DIR}" \
  --exclude='presence-server/node_modules' \
  --exclude='presence-server/.env' \
  --exclude='presence-server/.env.*' \
  -czf "${PRESENCE_ARCHIVE}" \
  presence-server

log "Subiendo artefactos"
rsync --archive --partial --info=progress2 "${FRONTEND_ARCHIVE}" "${REMOTE}:/root/manhwa-nextjs-deploy.tar.gz"
rsync --archive --partial --info=progress2 "${BACKEND_ARCHIVE}" "${REMOTE}:/root/manhwa-api.tar.gz"
rsync --archive --partial --info=progress2 "${PRESENCE_ARCHIVE}" "${REMOTE}:/root/manhwa-presence.tar.gz"

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
runuser -u www-data -- npm run migrate:all
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
mkdir -p "${deploy_dir}/.next/cache"
# Conservar solo la cache de compilacion, no artefactos de la version anterior.
find "${deploy_dir}/.next" -mindepth 1 -maxdepth 1 \
  ! -name 'cache' -exec rm -rf -- {} +
find "${deploy_dir}" -mindepth 1 -maxdepth 1 \
  ! -name '.env' ! -name '.next' -exec rm -rf -- {} +
tar -xzf /root/manhwa-nextjs-deploy.tar.gz -C "${deploy_dir}" \
  --exclude='./.env' --exclude='./.env.*' --exclude='.env' --exclude='.env.*'
chown -R www-data:www-data "${deploy_dir}"
systemctl start "${service_name}"
systemctl --no-pager --full status "${service_name}"
REMOTE_FRONTEND

log "Desplegando servicio de presencia"
ssh "${REMOTE}" bash -s -- \
  "${PRESENCE_REMOTE_DIR}" \
  "${FRONTEND_REMOTE_DIR}" \
  "${PRESENCE_SERVICE}" \
  "${NEXT_PUBLIC_PRESENCE_URL}" \
  "${FRONTEND_SERVICE}" <<'REMOTE_PRESENCE'
set -Eeuo pipefail

deploy_dir="$1"
frontend_dir="$2"
service_name="$3"
public_url="$4"
frontend_service="$5"

mkdir -p "${deploy_dir}"
tar -xzf /root/manhwa-presence.tar.gz -C "${deploy_dir}" --strip-components=1 \
  --exclude='.env' --exclude='.env.*'
cd "${deploy_dir}"
npm install --omit=dev

secret=''
if [[ -f "${deploy_dir}/.env" ]]; then
  secret="$(sed -n 's/^PRESENCE_SECRET=//p' "${deploy_dir}/.env" | tail -1)"
fi
if [[ -z "${secret}" && -f "${frontend_dir}/.env" ]]; then
  secret="$(sed -n 's/^PRESENCE_SECRET=//p' "${frontend_dir}/.env" | tail -1)"
fi
if [[ -z "${secret}" ]]; then
  secret="$(openssl rand -hex 32)"
fi

touch "${deploy_dir}/.env" "${frontend_dir}/.env"
sed -i '/^PRESENCE_SECRET=/d; /^PORT=/d' "${deploy_dir}/.env"
printf 'PRESENCE_SECRET=%s\nPORT=4001\n' "${secret}" >> "${deploy_dir}/.env"
sed -i '/^PRESENCE_SECRET=/d; /^NEXT_PUBLIC_PRESENCE_URL=/d' "${frontend_dir}/.env"
printf 'PRESENCE_SECRET=%s\nNEXT_PUBLIC_PRESENCE_URL=%s\n' "${secret}" "${public_url}" >> "${frontend_dir}/.env"
chmod 600 "${deploy_dir}/.env" "${frontend_dir}/.env"
chown www-data:www-data "${frontend_dir}/.env"
systemctl restart "${frontend_service}"

set -a
# shellcheck disable=SC1091
. "${deploy_dir}/.env"
set +a
if pm2 describe "${service_name}" >/dev/null 2>&1; then
  pm2 restart "${service_name}" --update-env
else
  pm2 start index.js --name "${service_name}"
fi
pm2 save

ssl_vhost='/etc/apache2/sites-available/manhwaimperial-le-ssl.conf'
if [[ -f "${ssl_vhost}" ]] && ! grep -qE 'ProxyPass[[:space:]]+/presence' "${ssl_vhost}"; then
  sed -i '/ProxyPass[[:space:]]\+\/socket\.io\//i\    ProxyPass        /presence ws://127.0.0.1:4001/ retry=0 timeout=120\n    ProxyPassReverse /presence ws://127.0.0.1:4001/' "${ssl_vhost}"
fi
if [[ -f "${ssl_vhost}" ]] && ! grep -qE 'ProxyPass[[:space:]]+/api/presence/token' "${ssl_vhost}"; then
  sed -i '/ProxyPass[[:space:]]\+\/api\/popular-home/i\    ProxyPass        /api/presence/token http://127.0.0.1:3001/api/presence/token retry=0 timeout=30\n    ProxyPassReverse /api/presence/token http://127.0.0.1:3001/api/presence/token' "${ssl_vhost}"
fi
apache2ctl configtest
systemctl reload apache2
pm2 status "${service_name}"
REMOTE_PRESENCE

log "Deploy de produccion completado correctamente"
