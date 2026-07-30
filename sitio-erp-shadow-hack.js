/**
 * sitio-erp-shadow-hack.js
 * ------------------------------------------------------------------
 * Fuerza `mode:'open'` en TODOS los shadow roots que se creen después.
 * Necesario para que sitio-erp-sync.js pueda traducir texto que vive
 * dentro de custom elements con shadow cerrado (support.js del sitio
 * y el custom element `<image-slot>` crean varios).
 *
 * DEBE cargarse SIN defer y ANTES de support.js.
 * ------------------------------------------------------------------
 */
(function () {
  "use strict";
  if (!window.Element || !Element.prototype.attachShadow) return;
  var original = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    try {
      var patched = Object.assign({}, init || {});
      patched.mode = "open";
      return original.call(this, patched);
    } catch (e) {
      return original.call(this, init);
    }
  };
})();
