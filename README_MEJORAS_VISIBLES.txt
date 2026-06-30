M17LIV3 - Mejoras visibles reforzadas

Corrección:
- Se añade Avisos automáticos como entrada visible en el menú.
- Las gráficas tienen título visible en Balance / finanzas.
- La sección de etiquetas en el formulario del cliente es más visible.
- Se refuerza caché/PWA para que cargue la versión nueva.

SQL necesario solo para etiquetas:
alter table public.clientes
add column if not exists etiquetas text[] default '{}';

update public.clientes
set etiquetas = '{}'
where etiquetas is null;
