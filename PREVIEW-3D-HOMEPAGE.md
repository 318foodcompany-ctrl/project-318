# 3D Homepage Preview

Open `/preview/3d-home.html` on a local or preview deployment. This route is intentionally absent from primary navigation and the sitemap, declares `noindex`, and does not modify `index.html`.

The preview lazy-loads Three.js after the page becomes idle. Reduced-motion users, narrow/low-core devices, browsers without WebGL, and failed CDN loads receive the complete semantic page over a CSS-rendered abstract catering-table fallback. Rendering pauses when the page or scene is not visible, pixel ratio is capped, geometry is procedural, and no model or texture payload is downloaded.

For local review, serve the repository root over HTTP and open `http://localhost:PORT/preview/3d-home.html`. Important quote, menu, phone, and navigation links continue to use existing production-compatible relative routes.
