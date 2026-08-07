/**
 * Build estático para Hostinger (Apache / LiteSpeed).
 *
 *   node scripts/build-hostinger.mjs
 *
 * Genera `dist/` con:
 *   - Las páginas y los .js del sitio.
 *   - Solo los assets de `uploads/` que las páginas realmente referencian
 *     (el repo guarda los .png/.jpeg originales al lado de los .webp; subirlos
 *     todos serían ~118 MB para servir ~15).
 *   - Cache-busting en los <script src> locales, para que un deploy nuevo no
 *     quede tapado por el sitio-erp-sync.js viejo del navegador.
 *   - .htaccess con URLs limpias, compresión, cache y HTTPS.
 *
 * Sin dependencias: solo Node.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(raiz, "dist");

/** Páginas que se publican. El resto de los .html del repo son borradores. */
const PAGINAS = [
  "index.html",
  "Marilia Magazine.dc.html",
  "Catalogo.dc.html",
  "Producto.dc.html",
  "Privacidad.dc.html",
];

/** Scripts del sitio. */
const SCRIPTS = [
  "sitio-erp-shadow-hack.js",
  "sitio-erp-sync.js",
  "support.js",
  "image-slot.js",
  "mm-marcas.js",
  "mm-menu.js",
  "mm-ui.js",
];

/** Stylesheets del sitio (design system compartido). */
const STYLESHEETS = [
  "mm-tokens.css",
  "mm-base.css",
  "mm-components.css",
];

/** Rewrites de URL limpia → archivo real. */
const RUTAS = [
  ["inicio", "Marilia Magazine.dc.html"],
  ["catalogo", "Catalogo.dc.html"],
  ["producto", "Producto.dc.html"],
  ["privacidad", "Privacidad.dc.html"],
];

const VERSION = process.env.BUILD_VERSION || String(Date.now());

async function limpiar() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });
}

/** Todas las rutas `uploads/...` mencionadas en un texto. */
function assetsMencionados(texto) {
  const encontrados = new Set();
  const re = /(?:\.\/)?uploads\/[A-Za-z0-9_\-./%()' ]+?\.(?:webp|png|jpe?g|gif|svg|avif|mp4|webm)/gi;
  for (const m of texto.matchAll(re)) {
    let ruta = m[0].replace(/^\.\//, "");
    try { ruta = decodeURIComponent(ruta); } catch { /* ya venía sin encodear */ }
    encontrados.add(ruta);
  }
  return encontrados;
}

/** Agrega ?v=<version> a los <script src> y <link href="*.css"> locales para
 * romper el cache del navegador entre deploys. */
function versionarAssets(html) {
  return html
    .replace(
      /(<script[^>]*\ssrc=")(\.\/)?([A-Za-z0-9_\-.]+\.js)(")/g,
      (_t, pre, punto, archivo, post) => `${pre}${punto ?? ""}${archivo}?v=${VERSION}${post}`
    )
    .replace(
      /(<link[^>]*\shref=")(\.\/)?([A-Za-z0-9_\-.]+\.css)(")/g,
      (_t, pre, punto, archivo, post) => `${pre}${punto ?? ""}${archivo}?v=${VERSION}${post}`
    );
}

const HTACCESS = `# Marilia Magazine — configuración para Hostinger (Apache / LiteSpeed)
# Generado por scripts/build-hostinger.mjs. No editar a mano: se pisa en el
# próximo build.

Options -Indexes
DirectoryIndex "Marilia Magazine.dc.html" index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Forzar HTTPS. La segunda condición evita el loop de redirecciones cuando
  # el SSL lo termina un proxy adelante (caso normal en Hostinger).
  # Si el dominio todavía no tiene certificado, comentá estas tres líneas.
  RewriteCond %{HTTPS} !=on
  RewriteCond %{HTTP:X-Forwarded-Proto} !=https
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]

  # URLs limpias
${RUTAS.map(([url, archivo]) => `  RewriteRule ^${url}/?$ "${archivo}" [L]`).join("\n")}

  # /algo → /algo.html si el archivo existe
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME}.html -f
  RewriteRule ^(.+?)/?$ $1.html [L]
</IfModule>

ErrorDocument 404 /404.html

# ── Compresión ─────────────────────────────────────────────────────────────
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css text/xml
  AddOutputFilterByType DEFLATE application/javascript application/x-javascript
  AddOutputFilterByType DEFLATE application/json application/xml
  AddOutputFilterByType DEFLATE image/svg+xml
</IfModule>

# ── Caché ──────────────────────────────────────────────────────────────────
# El HTML no se cachea: es lo que trae la versión nueva de los scripts.
# Los .js llevan ?v= en el build, así que pueden cachearse fuerte.
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresDefault                        "access plus 1 month"
  ExpiresByType text/html               "access plus 0 seconds"
  ExpiresByType image/webp              "access plus 1 year"
  ExpiresByType image/png               "access plus 1 year"
  ExpiresByType image/jpeg              "access plus 1 year"
  ExpiresByType image/svg+xml           "access plus 1 year"
  ExpiresByType text/css                "access plus 1 year"
  ExpiresByType application/javascript  "access plus 1 year"
  ExpiresByType font/woff2              "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\\.(html)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
  <FilesMatch "\\.(webp|png|jpe?g|svg|woff2?)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  # El sitio consulta Supabase desde el navegador; nada de esto lo bloquea.
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# ── MIME ───────────────────────────────────────────────────────────────────
<IfModule mod_mime.c>
  AddType image/webp  .webp
  AddType image/avif  .avif
  AddType font/woff2  .woff2
</IfModule>
`;

const PAGINA_404 = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Página no encontrada — Marilia Magazine</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#F7F3E6; color:#25251F; font-family:'Montserrat',sans-serif; text-align:center; padding:24px; }
  .w { max-width:380px }
  .logo { font:400 44px/1 'Cormorant Garamond',serif; font-style:italic; margin-bottom:6px }
  .sub { font-size:8.5px; letter-spacing:.52em; text-transform:uppercase; color:#8A7F6A;
    padding-left:.52em; margin-bottom:34px }
  .rule { width:40px; height:1px; background:#D4AF37; margin:0 auto 28px }
  p { font:400 12.5px/1.8 'Montserrat',sans-serif; color:#4A443A; margin:0 0 22px }
  a { display:inline-block; font:500 10px/1 'Montserrat',sans-serif; letter-spacing:.28em;
    text-transform:uppercase; color:#25251F; text-decoration:none;
    border:1px solid #D4AF37; padding:15px 26px; transition:background .4s ease, color .4s ease }
  a:hover { background:#25251F; color:#F7F3E6; border-color:#25251F }
</style>
</head>
<body>
  <div class="w">
    <div class="logo">Marilia</div>
    <div class="sub">Magazine</div>
    <div class="rule"></div>
    <p>No encontramos esta página.</p>
    <a href="/inicio">Volver al inicio</a>
  </div>
</body>
</html>
`;

async function main() {
  await limpiar();

  const assets = new Set();
  let paginasCopiadas = 0;

  for (const nombre of PAGINAS) {
    const origen = path.join(raiz, nombre);
    let html;
    try {
      html = await fs.readFile(origen, "utf8");
    } catch {
      console.warn(`· falta ${nombre}, se saltea`);
      continue;
    }
    for (const a of assetsMencionados(html)) assets.add(a);
    await fs.writeFile(path.join(dist, nombre), versionarAssets(html), "utf8");
    paginasCopiadas++;
  }

  for (const nombre of STYLESHEETS) {
    const origen = path.join(raiz, nombre);
    try {
      const css = await fs.readFile(origen, "utf8");
      await fs.writeFile(path.join(dist, nombre), css, "utf8");
    } catch {
      console.warn(`· falta ${nombre}, se saltea`);
    }
  }

  for (const nombre of SCRIPTS) {
    const origen = path.join(raiz, nombre);
    try {
      const js = await fs.readFile(origen, "utf8");
      for (const a of assetsMencionados(js)) assets.add(a);
      await fs.writeFile(path.join(dist, nombre), js, "utf8");
    } catch {
      console.warn(`· falta ${nombre}, se saltea`);
    }
  }

  let bytes = 0;
  let copiados = 0;
  const faltantes = [];
  for (const rel of assets) {
    const origen = path.join(raiz, rel);
    const destino = path.join(dist, rel);
    try {
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.copyFile(origen, destino);
      bytes += (await fs.stat(destino)).size;
      copiados++;
    } catch {
      faltantes.push(rel);
    }
  }

  await fs.writeFile(path.join(dist, ".htaccess"), HTACCESS, "utf8");
  await fs.writeFile(path.join(dist, "404.html"), PAGINA_404, "utf8");

  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(`\ndist/ listo`);
  console.log(`  ${paginasCopiadas} páginas · ${SCRIPTS.length} scripts · ${STYLESHEETS.length} stylesheets · ${copiados} assets (${mb} MB)`);
  console.log(`  versión de cache-busting: ${VERSION}`);
  if (faltantes.length > 0) {
    console.log(`\n  referencias rotas (${faltantes.length}) — el HTML las pide y no están en el repo:`);
    for (const f of faltantes) console.log(`    · ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
