# BZ Creators Web

## Arquitectura

- Frontend: React 18, Vite 5, TypeScript y Tailwind CSS 3.4.
- Backend: Node.js y Express.
- Base de datos: MySQL 8 con `mysql2`.
- Autenticación: sesión JWT en cookie `HttpOnly`; nunca guardar credenciales en el frontend.
- Archivos: imágenes en `UPLOAD_DIR`; en producción el directorio debe usar un volumen persistente.

## Reglas

- Mantener Tailwind CSS en la rama 3.4; no actualizar a v4.
- Toda consulta MySQL debe usar parámetros preparados.
- Las rutas de escritura bajo `/api/admin` requieren `requireAdmin`.
- No exponer `author_email`, hashes, claves ni secretos en respuestas públicas.
- Los cambios de esquema deben ser idempotentes y agregarse a `server/schema.sql`.
- Verificar al menos `npm run lint`, `npm test` y `npm run build` después de cambiar código.
