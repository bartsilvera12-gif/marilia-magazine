/**
 * sitio-erp-sync.js
 * ------------------------------------------------------------------
 * Sincroniza el sitio Marilia Magazine con el ERP (Supabase, schema
 * `mariliaerp`) usando el anon key (public). Consultas de solo lectura.
 *
 * Uso:
 *   <script>
 *     window.MM_SUPABASE = {
 *       url: "https://XXXXX.supabase.co",
 *       anonKey: "eyJhbGciOi...",
 *     };
 *   </script>
 *   <script defer src="./sitio-erp-sync.js"></script>
 *
 * Después el script auto-detecta qué secciones renderizar según los
 * atributos `data-mm-sync="catalogo|filtros|shop-the-look|instagram"`
 * presentes en el DOM. Si no encuentra ninguno, no hace nada.
 *
 * Diseño no invasivo: si Supabase no responde o no hay datos, el
 * contenido hardcodeado en el HTML se mantiene visible como fallback.
 * ------------------------------------------------------------------
 */
(function () {
  "use strict";

  var CFG = window.MM_SUPABASE || {};
  if (!CFG.url || !CFG.anonKey) {
    console.warn("[MM-SYNC] Falta window.MM_SUPABASE.{url, anonKey} — se usa contenido estático");
    return;
  }

  var REST = CFG.url.replace(/\/+$/, "") + "/rest/v1";
  var HEADERS = {
    apikey: CFG.anonKey,
    Authorization: "Bearer " + CFG.anonKey,
    "Accept-Profile": "mariliaerp",
    Accept: "application/json",
  };

  function fmtGs(n) {
    var v = Number(n) || 0;
    return "Gs. " + v.toLocaleString("es-PY");
  }

  function pickSlot(slot, key) {
    return (slot && slot.dataset && slot.dataset[key]) || "";
  }

  async function api(path) {
    try {
      var r = await fetch(REST + path, { headers: HEADERS, credentials: "omit" });
      if (!r.ok) {
        console.warn("[MM-SYNC] fetch failed", path, r.status);
        return null;
      }
      return await r.json();
    } catch (e) {
      console.warn("[MM-SYNC] fetch error", path, e);
      return null;
    }
  }

  // ------------------------------------------------------------------
  // 1) Catálogo dinámico
  // ------------------------------------------------------------------

  /**
   * Renderiza tarjetas de producto en el contenedor con
   * `data-mm-sync="catalogo"`. Mantiene el primer <article> hijo como
   * TEMPLATE (invisible) y clona uno por producto de la DB.
   */
  async function syncCatalogo() {
    var container = document.querySelector('[data-mm-sync="catalogo"]');
    if (!container) return;

    var template = container.querySelector("article");
    if (!template) return;

    var productos = await api(
      "/productos?select=id,nombre,precio_venta,descripcion,imagen_url,imagen_path,destacado,categoria_principal_id,color_nombre,talla_nombre&order=nombre.asc"
    );
    if (!productos || productos.length === 0) return; // deja el contenido estático

    // Categorías para mapear id → nombre
    var cats = (await api("/categorias_productos?select=id,nombre")) || [];
    var catById = {};
    cats.forEach(function (c) { catById[c.id] = c.nombre; });

    // Ocultamos template y agregamos las tarjetas nuevas
    var siblings = Array.prototype.slice.call(container.querySelectorAll("article"));
    siblings.forEach(function (a) { a.style.display = "none"; });

    productos.forEach(function (p, idx) {
      var card = template.cloneNode(true);
      card.style.display = "";
      card.setAttribute("data-id", p.id);
      card.setAttribute("data-name", p.nombre);
      card.setAttribute("data-price", p.precio_venta);
      card.setAttribute("data-sub", p.descripcion || "");
      card.setAttribute("data-cat", (catById[p.categoria_principal_id] || "").toLowerCase());
      var img = p.imagen_url || p.imagen_path || "";
      if (img) card.setAttribute("data-img", img);

      // Actualizamos strings visibles dentro de la card si existen
      var nombreEl = card.querySelector("h3, .mm-cg-name, [data-mm-name]");
      if (nombreEl) nombreEl.textContent = p.nombre;
      var precioEl = card.querySelector(".mm-cg-price, [data-mm-price]");
      if (precioEl) precioEl.textContent = fmtGs(p.precio_venta);
      var subEl = card.querySelector(".mm-cg-sub, [data-mm-sub]");
      if (subEl && p.descripcion) subEl.textContent = p.descripcion;
      var imgEl = card.querySelector("img, image-slot");
      if (imgEl && img) imgEl.setAttribute("src", img);

      container.appendChild(card);
    });

    container.setAttribute("data-mm-count", String(productos.length));
    document.dispatchEvent(new CustomEvent("mm:catalogo-loaded", { detail: { total: productos.length } }));
  }

  // ------------------------------------------------------------------
  // 1b) Tiles de categorías del home (sección "Encuentra tu estilo")
  // Solo aparecen las categorías que tienen imagen cargada en el ERP.
  // ------------------------------------------------------------------
  async function syncCategoriasTiles() {
    var container = document.querySelector('[data-mm-sync="categorias-tiles"]');
    if (!container) return;

    var cats = await api("/categorias_productos?select=id,nombre,imagen_url&order=nombre.asc");
    if (!cats) return;
    cats = cats.filter(function (c) { return c.imagen_url; });
    if (cats.length === 0) return;

    var template = container.querySelector("a.mm-cat-card");
    if (!template) return;

    // Contar piezas por categoría (una request extra por eficiencia)
    var counts = await api("/productos?select=categoria_principal_id&activo=eq.true&visible_web=eq.true");
    var countByCat = {};
    (counts || []).forEach(function (p) {
      var k = p.categoria_principal_id;
      if (!k) return;
      countByCat[k] = (countByCat[k] || 0) + 1;
    });

    // Limpiar tiles hardcoded
    Array.prototype.slice.call(container.querySelectorAll("a.mm-cat-card")).forEach(function (c) { c.remove(); });

    // Clase de layout rotando entre 4 opciones para variar tamaños
    var layoutClasses = ["mm-cat-mujer", "mm-cat-hombre", "mm-cat-acc", "mm-cat-nueva"];

    cats.forEach(function (c, idx) {
      var card = template.cloneNode(true);
      // Reset clases de layout
      layoutClasses.forEach(function (cls) { card.classList.remove(cls); });
      card.classList.add(layoutClasses[idx % layoutClasses.length]);

      var slug = c.nombre.toLowerCase();
      card.setAttribute("href", "./Catalogo.dc.html?cat=" + encodeURIComponent(slug));
      card.setAttribute("aria-label", "Explorar " + c.nombre + " en el catálogo");

      var imgWrap = card.querySelector(".mm-cat-img");
      if (imgWrap) {
        imgWrap.innerHTML = "";
        var img = document.createElement("img");
        img.src = c.imagen_url;
        img.alt = c.nombre;
        img.loading = "lazy";
        imgWrap.appendChild(img);
      }

      var nameEl = card.querySelector(".mm-cat-name");
      if (nameEl) {
        nameEl.textContent = c.nombre;
        nameEl.style.fontStyle = "";
      }

      var metaEl = card.querySelector(".mm-cat-meta > span:first-child");
      if (metaEl) {
        var n = countByCat[c.id] || 0;
        metaEl.textContent = n === 1 ? "1 pieza" : n + " piezas";
      }

      container.appendChild(card);
    });
  }

  // ------------------------------------------------------------------
  // 2) Filtros de categoría dinámicos
  // ------------------------------------------------------------------

  async function syncFiltros() {
    var container = document.querySelector('[data-mm-sync="filtros"]');
    if (!container) return;

    var cats = await api("/categorias_productos?select=id,nombre&order=nombre.asc");
    if (!cats || cats.length === 0) return;

    var template = container.querySelector("button, a");
    if (!template) return;

    // Limpiamos hijos excepto el primero ("Todo")
    var childs = Array.prototype.slice.call(container.children);
    childs.slice(1).forEach(function (c) { c.remove(); });

    cats.forEach(function (c) {
      var btn = template.cloneNode(true);
      btn.textContent = c.nombre;
      btn.setAttribute("data-cat", c.nombre.toLowerCase());
      btn.classList.remove("active", "is-active"); // reset selection
      container.appendChild(btn);
    });
  }

  // ------------------------------------------------------------------
  // 3) Shop the look
  // ------------------------------------------------------------------

  async function syncShopTheLook() {
    var container = document.querySelector('[data-mm-sync="shop-the-look"]');
    if (!container) return;

    var looks = await api(
      "/sitio_shop_the_look?select=id,titulo,subtitulo,imagen_url,orden,sitio_shop_the_look_items(id,producto_id,orden,etiqueta,productos(id,nombre,precio_venta,imagen_url,imagen_path))&activo=eq.true&order=orden.asc"
    );
    if (!looks || looks.length === 0) return;

    var look = looks[0]; // usamos el primer look para "El look completo"
    var items = (look.sitio_shop_the_look_items || []).sort(function (a, b) { return a.orden - b.orden; });

    // Actualizar título e imagen principal si están presentes
    var tituloEl = container.querySelector("[data-mm-look-title]");
    if (tituloEl && look.titulo) tituloEl.textContent = look.titulo;
    var subEl = container.querySelector("[data-mm-look-sub]");
    if (subEl && look.subtitulo) subEl.textContent = look.subtitulo;
    var imgEl = container.querySelector("[data-mm-look-img]");
    if (imgEl && look.imagen_url) {
      if (imgEl.tagName === "IMG") imgEl.setAttribute("src", look.imagen_url);
      else imgEl.style.backgroundImage = "url(" + look.imagen_url + ")";
    }

    // Reemplazar rows con productos del look
    var rowsContainer = container.querySelector("[data-mm-look-rows]");
    if (rowsContainer) {
      var rowTemplate = rowsContainer.querySelector(".mm-look-row, [data-mm-look-row]");
      if (rowTemplate) {
        rowsContainer.innerHTML = "";
        items.forEach(function (it, idx) {
          var prod = it.productos;
          if (!prod) return;
          var row = rowTemplate.cloneNode(true);
          row.setAttribute("data-name", prod.nombre);
          row.setAttribute("data-price", prod.precio_venta);
          var nameEl = row.querySelector(".mm-look-name, [data-mm-look-name]");
          if (nameEl) nameEl.textContent = prod.nombre;
          var priceEl = row.querySelector(".mm-look-price, [data-mm-look-price]");
          if (priceEl) priceEl.textContent = fmtGs(prod.precio_venta);
          var etiquetaEl = row.querySelector(".mm-look-cat, [data-mm-look-etiqueta]");
          if (etiquetaEl && it.etiqueta) etiquetaEl.textContent = it.etiqueta;
          var indexEl = row.querySelector(".mm-look-index, [data-mm-look-index]");
          if (indexEl) indexEl.textContent = String(idx + 1).padStart(2, "0");
          rowsContainer.appendChild(row);
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 4) Instagram grid
  // ------------------------------------------------------------------

  async function syncInstagram() {
    var container = document.querySelector('[data-mm-sync="instagram"]');
    if (!container) return;

    var posts = await api(
      "/sitio_instagram_posts?select=id,imagen_url,link,orden&activo=eq.true&order=orden.asc"
    );
    if (!posts || posts.length === 0) return;

    var template = container.querySelector("[data-mm-ig-cell], .mm-ig-cell, article, a, div");
    if (!template) return;

    var cells = Array.prototype.slice.call(container.children);
    cells.forEach(function (c) { c.style.display = "none"; });

    posts.forEach(function (p) {
      var cell = template.cloneNode(true);
      cell.style.display = "";
      var imgEl = cell.querySelector("img");
      if (imgEl) {
        imgEl.setAttribute("src", p.imagen_url);
      } else {
        cell.style.backgroundImage = "url(" + p.imagen_url + ")";
        cell.style.backgroundSize = "cover";
        cell.style.backgroundPosition = "center";
      }
      if (p.link && cell.tagName === "A") {
        cell.setAttribute("href", p.link);
        cell.setAttribute("target", "_blank");
        cell.setAttribute("rel", "noreferrer noopener");
      }
      container.appendChild(cell);
    });
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  function boot() {
    // Correr en paralelo — cualquiera puede fallar sin bloquear al resto
    Promise.allSettled([syncCatalogo(), syncCategoriasTiles(), syncFiltros(), syncShopTheLook(), syncInstagram()]).then(function () {
      document.dispatchEvent(new CustomEvent("mm:sync-done"));
    });
  }

  // El sitio usa custom elements (<x-dc>, <image-slot>) procesados por support.js
  // que reescriben el DOM DESPUÉS de DOMContentLoaded. Esperamos a window.load
  // (todo cargado) + un tick extra para que los reemplazos terminen antes de
  // manipular los contenedores con data-mm-sync.
  function bootDeferred() {
    setTimeout(boot, 200);
  }
  if (document.readyState === "complete") {
    bootDeferred();
  } else {
    window.addEventListener("load", bootDeferred);
  }
})();
