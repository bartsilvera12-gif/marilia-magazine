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
    // Categorías del catálogo TFLOW (vienen en portugués desde el proveedor)
    "SAIA":"FALDA", "SAIAS":"FALDAS", "CASACO":"ABRIGO", "CASACOS":"ABRIGOS",
    "CALÇAS":"PANTALONES", "CALCAS":"PANTALONES", "VESTIDO":"VESTIDO",
    "ACESSÓRIOS":"ACCESORIOS", "ACESSORIOS":"ACCESORIOS",
    "MULHER":"MUJER", "HOMEM":"HOMBRE", "TUDO":"TODO",
    "BONE":"GORRA", "BONÉ":"GORRA", "OCULOS":"LENTES", "ÓCULOS":"LENTES",
    "PULSEIRA":"PULSERA", "COLAR":"COLLAR", "CORRENTE":"CADENA",
    "BRACELETE":"BRAZALETE", "CHINELO":"OJOTA", "MALA":"VALIJA",
    "CARTEIRA":"BILLETERA", "MOLETOM":"BUZO", "SUETER":"SUÉTER",
    "COLETE":"CHALECO", "SUNGA":"MALLA", "MALHA":"TEJIDO",
    "COPO":"VASO", "CANECA":"TAZA", "GARRAFA TERMICA":"TERMO",
    "ESSENCIA":"ESENCIA", "BALA":"CARAMELO", "CERVEJA":"CERVEZA",
    "SAPATO":"ZAPATO", "SAPATENIS":"ZAPATILLA", "CHAPEU":"SOMBRERO",
    "MASCARA":"MÁSCARA", "ADESIVO":"ADHESIVO", "CARTAO":"TARJETA",
    "CABIDE":"PERCHA", "FITA":"CINTA", "EXPOSITOR":"EXHIBIDOR",
    "IMPRESSOS":"IMPRESOS", "DIVERSOS":"VARIOS", "PECAS BAZAR":"BAZAR",
    "PORTA TRECO":"ORGANIZADOR", "CAPA DE CHUVA":"PILOTO",
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
    "Catálogo completo": "Catálogo completo",
    "Buscar": "Buscar",
    "Buscar en la tienda": "Buscar na loja",
    "Búsquedas frecuentes": "Buscas frequentes",
    "Bolsa": "Sacola",
    "Ayuda": "Ajuda",
    "Cerrar ✕": "Fechar ✕",
    "Cerrar": "Fechar",
    "Categorías": "Categorias",
    "Cerrar bolsa": "Fechar sacola",
    "Cerrar búsqueda": "Fechar busca",
    "Nueva colección": "Nova coleção",
    "Ver todo": "Ver tudo",
    // Home sections
    "Explorar la colección": "Explorar a coleção",
    "Encuentra tu": "Encontre seu",
    "Explorar": "Explorar",
    "El look": "O look",
    "completo": "completo",
    "Nos escriben": "Nos escrevem",
    "Atelier Marilia": "Atelier Marilia",
    "Casa de moda": "Casa de moda",
    "Artesanas": "Artesãs",
    "Piezas seleccionadas": "Peças selecionadas",
    "Descubrí": "Descubra",
    "Elegí": "Escolha",
    "Elegí tu": "Escolha seu",
    "Sumate": "Junte-se",
    "Reservá tu": "Reserve seu",
    "Reserva": "Reserva",
    "Ver más": "Ver mais",
    "Ver menos": "Ver menos",
    "Ver la ficha": "Ver a ficha",
    "Ficha del producto": "Ficha do produto",
    "Volver": "Voltar",
    "Anterior": "Anterior",
    "Siguiente": "Próximo",
    "Guardar": "Salvar",
    "Continuar": "Continuar",
    "Editar": "Editar",
    "Eliminar": "Excluir",
    "Quitar": "Remover",
    "Vaciar": "Esvaziar",
    "Confirmar": "Confirmar",
    "Cancelar": "Cancelar",
    "Aviso": "Aviso",
    "Acceso:": "Acesso:",
    "Autoridades competentes": "Autoridades competentes",
    "Cambios en esta política": "Alterações nesta política",
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
    "Vista rápida": "Visualização rápida",
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
        // Misma protección que en translatePageDeep: si la traducción ya
        // está presente, no reaplicar (evita acumular letras al final).
        if (DICT_ES_PT[es] !== es && newT.indexOf(DICT_ES_PT[es]) > -1) return;
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

  // Mapa nombre-color → hex (comunes en el catálogo Marilia/pedido Paraguay).
  // A nivel de módulo porque lo usan tanto las tarjetas del catálogo como la
  // ficha de producto.
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
  /**
   * Imagen de reemplazo para productos sin foto.
   *
   * Sin esto la tarjeta se queda con la foto del molde de la maqueta, así que
   * un AROMATIZADOR aparecía ilustrado con un señor de camisa azul. Devuelve un
   * SVG en data URI (no pega a la red) con la paleta del sitio y el nombre de
   * la categoría, para que se lea claramente como "todavía sin foto".
   */
  function placeholderImg(etiqueta) {
    var txt = String(etiqueta || "").toUpperCase().slice(0, 22);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">' +
      '<rect width="600" height="800" fill="#EFE9DC"/>' +
      '<circle cx="300" cy="330" r="86" fill="none" stroke="#C8AE86" stroke-width="2"/>' +
      '<path d="M262 356l30-32 24 26 18-18 26 28v20H262z" fill="#C8AE86" opacity=".55"/>' +
      '<circle cx="330" cy="300" r="12" fill="#C8AE86" opacity=".55"/>' +
      '<text x="300" y="470" text-anchor="middle" fill="#8A7F6A" ' +
      'font-family="Montserrat,Helvetica,Arial,sans-serif" font-size="22" letter-spacing="4">' +
      txt.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
      "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function hexForColor(name) {
    if (!name) return "#B0B0B0";
    var up = String(name).toUpperCase().trim();
    return COLOR_HEX[up] || "#B0B0B0";
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

  /**
   * Igual que `api` pero devuelve el total de filas que matchean, leyendo el
   * header Content-Range. Sirve para el contador sin traerse el catálogo.
   */
  async function apiCount(path) {
    try {
      var h = Object.assign({}, HEADERS, { Prefer: "count=exact", Range: "0-0" });
      var r = await fetch(REST + path, { headers: h, credentials: "omit" });
      var cr = r.headers.get("content-range");
      if (!cr) return null;
      var total = parseInt(String(cr).split("/")[1], 10);
      return Number.isFinite(total) ? total : null;
    } catch (e) {
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

    var templateVivo = container.querySelector("article");
    if (!templateVivo) return;
    // Copia desprendida del DOM: las cards de la maqueta se eliminan más abajo
    // y necesitamos conservar el molde para clonar.
    var template = templateVivo.cloneNode(true);

    // Los 26 articles fallback del HTML ya arrancan con data-hidden (CSS: display:none)
    // asi que no hay flash del catalogo viejo al navegar sin cache. Solo reservamos
    // altura para que no salte el layout mientras llega la respuesta del ERP.
    container.style.minHeight = Math.max(container.offsetHeight, 800) + "px";

    // El catalogo tiene ~6.300 modelos en 24.000 variantes y PostgREST corta
    // en 1.000 filas, asi que no se puede traer todo y agrupar en el browser.
    // Se pagina contra la vista `sitio_modelos` (una fila por modelo) y recien
    // ahi se piden las variantes de los modelos visibles, para los swatches.
    var PAGINA = 24;
    // `catIds` es una lista: un chip de familia filtra por todas sus categorías.
    var estado = { q: "", catIds: [], offset: 0, total: 0, cargando: false, fin: false };

    /** Fragmento de filtro por categoría, sirva para una o para muchas. */
    function filtroCategorias() {
      if (!estado.catIds.length) return "";
      if (estado.catIds.length === 1) {
        return "&categoria_principal_id=eq." + encodeURIComponent(estado.catIds[0]);
      }
      var lista = estado.catIds.map(function (id) { return '"' + id + '"'; }).join(",");
      return "&categoria_principal_id=in.(" + encodeURIComponent(lista) + ")";
    }

    var cats = (await api("/categorias_productos?select=id,nombre")) || [];
    var catById = {};
    cats.forEach(function (c) { catById[c.id] = c.nombre; });

    // Las cards de la maqueta se ocultan, NO se borran: si el ERP no responde
    // tienen que poder volver a mostrarse como respaldo (antes el catálogo
    // quedaba vacío para siempre). El contador del diseño no las suma porque
    // Catalogo.dc.html las excluye por `data-fallback` mientras haya datos
    // reales; el `data-hidden` de acá es solo el estado inicial.
    Array.prototype.slice.call(container.querySelectorAll("article"))
      .forEach(function (a) { a.setAttribute("data-hidden", ""); });

    /** Trae las variantes de los modelos de la página y arma sus swatches. */
    async function armarGrupos(modelosPagina) {
      var codigos = modelosPagina.map(function (m) { return m.codigo_proveedor; }).filter(Boolean);
      if (codigos.length === 0) return [];
      var lista = codigos.map(function (c) { return '"' + String(c).replace(/"/g, '') + '"'; }).join(",");
      var variantes = (await api(
        "/productos?codigo_proveedor=in.(" + encodeURIComponent(lista) + ")" +
        "&select=id,codigo_proveedor,nombre,precio_venta,imagen_url,color_nombre,talla_nombre" +
        "&activo=eq.true&limit=1000"
      )) || [];

      var porCodigo = {};
      variantes.forEach(function (v) {
        var k = String(v.codigo_proveedor);
        if (!porCodigo[k]) porCodigo[k] = [];
        porCodigo[k].push(v);
      });

      return modelosPagina.map(function (m) {
        var vs = porCodigo[String(m.codigo_proveedor)] || [];
        // El representante viene de la vista: ya es la variante con foto.
        var rep = {
          id: m.id,
          nombre: m.nombre_modelo || m.nombre,
          precio_venta: m.precio_venta,
          imagen_url: m.imagen_url,
          categoria_principal_id: m.categoria_principal_id,
          descripcion: "",
        };
        var coloresMap = {}, talles = new Set();
        vs.forEach(function (v) {
          if (v.color_nombre) {
            var c = String(v.color_nombre).trim();
            if (!coloresMap[c]) coloresMap[c] = { hex: hexForColor(c), imagen_url: v.imagen_url || null };
            else if (!coloresMap[c].imagen_url && v.imagen_url) coloresMap[c].imagen_url = v.imagen_url;
          }
          if (v.talla_nombre) talles.add(v.talla_nombre);
        });
        return { representante: rep, coloresMap: coloresMap, talles: talles, variantes: vs };
      });
    }

    function renderModelos(modelos) {
    modelos.forEach(function (grupo, idx) {
      var p = grupo.representante;
      var coloresArr = Object.keys(grupo.coloresMap);
      var tallesArr = Array.from(grupo.talles);
      var card = template.cloneNode(true);
      card.style.display = "";
      card.style.visibility = "visible";  // resetear el hide inicial que se propaga del template
      card.removeAttribute("data-hidden");
      // El template clonado es una de las 26 tarjetas de respaldo del HTML y
      // arrastra su `data-fallback`. Sin sacarlo, el catálogo las trataría
      // como respaldo y las escondería hasta que termine el sync… que es
      // justo este código.
      card.removeAttribute("data-fallback");
      // El diseño arranca las cards con `data-pending` (opacity:0) y las revela
      // con un IntersectionObserver que solo mira las del HTML original. Las
      // nuestras se agregan después: si se lo dejamos puesto, nunca se ven.
      card.removeAttribute("data-pending");
      card.style.opacity = "1";
      card.style.transform = "none";
      card.setAttribute("data-mm", "");   // marca para poder limpiar al filtrar
      card.setAttribute("data-id", p.id);
      card.setAttribute("data-name", p.nombre);
      card.setAttribute("data-price", p.precio_venta);
      card.setAttribute("data-sub", p.descripcion || "");
      card.setAttribute("data-cat", (catById[p.categoria_principal_id] || "").toLowerCase());
      // Sin foto propia va el placeholder: nunca la del molde de la maqueta.
      var img = p.imagen_url || p.imagen_path ||
        placeholderImg(catById[p.categoria_principal_id] || "Sin foto");
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

      // La tarjeta sale de clonar el template estatico, que trae data-colors y
      // data-sizes hardcodeados (los de "Camisa Sauce"). Si no los pisamos, la
      // vista rapida muestra azul/crema/negro para cualquier producto real.
      // Con variantes: hex y talles del ERP. Sin variantes: se quitan.
      if (coloresArr.length) {
        card.setAttribute("data-colors", coloresArr.map(function (c) { return grupo.coloresMap[c].hex; }).join(","));
        card.setAttribute("data-colornames", coloresArr.join(","));
        // name → imagen propia del color, para que el swatch cambie la foto
        var imgsByColor = {};
        coloresArr.forEach(function (c) {
          if (grupo.coloresMap[c].imagen_url) imgsByColor[c] = grupo.coloresMap[c].imagen_url;
        });
        card.setAttribute("data-colorimgs", JSON.stringify(imgsByColor));
      } else {
        card.removeAttribute("data-colors");
        card.removeAttribute("data-colornames");
        card.removeAttribute("data-colorimgs");
      }
      if (tallesArr.length) card.setAttribute("data-sizes", tallesArr.join(","));
      else card.removeAttribute("data-sizes");

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
    }

    /** Actualiza el contador "N piezas" del encabezado de la grilla. */
    function pintarContador(n) {
      var cnt = document.querySelector("#coleccion-grid [data-count]");
      if (!cnt) return;
      if (n === 0) cnt.textContent = LANG === "pt" ? "Sem peças" : "Sin piezas";
      else if (n === 1) cnt.textContent = LANG === "pt" ? "1 peça" : "1 pieza";
      else cnt.textContent = n.toLocaleString("es-PY") + (LANG === "pt" ? " peças" : " piezas");
    }

    /** Carga una página de modelos. `reset` limpia la grilla y vuelve al inicio. */
    async function cargarPagina(reset) {
      if (estado.cargando) return;
      estado.cargando = true;
      if (reset) {
        estado.offset = 0;
        estado.fin = false;
        Array.prototype.slice.call(container.querySelectorAll("article[data-mm]"))
          .forEach(function (a) { a.remove(); });
      }

      var filtros = filtroCategorias();
      if (estado.q) filtros += "&nombre_modelo=ilike." + encodeURIComponent("*" + estado.q + "*");

      var url = "/sitio_modelos?select=id,codigo_proveedor,nombre_modelo,precio_venta,imagen_url,categoria_principal_id" +
        filtros + "&order=nombre_modelo.asc&limit=" + PAGINA + "&offset=" + estado.offset;

      var modelosPagina = await api(url);
      if (!modelosPagina) { estado.cargando = false; return; }
      if (modelosPagina.length < PAGINA) estado.fin = true;
      estado.offset += modelosPagina.length;

      var grupos = await armarGrupos(modelosPagina);
      renderModelos(grupos);

      if (vacioEl) vacioEl.style.display = (estado.offset === 0) ? "" : "none";
      if (masBtn) masBtn.style.display = estado.fin ? "none" : "";
      container.style.minHeight = "";
      estado.cargando = false;

      // Contador: total real del filtro actual, no lo que se lleva cargado.
      if (reset) {
        var total = await apiCount(
          "/sitio_modelos?select=id" +
          filtroCategorias() +
          (estado.q ? "&nombre_modelo=ilike." + encodeURIComponent("*" + estado.q + "*") : "")
        );
        if (total != null) {
          estado.total = total;
          pintarContador(total);
          // El script del diseño recuenta las cards del DOM y pisa el valor;
          // se vuelve a escribir después de que corra.
          setTimeout(function () { pintarContador(total); }, 400);
        }
      }
      document.dispatchEvent(new CustomEvent("mm:catalogo-loaded", { detail: { total: estado.total } }));
    }

    // ── Buscador + botón "ver más", inyectados debajo de la grilla ──────────
    var barra = document.createElement("div");
    barra.className = "mm-cg-tools";
    barra.style.cssText = "display:flex;gap:.5rem;align-items:center;justify-content:center;margin:0 0 1.5rem;flex-wrap:wrap;";
    var buscador = document.createElement("input");
    buscador.type = "search";
    buscador.placeholder = LANG === "pt" ? "Buscar peça…" : "Buscar prenda…";
    buscador.style.cssText = "flex:0 1 320px;padding:.6rem .9rem;border:1px solid #D8CBB0;border-radius:999px;font:inherit;font-size:.9rem;background:#fff;color:#1E1B16;outline:none;";
    barra.appendChild(buscador);
    if (container.parentNode) container.parentNode.insertBefore(barra, container);

    var vacioEl = document.createElement("p");
    vacioEl.style.cssText = "display:none;text-align:center;color:#8A7F6A;padding:3rem 1rem;font-size:.95rem;";
    vacioEl.textContent = LANG === "pt" ? "Nenhuma peça encontrada." : "No encontramos prendas con ese filtro.";
    if (container.parentNode) container.parentNode.insertBefore(vacioEl, container.nextSibling);

    var masBtn = document.createElement("button");
    masBtn.type = "button";
    masBtn.textContent = LANG === "pt" ? "Ver mais" : "Ver más";
    masBtn.style.cssText = "display:block;margin:2rem auto 0;padding:.75rem 2.5rem;border:1px solid #1E1B16;background:transparent;color:#1E1B16;border-radius:999px;font:inherit;font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;";
    masBtn.addEventListener("click", function () { cargarPagina(false); });
    if (container.parentNode) container.parentNode.insertBefore(masBtn, vacioEl.nextSibling);

    var debounce = null;
    buscador.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        estado.q = buscador.value.trim();
        cargarPagina(true);
      }, 350);
    });

    // Lo exponemos para que los filtros de categoría lo manejen server-side.
    // Acepta un id suelto o una lista (un chip de familia manda varias).
    window.MM_CATALOGO = {
      filtrarPorCategoria: function (cat) {
        if (!cat) estado.catIds = [];
        else if (Array.isArray(cat)) estado.catIds = cat.filter(Boolean);
        else estado.catIds = [cat];
        cargarPagina(true);
      },
    };

    await cargarPagina(true);
  }

  // ------------------------------------------------------------------
  // 1c) Carrusel "Explorar la colección" del home
  //
  // Muestra los productos marcados como DESTACADOS en el ERP (Inventario →
  // check "Destacado en la web"). Se agrupan por modelo igual que el catalogo
  // para no repetir una card por cada color/talle.
  //
  // Sin destacados cargados quedan las cards de la maqueta: nunca se ve vacio.
  // ------------------------------------------------------------------
  async function syncExplorar() {
    var container = document.querySelector('[data-mm-sync="explorar"]');
    if (!container) return;

    var productos = await api(
      "/productos?select=id,sku,codigo_proveedor,nombre,precio_venta,imagen_url,categoria_principal_id,color_nombre,talla_nombre" +
      "&destacado=eq.true&activo=eq.true&visible_web=eq.true&order=nombre.asc"
    );
    if (!productos || productos.length === 0) return;

    var cats = (await api("/categorias_productos?select=id,nombre")) || [];
    var catById = {};
    cats.forEach(function (c) { catById[c.id] = c.nombre; });

    // Una card por modelo: las variantes comparten el codigo_proveedor.
    var grupos = {};
    productos.forEach(function (p) {
      var base = String(p.codigo_proveedor || p.sku || p.id);
      if (!grupos[base]) grupos[base] = { rep: p, colores: {}, talles: {} };
      var g = grupos[base];
      if (p.color_nombre) {
        var c = String(p.color_nombre).trim();
        if (!g.colores[c]) g.colores[c] = { hex: hexForColor(c), imagen_url: p.imagen_url || null };
        else if (!g.colores[c].imagen_url && p.imagen_url) g.colores[c].imagen_url = p.imagen_url;
      }
      if (p.talla_nombre) g.talles[p.talla_nombre] = true;
      if (!g.rep.imagen_url && p.imagen_url) g.rep = p;
    });
    var modelos = Object.keys(grupos).map(function (k) { return grupos[k]; });

    // Las cards de la maqueta son los MOLDES, no una sola: cada una trae su
    // propio ancho, alto y desfase vertical en el style inline (y una es la
    // grande con data-featured). Clonar siempre la primera aplanaba todo a un
    // mismo rectangulo y se perdia el ritmo del diseño, asi que rotamos.
    var viejas = Array.prototype.slice.call(container.querySelectorAll("article.mm-ex-card"));
    if (viejas.length === 0) return;
    var moldes = viejas.map(function (a) { return a.cloneNode(true); });
    viejas.forEach(function (a) { a.parentNode.removeChild(a); });

    modelos.forEach(function (g, idx) {
      var p = g.rep;
      var coloresArr = Object.keys(g.colores);
      var tallesArr = Object.keys(g.talles);
      var img = p.imagen_url || placeholderImg(catById[p.categoria_principal_id] || "Sin foto");
      var card = moldes[idx % moldes.length].cloneNode(true);
      // Mismo motivo que en el catálogo: el observer del diseño no ve las
      // cards que agregamos, así que se quedarían en opacity:0.
      card.removeAttribute("data-pending");
      card.style.opacity = "1";
      card.style.transform = "none";

      card.setAttribute("data-id", p.id);
      card.setAttribute("data-pid", p.id);
      card.setAttribute("data-name", p.nombre);
      card.setAttribute("data-price", p.precio_venta);
      card.setAttribute("data-cat", (catById[p.categoria_principal_id] || "").toLowerCase());
      if (img) card.setAttribute("data-img", img);

      var nombreEl = card.querySelector("h3");
      if (nombreEl) nombreEl.textContent = tr(p.nombre);

      var precioEl = card.querySelector(".mm-ex-price");
      if (precioEl) precioEl.textContent = Number(p.precio_venta) > 0 ? fmtGs(p.precio_venta) : tr("Consultar");

      // El renglon de categoria es el div que va entre el h3 y el precio.
      var meta = card.querySelector(".mm-ex-meta");
      if (meta) {
        var catEl = meta.querySelector("div:not(.mm-ex-price)");
        if (catEl && catEl.querySelector(".mm-sw") === null) {
          catEl.textContent = tr(catById[p.categoria_principal_id] || "");
        }
      }

      // Imagen: el molde usa <image-slot id="...">; el id tiene que ser unico
      // por card o el runtime del sitio pisa la misma imagen en todas.
      var slots = card.querySelectorAll("image-slot");
      Array.prototype.forEach.call(slots, function (s, i) {
        s.setAttribute("id", "mm-ex-erp-" + idx + "-" + i);
        if (img) s.setAttribute("src", img);
        s.removeAttribute("data-src2");
        s.setAttribute("placeholder", p.nombre);
      });
      var imgTag = card.querySelector("img");
      if (imgTag && img) { imgTag.setAttribute("src", img); imgTag.setAttribute("alt", p.nombre); }

      // La segunda toma del diseño no aplica a un producto real.
      var altLayer = card.querySelector("[data-alt]");
      if (altLayer && altLayer.parentElement) altLayer.parentElement.removeChild(altLayer);

      // Swatches reales del ERP (o ninguno si el producto no tiene colores).
      var swWrap = card.querySelector(".mm-sw") ? card.querySelector(".mm-sw").parentElement : null;
      if (swWrap) {
        swWrap.innerHTML = "";
        coloresArr.forEach(function (nombreColor) {
          var info = g.colores[nombreColor];
          var sw = document.createElement("span");
          sw.className = "mm-sw";
          sw.style.background = info.hex;
          sw.setAttribute("title", nombreColor);
          swWrap.appendChild(sw);
        });
      }

      card.setAttribute("data-colores", coloresArr.join(","));
      card.setAttribute("data-talles", tallesArr.join(","));
      if (coloresArr.length) {
        card.setAttribute("data-colors", coloresArr.map(function (c) { return g.colores[c].hex; }).join(","));
        card.setAttribute("data-colornames", coloresArr.join(","));
      } else {
        card.removeAttribute("data-colors");
        card.removeAttribute("data-colornames");
      }
      if (tallesArr.length) card.setAttribute("data-sizes", tallesArr.join(","));
      else card.removeAttribute("data-sizes");

      container.appendChild(card);
    });

    // Los filtros de la seccion son fijos en el HTML: apagamos los que no
    // tienen ninguna card, en vez de dejar que muestren un carrusel vacio.
    var presentes = {};
    Array.prototype.forEach.call(container.querySelectorAll("article.mm-ex-card"), function (c) {
      (c.getAttribute("data-cat") || "").split(/\s+/).forEach(function (t) { if (t) presentes[t] = true; });
    });
    var filtros = document.querySelectorAll("#explorar .mm-filter");
    Array.prototype.forEach.call(filtros, function (b) {
      var f = (b.getAttribute("data-filter") || "").toLowerCase();
      if (f === "todo") return;
      if (presentes[f]) b.removeAttribute("data-empty-cat");
      else b.setAttribute("data-empty-cat", "");
    });

    container.setAttribute("data-mm-count", String(modelos.length));
  }

  // ------------------------------------------------------------------
  // 1b) Tiles de categorías del home (sección "Encuentra tu estilo")
  //
  // Se arman con las categorías marcadas "Mostrar en el home" en el ERP
  // (Inventario → Categorías → Editar), ordenadas por `orden_home`. Una
  // categoría sin foto se saltea porque el tile queda vacío.
  //
  // Si el ERP todavía no tiene ninguna marcada — o la base es vieja y no
  // tiene las columnas — se dejan los tiles hardcodeados del HTML.
  // ------------------------------------------------------------------
  async function syncCategoriasTiles() {
    var container = document.querySelector('[data-mm-sync="categorias-tiles"]');
    if (!container) return;

    var cats = await api(
      "/categorias_productos" +
      "?select=id,nombre,imagen_url,subtitulo_home,link_home" +
      "&mostrar_home=eq.true&order=orden_home.asc,nombre.asc"
    );
    if (!cats) return;
    cats = cats.filter(function (c) { return c.imagen_url; });
    if (cats.length === 0) return;

    var template = container.querySelector("a.mm-cat-card");
    if (!template) return;

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
      var href = (c.link_home || "").trim() ||
        "./Catalogo.dc.html?cat=" + encodeURIComponent(slug);
      card.setAttribute("href", href);
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

      // Meta: nunca conteo de piezas. Solo el subtítulo del ERP si lo hay,
      // siempre antes del "Explorar".
      var metaEl = card.querySelector(".mm-cat-meta");
      if (metaEl) {
        Array.prototype.slice
          .call(metaEl.querySelectorAll(":scope > span:not(.mm-cat-arrow)"))
          .forEach(function (s) { s.remove(); });
        var sub = (c.subtitulo_home || "").trim();
        if (sub) {
          var subEl = document.createElement("span");
          subEl.textContent = sub;
          metaEl.insertBefore(subEl, metaEl.firstChild);
        }
      }

      container.appendChild(card);
    });
  }

  // ------------------------------------------------------------------
  // 2) Filtros de categoría dinámicos
  // ------------------------------------------------------------------

  /**
   * Agrupamiento de las categorías del proveedor en familias.
   *
   * El catálogo trae 64 categorías sueltas (CAMISETA, CHINELO, PULSEIRA…) que
   * como chips ocupaban seis filas. Acá se juntan en cinco familias para que el
   * filtro entre en una línea; al elegir una se abren sus subcategorías.
   *
   * Los nombres son los del proveedor (portugués). Una categoría que no figure
   * en ninguna familia cae automáticamente en "Otros".
   */
  var FAMILIAS = [
    {
      clave: "ropa",
      nombre: "Ropa", nombrePt: "Roupa",
      categorias: ["CAMISETA", "CAMISA", "POLO", "BLUSA", "TOP", "BODY", "MALHA",
        "SHORTS", "BERMUDA", "CALÇA", "CALÇA JEANS", "SAIA", "VESTIDO",
        "JAQUETA", "CASACO", "BLAZER", "COLETE", "SUETER", "MOLETOM",
        "CONJUNTO", "PILOTOS", "CAPA DE CHUVA", "CUECA", "SUNGA", "MEIA"],
    },
    {
      clave: "calzado",
      nombre: "Calzado", nombrePt: "Calçados",
      categorias: ["TENIS", "CHINELO", "SAPATO", "SAPATENIS", "MULE"],
    },
    {
      clave: "accesorios",
      nombre: "Accesorios", nombrePt: "Acessórios",
      categorias: ["BONE", "OCULOS", "CINTO", "CARTEIRA", "GORRO", "CHAPEU",
        "MASCARA", "CHAVEIRO"],
    },
    {
      clave: "bolsos",
      nombre: "Bolsos", nombrePt: "Bolsas",
      categorias: ["MOCHILA", "MALA", "SACOLA", "PORTA TRECO"],
    },
    {
      clave: "bijou",
      nombre: "Bijou", nombrePt: "Bijuteria",
      categorias: ["PULSEIRA", "COLAR", "BRACELETE", "CORRENTE"],
    },
  ];

  async function syncFiltros() {
    var container = document.querySelector('[data-mm-sync="filtros"]');
    if (!container) return;

    // Ordenadas por cantidad de modelos: con 64 categorías, el orden
    // alfabético dejaba CAMISETA (1.858 modelos) al mismo nivel que CERVEJA (2).
    var cats = await api("/sitio_categorias?select=id,nombre,modelos&order=modelos.desc");
    if (!cats || cats.length === 0) {
      cats = await api("/categorias_productos?select=id,nombre&order=nombre.asc");
    }
    if (!cats || cats.length === 0) return;

    var template = container.querySelector("button, a");
    if (!template) return;

    // Índice nombre → categoría, para resolver cada familia a sus ids.
    var porNombre = {};
    cats.forEach(function (c) { porNombre[String(c.nombre).toUpperCase()] = c; });

    var familias = FAMILIAS.map(function (f) {
      var miembros = f.categorias.map(function (n) { return porNombre[n]; }).filter(Boolean);
      return { nombre: f.nombre, nombrePt: f.nombrePt, miembros: miembros };
    }).filter(function (f) { return f.miembros.length > 0; });

    // Las que no entraron en ninguna familia van a "Otros": así una categoría
    // nueva del proveedor aparece igual en vez de desaparecer del filtro.
    var asignadas = {};
    familias.forEach(function (f) { f.miembros.forEach(function (c) { asignadas[c.id] = true; }); });
    var sueltas = cats.filter(function (c) { return !asignadas[c.id]; });
    if (sueltas.length) familias.push({ clave: "otros", nombre: "Otros", nombrePt: "Outros", miembros: sueltas });

    // Dos filas: familias arriba, subcategorías de la elegida abajo.
    var padre = container.parentNode;
    var fila2 = document.getElementById("mm-subfiltros");
    if (!fila2) {
      fila2 = document.createElement("div");
      fila2.id = "mm-subfiltros";
      padre.insertBefore(fila2, container.nextSibling);
    }
    [container, fila2].forEach(function (row) {
      row.style.display = "flex";
      row.style.flexWrap = "wrap";
      row.style.justifyContent = "center";
      row.style.gap = "0.5rem";
    });
    fila2.style.margin = "0.75rem 0 0";
    fila2.style.display = "none";

    function chip(texto, titulo) {
      var b = template.cloneNode(true);
      b.textContent = texto;
      if (titulo) b.title = titulo;
      b.style.whiteSpace = "nowrap";
      b.removeAttribute("data-on");
      b.classList.remove("active", "is-active");
      return b;
    }
    var t = function (es, pt) { return LANG === "pt" ? pt : es; };

    // Fila 1: "Todo" (el del HTML) + una familia por chip.
    var childs = Array.prototype.slice.call(container.children);
    childs.slice(1).forEach(function (c) { c.remove(); });
    var btnTodo = container.firstElementChild;

    var grid = document.querySelector('[data-mm-sync="catalogo"]');
    function aplicar(ids, chipActivo, fila) {
      Array.prototype.forEach.call(fila.children, function (b) { b.removeAttribute("data-on"); });
      if (chipActivo) chipActivo.setAttribute("data-on", "");
      if (grid) grid.style.minHeight = "";
      if (window.MM_CATALOGO) window.MM_CATALOGO.filtrarPorCategoria(ids);
    }

    if (btnTodo) {
      btnTodo.setAttribute("data-on", "");
      btnTodo.addEventListener("click", function (ev) {
        ev.preventDefault();
        fila2.style.display = "none";
        fila2.innerHTML = "";
        aplicar(null, btnTodo, container);
      });
    }

    familias.forEach(function (f) {
      var total = f.miembros.reduce(function (a, c) { return a + (c.modelos || 0); }, 0);
      var b = chip(t(f.nombre, f.nombrePt), total + " " + t("modelos", "modelos"));
      b.addEventListener("click", function (ev) {
        ev.preventDefault();
        aplicar(f.miembros.map(function (c) { return c.id; }), b, container);

        // Subcategorías de la familia, ordenadas por cantidad.
        fila2.innerHTML = "";
        var orden = f.miembros.slice().sort(function (a, c) { return (c.modelos || 0) - (a.modelos || 0); });
        var todas = chip(t("Todo en " + f.nombre, "Tudo em " + f.nombrePt));
        todas.setAttribute("data-on", "");
        todas.addEventListener("click", function (e2) {
          e2.preventDefault();
          aplicar(f.miembros.map(function (c) { return c.id; }), todas, fila2);
        });
        fila2.appendChild(todas);
        orden.forEach(function (c) {
          var sb = chip(c.nombre, (c.modelos || 0) + " " + t("modelos", "modelos"));
          sb.addEventListener("click", function (e2) {
            e2.preventDefault();
            aplicar([c.id], sb, fila2);
          });
          fila2.appendChild(sb);
        });
        fila2.style.display = "flex";
      });
      b.setAttribute("data-familia", f.clave || "");
      container.appendChild(b);
    });

    // El menú superior linkea a ?familia=ropa|calzado|…: se aplica al entrar.
    try {
      var pedida = new URLSearchParams(location.search).get("familia");
      if (pedida) {
        var chipFamilia = container.querySelector('[data-familia="' + pedida.toLowerCase() + '"]');
        if (chipFamilia) chipFamilia.click();
      }
    } catch (e) {}

    // Delegación en gender también
    var genderBar = document.querySelector("#coleccion-grid .mm-cf-gender");
    // El catálogo del proveedor no distingue género (las categorías son
    // CAMISETA, SHORTS, CALÇA…), así que la barra HOMBRE/MUJER quedaría como
    // un control que no hace nada. Se oculta hasta que haya con qué filtrar.
    if (genderBar) genderBar.style.display = "none";
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  // Frases específicas de Marilia (copywriting). Ampliar cuando se sume nueva copy.
  var COPY_ES_PT = {
    // ── QA de traducción ───────────────────────────────────────────────────
    // Todo lo que quedaba en español al recorrer home / catálogo / ficha en
    // modo PT. Las frases completas van primero (el walker ordena por
    // longitud) para que no se traduzcan palabra por palabra y quede mezcla.

    // Hero y campañas del carrusel
    "Un catálogo pensado para cada estilo.": "Um catálogo pensado para cada estilo.",
    "Selecciones curadas para vos, tu familia y tu casa. Cada semana algo nuevo.":
      "Seleções escolhidas para você, sua família e sua casa. Toda semana, algo novo.",
    "Detalles que suman en cada día.": "Detalhes que somam no dia a dia.",
    "Bolsos, cinturones, pañuelos y complementos. Piezas atemporales.":
      "Bolsas, cintos, lenços e complementos. Peças atemporais.",
    "Ver accesorios": "Ver acessórios",
    "Ver novedades": "Ver novidades",
    "Novedades": "Novidades",

    // Accesos por categoría
    "Comprá por categoría": "Compre por categoria",
    "Ver todas": "Ver todas",

    // Recién llegados
    "Recién llegados": "Recém-chegados",
    "Los productos más nuevos y buscados de Marilia Magazine. Filtrá por departamento para acotar.":
      "Os produtos mais novos e procurados da Marilia Magazine. Filtre por departamento para refinar.",

    // Bloque departamental / promos
    // ("Un catálogo pensado para todo" ya estaba más abajo en este mismo objeto)
    "Ver el catálogo": "Ver o catálogo",
    "Lo último que entró": "O último que chegou",
    "Actualizamos el catálogo cada semana con productos recién llegados.":
      "Atualizamos o catálogo toda semana com produtos recém-chegados.",
    "Precios rebajados": "Preços com desconto",
    "Selección de productos con descuento por tiempo limitado.":
      "Seleção de produtos com desconto por tempo limitado.",

    // Marcas
    "Las marcas que trabajamos": "As marcas que trabalhamos",
    "Seleccionamos marcas por calidad y respaldo.": "Escolhemos marcas por qualidade e procedência.",
    "Hoy trabajamos una marca. A medida que sumemos más, van a aparecer acá.":
      "Hoje trabalhamos com uma marca. Conforme somarmos mais, vão aparecer aqui.",
    "Moda masculina y femenina, calzado y accesorios.":
      "Moda masculina e feminina, calçados e acessórios.",
    "Ver productos": "Ver produtos",
    "productos": "produtos",

    // Ayuda / beneficios
    "Asesoría": "Atendimento",
    "Seguimiento de pedido": "Acompanhamento do pedido",
    "A todo Paraguay, en 24–48 h.": "Para todo o Paraguai, em 24–48 h.",
    "Hasta 30 días, en su estado original.": "Até 30 dias, no estado original.",
    "Consultanos por WhatsApp antes de comprar.": "Fale com a gente pelo WhatsApp antes de comprar.",
    "Te avisamos por WhatsApp cuando sale.": "Avisamos pelo WhatsApp quando sair.",
    "Atención por WhatsApp": "Atendimento pelo WhatsApp",
    "Escribinos por WhatsApp — respondemos consultas de talles, disponibilidad, envíos y cambios.":
      "Fale com a gente pelo WhatsApp — tiramos dúvidas de tamanhos, disponibilidade, envios e trocas.",
    "Escribinos por WhatsApp": "Fale com a gente pelo WhatsApp",
    "Trabajá con nosotros": "Trabalhe com a gente",
    "Cómo comprar": "Como comprar",
    "Desarrollado por": "Desenvolvido por",

    // ── Catálogo ───────────────────────────────────────────────────────────
    "Todas las piezas disponibles. Filtrá por departamento, ordená por precio y encontrá lo que buscás.":
      "Todas as peças disponíveis. Filtre por departamento, ordene por preço e encontre o que procura.",
    "Buscar productos, categorías y marcas": "Buscar produtos, categorias e marcas",
    "Precio asc": "Preço asc",
    "Precio desc": "Preço desc",
    "Nombre A–Z": "Nome A–Z",
    "Sin resultados": "Sem resultados",
    "No encontramos productos con estos filtros. Probá con otra categoría o limpiá los filtros.":
      "Não encontramos produtos com esses filtros. Tente outra categoria ou limpe os filtros.",
    "Limpiar filtros": "Limpar filtros",
    "Búsqueda": "Busca",
    "Inicio": "Início",
    "Menú": "Menu",

    // Carrito
    "Tu bolsa está vacía.": "Sua sacola está vazia.",
    "Empezá por el catálogo": "Comece pelo catálogo",
    "Tu bolsa": "Sua sacola",
    "Envío calculado al finalizar. Envío sin costo desde Gs. 750.000.":
      "Frete calculado na finalização. Frete grátis a partir de Gs. 750.000.",
    "o comprar por WhatsApp": "ou comprar pelo WhatsApp",

    // ── Ficha de producto ──────────────────────────────────────────────────
    "En stock · Envío en 48 h": "Em estoque · Envio em 48 h",
    "Materiales y cuidado": "Materiais e cuidados",
    "Fibras naturales seleccionadas": "Fibras naturais selecionadas",
    "Lavar a mano con agua fría": "Lavar à mão com água fria",
    "Secar a la sombra, sin escurrir": "Secar à sombra, sem torcer",
    "Planchar del revés a temperatura media": "Passar do avesso em temperatura média",
    "Envío y devoluciones": "Envio e devoluções",
    "Podría gustarte": "Você também pode gostar",
    "Descripción": "Descrição",
    "Talle": "Tamanho",
    "Vestido midi en lino lavado, corte fluido con cintura marcada. Confección artesanal en el atelier con tejido de origen paraguayo.":
      "Vestido midi em linho lavado, corte fluido com cintura marcada. Confecção artesanal no ateliê com tecido de origem paraguaia.",
    "Vestido midi en lino lavado": "Vestido midi em linho lavado",
    "Envío sin costo dentro de Asunción para compras desde Gs. 750.000. Interior a coordinar. Cambios dentro de 30 días con etiqueta original.":
      "Frete grátis em Assunção para compras a partir de Gs. 750.000. Interior a combinar. Trocas em até 30 dias com a etiqueta original.",

    // Pie
    "Tienda departamental — ropa, accesorios y más. Envíos a todo Paraguay.":
      "Loja de departamentos — roupa, acessórios e mais. Enviamos para todo o Paraguai.",
    "Tienda departamental — moda, hogar, belleza, tecnología y más. Envíos a todo Paraguay.":
      "Loja de departamentos — moda, casa, beleza, tecnologia e mais. Enviamos para todo o Paraguai.",
    "Atelier y showroom: Av. Mariscal López 2340, Villa Morra, Asunción. Lunes a sábados de 10 a 19 h.":
      "Atelier e showroom: Av. Mariscal López 2340, Villa Morra, Assunção. Segunda a sábado, das 10h às 19h.",
    "Envíos": "Envios",
    "Envío": "Envio",
    "Asunción": "Assunção",

    // ── Hero y textos de portada ───────────────────────────────────────────
    // La frase completa va ANTES que sus palabras sueltas: el walker ordena
    // por longitud, si no "Todo" se traduciría solo y quedaba "Tudo lo que…".
    "Todo lo que buscás, en un solo lugar.": "Tudo o que você procura, em um só lugar.",
    "Todo lo que buscás,": "Tudo o que você procura,",
    "en un solo lugar.": "em um só lugar.",
    "Nueva temporada": "Nova temporada",
    "Ropa, calzado, accesorios y bijou. Un catálogo pensado para cada momento.":
      "Roupa, calçados, acessórios e bijuteria. Um catálogo pensado para cada momento.",
    "Ropa, calzado, accesorios y bijou. Un mismo lugar para lo que buscás cada día — pensado para vos y para toda la familia.":
      "Roupa, calçados, acessórios e bijuteria. Um só lugar para o que você procura todo dia — pensado para você e para toda a família.",
    "Tienda de moda — ropa, calzado, accesorios y bijou. Envíos a todo Paraguay.":
      "Loja de moda — roupa, calçados, acessórios e bijuteria. Enviamos para todo o Paraguai.",
    "Explorar productos": "Explorar produtos",
    "EXPLORAR PRODUCTOS": "EXPLORAR PRODUTOS",
    "La tienda para todo lo tuyo": "A loja para tudo o que é seu",
    "Un catálogo pensado para todo": "Um catálogo pensado para tudo",

    // ── Mosaicos del home (familias del catálogo) ──────────────────────────
    "Moda mujer": "Moda mulher",
    "Moda hombre": "Moda masculina",
    "Vestidos · Blusas · Faldas": "Vestidos · Blusas · Saias",
    "Camisas · Pantalones · Abrigos": "Camisas · Calças · Casacos",
    "Gorras · Lentes · Cinturones": "Bonés · Óculos · Cintos",
    "Championes · Zapatos · Ojotas": "Tênis · Sapatos · Chinelos",
    "Mochilas · Valijas · Bandoleras": "Mochilas · Malas · Bolsas",
    "Pulseras · Collares · Cadenas": "Pulseiras · Colares · Correntes",
    "Bazar · Perfumería · Varios": "Bazar · Perfumaria · Diversos",
    "Bolsos": "Bolsas",
    "Bijou": "Bijuteria",
    "Otros": "Outros",
    "Tienda departamental": "Loja departamental",

    // ── Bloque de beneficios ───────────────────────────────────────────────
    "Beneficios": "Benefícios",
    "Comprar en Marilia": "Comprar na Marilia",
    "Compra tranquila, con seguimiento y atención personalizada.":
      "Compra tranquila, com acompanhamento e atendimento personalizado.",
    "Envío a todo Paraguay": "Envio para todo o Paraguai",
    "Despacho en 24–48 h desde Asunción por correo o cadetería.":
      "Despacho em 24–48 h desde Assunção por correio ou motoboy.",
    "Cambios en 30 días": "Trocas em 30 dias",
    "Si algo no te queda, lo cambiamos. Solo pedimos que llegue en su estado original.":
      "Se algo não servir, trocamos. Só pedimos que chegue no estado original.",
    "Medios de pago": "Meios de pagamento",
    "Transferencia bancaria, efectivo en tienda y consultas por WhatsApp.":
      "Transferência bancária, dinheiro na loja e consultas pelo WhatsApp.",
    "Asesoramiento": "Atendimento",
    "Consultá tallas, disponibilidad y combinaciones — te respondemos por WhatsApp.":
      "Consulte tamanhos, disponibilidade e combinações — respondemos pelo WhatsApp.",

    // ── Ayuda ──────────────────────────────────────────────────────────────
    "Estamos para ayudarte": "Estamos aqui para ajudar",
    "¿Necesitás ayuda?": "Precisa de ajuda?",
    "Tiempos, zonas y costos.": "Prazos, zonas e custos.",
    "Cómo funciona y qué pedimos.": "Como funciona e o que pedimos.",

    "Explora prendas y accesorios seleccionados para mujer y hombre, pensados para acompañar cada estilo y ocasión.":
      "Explore peças e acessórios selecionados para mulher e homem, pensados para acompanhar cada estilo e ocasião.",
    "Tu estilo, tu mejor versión.": "Seu estilo, sua melhor versão.",
    "Tu estilo,": "Seu estilo,",
    "tu mejor versión.": "sua melhor versão.",
    "Tu estilo, tu mejor versión": "Seu estilo, sua melhor versão",
    "Descubre prendas seleccionadas para acompañarte con elegancia, personalidad y confianza en cada ocasión.":
      "Descubra peças selecionadas para acompanhá-lo(a) com elegância, personalidade e confiança em cada ocasião.",
    "DESCUBRIR LA COLECCIÓN": "DESCOBRIR A COLEÇÃO",
    "VISITAR LA TIENDA": "VISITAR A LOJA",
    "SELECCIÓN MARILIA": "SELEÇÃO MARILIA",
    "Piezas que definen": "Peças que definem",
    "tu estilo": "seu estilo",
    "Piezas que definen tu estilo": "Peças que definem seu estilo",
    "Encuentra tu estilo.": "Encontre seu estilo.",
    "Encuentra tu estilo": "Encontre seu estilo",
    "Explorar la colección": "Explorar a coleção",
    "El look completo": "O look completo",
    "Tres piezas, un mismo gesto. Elegí cualquiera de la lista y sumala a tu bolsa sin salir de la historia.":
      "Três peças, um mesmo gesto. Escolha qualquer uma da lista e adicione à sua sacola sem sair da história.",
    "Añadir el look": "Adicionar o look",
    "Añadir a la bolsa": "Adicionar à sacola",
    "Añadido a la bolsa": "Adicionado à sacola",
    "Añadido": "Adicionado",
    "Añadir": "Adicionar",
    "Añadir +": "Adicionar +",
    "Vista rápida": "Visualização rápida",
    "Ver completa": "Ver completo",
    "Consultar": "Consultar",
    "Consultar precio": "Consultar preço",
    "Cerrar bolsa": "Fechar sacola",
    "Cerrar búsqueda": "Fechar busca",
    "Cerrar ✕": "Fechar ✕",
    "Cerrar": "Fechar",
    "Ayuda": "Ajuda",
    "Bolsa": "Sacola",
    "Buscar": "Buscar",
    "Buscar en la tienda": "Buscar na loja",
    "Búsquedas frecuentes": "Buscas frequentes",
    "Categorías": "Categorias",
    "Casa": "Início",
    "Catálogo": "Catálogo",
    "Catálogo completo": "Catálogo completo",
    "Colecciones": "Coleções",
    "Nueva colección": "Nova coleção",
    "Ver todo": "Ver tudo",
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
    "Camisa · Hombre": "Camisa · Homem",
    "Blazer · Hombre": "Blazer · Homem",
    "Pantalón · Hombre": "Calça · Homem",
    "Traje · Hombre": "Terno · Homem",
    "Abrigo · Hombre": "Casaco · Homem",
    "Camisas · Hombre": "Camisas · Homem",
    "Abrigos · Hombre": "Casacos · Homem",
    "Accesorios · Hombre": "Acessórios · Homem",
    "Vestidos · Mujer": "Vestidos · Mulher",
    "Blusas · Mujer": "Blusas · Mulher",
    "Abrigos · Mujer": "Casacos · Mulher",
    "Faldas · Mujer": "Saias · Mulher",
    "piezas": "peças",
    "pieza": "peça",
    "talles": "tamanhos",
    "talle": "tamanho",
    "colores": "cores",
    "color": "cor",
    "Nos escriben": "Nos escrevem",
    "Atelier Marilia": "Atelier Marilia",
    "Artesanas": "Artesãs",
    "Aviso": "Aviso",
    "Volver": "Voltar",
    "Anterior": "Anterior",
    "Siguiente": "Próximo",
    "Guardar": "Salvar",
    "Continuar": "Continuar",
    "Editar": "Editar",
    "Eliminar": "Excluir",
    "Quitar": "Remover",
    "Vaciar": "Esvaziar",
    "Confirmar": "Confirmar",
    "Cancelar": "Cancelar",
    // Copy adicional detectada en el sitio
    "Curadas para quienes eligen calidad, diseño y autenticidad en cada detalle.":
      "Selecionadas para quem escolhe qualidade, design e autenticidade em cada detalhe.",
    "VER COLECCIÓN COMPLETA": "VER COLEÇÃO COMPLETA",
    "Ver colección completa": "Ver coleção completa",
    "Piezas seleccionadas por su diseño, calidad y atemporalidad.":
      "Peças selecionadas pelo seu design, qualidade e atemporalidade.",
    "Estilo que trasciende.": "Estilo que transcende.",
    "Estilo que trasciende": "Estilo que transcende",
    "Tres piezas, un mismo gesto.": "Três peças, um mesmo gesto.",
    "Tres piezas, un mismo gesto": "Três peças, um mesmo gesto",
    "AÑADIR EL LOOK": "ADICIONAR O LOOK",
    "Sastrería masculina fotografiada en las salinas del sur.":
      "Alfaiataria masculina fotografada nas salinas do sul.",
    "Camisas, pantalones y sacos en serie limitada de 40 unidades, con tintes naturales y acabados a mano.":
      "Camisas, calças e paletós em série limitada de 40 unidades, com tinturas naturais e acabamentos à mão.",
    "Hoy somos once mujeres que diseñan, cortan y cosen cada pieza pensando en cómo se vive un día entero dentro de ella.":
      "Hoje somos onze mulheres que desenham, cortam e costuram cada peça pensando em como se vive um dia inteiro dentro dela.",
    "Trabajamos con telas naturales, tiradas cortas y proveedores locales.":
      "Trabalhamos com tecidos naturais, tiragens curtas e fornecedores locais.",
    "PIEZAS POR SERIE": "PEÇAS POR SÉRIE",
    "Compré el vestido Aurelia para la boda de mi hermana y terminé usándolo todo el verano.":
      "Comprei o vestido Aurelia para o casamento da minha irmã e acabei usando o verão inteiro.",
    "La caída del lino es otra cosa.": "O caimento do linho é outra coisa.",
    "Es la única marca donde compramos los dos sin probarnos.":
      "É a única marca onde compramos os dois sem provar.",
    "Los talles son consistentes y las telas duran años.":
      "Os tamanhos são consistentes e os tecidos duram anos.",
    "— CIUDAD DEL ESTE": "— CIUDAD DEL ESTE",
    "Sastrería": "Alfaiataria",
    "sastrería": "alfaiataria",
    "vestido": "vestido",
    "prendas": "peças",
    "prenda": "peça",
    "boda": "casamento",
    "hermana": "irmã",
    "mujeres": "mulheres",
    "mujer": "mulher",
    "hombre": "homem",
    "hombres": "homens",
    "verano": "verão",
    "invierno": "inverno",
    "tela": "tecido",
    "telas": "tecidos",
    "seda": "seda",
    "lino": "linho",
    "algodón": "algodão",
    "diseño": "design",
    "años": "anos",
    "diseñan": "desenham",
    "cortan": "cortam",
    "cosen": "costuram",
    "compramos": "compramos",
    "compré": "comprei",
    "sur": "sul",
    "detalle": "detalhe",
    "detalles": "detalhes",
    "cada": "cada",
    "salinas": "salinas",
    // Copy adicional detectada en screenshots
    "CAMPAÑA HOMBRE": "CAMPANHA HOMEM",
    "CAMPAÑA MUJER": "CAMPANHA MULHER",
    "Campaña": "Campanha",
    "campaña": "campanha",
    "VER LA CAMPAÑA": "VER A CAMPANHA",
    "Ver la campaña": "Ver a campanha",
    "Lino, cuero y oficio": "Linho, couro e ofício",
    "Lino": "Linho",
    "cuero": "couro",
    "oficio": "ofício",
    "NUESTRA ESENCIA": "NOSSA ESSÊNCIA",
    "Nuestra esencia": "Nossa essência",
    "esencia": "essência",
    "Desde 2014, vestimos con calma": "Desde 2014, vestimos com calma",
    "vestimos con calma": "vestimos com calma",
    "con calma": "com calma",
    "Marilia nació en un taller de dos máquinas sobre la calle Mariscal López.":
      "A Marilia nasceu num ateliê de duas máquinas na rua Mariscal López.",
    "Marilia nació": "A Marilia nasceu",
    "nació en un taller": "nasceu num ateliê",
    "un taller": "um ateliê",
    "taller": "ateliê",
    "Nada se produce dos veces igual.": "Nada se produz duas vezes igual.",
    "Nada se produce": "Nada se produz",
    "dos veces": "duas vezes",
    "FIBRAS NATURALES": "FIBRAS NATURAIS",
    "Fibras naturales": "Fibras naturais",
    "ARTESANAS": "ARTESÃS",
    "artesanas": "artesãs",
    "Bolso": "Bolsa",
    "SHOP THE LOOK": "SHOP THE LOOK",
    "shop the look": "shop the look",
    "CAMPAÑA": "CAMPANHA",
    "PIEZAS": "PEÇAS",
    "sobre la calle": "na rua",
    "Hoy somos": "Hoje somos",
    "hoy somos": "hoje somos",
    "once mujeres": "onze mulheres",
    "cada pieza": "cada peça",
    "pensando en cómo se vive un día entero dentro de ella": "pensando em como se vive um dia inteiro dentro dela",
    "un día entero": "um dia inteiro",
    "un día": "um dia",
    "dentro de ella": "dentro dela",
    "tiradas cortas": "tiragens curtas",
    "proveedores locales": "fornecedores locais",
    "telas naturales": "tecidos naturais",
    "tintes naturales": "tinturas naturais",
    "acabados a mano": "acabamentos à mão",
    "a mano": "à mão",
    "en serie limitada": "em série limitada",
    "serie limitada": "série limitada",
    "unidades": "unidades",
    "de 40 unidades": "de 40 unidades",
    "sacos": "paletós",
    "saco": "paletó",
    "pantalones": "calças",
    "pantalón": "calça",
    "camisas": "camisas",
    "fotografiada": "fotografada",
    "masculina": "masculina",
    "femenina": "feminina",
    "las salinas del sur": "as salinas do sul",
    "del sur": "do sul",
    "Encuentra": "Encontre",
    "encuentra": "encontre",
    "Tu estilo": "Seu estilo",
    "TU ESTILO": "SEU ESTILO",
    "El look": "O look",
    "el look": "o look",
    "ADICIONAR O LOOK": "ADICIONAR O LOOK",
    "GS.": "GS.",
    "Ver la ficha": "Ver a ficha",
    "TALLA": "TAMANHO",
    "Talla": "Tamanho",
    "talla": "tamanho",
    "COLOR": "COR",
    "Color": "Cor",
    // Testimonios completos
    "Atención impecable en el atelier. Me ajustaron el traje en dos días y llegó envuelto como un regalo.":
      "Atendimento impecável no ateliê. Ajustaram o terno em dois dias e chegou embalado como um presente.",
    "Atención impecable en el atelier": "Atendimento impecável no ateliê",
    "Me ajustaron el traje en dos días y llegó envuelto como un regalo": "Ajustaram o terno em dois dias e chegou embalado como um presente",
    "atención impecable": "atendimento impecável",
    "ajustaron": "ajustaram",
    "traje": "terno",
    "envuelto como un regalo": "embalado como um presente",
    "envuelto": "embalado",
    "regalo": "presente",
    "días": "dias",
    "días.": "dias.",
    "impecable": "impecável",
    "Comprei o vestido Aurelia para o casamento da minha irmã e acabei usando o verão inteiro":
      "Comprei o vestido Aurelia para o casamento da minha irmã e acabei usando o verão inteiro",
    "Comprei el vestido Aurelia para el casamiento de mi hermana y terminé usándolo todo el verano.":
      "Comprei o vestido Aurelia para o casamento da minha irmã e acabei usando o verão inteiro.",
    "É la única marca donde compramos los dos sin probarnos.":
      "É a única marca onde compramos os dois sem provar.",
    "los dos sin probarnos": "os dois sem provar",
    "sin probarnos": "sem provar",
    "probarnos": "provar",
    "compramos los dos": "compramos os dois",
    "los talles": "os tamanhos",
    "talles son consistentes": "tamanhos são consistentes",
    "consistentes": "consistentes",
    "las telas duran años": "os tecidos duram anos",
    "duran años": "duram anos",
    "duran": "duram",
    // Nav header catálogo
    "INICIO": "INÍCIO",
    "CATÁLOGO": "CATÁLOGO",
    "CATEGORIAS": "CATEGORIAS",
    "NOSOTROS": "SOBRE NÓS",
    "Nosotros": "Sobre nós",
    "FAVORITOS": "FAVORITOS",
    "SACOLA": "SACOLA",
    "ROPA": "ROUPA",
    "Ropa": "Roupa",
    "ropa": "roupa",
    // Página catálogo (headings)
    "El catálogo": "O catálogo",
    "El": "O",
    "catálogo": "catálogo",
    "CATÁLOGO COMPLETO": "CATÁLOGO COMPLETO",
    "Todas las peças disponibles del atelier — filtrá por categoría, ordená por precio y explorá":
      "Todas as peças disponíveis do ateliê — filtre por categoria, ordene por preço e explore",
    "Todas las": "Todas as",
    "Todas las piezas": "Todas as peças",
    "disponibles del atelier": "disponíveis do ateliê",
    "disponibles": "disponíveis",
    "del atelier": "do ateliê",
    "atelier": "ateliê",
    "filtrá por categoría": "filtre por categoria",
    "ordená por precio": "ordene por preço",
    "y explorá": "e explore",
    "filtrá": "filtre",
    "ordená": "ordene",
    "explorá": "explore",
    "por categoría": "por categoria",
    "por precio": "por preço",
    "categoría": "categoria",
    "precio": "preço",
    "ORDENAR": "ORDENAR",
    "DESTACADOS": "DESTAQUES",
    "Destacados": "Destaques",
    "Recientes": "Recentes",
    "Precio menor a mayor": "Preço menor a maior",
    "Precio mayor a menor": "Preço maior a menor",
    "Nombre A-Z": "Nome A-Z",
  };
  // Reverse map PT→ES para toggle bidireccional
  var COPY_PT_ES = {};
  Object.keys(COPY_ES_PT).forEach(function (k) { COPY_PT_ES[COPY_ES_PT[k]] = k; });

  // Walker que traduce text nodes ATRAVESANDO SHADOW DOM
  // Nodos ya traducidos, con el texto exacto que les dejamos.
  //
  // Sin esto el observador vuelve a pasar sobre el mismo nodo y, cuando la
  // traducción CONTIENE a su clave ("Política de privacidad" → "Política de
  // privacidade"), la vuelve a matchear y le agrega una letra en cada pasada:
  // así aparecía "privacidadeeeeeeeee…". Se reinicia al cambiar de idioma.
  var yaTraducidos = new WeakMap();
  var ultimoLangTraducido = null;

  function translatePageDeep() {
    var dict = LANG === "pt" ? COPY_ES_PT : COPY_PT_ES;
    var keys = Object.keys(dict).sort(function (a, b) { return b.length - a.length; });
    if (ultimoLangTraducido !== LANG) {
      yaTraducidos = new WeakMap();
      ultimoLangTraducido = LANG;
    }
    function processRoot(root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          var tag = p.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
          if (p.id === "mm-lang-toggle") return NodeFilter.FILTER_REJECT;
          var v = n.nodeValue;
          if (!v || !v.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [];
      var n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var t = node.nodeValue;
        // Ya lo tradujimos y nadie lo tocó desde entonces: no repasar.
        if (yaTraducidos.get(node) === t) return;
        var trimmed = t.trim();
        if (dict[trimmed]) {
          var salida = t.replace(trimmed, dict[trimmed]);
          node.nodeValue = salida;
          yaTraducidos.set(node, salida);
          return;
        }
        // Reemplazo por frase/palabra CON word boundary — evita romper "Casacos" al buscar "Casa"
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (k.length < 3) continue;
          if (t.indexOf(k) === -1) continue;
          // Si la traducción ya está en el texto, no volver a aplicarla.
          // Sin esto, "Política de privacidad" vuelve a matchear dentro de
          // "Política de privacidade" y le agrega una "e" en cada pasada
          // ("privacidadeeeee…"). Hace la traducción idempotente sin
          // depender de que el WeakMap acierte con el nodo.
          if (dict[k] !== k && t.indexOf(dict[k]) > -1) continue;
          var esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // Solo aplicar word-boundary si es una palabra "limpia" (sin espacios ni puntuación)
          // Para frases largas con espacios, hacer replace directo.
          if (/^[A-Za-zÁÉÍÓÚÑáéíóúñÀ-ÿ]+$/.test(k)) {
            var re = new RegExp("\\b" + esc + "\\b", "g");
            t = t.replace(re, dict[k]);
          } else {
            t = t.split(k).join(dict[k]);
          }
        }
        if (t !== node.nodeValue) node.nodeValue = t;
        yaTraducidos.set(node, t);
      });
      // Recursar en shadow roots
      var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
      Array.prototype.forEach.call(all, function (el) {
        if (el.shadowRoot) processRoot(el.shadowRoot);
      });
    }
    processRoot(document.body);
    // Placeholders y alt/title
    document.querySelectorAll("input[placeholder]").forEach(function (i) {
      var v = i.getAttribute("placeholder");
      if (dict[v]) i.setAttribute("placeholder", dict[v]);
    });
    document.querySelectorAll("[alt],[title],[aria-label]").forEach(function (el) {
      ["alt", "title", "aria-label"].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && dict[v]) el.setAttribute(a, dict[v]);
      });
    });
    document.documentElement.setAttribute("lang", LANG);
  }

  // Deshabilitar Google Translate viejo (mantengo la función pero no la llamamos)
  function injectGoogleTranslate() {
    if (document.getElementById("google_translate_element")) return;
    // Contenedor invisible (Google inyecta su widget acá pero lo ocultamos)
    var host = document.createElement("div");
    host.id = "google_translate_element";
    host.style.cssText = "position:absolute;top:-9999px;left:-9999px;visibility:hidden";
    document.body.appendChild(host);
    // CSS ULTRA agresivo para matar completamente la barra de Google
    var style = document.createElement("style");
    style.textContent = [
      // Barra superior (todos los variantes conocidos de la clase)
      ".goog-te-banner-frame,.goog-te-banner-frame.skiptranslate,.VIpgJd-ZVi9od-ORHb-OEVmcd,.VIpgJd-ZVi9od-ORHb{display:none!important;visibility:hidden!important;height:0!important;position:absolute!important;top:-9999px!important}",
      // Forzar body sin offset (Google le pone top:40px cuando muestra su barra)
      "html,body{top:0!important;position:static!important;margin-top:0!important}",
      // Widget original (dropdown de Google)
      ".goog-te-gadget,.goog-te-gadget-simple{display:none!important}",
      ".goog-te-menu-value,.goog-te-menu-frame{display:none!important}",
      // Tooltips que aparecen al hover sobre texto traducido
      ".goog-tooltip,.goog-tooltip:hover,.goog-text-highlight{background:none!important;box-shadow:none!important;border:none!important}",
      // Iframe superior fijo
      "iframe.goog-te-banner-frame,iframe.goog-te-menu-frame{display:none!important}",
    ].join("");
    document.head.appendChild(style);
    // Watcher: si Google reinyecta la barra, la matamos
    var killBanner = function () {
      document.body.style.top = "0px";
      document.documentElement.style.top = "0px";
      var bars = document.querySelectorAll(".goog-te-banner-frame, .skiptranslate");
      bars.forEach(function (b) { if (b.tagName === "IFRAME" || b.classList.contains("goog-te-banner-frame")) b.style.display = "none"; });
    };
    setInterval(killBanner, 500);
    // Init callback
    window.googleTranslateElementInit = function () {
      new window.google.translate.TranslateElement({
        pageLanguage: "es",
        includedLanguages: "es,pt",
        autoDisplay: false,
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
      }, "google_translate_element");
    };
    var s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.head.appendChild(s);
  }

  function setGoogleLang(lang) {
    // Google Translate usa cookie `googtrans` con formato /es/pt o /es/es
    var host = "." + location.hostname.split(".").slice(-2).join(".");
    var val = "/es/" + lang;
    document.cookie = "googtrans=" + val + ";path=/";
    document.cookie = "googtrans=" + val + ";path=/;domain=" + host;
    document.cookie = "googtrans=" + val + ";path=/;domain=" + location.hostname;
  }

  // Banderas y etiquetas del selector de idioma (definidas afuera para que
  // las use tanto el montaje inicial como los menús que se crean después).
  var FLAG_PY, FLAG_BR, LABEL;

  /**
   * Crea un selector de idioma nuevo. Se llama una vez por contenedor:
   * la barra de departamentos en escritorio y el menú en móvil (donde esa
   * barra está oculta). Antes era un único chip `position:fixed` abajo a la
   * izquierda que tapaba el texto del pie.
   */
  function crearLangToggle() {
    var wrap = document.createElement("div");
    wrap.className = "mm-langtoggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Cambiar idioma / Trocar idioma");
    wrap.appendChild(makeOpt("es"));
    wrap.appendChild(makeOpt("pt"));
    return wrap;
  }
  window.mmCrearLangToggle = crearLangToggle;

  // Banderas como SVG inline. Windows renderiza mal los emojis de bandera
  // (se ven como "PY" / "BR" en texto plano), asi que las dibujamos con
  // formas simples que se ven igual en cualquier sistema.
  FLAG_PY = '<svg viewBox="0 0 15 10" width="17" height="11" style="border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.15);flex:0 0 auto" aria-hidden="true">' +
    '<rect width="15" height="3.33" y="0" fill="#D52B1E"/>' +
    '<rect width="15" height="3.34" y="3.33" fill="#FFFFFF"/>' +
    '<rect width="15" height="3.33" y="6.67" fill="#0038A8"/>' +
    '<circle cx="7.5" cy="5" r="1.1" fill="none" stroke="#D4AF37" stroke-width=".18"/>' +
  '</svg>';
  FLAG_BR = '<svg viewBox="0 0 20 14" width="17" height="11" style="border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.15);flex:0 0 auto" aria-hidden="true">' +
    '<rect width="20" height="14" fill="#009C3B"/>' +
    '<polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#FFDF00"/>' +
    '<circle cx="10" cy="7" r="3" fill="#002776"/>' +
  '</svg>';

  LABEL = {
    es: { flag: FLAG_PY, code: "ES", full: "Español" },
    pt: { flag: FLAG_BR, code: "PT", full: "Português" },
  };

  function makeOpt(lang) {
    var b = document.createElement("button");
    b.type = "button";
    var isActive = (LANG === lang);
    b.setAttribute("aria-pressed", isActive ? "true" : "false");
    b.title = isActive ? LABEL[lang].full : "Cambiar a " + LABEL[lang].full;
    b.innerHTML = LABEL[lang].flag + '<span>' + LABEL[lang].code + '</span>';
    b.addEventListener("click", function () {
      if (LANG === lang) return; // ya activo
      LANG = lang;
      localStorage.setItem("mm_lang", lang);
      setGoogleLang(lang);
      location.reload();
    });
    return b;
  }

  /**
   * Monta el selector donde corresponda:
   *   - barra de departamentos (escritorio), al lado de "Ver todo"
   *   - cualquier [data-lang-slot] (los menús móviles, que se arman después)
   * Se puede llamar varias veces: no duplica.
   */
  function injectLangToggle() {
    var destinos = [].slice.call(document.querySelectorAll(".mm-nav__inner, [data-lang-slot]"));
    destinos.forEach(function (destino) {
      if (destino.querySelector(".mm-langtoggle")) return;
      destino.appendChild(crearLangToggle());
    });
  }

  // El menú de la home lo arma el runtime DC recién al abrirlo, o sea después
  // de este montaje. Se vuelve a intentar en cuanto alguien toca "Menú".
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest("[data-menu-open]")) return;
    setTimeout(injectLangToggle, 60);
    setTimeout(injectLangToggle, 300);
  });

  // MutationObserver: re-traduce cada vez que el DOM cambia (útil cuando
  // el runtime DC hidrata headlines tarde). Debounced para no ir a 60fps.
  var mmMutationTimer = null;
  function installMutationObserver() {
    if (LANG === "es") return;
    var mo = new MutationObserver(function () {
      clearTimeout(mmMutationTimer);
      mmMutationTimer = setTimeout(function () {
        translatePageDeep();
      }, 200);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    // También observar shadow roots existentes
    document.querySelectorAll("*").forEach(function (el) {
      if (el.shadowRoot) {
        try { mo.observe(el.shadowRoot, { childList: true, subtree: true, characterData: true }); } catch (e) {}
      }
    });
  }

  // ------------------------------------------------------------------
  // Página de producto individual (Producto.dc.html): fetch por ID (UUID)
  // desde Supabase cuando el ID no está en el hardcoded MM_PRODUCTS.
  // ------------------------------------------------------------------
  async function syncProductoPage() {
    // Ojo con el .html: en Vercel esta activo cleanUrls, asi que en produccion
    // el pathname llega como "/Producto.dc" (y "/producto" por el rewrite),
    // nunca "/Producto.dc.html". Exigir la extension hacia que este sync no
    // corriera NUNCA en produccion — solo en local. De ahi el "Producto no
    // encontrado" que se veia online y no se reproducia sirviendo los archivos.
    if (!/producto/i.test(location.pathname)) return;
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    if (!id) return;
    // Si el ID es corto (p1, h1, t1...) es hardcoded — dejar que la página lo maneje
    if (id.length < 30) return;
    // Fetch el producto por UUID
    var rows = await api("/productos?id=eq." + encodeURIComponent(id) + "&select=id,sku,codigo_proveedor,nombre,precio_venta,descripcion,imagen_url,categoria_principal_id,color_nombre,talla_nombre");
    if (!rows || rows.length === 0) return;
    var p = rows[0];
    // Variantes del mismo modelo: comparten el codigo_proveedor.
    var codigoModelo = String(p.codigo_proveedor || "");
    var variantes = [];
    if (codigoModelo) {
      variantes = (await api("/productos?codigo_proveedor=eq." + encodeURIComponent(codigoModelo) + "&select=id,sku,codigo_proveedor,nombre,precio_venta,imagen_url,color_nombre,talla_nombre")) || [];
    }
    if (variantes.length === 0) variantes = [p];
    var colores = new Set(), talles = new Set(), imgPorColor = {};
    variantes.forEach(function (v) {
      if (v.color_nombre) { colores.add(v.color_nombre); if (v.imagen_url && !imgPorColor[v.color_nombre]) imgPorColor[v.color_nombre] = v.imagen_url; }
      if (v.talla_nombre) talles.add(v.talla_nombre);
    });

    // Poblar los data-* de la página
    var $ = function (s) { return document.querySelector(s); };
    var precioTexto = Number(p.precio_venta) > 0 ? "Gs. " + Number(p.precio_venta).toLocaleString("es-PY") : "Consultar";
    if ($("[data-name]")) $("[data-name]").textContent = tr(p.nombre);
    if ($("[data-crumb]")) $("[data-crumb]").textContent = tr(p.nombre);
    if ($("[data-sub]")) $("[data-sub]").textContent = tr(p.descripcion || "");
    if ($("[data-price]")) $("[data-price]").textContent = precioTexto;
    if ($("[data-desc]")) $("[data-desc]").textContent = tr(p.descripcion || "");
    if ($("[data-cat-lbl]")) $("[data-cat-lbl]").textContent = "";
    document.title = tr(p.nombre) + " — Marilia Magazine";
    // Imagen principal
    var hero = $("[data-hero]");
    if (hero && p.imagen_url) { hero.src = p.imagen_url; hero.alt = p.nombre; }
    var heroBox = $("[data-hero-box]");
    if (heroBox) heroBox.removeAttribute("data-swapping");
    // Talles y colores dinámicos
    var sizesEl = $("[data-sizes]");
    if (sizesEl) {
      sizesEl.innerHTML = "";
      Array.from(talles).forEach(function (t, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "mm-pd-size";
        b.textContent = tr(t);
        if (i === 0) b.setAttribute("data-on", "");
        sizesEl.appendChild(b);
      });
    }
    var colorsEl = $("[data-colors]");
    if (colorsEl) {
      colorsEl.innerHTML = "";
      // La foto grande es la de la variante que se abrio, asi que el swatch
      // marcado tiene que ser el de ESE color, no el primero de la lista.
      var coloresLista = Array.from(colores);
      var seleccionado = coloresLista.indexOf(p.color_nombre);
      if (seleccionado < 0) seleccionado = 0;
      coloresLista.forEach(function (c, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "mm-pd-color";
        // Sin background el boton queda transparente: la fila "Color" se veia
        // vacia aunque el producto tuviera variantes cargadas.
        b.style.background = hexForColor(c);
        b.title = tr(c);
        b.setAttribute("aria-label", tr(c));
        b.setAttribute("data-color", c);
        if (i === seleccionado) b.setAttribute("data-on", "");
        colorsEl.appendChild(b);
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(colorsEl.children, function (x) { x.removeAttribute("data-on"); });
          b.setAttribute("data-on", "");
          var img = imgPorColor[c];
          if (img && hero) hero.src = img;
        });
      });
    }
  }

  function boot() {
    injectLangToggle();
    if (LANG !== "es") translatePageDeep();
    // Correr en paralelo — cualquiera puede fallar sin bloquear al resto
    Promise.allSettled([syncCatalogo(), syncExplorar(), syncCategoriasTiles(), syncFiltros(), syncProductoPage()]).then(function () {
      if (LANG !== "es") translatePageDeep();
      // Ticks progresivos para capturar hidratación tardía del DC runtime
      [400, 1000, 2500, 5000].forEach(function (ms) {
        setTimeout(function () { if (LANG !== "es") translatePageDeep(); }, ms);
      });
      // MutationObserver permanente (mientras el usuario esté en PT)
      installMutationObserver();
      document.dispatchEvent(new CustomEvent("mm:sync-done"));
    });
  }

  // Arrancar apenas el DOM esté listo (no esperar imágenes) — el shadow-hack
  // ya inyectó lo necesario para que los custom elements se puedan traducir
  // después vía MutationObserver.
  function bootDeferred() {
    setTimeout(boot, 100);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootDeferred);
  } else {
    bootDeferred();
  }
})();
