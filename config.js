// Configuracion principal de M17LIV3 Web-App
// AVISO: en una web-app estatica estos datos siguen siendo visibles en el navegador.
// Para seguridad real, mueve login y claves API a un backend/servidor.
window.M17_CONFIG = {
  adminUser: 'admin',
  adminPassHash: '4dac92e5d0a207731ca0614e3143de433c18c1f3a6002be87be300ef115c7d0d',
  cartBinId: '6a330946da38895dfed2f865',
  cartKey: '$2a$10$9ikO.ZJ.tHgDUL0ddUaO.eNMFAT5S6FGO.Ub6rJKwpIsE/Mr/L2xG',
  cartImgBBKey: '8cb8483f3601ee9ae19b976b9f63d1fa',
  tmdbKey: '6b8e3eaa1a03ebb45642e9531d8a76d2',
  templateImgBBKey: '8cb8483f3601ee9ae19b976b9f63d1fa',
  useSupabase: true,
  supabaseUrl: 'https://qjbnjhojwhcndcfjcyrc.supabase.co',
  supabaseKey: 'sb_publishable_HxThHPoZaGm8YgirIX4BQQ_1Sjs907O',
  supabaseTable: 'clientes',
  supabaseRenewalsTable: 'renovaciones',
  fixedImageBucket: 'cartelera',
  fixedImagePath: 'imagen_actual.jpg',
  mfaEnabled: false,
  mfaForceSetup: false
};
