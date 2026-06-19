M17LIV3 Web-App - version modificada

Archivos principales:
- index.html: estructura de la app
- styles.css: estilos separados
- script.js: funciones JavaScript separadas
- config.js: configuracion principal
- assets/logo.png: logo extraido del HTML original

Cambios realizados:
1. Separado el codigo en HTML, CSS y JavaScript.
2. Extraido el logo base64 a assets/logo.png, reduciendo mucho el peso del index.html.
3. Corregido el cierre de sesion para ocultar realmente la app.
4. Corregido el overlay de la cartelera para que se abra/cierre igual que el resto de paneles.
5. Evitado pintar texto de cartelera con innerHTML en la vista previa.
6. Cambiada la contrasena visible por hash SHA-256 en config.js.

Aviso importante de seguridad:
Esta sigue siendo una web-app estatica. Cualquier clave API incluida en config.js sigue pudiendo verse desde el navegador si publicas la web.
Para seguridad real, el login y las claves de JsonBin/ImgBB deberian moverse a un backend/servidor.

Para probar:
- Abre index.html en el navegador.
- El usuario y contrasena son los mismos que en tu version original.

Para cambiar la contrasena:
- Hay que cambiar adminPassHash en config.js por el SHA-256 de la nueva contrasena.


Actualizacion nueva:
- Integrado el generador de Plantillas Peliculas dentro del propio index.html.
- Mantiene busqueda TMDB, galeria de posters, ajuste de portada, logo, descarga JPEG, subida a imgBB y copiar enlace.
- Las claves TMDB/imgBB estan ahora en config.js, visibles si se publica como web estatica.
