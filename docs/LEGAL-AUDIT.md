# Auditoría de datos y candidato legal para Meta

Fecha: 10/10/2026. Repositorio B4RT0Z1/BZ-Creators-Web, rama local `codex/legal-meta`, base `a10050c`. Se usó un worktree separado: la carpeta original conserva los cambios pendientes de Dina. No se hizo push ni se modificó producción.

## Datos y flujos comprobados antes de escribir los textos

| Flujo | Evidencia | Datos / comportamiento |
| --- | --- | --- |
| Comentarios | server/app.js, server/schema.sql, CommentsSection.tsx | Guarda id, post_id, author_name, author_email, content, approved (TRUE por defecto), created_at. Publicación inmediata; sólo nombre, texto y fecha en respuestas públicas. No columna de IP. Borrado en cascada al eliminar la nota. |
| Login administrativo | server/auth.js, config.js, schema.sql | Correo y bcrypt hash en users; JWT con sub/role/email. Cookie bz_admin_session, 12 horas, HttpOnly, SameSite=Lax, path=/, Secure según config (obligatorio en validación de producción). JWT configurable, 12h por defecto. Logout borra cookie. |
| Control de abuso | server/app.js | express-rate-limit, almacenamiento en memoria por IP: login 10 intentos / 15 minutos; comentarios 5 / 10 minutos. No persistencia en tabla de comentarios. |
| Imágenes | server/uploads.js, app.js, news-agent.js | Sólo admin sube archivos; MIME JPEG/PNG/WebP/GIF, tamaño configurable (5 MB por defecto), UUID, volumen local /uploads. No elimina EXIF. Agente editorial puede referenciar imágenes HTTP/HTTPS externas. |
| Contacto | Index.tsx, LabSections.tsx | Enlace a WhatsApp; sin formulario que persista consultas en MySQL. CTASection tiene un formulario antiguo sin montar: prepara texto para WhatsApp, no llama un endpoint. No newsletter activa. |
| Sesiones auxiliares | ui/sidebar.tsx y búsquedas de importación | sidebar:state existe en componente sin montar; no corresponde inventarlo como cookie activa. No ThemeProvider activo ni almacenamiento de credenciales del admin en el frontend. |
| Logs | server/index.js, app.js, news-agent.js | Logs de arranque, admin creado y errores. Errores pueden incluir detalles de operaciones. No access-log middleware en Express. Retención de proxy, Docker, hosting y backups no está definida aquí. No se leyeron .env, contraseñas ni tablas con datos de personas. |
| DB | server/schema.sql, db.js | MySQL: users, categories, posts, comments, open_source_projects, agent_drafts. agent_drafts conserva URL editorial de origen. No tabla pública de leads ni pagos. |
| Analítica retirada | index.html, App.tsx y búsqueda de scripts | El titular pidió retirar Google Tag Manager por no tener función. Se eliminaron script, iframe, cargador, banner y preferencia local del candidato. No se carga Analytics ni un píxel publicitario. |
| Fuentes | src/index.css | Inter y Space Grotesk desde Google Fonts; candidato las sirve localmente, conservando familias/pesos y licencias OFL. |
| Proxy público | GET público y API autenticada de Cloudflare de sólo lectura | Revisión de navegador activada, nivel medium, challenge_ttl 1800 segundos. Bot Fight Mode y detecciones JS apagados; sin rulesets de entrada WAF custom/managed. No Set-Cookie en respuesta ordinaria. Se informa cf_clearance como cookie esencial condicionada a superar un desafío; no se afirma que todas las visitas la reciban. |
| Hosting | Confirmación del titular | Contabo, región Unión Europea. No se inventó país ni centro de datos específico. |
| Instagram | BZ-Agent-OS/services/local-control/src/social/{instagram-client,social-store,social-service}.ts y agent-host-server.ts | Graph API de lectura: perfil propio, publicaciones/insights, Business Discovery de profesionales públicos. SQLite social.sqlite conserva métricas diarias, publicaciones, competidores e informes. Secreto de conexión en almacén del host. Los resúmenes se envían a OpenRouter, modelo DeepSeek configurado; informes a Telegram si se habilita. No POST de publicación ni mensajes de Instagram. No lee texto de comentarios, DMs ni listas de seguidores. |

## Decisiones confirmadas por el titular

- BAUTISTA ZANELLI, CUIT 20-43456073-0.
- Calle 38 N.º 577, Navarro, Buenos Aires, Argentina.
- bautistazanelli@bzcreators.com.ar para privacidad, eliminación y consultas.
- Jurisdicción Navarro, Buenos Aires, respetando tribunales competentes y fueros imperativos.
- Logs, backups, datos de Instagram y consultas: máximo 6 meses, con excepciones legales justificadas.
- Comentarios: hasta solicitud de borrado, moderación o eliminación de la nota.
- El titular ratificó el 10/10 la conservación del servidor. Es una confirmación del responsable, no una prueba independiente de todas sus tareas de rotación.
- Google Tag Manager se retira del sitio; no se reemplaza por otro servicio de seguimiento.

## Cambios del candidato

Cuatro rutas React y Express con texto visible sin JavaScript, canonical/title/description, enlaces del footer (incluido admin y 404), aviso y autorización expresa en comentarios, URLs y fecha en sitemap. Google Tag Manager eliminado. Sin banner porque sólo quedan cookies esenciales, sin preferencia local de seguimiento y sin nuevos scripts de terceros. Fuentes locales. Docker incluye shared para servir los textos en producción.

Ícono Meta: public/meta-app-icon-1024.png; logo oficial existente intacto en geometría, blanco sobre negro, con acento #A855F7 separado. 1024 × 1024. Reproducible con scripts/generate-meta-icon.mjs usando Sharp disponible en el runtime de trabajo (BZ_GRAPHICS_MODULE_ROOT); no se añadió esa dependencia a la app.

## Validación y revisión

`npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.

Pruebas de Express consultan las 4 rutas y el sitemap por HTTP, sin usar DB real; pruebas de React recorren rutas, footer, comentarios y ausencia de etiquetas/banners incluso con una aceptación antigua en localStorage. Prueba scripts/legal-visual.e2e.mjs con Playwright del runtime (BZ_BROWSER_MODULE_ROOT): escritorio 1440px, celular 390px, sin overflow, títulos/metadatos únicos, cero solicitudes externas en las rutas legales, sin banner y lectura de las cuatro páginas sin JS. Capturas y checks.json en dist/legal-review (no versionados).

Avisos existentes: 7 warnings de Fast Refresh en componentes ui y chunk del admin mayor a 500 KB; sin errores nuevos. No se instaló ni desplegó el candidato.

Resultado final tras retirar GTM: 25 pruebas aprobadas; typecheck, lint y build aprobados. La integración visual aprobó las cuatro páginas a 1440 y 390 px, sin solicitudes externas ni errores, sin banner y con lectura de todas las rutas sin JavaScript. El ícono conservó 1024 × 1024. `main` remoto sigue en `a10050c`; no se hizo push.

Textos completos: docs/LEGAL-TEXTS.md, exportados de la misma fuente que consumen React y Express.

## Antes de aprobar y publicar

No quedan campos [COMPLETAR] en los textos públicos. Los datos personales se confirmaron, Cloudflare se consultó y la conservación del servidor fue ratificada por el responsable. Estos son los límites de lo comprobado:

1. La política describe el alojamiento en la UE y el tratamiento posible por redes/proveedores globales; explica el marco de transferencias y enlaza la AAIP y los prestadores. No acredita contratos bilaterales ni cláusulas aceptadas que no se hayan visto. La documentación pública de un DPA no demuestra por sí sola su aceptación por el titular.
2. La conservación de seis meses es la política confirmada por el responsable. SocialStore no tiene purga automática por antigüedad ni borrado integral de informes de una cuenta; quitar un competidor borra sus mediciones, pero no reescribe reportes que lo mencionen. La atención manual documentada debe cubrir esos reportes. No se desplegó una nueva purga ni se borraron datos reales durante esta tarea.
3. La consulta SSH confirmó Docker con json-file y sin LogDriver específico en los servicios web/host. No confirmó una tarea programada por antigüedad. La confirmación del responsable sobre el servidor se registra como tal, sin presentarla como una auditoría independiente.

Para pedidos de eliminación: identificar datos por correo/URL/cuenta, verificar proporcionalmente, borrar sistemas activos y reportes identificables, revocar la conexión si corresponde, registrar resultado sin conservar contenido innecesario, impedir reaparición al restaurar backups y confirmar por correo. Las solicitudes se atienden con intervención del responsable; no se añadió un callback automático de Meta.

El responsable debe revisar mensualmente la antigüedad de logs, backups, métricas, publicaciones e informes; retirar los que superen seis meses salvo conservación legal justificada. Para solicitudes individuales, verificar primero su alcance y respaldos afectados; los comentarios del blog se eliminan desde el administrador y los datos de Instagram mediante mantenimiento autorizado del host, incluyendo informes que identifiquen la cuenta. Registrar identificador mínimo, fecha y resultado, sin copiar el contenido eliminado. La restauración de backups debe reaplicar las supresiones registradas. Este procedimiento documentado no equivale a una tarea automática instalada.

El plazo propuesto de 30 días es un máximo operativo subordinado a los plazos legales más breves: Argentina, acceso 10 días corridos; rectificación/actualización/supresión 5 días hábiles. RGPD, cuando corresponda, un mes con sus condiciones.

## URLs para Meta (previstas; aún no publicadas)

- Privacidad: https://bzcreators.com.ar/privacidad
- Condiciones: https://bzcreators.com.ar/terminos
- Eliminación: https://bzcreators.com.ar/eliminacion-de-datos
- Cookies: https://bzcreators.com.ar/cookies

Recomendación editorial: categoría Business and Pages / Negocios y páginas, si está disponible; tipo Business / uso para el propio negocio. La etiqueta exacta del selector actual de Meta debe comprobarse en el panel: la documentación pública de Meta no fue accesible durante esta revisión. No se garantizó aprobación de permisos o de la app.

## Fuentes primarias consultadas

- Ley 25.326, arts. 14/16: https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion
- Derechos y AAIP: https://www.argentina.gob.ar/aaip/datospersonales/derechos
- RGPD: https://eur-lex.europa.eu/legal-content/ES/ALL/?uri=CELEX%3A32016R0679
- Google, consentimiento: https://developers.google.com/tag-platform/security/guides/consent
- Cloudflare, privacidad: https://www.cloudflare.com/privacypolicy/
- Cloudflare, cookies: https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/
- AAIP, transferencias: https://www.argentina.gob.ar/transferencias-internacionales
- OpenRouter: https://openrouter.ai/privacy y https://openrouter.ai/data-processing-agreement
- Telegram: https://telegram.org/privacy
- Meta, páginas de configuración consultadas pero inaccesibles: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings/ y https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/

No se afirma que tener estas páginas pruebe cumplimiento operativo completo. Publicación sólo con OK del titular; un push a main activa Dokploy.
