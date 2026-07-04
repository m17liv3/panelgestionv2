M17LIV3 - Generador de cartelera diaria

Cambios:
- En Cartelera del día se añade "Crear cartelera diaria".
- Permite pegar el texto diario de eventos.
- Genera una imagen horizontal 4K estilo neon mediante canvas.
- Permite subirla directamente al enlace fijo HORARIOS MUNDIAL / imagen_actual.jpg.
- No usa ChatGPT ni APIs de imagen externas.
- No requiere SQL nuevo.

Notas:
- La imagen se genera en el navegador.
- El botón "Subir a HORARIOS MUNDIAL" usa Supabase Storage y la ruta fija imagen_actual.jpg.
