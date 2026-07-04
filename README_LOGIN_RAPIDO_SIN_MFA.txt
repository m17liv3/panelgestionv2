M17LIV3 - Login rápido sin Google Authenticator obligatorio

Qué cambia:
- La app ya no pide Google Authenticator para entrar.
- Se mantiene login con email + contraseña de Supabase.
- La sesión puede quedar recordada en el dispositivo.
- Cerrar sesión sigue borrando la sesión guardada.

IMPORTANTE:
Para que Supabase permita leer/editar datos sin aal2, ejecuta:
SQL_LOGIN_RAPIDO_SIN_MFA_OBLIGATORIO.txt

No borra datos.
No cambia clientes, renovaciones ni finanzas.
Solo cambia las políticas RLS para quitar el requisito aal2.
