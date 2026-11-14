# Marketing listo para el primer armado · 2026-11-13

**Publicado y verificado:** nueva tarjeta social, kit EN/ES, 32 archivos visuales y de video, textos por canal, FAQ, guion, canales y secuencia de publicación. GitHub Pages publicó `eee10e8`; los 36 archivos públicos coinciden byte por byte con los locales. Recibo: `validation/marketing-public.json`.

## Alcance y aceptación

Solicitud: corregir la presentación al compartir flankbd.com y preparar todo para empezar marketing de nicho después de encargar las piezas.

1. Compartir: tarjeta 1200 × 630, geometría real y rótulo de prototipo legible; metadatos en el HTML y acceso con agentes de Facebook, X y LinkedIn.
2. Material: carrusel, feed, story, portada YouTube, avatar, teaser vertical de 30 s, subtítulos, texto alternativo y archivo descargable EN/ES. Renders CAD; sin fotos sintéticas ni audio de tipeo prestado.
3. Canales: textos completos, bios, guion, FAQ, respuestas, lista de destinos con fuentes y límites de verificación, secuencia por hitos y registro manual de resultados.
4. Sitio: piezas encargadas / pruebas físicas pendientes visible; conservar configurador, idiomas, opciones, descargas y diseño inicial. Kit usable en escritorio y teléfono.
5. Entrega: fuentes y resultados reproducibles, cambios atribuibles validados y sincronizados a `origin/main`, publicación y descarga leídas de vuelta. No incluye publicar posts, enviar mensajes, abrir cuentas, comprar anuncios o vender productos.

Base: `f05cd33`, `main`, repositorio público `eduarbo/flan`, inicialmente limpio. El trabajo concurrente de emulación es dueño de `tools/display_preview/` y `docs/firmware.md`; queda fuera de esta entrega y de su publicación. Se obtuvo exclusividad de las operaciones Git para este cambio.

## Discrepancia y correcciones

La captura de SocialSharePreview dice que falta una imagen. Las lecturas HTTP frescas del 13 de noviembre devolvieron `og:image` y `twitter:image` en portada y explorador, PNG 1200 × 630 de 499,979 bytes, también bajo agentes de Facebook, X y LinkedIn. **No se reprodujo ese fallo; la causa sigue sin determinarse.** La tarjeta anterior sí era densa y carecía de rótulo de prototipo dentro de la imagen.

La nueva tarjeta usa el render real de Flan36 en crema/caramelo y marco Talavera. Incluye un rótulo grande y una URL basada en su contenido; `home-og.png` sigue disponible para consumidores anteriores. Se añadieron tipo PNG, URL segura y alt text. Esto separa versiones de caché; no demuestra que la caché de una app ajena ya se haya actualizado.

La portada informa que las piezas del primer Flan36 están encargadas, sin dar por recibidas, armadas ni probadas. La cifra antigua de 28 temas ahora se calcula desde los datos del sitio: 31 temas, seis marcos, cuatro cajas. La configuración inicial EVA-01 y sus controles se conservan.

## Revisión independiente y resultados

Una ronda con dos revisores de solo lectura: producto/constructivo y adversarial/fiabilidad. Ambos recomendaron publicar después de resolver sus hallazgos; sin objeciones CRITICAL. Los 20 archivos enumerados de la copia congelada conservaron sus hashes. Ver `validation/marketing-review.json`.

- HIGH aparente: ambos interpretaron la lámina de tamaños como cuatro Flan36. La inspección ampliada muestra 3×5+3, 3×6+3, 4×5+3 y 4×6+3 teclas por mitad. La lámina congelada y final tiene el mismo hash: la sospecha no se confirmó. Se corrigió el aviso prematuro y se reforzó la captura para contar las teclas visibles reales (18/21/23/27), esperar la carga y verificar los hashes reutilizados.
- MEDIUM: el rótulo social de 13 px se amplió con una insignia de 36 px; se inspeccionó a 600 y 360 px.
- LOW: se reconciliaron la cifra de temas y la duración de 30 segundos.

Pruebas funcionales: escritorio 1440 px y teléfono 390 px; EN/ES; copia exacta y selección manual cuando se niega portapapeles; 28 enlaces de descarga; ambos MP4 decodifican 1080 × 1920 y 30 s; portada 3D carga sin errores; sin desbordamiento horizontal. Metadatos, datos estructurados, robots, sitemap y resúmenes pasan el verificador existente. Los archivos del ZIP coinciden con las fuentes y conservan atribución y licencias.

Recibos:
- `validation/marketing-assets.json`: renders, teclas, fuentes y hashes de los 32 archivos.
- `validation/marketing-check.json`: uso local y hashes de portada, explorador, kit y ZIP.
- `validation/marketing-review.json`: revisión y disposición de hallazgos.
- `validation/marketing-public.json`: 36 archivos públicos y seis lecturas de portada/explorador con agentes sociales.
- `validation/marketing-checker.json`: SocialSharePreview reconoce la descripción nueva y muestra la tarjeta `home-og-7000e304e239.png`; comprobado visualmente. No implica que la caché propia de Facebook, X o LinkedIn se haya actualizado.

## Reproducir

Usar Node, Python 3, FFmpeg, las dependencias bloqueadas de `viewer/package-lock.json` y Playwright 1.61.1 con Chromium 149.0.7827.55. En esta máquina se reutilizó el runtime existente; no se instalaron dependencias nuevas. Si falta la escena, regenerarla con `tools/build_viewer_revI.py` y el Python de FreeCAD según [la guía CAD](../cad.md).

Desde la raíz, en este orden:

```sh
node viewer/build.mjs
FLAN36_PLAYWRIGHT_MODULE="$PWD/build/responsive-review/runtime-restore/node_modules/playwright" node viewer/marketing/capture.cjs
FLAN36_PLAYWRIGHT_MODULE="$PWD/build/responsive-review/runtime-restore/node_modules/playwright" node viewer/marketing/build.cjs
node viewer/build.mjs
node viewer/marketing/page.mjs
FLAN36_PLAYWRIGHT_MODULE="$PWD/build/responsive-review/runtime-restore/node_modules/playwright" node viewer/marketing/check.cjs
node viewer/site-meta-check.mjs
# Después de publicar en el destino existente:
node viewer/marketing/public-check.mjs
```

`FLAN36_PLAYWRIGHT_MODULE` puede señalar otra instalación del mismo runtime. `build/marketing/` está ignorado: capturas, fotogramas y comprobaciones se regeneran con estos comandos; se validan por los recibos y la inspección visual. Los archivos entregables permanecen en `docs/marketing/`. La geometría y todos los archivos de firmware permanecen fuera del alcance de este cambio.

## Dependencias reales

Las cuentas y los grupos privados no están verificados; los borradores no están publicados. Las fotos del armado, la voz opcional y el video largo requieren grabación de Eduardo. Las pruebas físicas siguen en [first-build.md](../first-build.md). La causa del fallo de la captura inicial sigue sin demostrarse; el comprobador ahora muestra la tarjeta nueva y el sitio se verifica por HTTP.
