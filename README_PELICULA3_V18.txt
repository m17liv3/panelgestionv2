M17LIV3 · Película 3 sin retraso de caché · V18

Esta versión mantiene la subida en Supabase Storage, pero el enlace que se copia para Película 3 apunta a una Edge Function pública que devuelve siempre el JPG más reciente con caché desactivada.

Antes de usar el nuevo enlace, despliega la función pelicula3-live incluida en el paquete independiente.

URL final para la app de clientes:
https://qjbnjhojwhcndcfjcyrc.supabase.co/functions/v1/pelicula3-live/pelicula3.jpg

La URL termina en .jpg y responde con Content-Type image/jpeg.
