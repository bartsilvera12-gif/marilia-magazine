# Marilia Magazine — Web Design

Sitio de una casa de moda con atelier en Villa Morra, Asunción. Estático: HTML,
CSS y JavaScript sin dependencias ni proceso de build.

## Páginas

| Archivo | Contenido |
|---|---|
| `Marilia Magazine.dc.html` | Home: hero, destacados, explorar la colección, categorías, shop the look, esencia |
| `Catalogo.dc.html` | Catálogo completo con filtros por género y categoría, orden y vista rápida |
| `Producto.dc.html` | Ficha de producto con galería, talles, colores y relacionados |
| `Privacidad.dc.html` | Política de privacidad |

## Cómo verlo

Necesita servirse por HTTP (las páginas cargan `support.js` y `image-slot.js` por
ruta relativa, y el sidecar de imágenes se lee por `fetch`).

```bash
npx --yes http-server . -p 8765 -c-1
```

Después abrir `http://localhost:8765/Marilia%20Magazine.dc.html`.

## Estructura

```
uploads/
  explorar/     6 productos de mujer, con toma en modelo y en percha
  destacado/    línea de hombre, con toma en modelo y en percha
  temporada/    colección nueva de mujer, con toma en modelo y en percha
support.js      runtime x-dc (componentes, estado, plantillas)
image-slot.js   <image-slot>, marco de imagen rellenable
```

Las fotos siguen la convención `prenda.webp` (en modelo) y `prenda2.webp` (en
percha). La primera es la principal; la segunda aparece al pasar el cursor sobre
la tarjeta y como segunda miniatura en la ficha.

## Notas de implementación

- **Catálogo de productos.** Vive en tres lugares que hay que mantener alineados:
  las tarjetas de la home, la grilla de `Catalogo.dc.html` y `MM_PRODUCTS` en
  `Producto.dc.html`. El mapa `Component.PRODUCT_IDS` de la home traduce nombre a
  id: si falta una entrada, la tarjeta no navega y falla en silencio.

- **Filtros.** `data-cat` es una lista separada por espacios (`"hombre camisas"`),
  así una pieza responde al filtro de género y al de prenda a la vez. Género y
  categoría se combinan con AND. Las categorías sin stock se atenúan solas.

- **Proporciones de foto.** Las imágenes van de 0.640 a 0.800, así que ningún
  marco fijo sirve para todas. La ficha de producto toma la proporción de la
  imagen al cargar (recorte cero). Las tarjetas comparten proporción por fuerza,
  y ahí el recorte se ancla arriba para que se pierda el ruedo y no la cara.

- **Revelado al hacer scroll.** Un elemento que se oculta recortándose
  (`clip-path`, o dentro de un `overflow:hidden`) nunca puede intersectar el
  viewport, así que no se lo puede observar directamente. La marca `data-shown`
  la lleva un ancestro sin recortar y el CSS anima los hijos desde ahí.

- **Carrusel de destacados.** Deriva lenta que invierte el sentido en los
  extremos. El `scroll-snap` se apaga mientras se mueve, porque devolvería cada
  paso sub-pixel a la tarjeta más cercana; se restaura al pausar, que es cuando
  el usuario toma el control.

- **Accesibilidad y movimiento.** Todo respeta `prefers-reduced-motion`, y en
  táctil (`hover: none`) los estados que dependen del cursor quedan visibles.

## Pendiente

- Cuatro piezas de mujer siguen sin foto propia: Vestido Aurelia, Conjunto
  Sienna, Blusa Loreta y Bolso Nieve usan tomas prestadas.
- El carrito y los favoritos viven en memoria; no hay backend ni pasarela de pago.
- `Privacidad.dc.html` es un modelo de referencia y debería revisarlo un
  profesional antes de publicarse.

## Peso de imágenes

Las fotos se sirven en **WebP** (`q82`, lado largo a 1000px): 109 MB de PNG
originales pasaron a 5,9 MB, sin cambio perceptible a los tamaños en que se
muestran. Los PNG quedan en disco como fuente pero no se versionan — están en
`.gitignore`.

Para regenerarlos después de agregar fotos nuevas:

```bash
npx --yes sharp-cli -i uploads/<carpeta>/*.png -o uploads/<carpeta> -f webp -q 82 resize 1000 --withoutEnlargement
```

Además: `<image-slot>` marca sus imágenes como `loading="lazy"`, y la segunda
toma de cada tarjeta (la del hover) guarda su URL en `data-src2` y no se
descarga hasta el primer hover — si no, al estar dentro del viewport con
`opacity:0` se bajaría igual y duplicaría el peso que paga el visitante.

---

Desarrollado por [Neura](https://neura.com.py)
