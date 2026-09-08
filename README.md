# BZ Creators Web

Sitio público, blog y CMS administrativo de BZ Creators. La aplicación usa React/Vite en el frontend y una API Node/Express con MySQL 8.

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- MySQL 8.0 o superior

## Puesta en marcha local

1. Copia `.env.example` como `.env`.
2. Para desarrollo con Docker, los valores de MySQL ya coinciden con `compose.yaml`. Cambia `JWT_SECRET` y `ADMIN_*` antes de cualquier despliegue real.
3. Crea la base y el usuario MySQL, o inicia el servicio incluido con `docker compose up -d mysql`.
4. Instala dependencias con `npm install`.
5. Ejecuta `npm run db:migrate` para crear y actualizar el esquema.
6. Inicia frontend y API con `npm run dev`.

El frontend queda en `http://localhost:8080` y la API en `http://localhost:3001`. Vite redirige `/api`, `/uploads` y `/sitemap.xml` a la API durante el desarrollo.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión MySQL |
| `DB_SSL` | Activa TLS validado hacia MySQL |
| `JWT_SECRET` | Firma de la sesión administrativa |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Crea el primer administrador si no existe |
| `COOKIE_SECURE` | Debe ser `true` en producción HTTPS |
| `PUBLIC_SITE_URL` | URL canónica usada por el sitemap |
| `OPEN_SOURCE_SITE_URL` | URL canónica de la sección OpenSource |
| `UPLOAD_DIR` | Directorio persistente de imágenes |
| `MAX_UPLOAD_MB` | Tamaño máximo por imagen |
| `VITE_API_URL` | Déjalo vacío en la arquitectura recomendada de mismo dominio |

La contraseña configurada en `ADMIN_PASSWORD` solo se usa para crear una cuenta ausente; no sobrescribe una cuenta existente. Después del primer arranque puedes retirar ambas variables `ADMIN_*`; el servidor comprobará que ya exista al menos un administrador.

## Producción

`npm run build` genera `dist` y `npm start` inicia una sola aplicación que sirve la API, las imágenes y la SPA. El arranque ejecuta el esquema idempotente antes de escuchar tráfico. Para Dokploy debe usarse el `Dockerfile` del repositorio, sin argumentos ni secretos durante el build.

En el hosting configura:

- MySQL 8 privado y respaldos automáticos.
- Todas las variables del bloque anterior.
- HTTPS y `COOKIE_SECURE=true`.
- Un volumen persistente montado en el valor absoluto de `UPLOAD_DIR`.
- Health check en `/api/health`.
- Puerto interno `3001` y dominio conectado a ese puerto.
- Los dominios `bzcreators.com.ar`, `www.bzcreators.com.ar` y `opensource.bzcreators.com.ar` conectados a la misma aplicación.

## Comandos de verificación

```bash
npm run lint
npm test
npm run build
```
