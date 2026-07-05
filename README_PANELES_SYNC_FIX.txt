M17LIV3 - Corrección sincronización paneles

Cambios:
- Al guardar enlaces, la app incluye owner_id del usuario autenticado.
- Ya no depende solo del almacenamiento local del navegador.
- Los enlaces se cargan online desde Supabase también en móvil.
- Se mantiene caché local solo como respaldo.
- No requiere SQL nuevo si ya ejecutaste la tabla panel_links.
