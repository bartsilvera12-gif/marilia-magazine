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

  // ------------------------------------------------------------------
  // Traducción PT → ES para textos del ERP (nombres, colores, tallas)
  // ------------------------------------------------------------------
  var LANG = localStorage.getItem("mm_lang") || "es"; // "es" | "pt"

  var DICT_PT_ES = {
    // Prendas
    "CAMISETA":"CAMISETA", "CAMISA":"CAMISA", "POLO":"POLO", "BLUSA":"BLUSA",
    "BERMUDA":"BERMUDA", "SHORT":"SHORT", "CALCA":"PANTALÓN", "CALÇA":"PANTALÓN",
    "JAQUETA":"CAMPERA", "CINTO":"CINTURÓN", "MEIA":"MEDIA", "SACOLA":"BOLSA",
    "CAIXA":"CAJA", "TENIS":"ZAPATILLA", "TÊNIS":"ZAPATILLA", "NECESSAIRE":"NECESER",
    "CHAVEIRO":"LLAVERO", "PRESENTE":"REGALO", "CUECA":"BOXER",
    "GOLA":"CUELLO", "ML":"ML", "MC":"MC", "PADRE":"PADRE",
    "PIQUET":"PIQUÉ", "TRICOT":"TEJIDO", "TRICOT ML":"TEJIDO ML",
    "FLANELADA":"FRANELA", "ALF":"CLÁSICO",
    "ELAST":"ELÁSTICO", "PRIME":"PRIME", "PIMA":"PIMA", "REVIVE":"REVIVE",
    "CLASS":"CLASSIC", "MOTION":"MOTION", "PREMIUM":"PREMIUM",
    "PU":"PU", "SJ":"SJ", "REP":"REP", "CONF":"CONF", "CAPUAÇU":"CAPUAZÚ",
    "BATH":"BATH", "COTELE":"COTELÊ", "SARJA":"GABARDINA",
    "IMPULSE":"IMPULSE", "INTENSE":"INTENSE", "INVICTUS":"INVICTUS",
    "AURUM":"AURUM", "PRIME":"PRIME", "WAFFLE":"WAFFLE", "ZIPER":"CIERRE",
    "ZÍPER":"CIERRE", "AGUARDANDO FICHA":"", "PIQUET VELLUTO":"PIQUÉ VELLUTO",
    // Colores
    "PRETO":"NEGRO", "BRANCO":"BLANCO", "OFF WHITE":"BLANCO CRUDO",
    "AZUL MARINHO":"AZUL MARINO", "AZUL MEDIO":"AZUL MEDIO",
    "AZUL INDIGO":"AZUL ÍNDIGO", "AZUL INFINITY":"AZUL INFINITY",
    "CAFE":"CAFÉ", "MARROM":"MARRÓN", "MARROM WOOD":"MARRÓN MADERA",
    "MARROM COGNAC":"MARRÓN COÑAC", "CAMEL":"CAMEL", "WHISKY":"WHISKY",
    "CINZA":"GRIS", "CINZA CLARO":"GRIS CLARO", "CINZA BOSS":"GRIS BOSS",
    "CHUMBO":"PLOMO", "GRAFITE":"GRAFITO",
    "VERMELHO":"ROJO", "CABERNET":"BORDÓ", "BORDO":"BORDÓ", "TELHA":"TERRACOTA",
    "VERDE":"VERDE", "VERDE MILITAR":"VERDE MILITAR", "VERDE MUSGO":"VERDE MUSGO",
    "VERDE PISTACHE":"VERDE PISTACHO", "VERDE OLIVA":"VERDE OLIVA",
    "VERDE GALAPAGOS":"VERDE GALÁPAGOS", "VERDE EDEN":"VERDE EDÉN",
    "LARANJA":"NARANJA", "AMETISTA":"AMATISTA", "CROMO":"CROMO",
    "KAKI":"CAQUI", "CAQUI":"CAQUI", "AREIA":"ARENA", "AVEIA":"AVENA",
    "BEGE":"BEIGE", "MARFIL":"MARFIL", "INCOLOR":"INCOLORO", "UNICA":"ÚNICO",
    "BRANCA TFLW":"BLANCA TFLW",
    // Talles
    "P":"S", "M":"M", "G":"L", "GG":"XL", "XG":"XXL", "UN":"UN",
  };

  function tr(text) {
    if (LANG === "pt" || !text) return text;
    var up = String(text).toUpperCase().trim();
    if (DICT_PT_ES[up] !== undefined) return DICT_PT_ES[up] || up;
    return up.split(/(\s+|·|\-|,)/).map(function (w) {
      var wu = w.toUpperCase().trim();
      if (DICT_PT_ES[wu] !== undefined) return DICT_PT_ES[wu];
      return w;
    }).join("");
  }

  // ------------------------------------------------------------------
  // Traducción de textos hardcodeados del HTML (secciones, botones, footer).
  // Sitio está en español; si LANG=pt, reemplazamos ES → PT.
  // ------------------------------------------------------------------
  var DICT_ES_PT = {
    // Navegación / cabecera
    "Casa": "Início",
    "Catálogo": "Catálogo",
    "Buscar": "Buscar",
    "Buscar en la tienda": "Pesquisar na loja",
    "Búsquedas frecuentes": "Buscas frequentes",
    "Bolsa": "Sacola",
    "Ayuda": "Ajuda",
    "Cerrar ✕": "Fechar ✕",
    "Cerrar": "Fechar",
    // Filtros / categorías
    "Todos": "Todos",
    "Todo": "Tudo",
    "Mujer": "Mulher",
    "Hombre": "Homem",
    "Vestidos": "Vestidos",
    "Conjuntos": "Conjuntos",
    "Blusas": "Blusas",
    "Camisas": "Camisas",
    "Pantalones": "Calças",
    "Faldas": "Saias",
    "Abrigos": "Casacos",
    "Accesorios": "Acessórios",
    "Calzado": "Calçados",
    "Blusa": "Blusa",
    "Camisa": "Camisa",
    "Abrigo": "Casaco",
    "Blazer": "Blazer",
    "Falda": "Saia",
    "Pantalón": "Calça",
    "Bolso": "Bolsa",
    "Bolso Nieve": "Bolsa Nieve",
    "Bolsa ": "Sacola ",
    // Secciones
    "Colecciones": "Coleções",
    "Nueva colección": "Nova coleção",
    "Explorar la colección": "Explorar a coleção",
    "Encuentra tu": "Encontre seu",
    "estilo": "estilo",
    "Explorar": "Explorar",
    "El look": "O look",
    "completo": "completo",
    "Shop the look": "Shop the look",
    "Ver completa": "Ver completo",
    "Vista rápida": "Vista rápida",
    // Acciones
    "Añadir a la bolsa": "Adicionar à sacola",
    "Añadir el look": "Adicionar o look",
    "Añadir": "Adicionar",
    "Añadir +": "Adicionar +",
    // Footer / info
    "Envíos y entregas": "Envios e entregas",
    "Cambios y devoluciones": "Trocas e devoluções",
    "Contacto": "Contato",
    "Preguntas frecuentes": "Perguntas frequentes",
    "Cuidado de las prendas": "Cuidado das peças",
    "Guía de talles": "Guia de tamanhos",
    "Sobre nosotros": "Sobre nós",
    "Términos y condiciones": "Termos e condições",
    "Política de privacidad": "Política de privacidade",
    "Seguinos en Instagram": "Siga-nos no Instagram",
    "Tienda": "Loja",
    "Consultar": "Consultar",
    // Chips de categorías
    "Camisa · Hombre": "Camisa · Homem",
    "Blazer · Hombre": "Blazer · Homem",
    "Pantalón · Hombre": "Calça · Homem",
    "Traje · Hombre": "Terno · Homem",
    "Abrigo · Hombre": "Casaco · Homem",
    "Camisas · Hombre": "Camisas · Homem",
    "Abrigos · Hombre": "Casacos · Homem",
    "Accesorios · Hombre": "Acessórios · Homem",
    // Botones flotantes / CTAs
    "WHATSAPP": "WHATSAPP",
    "Consultar precio": "Consultar preço",
    "Añadir al carrito": "Adicionar ao carrinho",
    // Contadores
    "piezas": "peças",
    "pieza": "peça",
    "talles": "tamanhos",
    "talle": "tamanho",
    "colores": "cores",
    "color": "cor",
  };

  function translateStaticText() {
    if (LANG !== "pt") return; // sitio ya está en ES por default
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        if (p.closest("[data-mm-sync]")) return NodeFilter.FILTER_REJECT; // esos ya los traduce el loader
        if (p.id === "mm-lang-toggle") return NodeFilter.FILTER_REJECT;
        var t = node.nodeValue;
        if (!t || !t.trim() || t.length > 200) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var t = node.nodeValue;
      var trimmed = t.trim();
      if (DICT_ES_PT[trimmed]) {
        node.nodeValue = t.replace(trimmed, DICT_ES_PT[trimmed]);
        return;
      }
      // Reemplazo por palabra completa (case-sensitive con primera mayúscula)
      var newT = t;
      Object.keys(DICT_ES_PT).forEach(function (es) {
        if (es.length < 3) return;
        var re = new RegExp("\\b" + es.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
        newT = newT.replace(re, DICT_ES_PT[es]);
      });
      if (newT !== t) node.nodeValue = newT;
    });

    // Placeholders de inputs (no son text nodes)
    document.querySelectorAll("input[placeholder]").forEach(function (i) {
      var v = i.getAttribute("placeholder");
      if (DICT_ES_PT[v]) i.setAttribute("placeholder", DICT_ES_PT[v]);
    });
    // Alt de imágenes visibles
    document.querySelectorAll("img[alt], [aria-label]").forEach(function (el) {
      ["alt", "aria-label"].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && DICT_ES_PT[v]) el.setAttribute(a, DICT_ES_PT[v]);
      });
    });
    // <html lang> para SEO / lector de pantalla
    document.documentElement.setAttribute("lang", "pt");
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
      "/productos?select=id,sku,nombre,precio_venta,descripcion,imagen_url,imagen_path,destacado,categoria_principal_id,color_nombre,talla_nombre&order=nombre.asc"
    );
    if (!productos || productos.length === 0) return; // deja el contenido estático

    // Categorías para mapear id → nombre
    var cats = (await api("/categorias_productos?select=id,nombre")) || [];
    var catById = {};
    cats.forEach(function (c) { catById[c.id] = c.nombre; });

    // Mapa nombre-color → hex (comunes en el catálogo Marilia/pedido Paraguay)
    var COLOR_HEX = {
      "PRETO":"#0E0E0E", "BLACK":"#0E0E0E", "NEGRO":"#0E0E0E",
      "BRANCO":"#F5F1E8", "OFF WHITE":"#F0EADB", "BEGE":"#D8C4A0",
      "AREIA":"#D8C6A5", "AVEIA":"#E5D8B9", "MARFIL":"#EFE6D2",
      "AZUL MARINHO":"#14243E", "AZUL MEDIO":"#3D6BA6", "AZUL INDIGO":"#2F4A73",
      "AZUL INFINITY":"#1E2E5A",
      "CAFE":"#4A2E1F", "MARROM":"#3E2519", "MARROM WOOD":"#4A3428",
      "MARROM COGNAC":"#7A3E1F", "CAMEL":"#B4855A", "WHISKY":"#8A5A2E",
      "CINZA":"#6C6C6C", "CINZA CLARO":"#B4B4B4", "CINZA BOSS":"#5A5A5A",
      "CHUMBO":"#3D3D42", "GRAFITE":"#40403E",
      "VERMELHO":"#B92E2E", "CABERNET":"#5C1A26", "BORDO":"#5C1A26",
      "TELHA":"#B8593A",
      "VERDE":"#3E6B3A", "VERDE MILITAR":"#3E4B2B", "VERDE MUSGO":"#4A5A2E",
      "VERDE PISTACHE":"#B7C88A", "VERDE OLIVA":"#6B6B34", "VERDE GALAPAGOS":"#2E5E3E",
      "VERDE EDEN":"#3E7E4E",
      "LARANJA":"#D46A2E", "AMETISTA":"#8E5CA6",
      "CROMO":"#B9B9B4", "KAKI":"#8A7A4A", "CAQUI":"#8A7A4A",
      "INCOLOR":"#EFEFEF", "UNICA":"#B0B0B0", "BRANCA TFLW":"#F5F1E8",
    };
    function hexForColor(name) {
      if (!name) return "#B0B0B0";
      var up = String(name).toUpperCase().trim();
      return COLOR_HEX[up] || "#B0B0B0";
    }

    // AGRUPAR por modelo base: SKU "XXXXX.YYY-TALLA" → modelo = "XXXXX".
    // Cada modelo puede tener N variantes color+talla; UNA card por modelo,
    // pero con swatches de todos los colores. Click en swatch cambia la imagen.
    var grupos = {};
    productos.forEach(function (p) {
      var sku = String(p.sku || "");
      var baseModelo = sku.split(".")[0] || sku;
      if (!grupos[baseModelo]) {
        grupos[baseModelo] = {
          representante: p,
          coloresMap: {},   // color_nombre → { hex, imagen_url }
          talles: new Set(),
          variantes: [],
        };
      }
      var g = grupos[baseModelo];
      g.variantes.push(p);
      if (p.color_nombre) {
        var c = String(p.color_nombre).trim();
        if (!g.coloresMap[c]) {
          g.coloresMap[c] = { hex: hexForColor(c), imagen_url: p.imagen_url || null };
        } else if (!g.coloresMap[c].imagen_url && p.imagen_url) {
          g.coloresMap[c].imagen_url = p.imagen_url;
        }
      }
      if (p.talla_nombre) g.talles.add(p.talla_nombre);
      if (!g.representante.imagen_url && p.imagen_url) g.representante = p;
    });
    var modelos = Object.values(grupos);

    // Ocultamos template y agregamos las tarjetas nuevas
    var siblings = Array.prototype.slice.call(container.querySelectorAll("article"));
    siblings.forEach(function (a) { a.style.display = "none"; });

    modelos.forEach(function (grupo, idx) {
      var p = grupo.representante;
      var coloresArr = Object.keys(grupo.coloresMap);
      var tallesArr = Array.from(grupo.talles);
      var card = template.cloneNode(true);
      card.style.display = "";
      card.setAttribute("data-id", p.id);
      card.setAttribute("data-name", p.nombre);
      card.setAttribute("data-price", p.precio_venta);
      card.setAttribute("data-sub", p.descripcion || "");
      card.setAttribute("data-cat", (catById[p.categoria_principal_id] || "").toLowerCase());
      var img = p.imagen_url || p.imagen_path || "";
      if (img) card.setAttribute("data-img", img);

      // Nombre (traducido si LANG=es)
      var nombreEl = card.querySelector("h3, .mm-cg-name, [data-mm-name]");
      if (nombreEl) nombreEl.textContent = tr(p.nombre);

      // Precio (0 → "Consultar")
      var precioEl = card.querySelector(".mm-cg-price, [data-mm-price]");
      if (precioEl) precioEl.textContent = (Number(p.precio_venta) > 0) ? fmtGs(p.precio_venta) : "Consultar";

      // Sub: descripción del ERP, o resumen de variantes disponibles
      var subEl = card.querySelector(".mm-cg-sub, [data-mm-sub]");
      if (subEl) {
        var variantesTxt = "";
        if (coloresArr.length > 0 || tallesArr.length > 0) {
          var pieces = [];
          if (coloresArr.length === 1) pieces.push(tr(coloresArr[0]));
          else if (coloresArr.length > 1) pieces.push(coloresArr.length + (LANG === "pt" ? " cores" : " colores"));
          if (tallesArr.length === 1) pieces.push((LANG === "pt" ? "tamanho " : "talle ") + tr(tallesArr[0]));
          else if (tallesArr.length > 1) pieces.push(tallesArr.length + (LANG === "pt" ? " tamanhos" : " talles"));
          variantesTxt = pieces.join(" · ");
        }
        subEl.textContent = (p.descripcion && p.descripcion.trim()) ? tr(p.descripcion) : (variantesTxt || "");
      }

      // Data attributes con listado de variantes para popover/detalle
      card.setAttribute("data-colores", coloresArr.join(","));
      card.setAttribute("data-talles", tallesArr.join(","));
      card.setAttribute("data-variantes", grupo.variantes.length);

      // Categoría (chip superior)
      var catEl = card.querySelector(".mm-cg-cat, [data-mm-cat]");
      if (catEl) {
        var catName = catById[p.categoria_principal_id] || "";
        catEl.textContent = tr(catName);
      }

      // Imagen principal
      var imgEl = card.querySelector("img");
      if (imgEl && img) { imgEl.setAttribute("src", img); imgEl.setAttribute("alt", p.nombre); }
      var slotEl = card.querySelector("image-slot");
      if (slotEl && img) slotEl.setAttribute("src", img);

      // Quitar los <div data-alt> con segunda imagen hardcoded (no aplican al producto real)
      var altLayer = card.querySelector("[data-alt]");
      if (altLayer && altLayer.parentElement) altLayer.parentElement.removeChild(altLayer);

      // Swatches: uno por color, click cambia la imagen principal
      var swatchesEl = card.querySelector(".mm-cg-swatches, [data-mm-swatches]");
      if (swatchesEl) {
        swatchesEl.innerHTML = "";
        coloresArr.forEach(function (colorName, i) {
          var info = grupo.coloresMap[colorName];
          var sw = document.createElement("span");
          sw.className = "mm-cg-sw";
          sw.style.background = info.hex;
          sw.style.cursor = "pointer";
          sw.setAttribute("title", colorName);
          sw.setAttribute("data-color", colorName);
          if (info.imagen_url) sw.setAttribute("data-img", info.imagen_url);
          if (i === 0) sw.style.outline = "1.5px solid #C8962A";
          sw.addEventListener("click", function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            var newImg = sw.getAttribute("data-img");
            if (!newImg) return;
            var mainImg = card.querySelector("img");
            if (mainImg) mainImg.setAttribute("src", newImg);
            var mainSlot = card.querySelector("image-slot");
            if (mainSlot) mainSlot.setAttribute("src", newImg);
            // Reset outlines
            Array.prototype.forEach.call(swatchesEl.children, function (c) { c.style.outline = ""; });
            sw.style.outline = "1.5px solid #C8962A";
            // Actualizar sub con color actual
            if (subEl) subEl.textContent = colorName + (tallesArr.length > 1 ? " · " + tallesArr.length + " talles" : (tallesArr[0] ? " · talle " + tallesArr[0] : ""));
          });
          swatchesEl.appendChild(sw);
        });
      }

      container.appendChild(card);
    });

    container.setAttribute("data-mm-count", String(modelos.length));
    document.dispatchEvent(new CustomEvent("mm:catalogo-loaded", { detail: { total: modelos.length, variantes: productos.length } }));
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
      var display = c.nombre;
      if (LANG === "pt") {
        // Traducir "Mujer Vestidos" → "Mulher Vestidos", "Hombre Camisas" → "Homem Camisas", etc.
        display = display.split(/\s+/).map(function (w) {
          return DICT_ES_PT[w] || w;
        }).join(" ");
      }
      btn.textContent = display;
      btn.setAttribute("data-cat", c.nombre.toLowerCase());
      btn.classList.remove("active", "is-active");
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

  // ------------------------------------------------------------------
  // Botón flotante PT / ES (esquina superior derecha)
  // ------------------------------------------------------------------
  function injectLangToggle() {
    if (document.getElementById("mm-lang-toggle")) return;
    var btn = document.createElement("button");
    btn.id = "mm-lang-toggle";
    btn.type = "button";
    btn.textContent = LANG === "pt" ? "ES" : "PT";
    btn.title = LANG === "pt" ? "Ver en español" : "Ver em português";
    btn.style.cssText = [
      "position:fixed", "top:16px", "right:16px", "z-index:9999",
      "background:#1E1B16", "color:#F7F3E6", "border:1px solid #C8962A",
      "padding:9px 14px", "font:600 11px/1 'Montserrat',sans-serif",
      "letter-spacing:.24em", "text-transform:uppercase", "cursor:pointer",
      "border-radius:2px", "box-shadow:0 4px 12px rgba(0,0,0,.18)",
    ].join(";");
    btn.addEventListener("click", function () {
      LANG = (LANG === "pt") ? "es" : "pt";
      localStorage.setItem("mm_lang", LANG);
      location.reload();
    });
    document.body.appendChild(btn);
  }

  function boot() {
    injectLangToggle();
    translateStaticText();
    // Correr en paralelo — cualquiera puede fallar sin bloquear al resto
    Promise.allSettled([syncCatalogo(), syncCategoriasTiles(), syncFiltros(), syncShopTheLook(), syncInstagram()]).then(function () {
      // Re-traducir por si el loader inyectó texto en español (ej "Consultar")
      translateStaticText();
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
