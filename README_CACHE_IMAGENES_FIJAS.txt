M17LIV3 - Caché reducida en imágenes fijas

Cambios:
- Las subidas a imágenes fijas usan cacheControl 1 en vez de 60.
- Película 3 sigue subiendo directamente a pelicula_recomendada_3.jpg.
- Tras subir Película 3, el estado muestra una URL con ?v=timestamp para comprobar la imagen sin caché.
- No requiere SQL nuevo.

Nota:
Si se abre el enlace fijo sin ?v=..., el navegador/CDN puede tardar un poco en refrescar una versión ya cacheada.
