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

ACTUALIZACION - PLANTILLAS SERIES
---------------------------------
Se ha integrado el nuevo apartado "Plantillas Series" dentro del menu del panel.
Incluye busqueda de series por TMDB, carga automatica de datos, galeria de posters, ajuste de portada, descarga JPEG, subida a imgBB y copia de enlace.

El generador de series utiliza la misma clave TMDB y la misma clave imgBB configuradas en config.js.


Actualizacion revision preview series:
- Corregida la previsualizacion de Plantillas Series para que el canvas ocupe todo el marco 16:9.
- Ocultado correctamente el input de subida de logo en Plantillas Series.


PWA / MODO APP INSTALABLE
-------------------------
Esta versión incluye modo PWA:
- manifest.webmanifest
- sw.js
- iconos en assets/icons/
- botón "Instalar como app" dentro del menú.

Para que funcione correctamente debe estar publicada con HTTPS. GitHub Pages ya usa HTTPS.
En Android/Chrome puede aparecer el botón de instalación automáticamente.
En iPhone/iPad hay que abrir la web en Safari y usar Compartir > Añadir a pantalla de inicio.

Nota: la app podrá abrirse como app instalada, pero las funciones que dependen de Internet
(TMDB, imgBB, cartelera online, CDN de Excel, etc.) seguirán necesitando conexión.


Actualizacion: se ha añadido el modulo de mensajes rapidos para clientes. Permite copiar textos para WhatsApp/Telegram sin guardar telefonos, incluyendo datos de acceso, fecha de expiracion y aviso de renovacion 15 dias antes.


Actualización: los clientes se muestran ordenados por fecha de expiración, de más próxima a más lejana. Los clientes sin fecha quedan al final.


Actualización Panel APP IBO:
- Añadido nuevo apartado "Panel APP IBO" en el menú.
- Integra https://damaplay.top/panelr/m17live/ mediante iframe.
- Incluye botón "Abrir fuera" por si el panel externo bloquea la vista integrada.
- Actualizada versión de service worker para forzar refresco de PWA.
