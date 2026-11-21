# Despliegue del servicio de presencia

La presencia vive únicamente en memoria. Ejecuta una sola instancia del proceso; no uses el modo cluster de PM2 sin añadir antes un adaptador compartido como Redis.

## Variables de entorno

Usa el mismo secreto largo y aleatorio en el proceso de Next.js y en el microservicio:

```bash
PRESENCE_SECRET=un_secreto_largo_y_aleatorio
NEXT_PUBLIC_PRESENCE_URL=wss://manhwaimperial.site/presence
```

`NEXT_PUBLIC_PRESENCE_URL` se incorpora al bundle del navegador durante `next build`, así que configura la variable antes de compilar Next.js. `PRESENCE_SECRET` es privada y nunca debe llevar el prefijo `NEXT_PUBLIC_`.

## PM2

Desde la raíz del repositorio, después de ejecutar `npm install` dentro de `presence-server/`:

```bash
PRESENCE_SECRET='un_secreto_largo_y_aleatorio' PORT=4001 pm2 start presence-server/index.js --name manhwa-presence
pm2 save
```

## nginx

Incluye este bloque dentro del `server` que atiende `manhwaimperial.site`:

```nginx
location /presence {
    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

Valida y recarga nginx sin interrumpir conexiones existentes:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Antes de arrancar la nueva versión del API, aplica `manhwa-api/migrations/013_add_active_reader_privacy.sql` con el procedimiento habitual de migraciones del proyecto.
