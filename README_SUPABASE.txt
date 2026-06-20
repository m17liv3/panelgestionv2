M17LIV3 Web-App conectada a Supabase

Cambios principales:
- Los clientes ya no se guardan en localStorage si useSupabase=true.
- Alta, edicion, borrado, renovacion e importacion Excel guardan directamente en la tabla public.clientes.
- El login ahora usa Supabase Auth con email y contrasena.
- Exportar Excel sigue funcionando como copia de seguridad.

Antes de usar:
1. La tabla public.clientes debe existir.
2. RLS debe estar activo.
3. Deben existir policies para authenticated usando owner_id = auth.uid().
4. Debes iniciar sesion con el email y contrasena del usuario creado en Supabase Auth.

Campos usados en la tabla clientes:
- id uuid
- nombre text
- usuario text
- password text
- servicio text
- expiracion date
- apps text
- notas text
- created_at timestamptz
- updated_at timestamptz
- owner_id uuid default auth.uid()

Importar Excel:
- Para clientes nuevos deja ID vacio.
- Si exportas Excel desde esta version, el ID sera el uuid de Supabase y podras actualizar esos clientes reimportando el archivo.

Notas:
- La clave incluida en config.js es publishable/public. No uses service_role ni secret keys en GitHub Pages.
- Si subes cambios y la PWA sigue mostrando version antigua, cierra la app, borra cache o espera a que el service worker actualice.

AVISO DE RENOVACIÓN 15 DÍAS
Antes de usar esta versión, añade estas columnas en Supabase > SQL Editor:

alter table public.clientes
add column if not exists aviso_renovacion_enviado boolean default false,
add column if not exists aviso_renovacion_fecha timestamptz,
add column if not exists aviso_renovacion_expiracion date;

Estas columnas permiten guardar si un cliente que expira pronto ya ha sido avisado. Al renovar o cambiar la fecha de expiración, el aviso se reinicia.
