# Manhwa API

## Desarrollo local

La conexión local debe usar TCP (`127.0.0.1`) y un rol propio de PostgreSQL.
No uses `www-data`: la autenticación `peer` por socket solo permite conectarse
con un rol que coincida con el usuario de Linux, y `www-data` es el usuario del
servicio web, no el usuario con el que ejecutas `npm run dev`.

1. Revisa si ya existen el rol o la base para evitar sobrescribir una instalación:

   ```bash
   sudo -u postgres psql -c '\du'
   sudo -u postgres psql -l
   ```

2. Si `manhwa_app` y `manhwa_db` no existen, créalos con una contraseña local
   propia (reemplaza el ejemplo por la misma contraseña que pondrás en `.env`):

   ```bash
   sudo -u postgres psql
   ```

   En la consola de PostgreSQL:

   ```sql
   CREATE ROLE manhwa_app WITH LOGIN PASSWORD 'cambia-esta-clave-local';
   CREATE DATABASE manhwa_db OWNER manhwa_app;
   \q
   ```

   Si alguno ya existe, no repitas esos comandos ni importes el esquema encima
   de una base con datos; conserva la base y configura `.env` con sus credenciales
   y permisos actuales.

3. La API lee `.env` al arrancar. `.env.example` es solo la plantilla versionada
   en Git; no pongas contraseñas reales en ese archivo. Desde `manhwa-api`, crea
   el `.env` local solo si todavía no existe:

   ```bash
   cp -n .env.example .env
   ```

   `-n` evita reemplazar tu configuración local existente. Edita `.env` (no
   `.env.example`) y asegúrate de que tenga `DB_HOST=127.0.0.1`,
   `DB_NAME=manhwa_db`, `DB_USER=manhwa_app` y el mismo `DB_PASSWORD` que usaste
   al crear el rol. Conserva las demás variables de tu `.env`.

   Si quieres mostrar localmente el catálogo almacenado en DigitalOcean Spaces
   sin copiarlo a PostgreSQL, configura en `.env` las credenciales `DO_SPACES_*`
   y agrega:

   ```env
   SPACES_PRELOAD_IN_DEVELOPMENT=true
   ```

   Esto solo permite leer el catálogo remoto cuando `NODE_ENV=development`; no
   sincroniza ni modifica datos en Spaces. La primera petición puede tardar hasta
   45 segundos mientras se carga el catálogo.

4. Solo para una base nueva y vacía, carga el esquema inicial:

   ```bash
   psql -h 127.0.0.1 -U manhwa_app -d manhwa_db -f db/base_schema.sql
   ```

5. Inicia la API:

   ```bash
   npm run dev
   ```

El `.env` no se debe subir al repositorio. Usa secretos distintos para cada
entorno y no uses esta configuración de desarrollo en producción.
