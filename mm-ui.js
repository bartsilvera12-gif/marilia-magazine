/* mm-ui.js — detalles de interfaz que valen para todas las páginas.
 *
 * Hoy hace una sola cosa: esconder el botón flotante de WhatsApp cuando el
 * visitante llega al final. Ahí abajo el botón no aporta (el pie ya tiene su
 * propio enlace de WhatsApp) y sí estorba: quedaba encima de "Desarrollado
 * por Neura" y de los enlaces de la última fila.
 *
 * La marca se pone en <html>, no en el botón: el runtime de DC reconcilia
 * los atributos de los nodos que renderiza y los borra a los pocos ms.
 * El estilo vive en mm-components.css (html.mm-en-pie .mm-whatsapp).
 */
(function () {
  'use strict';

  var CLASE = 'mm-en-pie';

  function marcar(enPie) {
    document.documentElement.classList.toggle(CLASE, !!enPie);
  }

  // El botón y el pie los pinta el runtime de DC, que termina después de
  // DOMContentLoaded. Se reintenta hasta que aparezcan.
  function esperar(intentos) {
    if (document.querySelector('.mm-whatsapp')) return iniciar();
    if (intentos <= 0) return;
    setTimeout(function () { esperar(intentos - 1); }, 120);
  }

  // Se vuelve a buscar el pie en cada comprobación en lugar de guardarlo:
  // DC vuelve a pintar el árbol y el nodo que había al arrancar queda
  // huérfano. Un IntersectionObserver sobre ese nodo suelto no dispara
  // nunca — probado.
  function enPie() {
    var pie = document.querySelector('.mm-footer');
    if (pie) return pie.getBoundingClientRect().top < window.innerHeight;
    // El catálogo no tiene pie: ahí se usa el final del documento.
    var alto = document.documentElement.scrollHeight;
    return window.scrollY + window.innerHeight >= alto - 8;
  }

  function iniciar() {
    var pendiente = false;
    function revisar() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; marcar(enPie()); });
    }
    addEventListener('scroll', revisar, { passive: true });
    addEventListener('resize', revisar);
    // El alto de la página cambia cuando entran los productos del ERP.
    document.addEventListener('mm:catalogo-loaded', revisar);
    // La primera pasada va directa, sin rAF: si la pestaña está en segundo
    // plano rAF no dispara y el botón se quedaría en un estado equivocado
    // hasta el primer scroll.
    marcar(enPie());
  }

  var arranque = function () { esperar(60); };   // ~7 s de margen
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arranque);
  } else {
    arranque();
  }
})();
