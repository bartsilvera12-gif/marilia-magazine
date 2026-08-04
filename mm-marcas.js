/**
 * mm-marcas.js
 * ---------------------------------------------------------------------------
 * Registro de marcas de Marilia Magazine.
 *
 * POR QUE ESTA ACA Y NO EN EL ERP:
 * el schema `mariliaerp` no tiene tabla `marcas` ni columna `marca` en
 * `productos` (verificado: GET /marcas -> 404). Hasta que exista, la lista
 * vive en este archivo y se edita a mano. Cuando el ERP tenga la tabla,
 * se reemplaza `cargar()` por un fetch y el resto del sitio no se toca.
 *
 * COMO AGREGAR UNA MARCA:
 *   { slug:'gap', nombre:'GAP', desc:'...', match:['GAP'] }
 *
 *   slug   -> va en la URL: ./Catalogo.dc.html?marca=gap
 *   nombre -> como se muestra (el wordmark se dibuja con tipografia)
 *   desc   -> linea corta opcional
 *   logo   -> opcional: ruta a un archivo dentro de uploads/marcas/
 *             (ej: uploads + /marcas/ + gap.svg). Si no hay, se usa el
 *             nombre en tipografia, que es mejor que un logo inventado.
 *   match  -> tokens que tienen que aparecer en el nombre del producto
 *   todo   -> true si la marca cubre TODO el catalogo (ver nota TFLOW)
 *
 * NOTA TFLOW: hoy el 100% del catalogo identificable es TFLOW. Se cruzaron
 * los 21.000 productos visibles del ERP contra "TABELA PARAGUAI CORRIGIDO.xlsx"
 * por codigo de barras: 17.870 cruzan y todos dan marca TFLOW; los 3.130
 * restantes no cruzan porque tienen codigo_barras en null, no porque sean
 * otra marca. Por eso lleva `todo:true` en vez de `match`: filtrar por el
 * texto "TFLOW" en el nombre dejaria afuera la mayoria del catalogo
 * (solo ~15% de los nombres incluyen la palabra).
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var MARCAS = [
    {
      slug: "tflow",
      nombre: "TFLOW",
      desc: "Moda masculina y femenina, calzado y accesorios.",
      todo: true,
    },
    // Proximas marcas: agregar acá con `match` en vez de `todo`.
  ];

  window.MM_MARCAS = MARCAS;

  /** Busca una marca por slug. */
  window.mmMarcaPorSlug = function (slug) {
    if (!slug) return null;
    slug = String(slug).toLowerCase().trim();
    for (var i = 0; i < MARCAS.length; i++) {
      if (MARCAS[i].slug === slug) return MARCAS[i];
    }
    return null;
  };

  /**
   * ¿Este producto pertenece a la marca?
   * `todo:true` -> siempre sí (la marca cubre el catálogo entero).
   * `match`     -> alguno de los tokens aparece en el nombre.
   */
  window.mmProductoEsDeMarca = function (marca, nombre) {
    if (!marca) return true;
    if (marca.todo) return true;
    if (!marca.match || !marca.match.length) return false;
    var n = String(nombre || "").toUpperCase();
    for (var i = 0; i < marca.match.length; i++) {
      if (n.indexOf(String(marca.match[i]).toUpperCase()) > -1) return true;
    }
    return false;
  };
})();
