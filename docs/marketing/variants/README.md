# Portadas Flan · variantes

Petición del 13 de noviembre de 2026: quitar «prototipo» de las imágenes y crear variantes con otros temas y estilos a partir de la portada Ko-fi. Esta revisión reemplaza la decisión gráfica anterior de añadir una insignia. El estado físico sigue explícito en el texto del proyecto.

| Tema | Caja | Marcos | Fondo |
|---|---|---|---|
| EVA-01 | Color rim | SNES / 2000s Phone | Ciruela oscuro |
| Matcha | Terrace | iPod / Game Boy | Verde bosque |
| Hanafuda | Level | Hanafuda | Papel crema |
| Flan | Solid | Talavera | Crema y caramelo |

Cada combinación incluye `cover-TEMA-IDIOMA.png` (1400 × 466) y `card-TEMA-IDIOMA.png` (1200 × 630), en EN y ES. Los 16 archivos utilizan capturas del modelo CAD real y tipografía del proyecto. Se verifican las 18 teclas por mitad, caja y marcos antes de capturar. Los gráficos de las pantallas son ilustrativos. No se han cambiado las fuentes CAD ni el firmware.

`kofi-eva-01-clean.png` es la edición solicitada de la portada adjunta, realizada con la herramienta integrada imagegen. Se conserva como una pieza separada; las otras variantes se generan desde las fuentes nativas para mantener su geometría exacta. Prompt de edición: “Remove only the words ‘ · DIGITAL PROTOTYPE’; retain ‘OPEN-SOURCE KEYBOARD’, all other text, typography, keyboard geometry, four miniatures, exploded layers, colors and composition. Do not add prototype/prototipo or another badge. Preserve the wide 3:1 banner.”

Reproducción desde la raíz, con el runtime de Playwright existente:

```sh
FLAN36_PLAYWRIGHT_MODULE="$PWD/build/responsive-review/runtime-restore/node_modules/playwright" node viewer/marketing/variant-capture.cjs
FLAN36_PLAYWRIGHT_MODULE="$PWD/build/responsive-review/runtime-restore/node_modules/playwright" node viewer/marketing/variant-build.cjs
node viewer/marketing/page.mjs
```

Los PNG finales están versionados. Las capturas y configuraciones intermedias de `build/marketing/variants/` están ignoradas y se regeneran con los comandos anteriores. `validation/marketing-variants.json` conserva configuraciones y hashes. Para regenerar todo el kit sin las etiquetas, ejecutar además `viewer/marketing/build.cjs`, `viewer/build.mjs` y los controles descritos en `../verification.md`.

Créditos y licencia: [ASSET-LICENSE.md](../ASSET-LICENSE.md). Mantener la atribución del proyecto y de KLP Lamé. Las imágenes sin rótulo no constituyen evidencia de pruebas físicas.
