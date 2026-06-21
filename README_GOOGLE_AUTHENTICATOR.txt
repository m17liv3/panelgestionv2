M17LIV3 - Google Authenticator / MFA

NOVEDADES:
- Despues del login con Supabase, aparece verificacion con Google Authenticator.
- Si no hay autenticador configurado, la app muestra QR para configurarlo.
- Boton "Pegar codigo" para pegar el codigo copiado desde Google Authenticator.
- Menu nuevo: Seguridad Google Authenticator, para revisar factores y añadir otro autenticador.
- No requiere SQL para funcionar en la interfaz.

IMPORTANTE:
- Para seguridad completa a nivel base de datos, ejecuta SQL_MFA_RLS_RECOMENDADO.txt despues de comprobar que puedes entrar con el codigo MFA.
- Si ejecutas ese SQL, Supabase exigira una sesion aal2 para leer/modificar clientes, renovaciones y sorteos.
- Si pierdes acceso a Google Authenticator, tendras que gestionar el MFA desde Supabase.

PASOS RECOMENDADOS:
1. Sube todos los archivos a GitHub.
2. Abre la app, inicia sesion con Supabase.
3. Escanea el QR con Google Authenticator.
4. Copia o escribe el codigo de 6 digitos.
5. Pulsa Activar y entrar.
6. Cierra sesion y vuelve a entrar para comprobar que pide codigo.
7. Cuando todo funcione, ejecuta SQL_MFA_RLS_RECOMENDADO.txt si quieres blindar tambien la base de datos.
