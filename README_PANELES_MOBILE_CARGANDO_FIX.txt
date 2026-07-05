M17LIV3 - Corrección paneles en móvil

Cambios:
- Corrige un fallo de inicialización que podía dejar los botones en "Cargando..." en móvil.
- Los botones ya arrancan con estado seguro: Abrir panel / Sin enlace.
- La app reintenta cargar enlaces online varias veces al entrar.
- Al tocar un panel, vuelve a consultar Supabase antes de abrirlo.
- No requiere SQL nuevo si ya existe panel_links.
