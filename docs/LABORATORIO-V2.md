# BZ Creators — laboratorio de producto

## Dirección implementada

Portada editorial en negro grafito y violeta, con el logo original. Recorrido: hero interactivo, proyectos seleccionados, capacidades, proceso, OpenSource y contacto. La demo explica las etapas del trabajo; no simula conexiones ni estados de producción.

Se retiraron de la portada los cupos comerciales, métricas sin respaldo, testimonios provisionales, precios y productos con enlaces vacíos. Los componentes antiguos siguen disponibles en el repositorio. GymFlow, la plataforma de contenidos BZ y Honda Indumentaria (`https://induhonda.uk/`) cuentan con presentaciones gráficas de sus áreas; no se presentan como capturas de sus interfaces. Por decisión del usuario se mantiene esta estética tech.

El logo de navegación y footer usa `logo-web.webp`, una versión de 192 × 192 de 10.824 bytes frente a 919.037 bytes del PNG original (98,82% menos). La codificación WebP es sin pérdida sobre el resultado del reescalado Lanczos y preserva transparencia. Se generaron favicon de 64 px, icono Apple de 180 px e imagen social PNG de 512 px. Los originales se conservan. El proceso se puede repetir con `scripts/optimize-brand-assets.py` y Pillow.

OpenSource consume el endpoint público existente e incorpora búsqueda combinada con filtros por tecnología, destacados, fecha de actualización y estados de carga, vacío y error con reintento. No se inventaron estrellas, licencias ni versiones: el CMS actual no tiene esos campos. El endpoint publicado devolvió cero proyectos al verificarlo el 8 de septiembre de 2026.

El perfil de GitHub asociado al laboratorio es `https://github.com/opensource-bzcreators`, verificado en la sesión del usuario. Está enlazado desde el portal, la sección OpenSource de la portada y el footer. No tiene repositorios públicos al momento de la asociación. Los proyectos del portal siguen administrándose desde el CMS: esta vinculación no configura sincronización automática, credenciales, webhooks ni cambia el repositorio de despliegue de la web.

El blog comparte la paleta oscura y su encabezado ya queda por debajo de la navegación fija. Las rutas administrativas se cargan por separado; se mantienen los contratos de API, MySQL, autenticación y esquema.

## Validación local

- `npm run typecheck`: correcto.
- `npm run lint`: cero errores, siete advertencias previas en componentes de UI.
- `npm test`: siete pruebas aprobadas, incluidas interacción del hero, combinación de filtros y catálogo vacío.
- `npm run build`: correcto. JavaScript inicial de 365,77 kB (117,28 kB gzip). El chunk administrativo continúa por encima de 500 kB, pero no forma parte de la carga inicial.
- `git diff --check`: correcto.
- Build revisado en navegador a 360, 390, 430, 768 y 1440 px: sin desbordamiento horizontal, imágenes rotas ni enlaces `href="#"` en la portada.
- Menú móvil, cierre con Escape, anclas, selector del hero, portal OpenSource y listado del blog revisados en navegador.

La vista previa local usa un auxiliar temporal en `.agent/public-preview.mjs` para leer únicamente contenido público mediante GET. No utiliza credenciales y rechaza escrituras. Esto permite revisar el catálogo real sin ejecutar migraciones ni levantar el backend de producción. No constituye una prueba autenticada de administración o de escritura contra MySQL.

## Siguientes mejoras de contenido y rendimiento

- Cargar proyectos en el CMS a medida que el usuario publique repositorios en `opensource-bzcreators`; no se configuró sincronización automática.
- Mantener las ilustraciones tech de los proyectos, según la decisión del usuario.
- Alojar las fuentes localmente.

## Publicación

Repositorio de la web: `B4RT0Z1/BZ-Creators-Web`, rama `main`. El perfil `opensource-bzcreators` es el destino de los proyectos abiertos, no el repositorio de despliegue de esta web. Después del push, verificar la versión renderizada en `bzcreators.com.ar` y `opensource.bzcreators.com.ar`, el logo WebP y `/api/health`.
