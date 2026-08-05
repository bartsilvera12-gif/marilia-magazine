/**
 * mm-menu.js
 * ---------------------------------------------------------------------------
 * Menú móvil para las páginas que NO son la home.
 *
 * POR QUE EXISTE:
 * la home arma su menú con el runtime DC (`<sc-if value="{{ menuOpen }}">` +
 * estado en el Component). Catalogo.dc.html y Producto.dc.html tienen el
 * botón "Menú" en el header pero ningún estado ni marcado detrás, así que
 * tocarlo no hacía nada. Este script les da un menú propio en JS plano,
 * sin depender del runtime.
 *
 * Se activa SOLO en los botones marcados con `data-menu-js`, para no chocar
 * con el menú DC de la home.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var WA = "https://wa.me/595981000000";

  // Mismos departamentos que la barra de navegación de escritorio.
  var DEPARTAMENTOS = [
    { t: "Ropa",       h: "./Catalogo.dc.html?familia=ropa" },
    { t: "Calzado",    h: "./Catalogo.dc.html?familia=calzado" },
    { t: "Accesorios", h: "./Catalogo.dc.html?familia=accesorios" },
    { t: "Bolsos",     h: "./Catalogo.dc.html?familia=bolsos" },
    { t: "Bijou",      h: "./Catalogo.dc.html?familia=bijou" },
    { t: "Otros",      h: "./Catalogo.dc.html?familia=otros" },
  ];

  var DESCUBRI = [
    { t: "Novedades",         h: "./Catalogo.dc.html?nuevo=1",  destacado: true },
    { t: "Ofertas",           h: "./Catalogo.dc.html?oferta=1", destacado: true },
    { t: "Ver todo el catálogo", h: "./Catalogo.dc.html" },
  ];

  var overlay = null;
  var ultimoFoco = null;

  function bloque(titulo, items, grande) {
    var html = '<div class="mm-menu__label">' + titulo + "</div>";
    html += items.map(function (i) {
      return '<a class="mm-menu__link' + (grande ? " mm-menu__link--lg" : "") +
             (i.destacado ? " mm-menu__link--accent" : "") + '" href="' + i.h + '">' + i.t + "</a>";
    }).join("");
    return html;
  }

  function crear() {
    overlay = document.createElement("div");
    overlay.className = "mm-menu";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Menú");
    overlay.innerHTML =
      '<div class="mm-menu__top">' +
        '<span class="mm-menu__brand">Marilia <span>Magazine</span></span>' +
        '<button type="button" class="mm-menu__close" data-menu-close>Cerrar ✕</button>' +
      "</div>" +
      '<form class="mm-menu__search" role="search">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input type="search" placeholder="Buscar productos, categorías…" aria-label="Buscar">' +
      "</form>" +
      '<nav class="mm-menu__nav" aria-label="Menú principal">' +
        bloque("Departamentos", DEPARTAMENTOS, true) +
        bloque("Descubrí", DESCUBRI, false) +
      "</nav>" +
      '<div class="mm-menu__foot">' +
        '<a href="./Catalogo.dc.html">Favoritos</a>' +
        '<a href="./Catalogo.dc.html">Bolsa</a>' +
        '<a href="' + WA + '" class="mm-menu__wa">WhatsApp</a>' +
      "</div>";

    overlay.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-menu-close]")) { cerrar(); return; }
      if (ev.target === overlay) cerrar();           // tocar el fondo cierra
    });

    overlay.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = this.querySelector("input").value.trim();
      if (q) location.href = "./Catalogo.dc.html?q=" + encodeURIComponent(q);
    });

    document.body.appendChild(overlay);
  }

  function abrir() {
    if (!overlay) crear();
    ultimoFoco = document.activeElement;
    overlay.setAttribute("data-open", "");
    document.body.style.overflow = "hidden";
    var cerrarBtn = overlay.querySelector("[data-menu-close]");
    if (cerrarBtn) cerrarBtn.focus();
  }

  function cerrar() {
    if (!overlay) return;
    overlay.removeAttribute("data-open");
    document.body.style.overflow = "";
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  // Delegado en document: el header puede re-renderizarse y los listeners
  // directos se perderían.
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-menu-open][data-menu-js]");
    if (!btn) return;
    ev.preventDefault();
    abrir();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && overlay && overlay.hasAttribute("data-open")) cerrar();
  });
})();
