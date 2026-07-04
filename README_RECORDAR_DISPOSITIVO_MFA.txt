M17LIV3 - Recordar dispositivo con Google Authenticator

Cambio:
- Se añade "Recordar este dispositivo" en login y Google Authenticator.
- Si la sesión de Supabase sigue válida y está en nivel MFA verificado (aal2), la app entra sola al abrirla.
- Si Supabase pierde el nivel aal2, pedirá Google Authenticator una vez por seguridad.
- Cerrar sesión desde el menú elimina el dispositivo recordado.

No requiere SQL nuevo.
