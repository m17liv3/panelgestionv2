// google-authenticator-mfa-v1.3.1-7-links-fijos-fix
var CONFIG = window.M17_CONFIG || {};
var ADMIN_USER = CONFIG.adminUser || 'admin';
var ADMIN_PASS_HASH = CONFIG.adminPassHash || '';
var USE_SUPABASE = !!(CONFIG.useSupabase && CONFIG.supabaseUrl && CONFIG.supabaseKey);
var SUPABASE_TABLE = CONFIG.supabaseTable || 'clientes';
var supabaseDb = null;
var APPS = [
  { name: 'M17LIV3', needsMac: false, needsCode: false },
  { name: 'IBO PLAYER', needsMac: true, needsCode: true },
  { name: 'KDSPLAYER', needsMac: false, needsCode: false },
  { name: 'DEADPLAYER25', needsMac: false, needsCode: false },
  { name: 'SHAMELTV', needsMac: true, needsCode: true },
  { name: 'DEADSMART', needsMac: false, needsCode: false },
  { name: 'NANOMID', needsMac: false, needsCode: false },
  { name: 'VUPLAYER', needsMac: true, needsCode: true },
  { name: 'OTRA APP NO CONOCIDA', needsMac: false, needsCode: false, isOther: true }
];
var clients = [];
if (!USE_SUPABASE) {
  try { clients = JSON.parse(localStorage.getItem('m17_clients') || '[]'); } catch(e) { clients = []; }
}
var selectedApps = [];
var deleteTargetId = null;
var renewTargetId = null;
var renewMonths = 1;
var messageTargetId = null;
var filterSvc = '';
var filterSt = '';
var activeTagFilter = '';
var CLIENT_TAG_OPTIONS = ['CONTESTA RÁPIDO Y PAGA','NO CONTESTA AL RENOVAR'];
var hasSelectedClientFilter = false;
var showFilters = false;
var raffles = [];
var lastRaffleResult = null;
var SUPABASE_RAFFLES_TABLE = CONFIG.supabaseRafflesTable || 'sorteos';
var SUPABASE_RENEWALS_TABLE = CONFIG.supabaseRenewalsTable || 'renovaciones';
var SUPABASE_FINANCE_TABLE = CONFIG.supabaseFinanceTable || 'finanzas_movimientos';
var financeMovements = [];
var SUPABASE_MESSAGE_TEMPLATES_TABLE = CONFIG.supabaseMessageTemplatesTable || 'message_templates';
var renewals = [];
var BACKUP_LAST_KEY = 'm17_last_backup_at';
var BACKUP_REMINDER_DAYS = 7;
var MFA_ENABLED = USE_SUPABASE && CONFIG.mfaEnabled !== false;
var MFA_FORCE_SETUP = CONFIG.mfaForceSetup !== false;
var mfaMode = '';
var mfaFactorId = '';
var mfaFactorName = '';
var mfaEnrollmentData = null;
var REMEMBER_DEVICE_KEY = 'm17liv3_remember_device';
var REMEMBER_DEVICE_EMAIL_KEY = 'm17liv3_remember_email';
var autoSessionTried = false;

function initSupabase() {
  if (!USE_SUPABASE) return null;
  if (supabaseDb) return supabaseDb;
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('No se ha podido cargar Supabase. Revisa la conexión a Internet.');
  }
  supabaseDb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'm17liv3-supabase-auth'
    }
  });
  return supabaseDb;
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());
}

function parseAppsFromDb(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    var parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) {
    return String(value).split(' | ').filter(Boolean).map(function(a){
      var obj = {};
      var mm = a.match(/MAC:([^\s]+)/); var cm = a.match(/CODE:([^\s]+)/);
      obj.mac = mm ? mm[1] : '';
      obj.code = cm ? cm[1] : '';
      obj.name = a.replace(/\s*MAC:[^\s]+/,'').replace(/\s*CODE:[^\s]+/,'').replace(/\s*\(.*?\)/,'').trim();
      var cu = a.match(/\(([^)]+)\)/); if (cu) obj.customName = cu[1];
      return obj;
    });
  }
}


// ========== ETIQUETAS CLIENTES ==========
function normalizeClientTags(value) {
  if (!value) return [];
  var arr = Array.isArray(value) ? value : String(value).split(/[,|]/);
  var seen = {};
  return arr.map(function(t){ return String(t || '').trim(); })
    .filter(Boolean)
    .filter(function(t){
      var k = t.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
}

function clientTagsHtml(c) {
  var tags = normalizeClientTags(c && c.tags);
  if (!tags.length) return '';
  return '<div class="clientTags">' + tags.map(function(t){
    return '<button type="button" class="clientTag" onclick="setTagFilter(&quot;'+esc(t)+'&quot;)">'+esc(t)+'</button>';
  }).join('') + '</div>';
}

function renderClientTagsInput(tags) {
  var box = document.getElementById('clientTagsEditor');
  var custom = document.getElementById('fCustomTags');
  if (!box) return;
  tags = normalizeClientTags(tags);
  var lower = tags.map(function(t){ return t.toLowerCase(); });
  box.innerHTML = CLIENT_TAG_OPTIONS.map(function(t){
    var selected = lower.indexOf(t.toLowerCase()) >= 0;
    return '<button type="button" class="tagPick '+(selected?'selected':'')+'" data-tag="'+esc(t)+'" onclick="toggleClientTagPick(this)">'+esc(t)+'</button>';
  }).join('');
  var extras = tags.filter(function(t){
    return CLIENT_TAG_OPTIONS.map(function(x){return x.toLowerCase();}).indexOf(t.toLowerCase()) < 0;
  });
  if (custom) custom.value = extras.join(', ');
}

function toggleClientTagPick(btn) {
  if (!btn) return;
  btn.classList.toggle('selected');
}

function getSelectedClientTags() {
  var tags = [];
  document.querySelectorAll('#clientTagsEditor .tagPick.selected').forEach(function(btn){
    tags.push(btn.dataset.tag || btn.textContent || '');
  });
  var custom = document.getElementById('fCustomTags');
  if (custom && custom.value) tags = tags.concat(custom.value.split(','));
  return normalizeClientTags(tags);
}

function setTagFilter(tag) {
  activeTagFilter = tag || '';
  hasSelectedClientFilter = true;
  renderTagFilterBar();
  renderCards();
  var sc = document.getElementById('mainScroll');
  if (sc) sc.scrollTo({top: 200, behavior: 'smooth'});
}

function clearTagFilter() {
  activeTagFilter = '';
  renderTagFilterBar();
  renderCards();
}

function allClientTags() {
  var tags = [];
  (clients || []).forEach(function(c){ tags = tags.concat(normalizeClientTags(c.tags)); });
  return normalizeClientTags(tags).sort(function(a,b){ return a.localeCompare(b); });
}

function renderTagFilterBar() {
  var box = document.getElementById('tagFilterBar');
  if (!box) return;
  var tags = allClientTags();
  if (!tags.length) {
    box.innerHTML = '<span class="tagFilterTitle">Etiquetas</span><span class="tagFilterEmpty">Aún no hay etiquetas creadas</span>';
    box.style.display = 'flex';
    return;
  }
  box.style.display = 'flex';
  box.innerHTML =
    '<span class="tagFilterTitle">Etiquetas</span>' +
    tags.map(function(t){
      return '<button class="tagFilterChip '+(activeTagFilter===t?'active':'')+'" onclick="setTagFilter(&quot;'+esc(t)+'&quot;)">'+esc(t)+'</button>';
    }).join('') +
    (activeTagFilter ? '<button class="tagFilterClear" onclick="clearTagFilter()">Quitar etiqueta</button>' : '');
}
// ========== FIN ETIQUETAS CLIENTES ==========


function dbRowToClient(row) {
  return {
    id: row.id,
    name: row.nombre || '',
    user: row.usuario || '',
    pass: row.password || '',
    service: row.servicio || 'TODO',
    expiry: row.expiracion || '',
    notes: row.notas || '',
    tags: normalizeClientTags(row.etiquetas || row.tags || ''),
    apps: parseAppsFromDb(row.apps),
    avisoRenovacionEnviado: !!row.aviso_renovacion_enviado,
    avisoRenovacionFecha: row.aviso_renovacion_fecha || '',
    avisoRenovacionExpiracion: row.aviso_renovacion_expiracion || '',
    avisoRenovacionContestado: !!row.aviso_renovacion_contestado,
    avisoRenovacionContestadoFecha: row.aviso_renovacion_contestado_fecha || '',
    avisoRenovacionContestadoExpiracion: row.aviso_renovacion_contestado_expiracion || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || ''
  };
}

function clientToDbPayload(c) {
  return {
    nombre: c.name || '',
    usuario: c.user || '',
    password: c.pass || '',
    servicio: c.service || 'TODO',
    expiracion: c.expiry || null,
    apps: JSON.stringify(c.apps || []),
    notas: c.notes || '',
    etiquetas: normalizeClientTags(c.tags || []),
    aviso_renovacion_enviado: !!c.avisoRenovacionEnviado,
    aviso_renovacion_fecha: c.avisoRenovacionFecha || null,
    aviso_renovacion_expiracion: c.avisoRenovacionExpiracion || null,
    aviso_renovacion_contestado: !!c.avisoRenovacionContestado,
    aviso_renovacion_contestado_fecha: c.avisoRenovacionContestadoFecha || null,
    aviso_renovacion_contestado_expiracion: c.avisoRenovacionContestadoExpiracion || null,
    updated_at: new Date().toISOString()
  };
}

async function loadClientsFromStore() {
  if (!USE_SUPABASE) {
    try { clients = JSON.parse(localStorage.getItem('m17_clients') || '[]'); } catch(e) { clients = []; }
    clients = sortClientsByExpiryAsc(clients);
    return clients;
  }
  var db = initSupabase();
  var result = await db.from(SUPABASE_TABLE).select('*').order('created_at', { ascending: false });
  if (result.error) throw result.error;
  clients = sortClientsByExpiryAsc((result.data || []).map(dbRowToClient));
  return clients;
}

async function saveClientToStore(c) {
  if (!USE_SUPABASE) {
    if (!c.id) c.id = genId();
    return c;
  }
  var db = initSupabase();
  var payload = clientToDbPayload(c);
  var result;

  // Si el cliente trae un UUID existente, intentamos actualizarlo.
  // Si ese ID no existe en Supabase o no pertenece al usuario actual,
  // Supabase devuelve 0 filas. En ese caso lo tratamos como cliente nuevo.
  if (c.id && isUuid(c.id)) {
    result = await db.from(SUPABASE_TABLE).update(payload).eq('id', c.id).select('*').maybeSingle();
    if (result.error) throw result.error;
    if (result.data) return dbRowToClient(result.data);
  }

  result = await db.from(SUPABASE_TABLE).insert(payload).select('*').single();
  if (result.error) throw result.error;
  return dbRowToClient(result.data);
}

async function deleteClientFromStore(id) {
  if (!USE_SUPABASE) return true;
  var db = initSupabase();
  var result = await db.from(SUPABASE_TABLE).delete().eq('id', id);
  if (result.error) throw result.error;
  return true;
}

async function deleteAllClientsFromStore() {
  if (!USE_SUPABASE) {
    clients = [];
    saveData();
    return true;
  }
  var db = initSupabase();
  // RLS limita el borrado a los clientes del usuario autenticado.
  // La condicion evita tener que conocer todos los IDs uno por uno.
  var result = await db.from(SUPABASE_TABLE)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (result.error) throw result.error;
  return true;
}


// ========== RECORDAR DISPOSITIVO / SESION RAPIDA ==========
function rememberDeviceWanted() {
  var loginCb = document.getElementById('rememberDeviceLogin');
  var mfaCb = document.getElementById('rememberDeviceMfa');
  if (mfaCb) return !!mfaCb.checked;
  if (loginCb) return !!loginCb.checked;
  return true;
}

function setRememberDevice(enabled, email) {
  try {
    if (enabled) {
      localStorage.setItem(REMEMBER_DEVICE_KEY, '1');
      if (email) localStorage.setItem(REMEMBER_DEVICE_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_DEVICE_KEY);
      localStorage.removeItem(REMEMBER_DEVICE_EMAIL_KEY);
    }
  } catch(e) {}
}

function isRememberDeviceEnabled() {
  try { return localStorage.getItem(REMEMBER_DEVICE_KEY) === '1'; } catch(e) { return false; }
}

function syncRememberCheckboxes() {
  var remembered = isRememberDeviceEnabled();
  var loginCb = document.getElementById('rememberDeviceLogin');
  var mfaCb = document.getElementById('rememberDeviceMfa');
  if (loginCb) loginCb.checked = remembered || true;
  if (mfaCb) mfaCb.checked = loginCb ? loginCb.checked : true;
  try {
    var email = localStorage.getItem(REMEMBER_DEVICE_EMAIL_KEY) || '';
    var lu = document.getElementById('lUser');
    if (email && lu && !lu.value) lu.value = email;
  } catch(e) {}
}

function setLoginLoading(message) {
  var err = document.getElementById('loginErr');
  if (!err) return;
  err.textContent = message || 'Comprobando sesión guardada...';
  err.style.display = 'block';
}

function clearLoginLoading() {
  var err = document.getElementById('loginErr');
  if (!err) return;
  err.style.display = 'none';
}

async function checkMfaAal2() {
  var db = initSupabase();
  if (!MFA_ENABLED || !db.auth || !db.auth.mfa) return true;
  var aal = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) throw aal.error;
  return !!(aal.data && aal.data.currentLevel === 'aal2');
}

async function tryRestoreSupabaseSession() {
  if (!USE_SUPABASE || autoSessionTried) return false;
  autoSessionTried = true;

  try {
    syncRememberCheckboxes();
    if (!isRememberDeviceEnabled()) return false;

    var db = initSupabase();
    if (!db || !db.auth || !db.auth.getSession) return false;

    setLoginLoading('Comprobando sesión guardada...');
    var sessionRes = await db.auth.getSession();
    if (sessionRes.error) throw sessionRes.error;

    var session = sessionRes.data && sessionRes.data.session;
    if (!session) {
      clearLoginLoading();
      return false;
    }

    if (MFA_ENABLED) {
      var aal2 = await checkMfaAal2();
      if (!aal2) {
        clearLoginLoading();
        setLoginLoading('Sesión guardada encontrada. Por seguridad, introduce Google Authenticator una vez.');
        setTimeout(clearLoginLoading, 3500);
        return false;
      }
    }

    await completeSupabaseLogin(true);
    return true;
  } catch (ex) {
    clearLoginLoading();
    return false;
  }
}
// ========== FIN RECORDAR DISPOSITIVO ==========

function showAppAfterLogin() {
  var lp = document.getElementById('loginPage');
  var ap = document.getElementById('appPage');
  lp.style.display = 'none';
  ap.classList.add('active');
  ap.style.display = 'flex';
  ap.style.flexDirection = 'column';
  ap.style.height = '100vh';
  renderCards();
  updateStats();
  updateBackupReminder();
  renderTagFilterBar();
}


function setMfaVisible(visible) {
  var mp = document.getElementById('mfaPage');
  var lp = document.getElementById('loginPage');
  var ap = document.getElementById('appPage');
  if (mp) mp.style.display = visible ? 'flex' : 'none';
  if (visible) {
    if (lp) lp.style.display = 'none';
    if (ap) { ap.classList.remove('active'); ap.style.display = 'none'; }
    setTimeout(function(){ var input = document.getElementById('mfaCode'); if (input) input.focus(); }, 80);
  }
}

function setMfaError(message) {
  var err = document.getElementById('mfaErr');
  if (!err) return;
  if (!message) {
    err.style.display = 'none';
    err.textContent = '';
  } else {
    err.textContent = message;
    err.style.display = 'block';
  }
}

function normalizeMfaCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function setMfaCodeValue(value) {
  var input = document.getElementById('mfaCode');
  if (!input) return '';
  var code = normalizeMfaCode(value);
  input.value = code;
  return code;
}

function normalizeMfaQr(qr) {
  qr = String(qr || '');
  if (!qr) return '';
  if (qr.indexOf('<svg') === 0) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr);
  return qr;
}

function getVerifiedTotpFactors(factorsData) {
  factorsData = factorsData || {};
  var list = [];
  if (Array.isArray(factorsData.totp)) list = factorsData.totp;
  else if (Array.isArray(factorsData.all)) list = factorsData.all.filter(function(f){ return (f.factor_type || f.type) === 'totp'; });
  return list.filter(function(f){ return !f.status || f.status === 'verified'; });
}

async function completeSupabaseLogin(fromSavedSession) {
  try {
    var db = initSupabase();
    var userEmail = '';
    if (db && db.auth && db.auth.getUser) {
      var userRes = await db.auth.getUser();
      userEmail = userRes && userRes.data && userRes.data.user && userRes.data.user.email ? userRes.data.user.email : '';
    }
    setRememberDevice(rememberDeviceWanted(), userEmail);
  } catch(e) {}

  await loadClientsFromStore();
  await loadRenewals(false);
  setMfaVisible(false);
  clearLoginLoading();
  showAppAfterLogin();
  if (typeof showToast === 'function') showToast(fromSavedSession ? 'Entrando con sesión guardada' : 'Conectado a Supabase');
}

async function handleMfaAfterPasswordLogin() {
  var db = initSupabase();
  if (!db.auth || !db.auth.mfa) {
    await completeSupabaseLogin();
    return;
  }
  var aal = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) throw aal.error;

  if (aal.data && aal.data.currentLevel === 'aal2') {
    await completeSupabaseLogin();
    return;
  }

  if (aal.data && aal.data.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') {
    await startMfaChallengeScreen();
    return;
  }

  if (MFA_FORCE_SETUP) {
    await startMfaEnrollmentScreen();
    return;
  }

  await completeSupabaseLogin();
}

async function startMfaChallengeScreen() {
  var db = initSupabase();
  var factors = await db.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  var totps = getVerifiedTotpFactors(factors.data);
  if (!totps.length) {
    await startMfaEnrollmentScreen();
    return;
  }
  mfaMode = 'challenge';
  mfaFactorId = totps[0].id;
  mfaFactorName = totps[0].friendly_name || totps[0].friendlyName || 'Google Authenticator';
  mfaEnrollmentData = null;
  var title = document.getElementById('mfaTitle');
  var sub = document.getElementById('mfaSubtitle');
  var setup = document.getElementById('mfaSetupBox');
  var btn = document.getElementById('mfaVerifyBtn');
  if (title) title.textContent = 'Codigo Google Authenticator';
  if (sub) sub.textContent = 'Pega o escribe el codigo de 6 digitos para entrar en la app.';
  if (setup) setup.style.display = 'none';
  if (btn) btn.textContent = 'Verificar y entrar';
  var loginCb = document.getElementById('rememberDeviceLogin');
  var mfaCb = document.getElementById('rememberDeviceMfa');
  if (loginCb && mfaCb) mfaCb.checked = loginCb.checked;
  setMfaError('');
  setMfaCodeValue('');
  setMfaVisible(true);
}

async function startMfaEnrollmentScreen() {
  var db = initSupabase();
  var res = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'M17LIV3 Panel' });
  if (res.error) throw res.error;
  mfaMode = 'enroll';
  mfaFactorId = res.data.id;
  mfaFactorName = res.data.friendly_name || 'M17LIV3 Panel';
  mfaEnrollmentData = res.data;
  var title = document.getElementById('mfaTitle');
  var sub = document.getElementById('mfaSubtitle');
  var setup = document.getElementById('mfaSetupBox');
  var qr = document.getElementById('mfaQrImg');
  var secret = document.getElementById('mfaSecretText');
  var btn = document.getElementById('mfaVerifyBtn');
  if (title) title.textContent = 'Configurar Google Authenticator';
  if (sub) sub.textContent = 'Escanea el QR y despues pega el codigo de 6 digitos para activar la doble verificacion.';
  if (setup) setup.style.display = 'block';
  if (qr) qr.src = normalizeMfaQr(res.data.totp && res.data.totp.qr_code);
  if (secret) secret.textContent = (res.data.totp && res.data.totp.secret) ? res.data.totp.secret : '';
  if (btn) btn.textContent = 'Activar y entrar';
  var loginCb = document.getElementById('rememberDeviceLogin');
  var mfaCb = document.getElementById('rememberDeviceMfa');
  if (loginCb && mfaCb) mfaCb.checked = loginCb.checked;
  setMfaError('');
  setMfaCodeValue('');
  setMfaVisible(true);
}

async function submitMfaCode() {
  var db = initSupabase();
  var btn = document.getElementById('mfaVerifyBtn');
  var code = setMfaCodeValue(document.getElementById('mfaCode') ? document.getElementById('mfaCode').value : '');
  try {
    setMfaError('');
    if (code.length !== 6) throw new Error('Introduce un codigo de 6 digitos.');
    if (!mfaFactorId) throw new Error('No se ha encontrado el factor de autenticacion. Vuelve a iniciar sesion.');
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
    var challenge = await db.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challenge.error) throw challenge.error;
    var verify = await db.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.data.id, code: code });
    if (verify.error) throw verify.error;
    await completeSupabaseLogin();
  } catch (ex) {
    setMfaError(ex.message || 'Codigo incorrecto.');
    if (typeof showToast === 'function') showToast('Error MFA: ' + (ex.message || 'codigo incorrecto'), 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (btn) btn.textContent = (mfaMode === 'enroll') ? 'Activar y entrar' : 'Verificar y entrar';
  }
}

async function pasteMfaCode() {
  try {
    setMfaError('');
    if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('El navegador no permite pegar automaticamente. Mantén pulsado y pega el codigo manualmente.');
    var text = await navigator.clipboard.readText();
    var code = setMfaCodeValue(text);
    if (!code) throw new Error('No he encontrado ningun codigo numerico en el portapapeles.');
    if (typeof showToast === 'function') showToast('Codigo pegado');
  } catch (ex) {
    setMfaError(ex.message || 'No se pudo pegar el codigo.');
  }
}

async function copyMfaSecret() {
  var secret = document.getElementById('mfaSecretText') ? document.getElementById('mfaSecretText').textContent : '';
  if (!secret) return;
  try {
    await navigator.clipboard.writeText(secret);
    if (typeof showToast === 'function') showToast('Secreto copiado');
  } catch(e) {
    alert(secret);
  }
}

async function cancelMfaLogin() {
  setRememberDevice(false);
  try { if (USE_SUPABASE && supabaseDb) await supabaseDb.auth.signOut(); } catch(e) {}
  setMfaVisible(false);
  var lp = document.getElementById('loginPage');
  var ap = document.getElementById('appPage');
  if (lp) lp.style.display = 'flex';
  if (ap) { ap.classList.remove('active'); ap.style.display = 'none'; }
  mfaMode = '';
  mfaFactorId = '';
  mfaEnrollmentData = null;
}

async function openMfaSecurity() {
  closeSheet('menuSheet','menuOverlay');
  openSheet('mfaSecuritySheet','mfaSecurityOverlay');
  await renderMfaSecurityList();
}

async function renderMfaSecurityList() {
  var box = document.getElementById('mfaSecurityList');
  if (!box) return;
  box.innerHTML = '<div class="empty" style="padding:18px 10px">Cargando autenticadores...</div>';
  try {
    var db = initSupabase();
    var factors = await db.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    var totps = getVerifiedTotpFactors(factors.data);
    if (!totps.length) {
      box.innerHTML = '<div class="empty" style="padding:18px 10px">No hay autenticadores verificados.</div>';
      return;
    }
    box.innerHTML = totps.map(function(f, i){
      var name = f.friendly_name || f.friendlyName || ('Autenticador ' + (i+1));
      var created = f.created_at ? formatDate(f.created_at.slice(0,10)) : '';
      return '<div class="mfaFactorItem"><strong>&#128274; '+escapeHtml(name)+'</strong><span>Estado: verificado'+(created ? ' · Creado: '+created : '')+'</span></div>';
    }).join('');
  } catch(ex) {
    box.innerHTML = '<div class="formError" style="display:block">'+escapeHtml(ex.message || 'No se pudo cargar la seguridad MFA')+'</div>';
  }
}

async function startMfaEnrollmentFromSettings() {
  closeSheet('mfaSecuritySheet','mfaSecurityOverlay');
  await startMfaEnrollmentScreen();
}


async function sha256Text(text) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('El navegador no permite comprobar la clave en este contexto. Usa HTTPS o localhost.');
  }
  var data = new TextEncoder().encode(text);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.prototype.map.call(new Uint8Array(hashBuffer), function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
}

async function doLogin() {
  var btn = document.querySelector('#loginBox .btnMain');
  var err = document.getElementById('loginErr');
  try {
    var u = document.getElementById('lUser').value.trim();
    var p = document.getElementById('lPass').value;
    if (err) err.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

    if (USE_SUPABASE) {
      setRememberDevice(rememberDeviceWanted(), u);
      var db = initSupabase();
      var res = await db.auth.signInWithPassword({ email: u, password: p });
      if (res.error) throw res.error;
      if (MFA_ENABLED) {
        await handleMfaAfterPasswordLogin();
      } else {
        await completeSupabaseLogin();
      }
      return;
    }

    var okPass = ADMIN_PASS_HASH && (await sha256Text(p)) === ADMIN_PASS_HASH;
    if (u === ADMIN_USER && okPass) {
      showAppAfterLogin();
    } else {
      if(err) err.style.display = 'block';
    }
  } catch(ex) {
    if (err) {
      err.textContent = USE_SUPABASE ? 'Email o contraseña incorrectos' : 'Usuario o contrasena incorrectos';
      err.style.display = 'block';
    }
    if (typeof showToast === 'function') showToast('Error login: ' + ex.message, 'error');
    else alert('Error login: ' + ex.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}
document.addEventListener('DOMContentLoaded', function() {
  syncRememberCheckboxes();
  setTimeout(function(){ tryRestoreSupabaseSession(); }, 350);
  var lp = document.getElementById('lPass');
  var lu = document.getElementById('lUser');
  if(lp) lp.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  if(lu) lu.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  var mc = document.getElementById('mfaCode');
  if(mc) {
    mc.addEventListener('input', function(){ setMfaCodeValue(mc.value); });
    mc.addEventListener('keydown', function(e){ if(e.key==='Enter') submitMfaCode(); });
  }
});
async function doLogout() {
  closeSheet('menuSheet','menuOverlay');
  setRememberDevice(false);
  if (USE_SUPABASE && supabaseDb) {
    try { await supabaseDb.auth.signOut(); } catch(e) {}
  }
  clients = [];
  var mp = document.getElementById('mfaPage');
  if (mp) mp.style.display = 'none';
  var ap = document.getElementById('appPage');
  var lp = document.getElementById('loginPage');
  if (ap) {
    ap.classList.remove('active');
    ap.style.display = 'none';
  }
  if (lp) lp.style.display = 'flex';
  document.getElementById('lUser').value = '';
  document.getElementById('lPass').value = '';
}

function saveData() { if (!USE_SUPABASE) localStorage.setItem('m17_clients', JSON.stringify(clients)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function getStatus(expiry) {
  if (!expiry) return 'unknown';
  var now = new Date(); now.setHours(0,0,0,0);
  var diff = Math.floor((new Date(expiry) - now) / 86400000);
  if (diff < 0) return 'exp';
  if (diff <= 15) return 'warn';
  return 'ok';
}
function getDaysLeft(expiry) {
  var now = new Date(); now.setHours(0,0,0,0);
  return Math.floor((new Date(expiry) - now) / 86400000);
}
function statusBadge(expiry) {
  var s = getStatus(expiry);
  var diff = getDaysLeft(expiry);
  if (s === 'exp') return '<span class="badge badgeExp">Expirado</span>';
  if (s === 'warn') return '<span class="badge badgeWarn">'+diff+'d</span>';
  return '<span class="badge badgeOk">Activo</span>';
}

function isRenewalNoticeCurrent(c) {
  return !!(c && c.avisoRenovacionEnviado && c.avisoRenovacionExpiracion && c.expiry && c.avisoRenovacionExpiracion === c.expiry);
}

function clientHasRenewalNotice(c) {
  return !!(c && getStatus(c.expiry) === 'warn' && isRenewalNoticeCurrent(c));
}

function isRenewalReplyCurrent(c) {
  if (!c || !clientHasRenewalNotice(c)) return false;
  if (!c.avisoRenovacionContestado) return false;
  if (c.avisoRenovacionContestadoExpiracion && c.expiry && c.avisoRenovacionContestadoExpiracion !== c.expiry) return false;
  return true;
}

function clientHasAnsweredRenewalNotice(c) {
  return isRenewalReplyCurrent(c);
}

function clientHasUnansweredRenewalNotice(c) {
  return !!(clientHasRenewalNotice(c) && !isRenewalReplyCurrent(c));
}

function renewalReplyBadgeHtml(c) {
  if (!clientHasRenewalNotice(c)) return '';
  return isRenewalReplyCurrent(c)
    ? '<span class="badge badgeAnswered">Contesto</span>'
    : '<span class="badge badgeNoAnswer">Sin contestar</span>';
}

function renewalNoticeHtml(c, mode) {
  if (!c || getStatus(c.expiry) !== 'warn') return '';
  var current = isRenewalNoticeCurrent(c);
  var answered = isRenewalReplyCurrent(c);
  var sentDate = c.avisoRenovacionFecha ? formatDate(String(c.avisoRenovacionFecha).split('T')[0]) : '';
  var replyDate = c.avisoRenovacionContestadoFecha ? formatDate(String(c.avisoRenovacionContestadoFecha).split('T')[0]) : '';
  var baseClass = current ? (answered ? 'renewNotice done answered' : 'renewNotice done noanswer') : 'renewNotice pending';
  var label = current ? ('Avisado' + (sentDate ? ' · ' + sentDate : '')) : 'Pendiente de aviso';
  var replyLabel = current ? (answered ? ('Contesto' + (replyDate ? ' · ' + replyDate : '')) : 'Sin contestar todavía') : 'Aviso de renovación 15 días';
  var actions = '';
  if (current) {
    actions = '<div class="noticeActions">' +
      '<button type="button" data-id="'+esc(c.id)+'" onclick="toggleRenewalReply(this.dataset.id, '+(!answered)+', this)">'+(answered ? 'Marcar sin contestar' : 'Marcar contestado')+'</button>' +
      '<button type="button" data-id="'+esc(c.id)+'" onclick="toggleRenewalNotice(this.dataset.id, false, this)">Desmarcar aviso</button>' +
    '</div>';
  } else {
    actions = '<div class="noticeActions"><button type="button" data-id="'+esc(c.id)+'" onclick="toggleRenewalNotice(this.dataset.id, true, this)">Marcar avisado</button></div>';
  }
  return '<div class="'+baseClass+(mode==='view'?' view':'')+'"><div><strong>'+label+'</strong><span>'+replyLabel+'</span></div>'+actions+'</div>';
}

async function toggleRenewalNotice(id, value, btn) {
  var c = clients.find(function(x){ return x.id === id; });
  if (!c) return;
  var oldText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  if (value) {
    c.avisoRenovacionEnviado = true;
    c.avisoRenovacionFecha = new Date().toISOString();
    c.avisoRenovacionExpiracion = c.expiry || null;
    c.avisoRenovacionContestado = false;
    c.avisoRenovacionContestadoFecha = null;
    c.avisoRenovacionContestadoExpiracion = null;
  } else {
    c.avisoRenovacionEnviado = false;
    c.avisoRenovacionFecha = null;
    c.avisoRenovacionExpiracion = null;
    c.avisoRenovacionContestado = false;
    c.avisoRenovacionContestadoFecha = null;
    c.avisoRenovacionContestadoExpiracion = null;
  }
  try {
    var saved = await saveClientToStore(c);
    var idx = clients.findIndex(function(x){ return x.id === id; });
    if (idx >= 0) clients[idx] = saved;
    saveData();
    renderCards();
    if (document.getElementById('viewSheet') && document.getElementById('viewSheet').classList.contains('open')) {
      viewClient(id);
    }
    if (typeof showToast === 'function') showToast(value ? 'Cliente marcado como avisado' : 'Aviso desmarcado');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al guardar aviso: ' + ex.message, 'error'); else alert('Error al guardar aviso: ' + ex.message);
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
  }
}

async function toggleRenewalReply(id, value, btn) {
  var c = clients.find(function(x){ return x.id === id; });
  if (!c) return;
  if (!clientHasRenewalNotice(c)) {
    if (typeof showToast === 'function') showToast('Primero marca el aviso como enviado', 'error'); else alert('Primero marca el aviso como enviado');
    return;
  }
  var oldText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  c.avisoRenovacionContestado = !!value;
  c.avisoRenovacionContestadoFecha = value ? new Date().toISOString() : null;
  c.avisoRenovacionContestadoExpiracion = value ? (c.expiry || null) : null;
  try {
    var saved = await saveClientToStore(c);
    var idx = clients.findIndex(function(x){ return x.id === id; });
    if (idx >= 0) clients[idx] = saved;
    saveData();
    renderCards();
    if (document.getElementById('viewSheet') && document.getElementById('viewSheet').classList.contains('open')) {
      viewClient(id);
    }
    if (typeof showToast === 'function') showToast(value ? 'Cliente marcado como contestado' : 'Cliente marcado como sin contestar');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al guardar contestación: ' + ex.message, 'error'); else alert('Error al guardar contestación: ' + ex.message);
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
  }
}

function formatDate(d) {
  if (!d) return '-';
  var p = d.split('-'); return p[2]+'/'+p[1]+'/'+p[0];
}

function clientExpirySortValue(c) {
  if (!c || !c.expiry) return Number.POSITIVE_INFINITY;
  var t = new Date(c.expiry).getTime();
  return isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function sortClientsByExpiryAsc(list) {
  return (list || []).slice().sort(function(a, b) {
    var da = clientExpirySortValue(a);
    var db = clientExpirySortValue(b);
    if (da !== db) return da - db;
    return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
  });
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function avatarLetter(name) { return (name||'?')[0].toUpperCase(); }

function openSheet(id, ovl) {
  var overlay = document.getElementById(ovl);
  var sheet = document.getElementById(id);
  if (overlay) {
    overlay.style.display = 'block';
    overlay.classList.add('active');
  }
  if (sheet) setTimeout(function(){ sheet.classList.add('open'); }, 10);
}
function closeSheet(id, ovl) {
  var overlay = document.getElementById(ovl);
  var sheet = document.getElementById(id);
  if (sheet) sheet.classList.remove('open');
  setTimeout(function(){
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
  }, 300);
}
function openMenu() { openSheet('menuSheet','menuOverlay'); }


// ========== BACKUP INTELIGENTE ==========
function getLastBackupAt() {
  try { return localStorage.getItem(BACKUP_LAST_KEY) || ''; } catch(e) { return ''; }
}

function setLastBackupNow() {
  try { localStorage.setItem(BACKUP_LAST_KEY, new Date().toISOString()); } catch(e) {}
  updateBackupReminder();
  updateBackupCenterText();
}

function daysSinceIso(iso) {
  if (!iso) return null;
  var d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  var now = new Date();
  d.setHours(0,0,0,0); now.setHours(0,0,0,0);
  return Math.floor((now - d) / 86400000);
}

function formatDateTimeEs(iso) {
  if (!iso) return '-';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
  } catch(e) { return iso; }
}

function getBackupStatusText() {
  var last = getLastBackupAt();
  var days = daysSinceIso(last);
  if (days === null) return { due:true, text:'Todavia no hay ninguna copia registrada en este dispositivo.' };
  if (days >= BACKUP_REMINDER_DAYS) return { due:true, text:'Ultima copia hace ' + days + ' dias. Recomendado exportar backup.' };
  return { due:false, text:'Ultima copia: ' + formatDateTimeEs(last) + ' · Correcto.' };
}

function updateBackupReminder() {
  var box = document.getElementById('backupNotice');
  if (!box) return;
  var st = getBackupStatusText();
  if (!st.due) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';
  var txt = document.getElementById('backupNoticeText');
  if (txt) txt.textContent = st.text;
}

function updateBackupCenterText() {
  var lastEl = document.getElementById('backupLastText');
  var statusEl = document.getElementById('backupStatusText');
  var st = getBackupStatusText();
  if (lastEl) lastEl.textContent = getLastBackupAt() ? formatDateTimeEs(getLastBackupAt()) : 'Sin copia registrada en este dispositivo';
  if (statusEl) {
    statusEl.textContent = st.due ? st.text : 'Backup al dia. Aun asi puedes exportar una copia cuando quieras.';
    statusEl.style.color = st.due ? 'var(--orange)' : 'var(--green)';
  }
}

function openBackupCenter() {
  closeSheet('menuSheet','menuOverlay');
  updateBackupCenterText();
  openSheet('backupSheet','backupOverlay');
}

function buildClientExportRows() {
  return clients.map(function(c){
    var svc = c.service === 'ESPANA' ? 'ESPAÑA' : c.service;
    var appsStr=(c.apps||[]).map(function(a){var s=a.name;if(a.customName) s+=' ('+a.customName+')';if(a.mac) s+=' MAC:'+a.mac;if(a.code) s+=' CODE:'+a.code;return s;}).join(' | ');
    return {'ID':c.id,'Nombre':c.name,'Usuario':c.user,'Contrasena':c.pass,'Servicio':svc,'Expiracion':c.expiry,'Apps':appsStr,'Etiquetas':normalizeClientTags(c.tags).join(', '),'Notas':c.notes,'AvisoRenovacion':isRenewalNoticeCurrent(c)?'SI':'NO','FechaAviso':c.avisoRenovacionFecha?String(c.avisoRenovacionFecha).split('T')[0]:'','ContestadoAviso':clientHasAnsweredRenewalNotice(c)?'SI':'NO','FechaContestacion':c.avisoRenovacionContestadoFecha?String(c.avisoRenovacionContestadoFecha).split('T')[0]:'','Creado':c.createdAt?String(c.createdAt).split('T')[0]:''};
  });
}

function buildRenewalExportRows() {
  return (renewals || []).map(function(r){
    return {
      'ID': r.id || '',
      'ClienteID': r.clientId || '',
      'Cliente': r.clientName || '',
      'Fecha anterior': r.previousExpiry || '',
      'Fecha nueva': r.newExpiry || '',
      'Meses': r.months || 0,
      'Importe': Number(r.amount || 0),
      'Metodo pago': r.paymentMethod || '',
      'Estado pago': r.paymentStatus || 'pagado',
      'Fecha pago': r.paymentPaidAt ? String(r.paymentPaidAt).replace('T',' ').slice(0,16) : '',
      'Notas': r.notes || '',
      'Fecha registro': r.createdAt ? String(r.createdAt).replace('T',' ').slice(0,16) : ''
    };
  });
}

async function exportFullBackup() {
  try {
    if(!clients.length){ alert('No hay clientes para exportar.'); return; }
    await loadRenewals(false);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildClientExportRows()), 'Clientes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildRenewalExportRows()), 'Renovaciones');
    XLSX.writeFile(wb, 'M17LIV3_backup_completo_' + new Date().toISOString().split('T')[0] + '.xlsx');
    setLastBackupNow();
    if (typeof showToast === 'function') showToast('Backup completo exportado');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al exportar backup: ' + ex.message, 'error'); else alert('Error al exportar backup: ' + ex.message);
  }
}
// ========== FIN BACKUP INTELIGENTE ==========

// ========== RENOVACIONES E INGRESOS ==========
function parseEuroAmount(value) {
  if (value === null || value === undefined) return 0;
  var s = String(value).trim();
  if (!s) return 0;
  s = s.replace(/\s/g, '').replace(',', '.');
  s = s.replace(/[^0-9.\-]/g, '');
  var n = Number(s);
  if (!isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

function renewalRowToItem(row) {
  return {
    id: row.id || '',
    clientId: row.cliente_id || '',
    clientName: row.cliente_nombre || '',
    previousExpiry: row.fecha_anterior || '',
    newExpiry: row.fecha_nueva || '',
    months: row.meses || 0,
    amount: Number(row.importe || 0),
    paymentMethod: row.metodo_pago || '',
    paymentStatus: row.estado_pago || 'pagado',
    paymentPaidAt: row.fecha_pago || '',
    notes: row.notas || '',
    createdAt: row.created_at || ''
  };
}

async function loadRenewals(showMsg) {
  try {
    if (!USE_SUPABASE) {
      try { renewals = JSON.parse(localStorage.getItem('m17_renewals') || '[]'); } catch(e) { renewals = []; }
      renderPaymentsDashboard();
      return renewals;
    }
    var db = initSupabase();
    var result = await db.from(SUPABASE_RENEWALS_TABLE).select('*').order('created_at', { ascending: false }).limit(500);
    if (result.error) throw result.error;
    renewals = (result.data || []).map(renewalRowToItem);
    renderPaymentsDashboard();
    if (showMsg && typeof showToast === 'function') showToast('Ingresos actualizados');
    return renewals;
  } catch(ex) {
    console.error(ex);
    var box = document.getElementById('paymentsHistory');
    if (box) box.innerHTML = '<div class="emptyMini" style="color:var(--orange)">No se han podido cargar las renovaciones. Revisa que hayas ejecutado el SQL de la tabla renovaciones.</div>';
    if (showMsg && typeof showToast === 'function') showToast('Error al cargar ingresos: ' + ex.message, 'error');
    return [];
  }
}

async function saveRenewalToStore(item) {
  if (!USE_SUPABASE) {
    item.id = genId();
    item.createdAt = new Date().toISOString();
    item.paymentStatus = item.paymentStatus || 'pagado';
    item.paymentPaidAt = item.paymentStatus === 'pagado' ? (item.paymentPaidAt || new Date().toISOString()) : '';
    renewals.unshift(item);
    localStorage.setItem('m17_renewals', JSON.stringify(renewals));
    return item;
  }
  var db = initSupabase();
  var payload = {
    cliente_id: item.clientId || null,
    cliente_nombre: item.clientName || '',
    fecha_anterior: item.previousExpiry || null,
    fecha_nueva: item.newExpiry || null,
    meses: item.months || 0,
    importe: Number(item.amount || 0),
    metodo_pago: item.paymentMethod || '',
    estado_pago: item.paymentStatus || 'pagado',
    fecha_pago: (item.paymentStatus || 'pagado') === 'pagado' ? (item.paymentPaidAt || new Date().toISOString()) : null,
    notas: item.notes || ''
  };
  var result = await db.from(SUPABASE_RENEWALS_TABLE).insert(payload).select('*').single();
  if (result.error) throw result.error;
  return renewalRowToItem(result.data);
}


function isPaymentPending(r) {
  return String((r && r.paymentStatus) || '').toLowerCase() === 'pendiente';
}
function isPaymentPaid(r) {
  return !isPaymentPending(r);
}
function getPendingPaymentRenewalForClient(clientId) {
  clientId = String(clientId || '');
  return (renewals || []).find(function(r){
    return String(r.clientId || '') === clientId && isPaymentPending(r);
  }) || null;
}
function clientHasPendingPayment(c) {
  return !!(c && getPendingPaymentRenewalForClient(c.id));
}
function pendingPaymentNoticeHtml(c, mode) {
  var r = getPendingPaymentRenewalForClient(c && c.id);
  if (!r) return '';
  var amount = Number(r.amount || 0);
  var amountTxt = amount > 0 ? (' · ' + euro(amount)) : '';
  var d = r.createdAt ? formatDateTimeEs(r.createdAt) : '';
  var info = (d ? d + ' · ' : '') + formatDate(r.previousExpiry) + ' → ' + formatDate(r.newExpiry);
  return '<div class="paymentNotice pendingPay'+(mode === 'view' ? ' view' : '')+'">' +
    '<div><strong>Pago pendiente'+amountTxt+'</strong><span>'+esc(info)+'</span></div>' +
    '<div class="paymentNoticeBtns">' +
      '<button type="button" data-renewal-id="'+esc(r.id)+'" onclick="openEditRenewal(this.dataset.renewalId)">Editar</button>' +
      '<button type="button" data-renewal-id="'+esc(r.id)+'" onclick="markRenewalAsPaid(this.dataset.renewalId, this)">Marcar pagado</button>' +
      '<button type="button" class="paymentDeleteBtn" data-renewal-id="'+esc(r.id)+'" onclick="deleteRenewalFromStore(this.dataset.renewalId, this)">Borrar</button>' +
    '</div>' +
  '</div>';
}
async function markRenewalAsPaid(renewalId, btn) {
  var r = (renewals || []).find(function(x){ return String(x.id) === String(renewalId); });
  if (!r) return;
  var oldText = btn ? btn.textContent : '';
  var amountInput = prompt('Importe cobrado para marcarlo como pagado:', r.amount ? String(r.amount).replace('.', ',') : '');
  if (amountInput === null) return;
  var amount = parseEuroAmount(amountInput);
  if (isNaN(amount)) { alert('Importe no valido. Ejemplo: 10 o 10,50'); return; }
  var method = prompt('Metodo de pago:', r.paymentMethod && r.paymentMethod !== 'Pendiente' ? r.paymentMethod : 'Bizum');
  if (method === null) return;
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    var paidAt = new Date().toISOString();
    if (USE_SUPABASE) {
      var db = initSupabase();
      var result = await db.from(SUPABASE_RENEWALS_TABLE).update({
        importe: Number(amount || 0),
        metodo_pago: method || 'Bizum',
        estado_pago: 'pagado',
        fecha_pago: paidAt
      }).eq('id', renewalId).select('*').maybeSingle();
      if (result.error) throw result.error;
      if (result.data) {
        var updated = renewalRowToItem(result.data);
        var ix = renewals.findIndex(function(x){ return String(x.id) === String(renewalId); });
        if (ix >= 0) renewals[ix] = updated;
      }
    } else {
      r.amount = Number(amount || 0);
      r.paymentMethod = method || 'Bizum';
      r.paymentStatus = 'pagado';
      r.paymentPaidAt = paidAt;
      localStorage.setItem('m17_renewals', JSON.stringify(renewals));
    }
    renderPaymentsDashboard();
    renderCards();
    var sheet = document.getElementById('viewSheet');
    if (sheet && sheet.classList.contains('open') && r.clientId) viewClient(r.clientId);
    if (typeof showToast === 'function') showToast('Pago marcado como cobrado');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al marcar pago: ' + ex.message, 'error'); else alert('Error al marcar pago: ' + ex.message);
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
  }
}


async function updateRenewalInStore(renewalId, patch) {
  patch = patch || {};
  var ix = (renewals || []).findIndex(function(x){ return String(x.id) === String(renewalId); });
  if (ix < 0) throw new Error('No se ha encontrado la renovacion.');
  var current = renewals[ix];
  var merged = Object.assign({}, current, patch || {});

  if (USE_SUPABASE) {
    var db = initSupabase();
    var payload = {};
    if ('clientId' in patch) payload.cliente_id = merged.clientId || null;
    if ('clientName' in patch) payload.cliente_nombre = merged.clientName || '';
    if ('previousExpiry' in patch) payload.fecha_anterior = merged.previousExpiry || null;
    if ('newExpiry' in patch) payload.fecha_nueva = merged.newExpiry || null;
    if ('months' in patch) payload.meses = Number(merged.months || 0);
    if ('amount' in patch) payload.importe = Number(merged.amount || 0);
    if ('paymentMethod' in patch) payload.metodo_pago = merged.paymentMethod || '';
    if ('paymentStatus' in patch) payload.estado_pago = merged.paymentStatus || 'pagado';
    if ('paymentPaidAt' in patch) payload.fecha_pago = merged.paymentPaidAt || null;
    if ('notes' in patch) payload.notas = merged.notes || '';

    var result = await db.from(SUPABASE_RENEWALS_TABLE).update(payload).eq('id', renewalId).select('*').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Supabase no devolvio la renovacion actualizada. Revisa permisos/RLS o pulsa actualizar y vuelve a entrar.');
    merged = renewalRowToItem(result.data);
  }

  renewals[ix] = merged;
  if (!USE_SUPABASE) localStorage.setItem('m17_renewals', JSON.stringify(renewals));
  return merged;
}

async function deleteRenewalFromStore(renewalId, btn) {
  var r = (renewals || []).find(function(x){ return String(x.id) === String(renewalId); });
  if (!r) { alert('No se ha encontrado este registro. Pulsa Recargar y vuelve a intentarlo.'); return; }

  var details = (r.clientName || 'Cliente') + ' · ' + euro(r.amount) + ' · ' + (r.createdAt ? formatDateTimeEs(r.createdAt) : 'sin fecha');
  var ok = confirm('¿Borrar este ingreso / renovación del historial?\n\n' + details + '\n\nEsto quitará este importe de los totales y de los pendientes de pago.');
  if (!ok) return;

  var oldText = btn ? btn.textContent : '';
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Borrando...'; }

    if (USE_SUPABASE) {
      var db = initSupabase();
      var result = await db.from(SUPABASE_RENEWALS_TABLE).delete().eq('id', renewalId);
      if (result.error) throw result.error;
    }

    renewals = (renewals || []).filter(function(x){ return String(x.id) !== String(renewalId); });
    if (!USE_SUPABASE) localStorage.setItem('m17_renewals', JSON.stringify(renewals));

    renderPaymentsDashboard();
    renderCards();

    var viewSheet = document.getElementById('viewSheet');
    if (viewSheet && viewSheet.classList.contains('open') && r.clientId) viewClient(r.clientId);

    var editSheet = document.getElementById('editRenewalSheet');
    if (editSheet && editSheet.classList.contains('open')) closeSheet('editRenewalSheet','editRenewalOverlay');

    if (typeof showToast === 'function') showToast('Registro borrado del historial');
    else alert('Registro borrado del historial');
  } catch(ex) {
    var msg = ex && ex.message ? ex.message : 'No se pudo borrar el registro.';
    if (typeof showToast === 'function') showToast('Error al borrar: ' + msg, 'error');
    else alert('Error al borrar: ' + msg);
    if (btn) { btn.disabled = false; btn.textContent = oldText || 'Borrar'; }
  }
}



function deleteCurrentEditedRenewal(btn) {
  var idEl = document.getElementById('editRenewalId');
  var id = idEl ? idEl.value : '';
  if (!id) { alert('No se ha encontrado el registro para borrar.'); return; }
  deleteRenewalFromStore(id, btn);
}


function openEditRenewal(renewalId) {
  // Releer los ingresos antes de editar ayuda cuando vienes de otra pantalla o la PWA estaba en caché.
  var r = (renewals || []).find(function(x){ return String(x.id) === String(renewalId); });
  if (!r) { alert('No se ha encontrado esta renovacion. Pulsa Recargar en Ingresos / renovaciones y prueba otra vez.'); return; }

  var idEl = document.getElementById('editRenewalId');
  var cEl = document.getElementById('editRenewalClient');
  var prevEl = document.getElementById('editRenewalPrevious');
  var newEl = document.getElementById('editRenewalNew');
  var monthsEl = document.getElementById('editRenewalMonths');
  var amountEl = document.getElementById('editRenewalAmount');
  var methodEl = document.getElementById('editRenewalMethod');
  var statusEl = document.getElementById('editRenewalStatus');
  var notesEl = document.getElementById('editRenewalNotes');
  var errEl = document.getElementById('editRenewalError');

  if (!idEl || !amountEl || !statusEl) {
    alert('No se ha cargado bien la ventana de edicion. Pulsa el boton actualizar de la app y vuelve a intentarlo.');
    return;
  }

  idEl.value = r.id || '';
  if (cEl) cEl.textContent = 'Cliente: ' + (r.clientName || 'Cliente') + ' · Registrado: ' + (r.createdAt ? formatDateTimeEs(r.createdAt) : '-');
  if (prevEl) prevEl.value = r.previousExpiry || '';
  if (newEl) newEl.value = r.newExpiry || '';
  if (monthsEl) monthsEl.value = r.months || 0;
  amountEl.value = (Number(r.amount || 0) ? String(r.amount).replace('.', ',') : '');
  amountEl.style.borderColor = '';
  if (methodEl) {
    var method = r.paymentMethod || (isPaymentPending(r) ? 'Pendiente' : 'Bizum');
    var exists = Array.prototype.some.call(methodEl.options, function(o){ return o.value === method; });
    methodEl.value = exists ? method : 'Otro';
  }
  statusEl.value = isPaymentPending(r) ? 'pendiente' : 'pagado';
  if (notesEl) notesEl.value = r.notes || '';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  // Mantener la ventana de ingresos debajo, pero subir la de edición por encima.
  openSheet('editRenewalSheet','editRenewalOverlay');
  setTimeout(function(){
    var sheet = document.getElementById('editRenewalSheet');
    var overlay = document.getElementById('editRenewalOverlay');
    if (overlay) { overlay.style.zIndex = '650'; overlay.style.display = 'block'; overlay.classList.add('active'); }
    if (sheet) { sheet.style.zIndex = '651'; sheet.classList.add('open'); }
    if (amountEl) amountEl.focus();
  }, 80);
}

async function saveEditedRenewal(btn) {
  var idEl = document.getElementById('editRenewalId');
  var id = idEl ? idEl.value : '';
  var r = (renewals || []).find(function(x){ return String(x.id) === String(id); });
  if (!r) { alert('No se ha encontrado esta renovacion. Pulsa Recargar y vuelve a intentarlo.'); return; }

  var errEl = document.getElementById('editRenewalError');
  var amountEl = document.getElementById('editRenewalAmount');
  var amount = parseEuroAmount(amountEl ? amountEl.value : '');
  if (isNaN(amount)) {
    if (errEl) { errEl.textContent = 'Importe no valido. Ejemplo: 10 o 10,50'; errEl.style.display = 'block'; }
    if (amountEl) { amountEl.style.borderColor = 'var(--red)'; amountEl.focus(); }
    return;
  }

  var statusEl = document.getElementById('editRenewalStatus');
  var methodEl = document.getElementById('editRenewalMethod');
  var status = statusEl ? (statusEl.value || 'pagado') : 'pagado';
  var method = methodEl ? (methodEl.value || '') : '';
  if (!method) method = status === 'pendiente' ? 'Pendiente' : 'Bizum';
  var paidAt = status === 'pagado' ? (r.paymentPaidAt || new Date().toISOString()) : '';

  var patch = {
    previousExpiry: (document.getElementById('editRenewalPrevious') || {}).value || '',
    newExpiry: (document.getElementById('editRenewalNew') || {}).value || '',
    months: parseInt(((document.getElementById('editRenewalMonths') || {}).value || '0'), 10) || 0,
    amount: amount,
    paymentMethod: method,
    paymentStatus: status,
    paymentPaidAt: paidAt,
    notes: ((document.getElementById('editRenewalNotes') || {}).value || '').trim()
  };

  var oldText = btn ? btn.textContent : '';
  try {
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    var updated = await updateRenewalInStore(id, patch);

    // Si el ingreso editado es el pago pendiente visible del cliente, refrescamos todo.
    await loadRenewals(false);
    closeSheet('editRenewalSheet','editRenewalOverlay');
    renderPaymentsDashboard();
    renderCards();

    var sheet = document.getElementById('viewSheet');
    if (sheet && sheet.classList.contains('open') && updated.clientId) viewClient(updated.clientId);
    if (typeof showToast === 'function') showToast('Ingreso actualizado correctamente');
    else alert('Ingreso actualizado correctamente');
  } catch(ex) {
    var msg = ex && ex.message ? ex.message : 'No se pudo guardar el ingreso.';
    if (errEl) { errEl.textContent = 'Error al guardar: ' + msg; errEl.style.display = 'block'; }
    else alert('Error al guardar: ' + msg);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText || 'Guardar cambios'; }
  }
}

function clientRenewalsHtml(c) {
  var list = (renewals || []).filter(function(r){ return String(r.clientId || '') === String(c && c.id || ''); }).slice(0, 20);
  if (!list.length) return '';
  return '<div class="clientRenewalsBlock">' +
    '<div class="vlabel" style="margin:16px 0 8px">Ingresos / renovaciones de este cliente</div>' +
    list.map(function(r){
      var pending = isPaymentPending(r);
      var status = pending ? '<span class="paymentStatus pending">Pendiente de pago</span>' : '<span class="paymentStatus paid">Pagado</span>';
      return '<div class="paymentItem '+(pending?'paymentItemPending':'')+'">' +
        '<div class="paymentItemTop"><div class="paymentName">'+esc(r.createdAt ? formatDateTimeEs(r.createdAt) : 'Renovacion')+'</div><div class="'+(pending?'paymentAmount pending':'paymentAmount')+'">'+euro(r.amount)+'</div></div>' +
        '<div class="paymentMeta">'+status+' · '+esc(r.months || 0)+' mes(es)'+(r.paymentMethod ? ' · '+esc(r.paymentMethod) : '')+'</div>' +
        '<div class="paymentMeta">'+formatDate(r.previousExpiry)+' → '+formatDate(r.newExpiry)+'</div>' +
        (r.notes ? '<div class="paymentMeta">Notas: '+esc(r.notes)+'</div>' : '') +
        '<div class="paymentActions">' +
          '<button class="paymentEditBtn" data-renewal-id="'+esc(r.id)+'" onclick="openEditRenewal(this.dataset.renewalId)">&#9998; Editar ingreso</button>' +
          (pending ? '<button data-renewal-id="'+esc(r.id)+'" onclick="markRenewalAsPaid(this.dataset.renewalId, this)">&#10003; Marcar pagado</button>' : '') +
          '<button class="paymentDeleteBtn" data-renewal-id="'+esc(r.id)+'" onclick="deleteRenewalFromStore(this.dataset.renewalId, this)">&#128465; Borrar</button>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function currentMonthKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth()+1);
}

function euro(n) {
  n = Number(n || 0);
  try { return n.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'; }
  catch(e) { return n.toFixed(2) + ' €'; }
}

function sumRenewals(filterFn) {
  return (renewals || []).filter(filterFn || function(){return true;}).reduce(function(acc, r){ return acc + Number(r.amount || 0); }, 0);
}

function renderPaymentsDashboard() {
  var now = new Date();
  var month = currentMonthKey(now);
  var since30 = new Date(now.getTime() - 30*86400000);
  var monthTotal = sumRenewals(function(r){ return isPaymentPaid(r) && r.createdAt && currentMonthKey(new Date(r.createdAt)) === month; });
  var last30 = sumRenewals(function(r){ return isPaymentPaid(r) && r.createdAt && new Date(r.createdAt) >= since30; });
  var total = sumRenewals(function(r){ return isPaymentPaid(r); });
  var pendingTotal = sumRenewals(function(r){ return isPaymentPending(r); });
  var pendingCount = (renewals || []).filter(function(r){ return isPaymentPending(r); }).length;
  var countMonth = (renewals || []).filter(function(r){ return r.createdAt && currentMonthKey(new Date(r.createdAt)) === month; }).length;
  var elMonth = document.getElementById('payMonthTotal');
  var el30 = document.getElementById('pay30Total');
  var elAll = document.getElementById('payAllTotal');
  var elCount = document.getElementById('payMonthCount');
  var elPendingCount = document.getElementById('payPendingCount');
  var elPendingTotal = document.getElementById('payPendingTotal');
  if (elMonth) elMonth.textContent = euro(monthTotal);
  if (el30) el30.textContent = euro(last30);
  if (elAll) elAll.textContent = euro(total);
  if (elCount) elCount.textContent = String(countMonth);
  if (elPendingCount) elPendingCount.textContent = String(pendingCount);
  if (elPendingTotal) elPendingTotal.textContent = euro(pendingTotal);

  var box = document.getElementById('paymentsHistory');
  if (!box) return;
  if (!renewals.length) {
    box.innerHTML = '<div class="emptyMini">Todavia no hay renovaciones registradas.</div>';
    return;
  }
  box.innerHTML = renewals.slice(0,100).map(function(r){
    var d = r.createdAt ? formatDateTimeEs(r.createdAt) : '-';
    var pending = isPaymentPending(r);
    var status = pending ? '<span class="paymentStatus pending">Pendiente de pago</span>' : '<span class="paymentStatus paid">Pagado</span>';
    var amountClass = pending ? 'paymentAmount pending' : 'paymentAmount';
    return '<div class="paymentItem '+(pending?'paymentItemPending':'')+'">' +
      '<div class="paymentItemTop">' +
        '<div class="paymentName">' + esc(r.clientName || 'Cliente') + '</div>' +
        '<div class="'+amountClass+'">' + euro(r.amount) + '</div>' +
      '</div>' +
      '<div class="paymentMeta">' + status + ' · ' + esc(d) + ' · ' + esc(r.months || 0) + ' mes(es)' + (r.paymentMethod ? ' · ' + esc(r.paymentMethod) : '') + '</div>' +
      '<div class="paymentMeta">' + formatDate(r.previousExpiry) + ' → ' + formatDate(r.newExpiry) + '</div>' +
      (r.notes ? '<div class="paymentMeta">Notas: ' + esc(r.notes) + '</div>' : '') +
      '<div class="paymentActions">' +
        '<button class="paymentEditBtn" data-renewal-id="'+esc(r.id)+'" onclick="openEditRenewal(this.dataset.renewalId)">&#9998; Editar ingreso</button>' +
        (pending ? '<button data-renewal-id="'+esc(r.id)+'" onclick="markRenewalAsPaid(this.dataset.renewalId, this)">&#10003; Marcar pagado</button>' : '') +
        '<button class="paymentDeleteBtn" data-renewal-id="'+esc(r.id)+'" onclick="deleteRenewalFromStore(this.dataset.renewalId, this)">&#128465; Borrar</button>' +
      '</div>' +
    '</div>';
  }).join('');
  ensurePaymentDeleteButtons();
}

async function openPayments() {
  closeSheet('menuSheet','menuOverlay');
  openSheet('paymentsSheet','paymentsOverlay');
  var box = document.getElementById('paymentsHistory');
  if (box) box.innerHTML = '<div class="emptyMini">Cargando ingresos...</div>';
  await loadRenewals(false);
  setTimeout(ensurePaymentDeleteButtons, 100);
}

async function exportPaymentsExcel() {
  try {
    await loadRenewals(false);
    if (!renewals.length) { alert('Todavia no hay renovaciones para exportar.'); return; }
    var ws = XLSX.utils.json_to_sheet(buildRenewalExportRows());
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Renovaciones');
    XLSX.writeFile(wb, 'M17LIV3_renovaciones_' + new Date().toISOString().split('T')[0] + '.xlsx');
    if (typeof showToast === 'function') showToast('Ingresos exportados');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al exportar ingresos: ' + ex.message, 'error'); else alert('Error al exportar ingresos: ' + ex.message);
  }
}

function ensurePaymentDeleteButtons() {
  try {
    document.querySelectorAll('.paymentEditBtn[data-renewal-id]').forEach(function(editBtn){
      var renewalId = editBtn.getAttribute('data-renewal-id') || '';
      if (!renewalId) return;
      var actions = editBtn.closest('.paymentActions') || editBtn.parentElement;
      if (!actions) return;
      var existing = actions.querySelector('.paymentDeleteBtn[data-renewal-id="' + renewalId.replace(/"/g, '\\"') + '"]');
      if (existing) return;

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'paymentDeleteBtn';
      delBtn.setAttribute('data-renewal-id', renewalId);
      delBtn.innerHTML = '&#128465; Borrar';
      delBtn.onclick = function(){
        deleteRenewalFromStore(renewalId, delBtn);
      };
      actions.appendChild(delBtn);
    });
  } catch(e) {
    console.warn('No se pudieron añadir botones de borrar', e);
  }
}

// ========== FIN RENOVACIONES E INGRESOS ==========


// ========== BALANCE / FINANZAS ==========
var FINANCE_MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function financeRowToItem(row) {
  return {
    id: row.id || '',
    type: row.tipo || 'ingreso',
    concept: row.concepto || '',
    category: row.categoria || '',
    amount: Number(row.importe || 0),
    date: row.fecha || '',
    notes: row.notas || '',
    createdAt: row.created_at || ''
  };
}

function financeTodayIso() {
  return new Date().toISOString().split('T')[0];
}

function financeMonthKeyFromDate(value) {
  if (!value) return '';
  var d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

function financeSelectedMonthKey() {
  var y = document.getElementById('financeYear');
  var m = document.getElementById('financeMonth');
  if (!y || !m) {
    var now = new Date();
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1);
  }
  return y.value + '-' + pad2(Number(m.value || 1));
}

function financeCurrentViewMode() {
  var el = document.getElementById('financeViewMode');
  return el ? (el.value || 'year') : 'year';
}

function setFinanceViewMode(mode) {
  var el = document.getElementById('financeViewMode');
  if (el) el.value = mode || 'year';
}

function setFinanceFilterToDate(dateValue) {
  if (!dateValue) return;
  var d = new Date(dateValue);
  if (isNaN(d.getTime())) return;
  var monthEl = document.getElementById('financeMonth');
  var yearEl = document.getElementById('financeYear');
  if (monthEl) monthEl.value = String(d.getMonth() + 1);
  if (yearEl) {
    var year = String(d.getFullYear());
    var exists = Array.prototype.some.call(yearEl.options || [], function(o){ return String(o.value) === year; });
    if (!exists) {
      var opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      yearEl.appendChild(opt);
    }
    yearEl.value = year;
  }
}


function ensureFinanceYearRange() {
  var yearEl = document.getElementById('financeYear');
  if (!yearEl) return;

  var currentYear = new Date().getFullYear();
  var selected = yearEl.value || String(currentYear);

  for (var y = currentYear - 5; y <= currentYear + 25; y++) {
    var exists = Array.prototype.some.call(yearEl.options || [], function(o){
      return String(o.value) === String(y);
    });
    if (!exists) {
      var opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      yearEl.appendChild(opt);
    }
  }

  var opts = Array.prototype.slice.call(yearEl.options || []);
  opts.sort(function(a,b){ return Number(a.value) - Number(b.value); });
  yearEl.innerHTML = '';
  opts.forEach(function(o){ yearEl.appendChild(o); });

  if (selected) yearEl.value = selected;
}

function initFinanceSelectors() {
  var monthEl = document.getElementById('financeMonth');
  var yearEl = document.getElementById('financeYear');
  var viewEl = document.getElementById('financeViewMode');
  if (!monthEl || !yearEl) return;

  var now = new Date();
  if (!monthEl.options.length) {
    monthEl.innerHTML = FINANCE_MONTH_NAMES.map(function(name, i){
      return '<option value="'+(i+1)+'">'+name+'</option>';
    }).join('');
  }

  if (!yearEl.options.length) {
    var currentYear = now.getFullYear();
    var years = [];
    for (var y = currentYear - 5; y <= currentYear + 25; y++) years.push(y);
    yearEl.innerHTML = years.map(function(y){ return '<option value="'+y+'">'+y+'</option>'; }).join('');
  }

  monthEl.value = String(now.getMonth() + 1);
  yearEl.value = String(now.getFullYear());
  if (viewEl) viewEl.value = 'year';
  ensureFinanceYearRange();
}

async function loadFinanceMovements(showMsg) {
  try {
    if (!USE_SUPABASE) {
      try { financeMovements = JSON.parse(localStorage.getItem('m17_finance_movements') || '[]'); } catch(e) { financeMovements = []; }
      renderFinanceDashboard();
      return financeMovements;
    }

    var db = initSupabase();
    var result = await db.from(SUPABASE_FINANCE_TABLE).select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1000);
    if (result.error) throw result.error;

    financeMovements = (result.data || []).map(financeRowToItem);
    renderFinanceDashboard();
    if (showMsg && typeof showToast === 'function') showToast('Balance actualizado');
    return financeMovements;
  } catch(ex) {
    console.error(ex);
    var box = document.getElementById('financeHistory');
    if (box) box.innerHTML = '<div class="emptyMini" style="color:var(--orange)">No se han podido cargar los movimientos. Revisa que hayas ejecutado el SQL de finanzas.</div>';
    if (showMsg && typeof showToast === 'function') showToast('Error al cargar balance: ' + ex.message, 'error');
    return [];
  }
}

function buildFinancePayloadFromForm() {
  var type = (document.getElementById('financeType') || {}).value || 'ingreso';
  var concept = ((document.getElementById('financeConcept') || {}).value || '').trim();
  var category = (document.getElementById('financeCategory') || {}).value || 'Otro';
  var amountRaw = ((document.getElementById('financeAmount') || {}).value || '').trim();
  var amount = parseEuroAmount(amountRaw);
  var date = (document.getElementById('financeDate') || {}).value || financeTodayIso();
  var notes = ((document.getElementById('financeNotes') || {}).value || '').trim();

  if (!concept) throw new Error('Escribe un concepto.');
  if (amountRaw === '' || isNaN(amount)) throw new Error('Importe no válido. Ejemplo: 750 o 120.');
  if (!date) throw new Error('Selecciona una fecha.');

  return {
    type: type,
    concept: concept,
    category: category,
    amount: amount,
    date: date,
    notes: notes
  };
}

function clearFinanceForm() {
  var ids = ['financeAmount','financeConcept','financeNotes'];
  ids.forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
  var type = document.getElementById('financeType');
  var cat = document.getElementById('financeCategory');
  var date = document.getElementById('financeDate');
  var err = document.getElementById('financeError');
  if (type) type.value = 'ingreso';
  if (cat) cat.value = 'Otro';
  if (date) date.value = financeTodayIso();
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

function fillFinanceQuick(kind) {
  clearFinanceForm();
  var type = document.getElementById('financeType');
  var amount = document.getElementById('financeAmount');
  var concept = document.getElementById('financeConcept');
  var category = document.getElementById('financeCategory');
  var notes = document.getElementById('financeNotes');
  var date = document.getElementById('financeDate');
  if (date) date.value = financeTodayIso();

  if (kind === 'gastoProveedor') {
    if (type) type.value = 'gasto';
    if (amount) amount.value = '750';
    if (concept) concept.value = 'Gasto Panel K13';
    if (category) category.value = 'Panel K13';
    if (notes) notes.value = 'Recarga del Panel K13';
  } else if (kind === 'ingresoPeliculas') {
    if (type) type.value = 'ingreso';
    if (amount) amount.value = '120';
    if (concept) concept.value = 'Ingreso Jordan Pelis / Series';
    if (category) category.value = 'Jordan Pelis / Series';
    if (notes) notes.value = 'Ingreso mensual aproximado Jordan Pelis / Series';
  }
}

async function saveFinanceMovement(btn) {
  var err = document.getElementById('financeError');
  var oldText = btn ? btn.textContent : '';
  try {
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    var item = buildFinancePayloadFromForm();
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    var saved;
    if (USE_SUPABASE) {
      var db = initSupabase();
      var payload = {
        tipo: item.type,
        concepto: item.concept,
        categoria: item.category,
        importe: item.amount,
        fecha: item.date,
        notas: item.notes
      };
      var result = await db.from(SUPABASE_FINANCE_TABLE).insert(payload).select('*').single();
      if (result.error) throw result.error;
      saved = financeRowToItem(result.data);
    } else {
      saved = Object.assign({}, item, { id: genId(), createdAt: new Date().toISOString() });
      financeMovements.unshift(saved);
      localStorage.setItem('m17_finance_movements', JSON.stringify(financeMovements));
    }

    if (!financeMovements.find(function(x){ return String(x.id) === String(saved.id); })) financeMovements.unshift(saved);

    // Mostramos el movimiento en su año automáticamente. Si estás en vista mensual,
    // también se cambia al mes correspondiente.
    setFinanceFilterToDate(saved.date || item.date);

    clearFinanceForm();
    var d = document.getElementById('financeDate');
    if (d) d.value = saved.date || item.date || financeTodayIso();
    renderFinanceDashboard();
    if (typeof showToast === 'function') showToast('Movimiento guardado y mostrado en su año');
  } catch(ex) {
    var msg = ex && ex.message ? ex.message : 'No se pudo guardar.';
    if (err) { err.textContent = msg; err.style.display = 'block'; }
    else alert(msg);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText || 'Guardar movimiento'; }
  }
}

async function deleteFinanceMovement(id, btn) {
  var item = (financeMovements || []).find(function(x){ return String(x.id) === String(id); });
  if (!item) return;
  var ok = confirm('¿Borrar este movimiento?\n\n' + item.concept + ' · ' + euro(item.amount));
  if (!ok) return;

  var oldText = btn ? btn.textContent : '';
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Borrando...'; }
    if (USE_SUPABASE) {
      var db = initSupabase();
      var result = await db.from(SUPABASE_FINANCE_TABLE).delete().eq('id', id);
      if (result.error) throw result.error;
    }

    financeMovements = (financeMovements || []).filter(function(x){ return String(x.id) !== String(id); });
    if (!USE_SUPABASE) localStorage.setItem('m17_finance_movements', JSON.stringify(financeMovements));
    renderFinanceDashboard();
    if (typeof showToast === 'function') showToast('Movimiento borrado');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al borrar: ' + ex.message, 'error'); else alert('Error al borrar: ' + ex.message);
    if (btn) { btn.disabled = false; btn.textContent = oldText || 'Borrar'; }
  }
}

async function editFinanceMovement(id) {
  var item = (financeMovements || []).find(function(x){ return String(x.id) === String(id); });
  if (!item) return;

  var concept = prompt('Concepto:', item.concept || '');
  if (concept === null) return;
  concept = concept.trim();
  if (!concept) { alert('El concepto no puede estar vacío.'); return; }

  var amountInput = prompt('Importe:', String(item.amount || 0).replace('.', ','));
  if (amountInput === null) return;
  var amount = parseEuroAmount(amountInput);
  if (isNaN(amount)) { alert('Importe no válido.'); return; }

  var type = prompt('Tipo: ingreso o gasto', item.type || 'ingreso');
  if (type === null) return;
  type = String(type || '').toLowerCase().trim();
  if (type !== 'ingreso' && type !== 'gasto') { alert('Tipo no válido. Usa ingreso o gasto.'); return; }

  var date = prompt('Fecha YYYY-MM-DD:', item.date || financeTodayIso());
  if (date === null) return;
  date = String(date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('Fecha no válida. Usa formato YYYY-MM-DD.'); return; }

  var category = prompt('Categoría:', item.category || 'Otro');
  if (category === null) return;

  var notes = prompt('Notas:', item.notes || '');
  if (notes === null) return;

  try {
    if (USE_SUPABASE) {
      var db = initSupabase();
      var result = await db.from(SUPABASE_FINANCE_TABLE).update({
        tipo: type,
        concepto: concept,
        categoria: category || 'Otro',
        importe: amount,
        fecha: date,
        notas: notes || ''
      }).eq('id', id).select('*').maybeSingle();
      if (result.error) throw result.error;
      if (result.data) {
        var updated = financeRowToItem(result.data);
        var ix = financeMovements.findIndex(function(x){ return String(x.id) === String(id); });
        if (ix >= 0) financeMovements[ix] = updated;
      }
    } else {
      Object.assign(item, { type: type, concept: concept, category: category || 'Otro', amount: amount, date: date, notes: notes || '' });
      localStorage.setItem('m17_finance_movements', JSON.stringify(financeMovements));
    }
    renderFinanceDashboard();
    if (typeof showToast === 'function') showToast('Movimiento editado');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al editar: ' + ex.message, 'error'); else alert('Error al editar: ' + ex.message);
  }
}

function financePaidRenewals() {
  return (renewals || []).filter(function(r){ return isPaymentPaid(r); });
}

function financeRenewalDate(r) {
  return r.createdAt || r.paymentPaidAt || '';
}

function financeSumPaidRenewals(filterFn) {
  return financePaidRenewals().filter(filterFn || function(){ return true; }).reduce(function(acc, r){ return acc + Number(r.amount || 0); }, 0);
}

function financeSumMovements(type, filterFn) {
  return (financeMovements || []).filter(function(m){
    return (!type || m.type === type) && (!filterFn || filterFn(m));
  }).reduce(function(acc, m){ return acc + Number(m.amount || 0); }, 0);
}

function financePeriodFilter() {
  var selectedMonth = financeSelectedMonthKey();
  var selectedYear = selectedMonth.slice(0,4);
  var viewMode = financeCurrentViewMode();
  var isYearView = viewMode === 'year';

  var inSelectedMonth = function(dateValue){ return financeMonthKeyFromDate(dateValue) === selectedMonth; };
  var inSelectedYear = function(dateValue){ return String(dateValue || '').slice(0,4) === selectedYear; };

  return {
    selectedMonth: selectedMonth,
    selectedYear: selectedYear,
    viewMode: viewMode,
    isYearView: isYearView,
    inPeriod: isYearView ? inSelectedYear : inSelectedMonth,
    inYear: inSelectedYear,
    label: isYearView ? 'año' : 'mes'
  };
}


function financeMonthlyTotals(year) {
  var rows = [];
  for (var i = 1; i <= 12; i++) {
    var key = year + '-' + pad2(i);
    var inMonth = function(dateValue){ return financeMonthKeyFromDate(dateValue) === key; };
    var clientIncome = financeSumPaidRenewals(function(r){ return inMonth(financeRenewalDate(r)); });
    var otherIncome = financeSumMovements('ingreso', function(m){ return inMonth(m.date); });
    var expense = financeSumMovements('gasto', function(m){ return inMonth(m.date); });
    var income = clientIncome + otherIncome;
    var profit = income - expense;
    rows.push({month: FINANCE_MONTH_NAMES[i-1].slice(0,3), income: income, expense: expense, profit: profit});
  }
  return rows;
}

function financeBarsChartHtml(title, rows, key, className) {
  var max = rows.reduce(function(acc, r){ return Math.max(acc, Math.abs(Number(r[key] || 0))); }, 1);
  return '<div class="financeChartCard">' +
    '<div class="financeChartTitle">'+title+'</div>' +
    '<div class="financeBarChart">' +
      rows.map(function(r){
        var val = Number(r[key] || 0);
        var h = Math.max(4, Math.round((Math.abs(val) / max) * 100));
        return '<div class="financeBarCol" title="'+r.month+' · '+euro(val)+'">' +
          '<div class="financeBarVal">'+(val ? euro(val) : '')+'</div>' +
          '<div class="financeBarTrack"><div class="financeBar '+className+(val < 0 ? ' negative':'')+'" style="height:'+h+'%"></div></div>' +
          '<div class="financeBarLabel">'+r.month+'</div>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</div>';
}

function financeChartsHtml(year) {
  var rows = financeMonthlyTotals(year);
  return financeBarsChartHtml('Ingresos por mes', rows, 'income', 'income') +
         financeBarsChartHtml('Gastos por mes', rows, 'expense', 'expense') +
         financeBarsChartHtml('Beneficio por mes', rows, 'profit', 'profit');
}

function financeMonthSummaryHtml(year) {
  var rows = [];
  for (var i = 1; i <= 12; i++) {
    var key = year + '-' + pad2(i);
    var inMonth = function(dateValue){ return financeMonthKeyFromDate(dateValue) === key; };

    var clientIncome = financeSumPaidRenewals(function(r){ return inMonth(financeRenewalDate(r)); });
    var otherIncome = financeSumMovements('ingreso', function(m){ return inMonth(m.date); });
    var expense = financeSumMovements('gasto', function(m){ return inMonth(m.date); });
    var profit = clientIncome + otherIncome - expense;
    var hasAny = clientIncome || otherIncome || expense;

    rows.push(
      '<div class="financeMonthCard '+(hasAny?'hasData':'')+'">' +
        '<div class="financeMonthTitle">'+FINANCE_MONTH_NAMES[i-1]+'</div>' +
        '<div class="financeMonthLine"><span>Clientes</span><strong>'+euro(clientIncome)+'</strong></div>' +
        '<div class="financeMonthLine"><span>Otros</span><strong>'+euro(otherIncome)+'</strong></div>' +
        '<div class="financeMonthLine expense"><span>Gastos</span><strong>'+euro(expense)+'</strong></div>' +
        '<div class="financeMonthLine profit '+(profit < 0 ? 'negative' : '')+'"><span>Beneficio</span><strong>'+euro(profit)+'</strong></div>' +
      '</div>'
    );
  }
  return rows.join('');
}

function renderFinanceDashboard() {
  var box = document.getElementById('financeHistory');
  var summaryBox = document.getElementById('financeMonthlySummary');
  var p = financePeriodFilter();

  var monthGroup = document.getElementById('financeMonthGroup');
  if (monthGroup) monthGroup.style.display = p.isYearView ? 'none' : '';

  var setText = function(id, txt){ var el = document.getElementById(id); if (el) el.textContent = txt; };
  setText('finClientIncomeLabel', 'Ingresos clientes ' + p.label);
  setText('finOtherIncomeLabel', 'Otros ingresos ' + p.label);
  setText('finExpenseLabel', 'Gastos ' + p.label);
  setText('finProfitLabel', 'Beneficio ' + p.label);
  setText('finMovementCountLabel', 'Movimientos ' + p.label);
  setText('financeHistoryTitle', p.isYearView ? 'Historial ingresos / gastos del año' : 'Historial ingresos / gastos del mes');

  var clientIncomePeriod = financeSumPaidRenewals(function(r){ return p.inPeriod(financeRenewalDate(r)); });
  var clientIncomeYear = financeSumPaidRenewals(function(r){ return p.inYear(financeRenewalDate(r)); });

  var otherIncomePeriod = financeSumMovements('ingreso', function(m){ return p.inPeriod(m.date); });
  var otherIncomeYear = financeSumMovements('ingreso', function(m){ return p.inYear(m.date); });
  var expensePeriod = financeSumMovements('gasto', function(m){ return p.inPeriod(m.date); });
  var expenseYear = financeSumMovements('gasto', function(m){ return p.inYear(m.date); });

  var incomePeriod = clientIncomePeriod + otherIncomePeriod;
  var incomeYear = clientIncomeYear + otherIncomeYear;
  var profitPeriod = incomePeriod - expensePeriod;
  var profitYear = incomeYear - expenseYear;

  var set = function(id, val){ var el = document.getElementById(id); if (el) el.textContent = val; };
  set('finClientIncomeMonth', euro(clientIncomePeriod));
  set('finOtherIncomeMonth', euro(otherIncomePeriod));
  set('finExpenseMonth', euro(expensePeriod));
  set('finProfitMonth', euro(profitPeriod));
  set('finIncomeYear', euro(incomeYear));
  set('finExpenseYear', euro(expenseYear));
  set('finProfitYear', euro(profitYear));
  var historyRenewalCount = financePaidRenewals().filter(function(r){ return p.inPeriod(financeRenewalDate(r)); }).length;
  var historyExternalCount = (financeMovements || []).filter(function(m){ return p.inPeriod(m.date); }).length;
  set('finMovementCountMonth', String(historyRenewalCount + historyExternalCount));

  ['finProfitMonth','finProfitYear'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.color = (id === 'finProfitMonth' ? profitPeriod : profitYear) >= 0 ? 'var(--green)' : 'var(--red)';
  });

  if (summaryBox) {
    summaryBox.style.display = p.isYearView ? 'grid' : 'none';
    summaryBox.innerHTML = p.isYearView ? financeMonthSummaryHtml(p.selectedYear) : '';
  }
  var chartBox = document.getElementById('financeCharts');
  var chartHeader = document.querySelector('.financeChartsHeader');
  if (chartBox) {
    chartBox.style.display = p.isYearView ? 'grid' : 'none';
    chartBox.innerHTML = p.isYearView ? financeChartsHtml(p.selectedYear) : '';
  }
  if (chartHeader) chartHeader.style.display = p.isYearView ? '' : 'none';

  if (!box) return;

  var renewalHistory = financePaidRenewals()
    .filter(function(r){ return p.inPeriod(financeRenewalDate(r)); })
    .map(function(r){
      return {
        source: 'renewal',
        id: r.id || '',
        type: 'ingreso',
        concept: 'Renovación · ' + (r.clientName || 'Cliente'),
        category: 'Renovaciones clientes',
        amount: Number(r.amount || 0),
        date: financeRenewalDate(r) ? String(financeRenewalDate(r)).split('T')[0] : '',
        notes: r.notes || '',
        paymentMethod: r.paymentMethod || '',
        previousExpiry: r.previousExpiry || '',
        newExpiry: r.newExpiry || ''
      };
    });

  var externalHistory = (financeMovements || [])
    .filter(function(m){ return p.inPeriod(m.date); })
    .map(function(m){
      return {
        source: 'manual',
        id: m.id || '',
        type: m.type || 'ingreso',
        concept: m.concept || m.concepto || m.category || 'Movimiento',
        category: m.category || 'Otro',
        amount: Number(m.amount || 0),
        date: m.date || '',
        notes: m.notes || '',
        paymentMethod: ''
      };
    });

  var list = renewalHistory.concat(externalHistory);
  list.sort(function(a,b){ return String(b.date || '').localeCompare(String(a.date || '')); });

  if (!list.length) {
    var otherPeriods = []
      .concat((financeMovements || []).map(function(m){
        return p.isYearView ? String(m.date || '').slice(0,4) : financeMonthKeyFromDate(m.date);
      }))
      .concat(financePaidRenewals().map(function(r){
        var d = financeRenewalDate(r);
        return p.isYearView ? String(d || '').slice(0,4) : financeMonthKeyFromDate(d);
      }))
      .filter(Boolean);

    var uniquePeriods = Array.from(new Set(otherPeriods)).sort().reverse();

    if (uniquePeriods.length) {
      box.innerHTML = '<div class="emptyMini">No hay movimientos para esta vista. Hay movimientos en: ' +
        uniquePeriods.slice(0,8).map(function(k){
          return p.isYearView ? k : (k.slice(5,7) + '/' + k.slice(0,4));
        }).join(', ') +
        '. Cambia los filtros de arriba para verlos.</div>';
    } else {
      box.innerHTML = '<div class="emptyMini">No hay movimientos registrados todavía.</div>';
    }
    return;
  }

  box.innerHTML = list.map(function(m){
    var isExpense = m.type === 'gasto';
    var isRenewal = m.source === 'renewal';
    var amountClass = isExpense ? 'paymentAmount expense' : 'paymentAmount';
    var amountPrefix = isExpense ? '- ' : '+ ';
    var metaType = isRenewal ? 'Ingreso renovación cliente' : (isExpense ? 'Gasto' : 'Ingreso externo');
    var extraMeta = '';

    if (isRenewal) {
      extraMeta = '<div class="paymentMeta">Periodo: ' + formatDate(m.previousExpiry) + ' → ' + formatDate(m.newExpiry) + (m.paymentMethod ? ' · ' + esc(m.paymentMethod) : '') + '</div>';
    }

    return '<div class="paymentItem financeItem '+(isExpense?'financeExpense':'financeIncome')+' '+(isRenewal?'financeRenewal':'')+'">' +
      '<div class="paymentItemTop">' +
        '<div class="paymentName">'+esc(m.concept)+'</div>' +
        '<div class="'+amountClass+'">'+amountPrefix+euro(m.amount)+'</div>' +
      '</div>' +
      '<div class="paymentMeta">'+metaType+' · '+formatDate(m.date)+' · '+esc(m.category || 'Otro')+'</div>' +
      extraMeta +
      (m.notes ? '<div class="paymentMeta">Notas: '+esc(m.notes)+'</div>' : '') +
      '<div class="paymentActions">' +
        (isRenewal
          ? '<button class="paymentEditBtn" data-renewal-id="'+esc(m.id)+'" onclick="openEditRenewal(this.dataset.renewalId)">&#9998; Editar renovación</button><button class="paymentDeleteBtn" data-renewal-id="'+esc(m.id)+'" onclick="deleteRenewalFromStore(this.dataset.renewalId, this)">&#128465; Borrar</button>'
          : '<button onclick="editFinanceMovement(\''+esc(m.id)+'\')">&#9998; Editar</button><button class="paymentDeleteBtn" onclick="deleteFinanceMovement(\''+esc(m.id)+'\', this)">&#128465; Borrar</button>'
        ) +
      '</div>' +
    '</div>';
  }).join('');
}

async function openFinanceBalance() {
  closeSheet('menuSheet','menuOverlay');
  initFinanceSelectors();
  ensureFinanceYearRange();
  setFinanceViewMode('year');
  var now = new Date();
  var monthEl = document.getElementById('financeMonth');
  var yearEl = document.getElementById('financeYear');
  if (monthEl) monthEl.value = String(now.getMonth() + 1);
  if (yearEl) yearEl.value = String(now.getFullYear());
  var d = document.getElementById('financeDate');
  if (d && !d.value) d.value = financeTodayIso();
  openSheet('financeSheet','financeOverlay');

  var box = document.getElementById('financeHistory');
  if (box) box.innerHTML = '<div class="emptyMini">Cargando balance...</div>';

  await loadRenewals(false);
  await loadFinanceMovements(false);
}

function buildFinanceExportRows() {
  var rows = [];
  (renewals || []).forEach(function(r){
    if (!isPaymentPaid(r)) return;
    rows.push({
      'Tipo': 'Ingreso cliente',
      'Concepto': 'Renovación ' + (r.clientName || ''),
      'Categoría': 'Renovaciones',
      'Importe': Number(r.amount || 0),
      'Fecha': financeRenewalDate(r) ? String(financeRenewalDate(r)).split('T')[0] : '',
      'Notas': r.notes || ''
    });
  });
  (financeMovements || []).forEach(function(m){
    rows.push({
      'Tipo': m.type === 'gasto' ? 'Gasto' : 'Ingreso externo',
      'Concepto': m.concept || '',
      'Categoría': m.category || '',
      'Importe': m.type === 'gasto' ? -Number(m.amount || 0) : Number(m.amount || 0),
      'Fecha': m.date || '',
      'Notas': m.notes || ''
    });
  });
  return rows;
}

function buildFinanceSummaryRows() {
  var years = {};
  buildFinanceExportRows().forEach(function(row){
    var year = String(row.Fecha || '').slice(0,4) || 'Sin fecha';
    if (!years[year]) years[year] = {year: year, income: 0, expense: 0};
    var amt = Number(row.Importe || 0);
    if (amt >= 0) years[year].income += amt;
    else years[year].expense += Math.abs(amt);
  });
  return Object.keys(years).sort().map(function(y){
    var item = years[y];
    return {
      'Año': item.year,
      'Ingresos': item.income,
      'Gastos': item.expense,
      'Beneficio': item.income - item.expense
    };
  });
}

async function exportFinanceExcel() {
  try {
    await loadRenewals(false);
    await loadFinanceMovements(false);
    var rows = buildFinanceExportRows();
    if (!rows.length) { alert('Todavía no hay datos de balance para exportar.'); return; }

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Balance');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildFinanceSummaryRows()), 'Resumen anual');
    XLSX.writeFile(wb, 'M17LIV3_balance_' + new Date().toISOString().split('T')[0] + '.xlsx');
    if (typeof showToast === 'function') showToast('Balance exportado');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al exportar balance: ' + ex.message, 'error'); else alert('Error al exportar balance: ' + ex.message);
  }
}
// ========== FIN BALANCE / FINANZAS ==========


// ========== PANEL APP IBO ==========
var IBO_PANEL_URL = 'https://damaplay.top/panelr/m17live/';
function openIboPanel() {
  closeSheet('menuSheet','menuOverlay');
  window.open(IBO_PANEL_URL, '_blank', 'noopener');
}
function openIboPanelExternal() {
  openIboPanel();
}

function toggleFilters() {
  showFilters = !showFilters;
  document.getElementById('filterPills').style.display = showFilters ? 'flex' : 'none';
  document.getElementById('filterToggleBtn').classList.toggle('active', showFilters);
}
function setPillSvc(el, val) {
  document.querySelectorAll('[data-svc]').forEach(function(p){ p.classList.remove('active'); });
  el.classList.add('active');
  filterSvc = val;
  hasSelectedClientFilter = true;
  var bar = document.getElementById('activeFilterBar');
  var lbl = document.getElementById('activeFilterLabel');
  if (bar && lbl && !filterSt) {
    bar.style.display = 'flex';
    lbl.textContent = val ? ('Mostrando servicio: ' + (val === 'ESPANA' ? 'ESPAÑA' : val)) : 'Mostrando: Todos los clientes';
  }
  renderCards();
}

function resetClientView() {
  filterSt = '';
  filterSvc = '';
  hasSelectedClientFilter = false;
  document.querySelectorAll('[data-svc]').forEach(function(p){ p.classList.remove('active'); });
  var allPill = document.querySelector('[data-svc=""]');
  if (allPill) allPill.classList.add('active');
  var bar = document.getElementById('activeFilterBar');
  if (bar) bar.style.display = 'none';
  var searchBox = document.getElementById('searchBox');
  if (searchBox) searchBox.value = '';
  renderCards();
}


// ========== AVISOS AUTOMATICOS ==========
function getAutoAlertItems() {
  var soonNoNotice = (clients || []).filter(function(c){ return getStatus(c.expiry)==='warn' && !clientHasRenewalNotice(c); });
  var pendingPay = (clients || []).filter(function(c){ return clientHasPendingPayment(c); });
  var noAnswer = (clients || []).filter(function(c){ return clientHasUnansweredRenewalNotice(c); });
  var expired = (clients || []).filter(function(c){ return getStatus(c.expiry)==='exp'; });
  var noRenewExpired = (clients || []).filter(function(c){ return normalizeClientTags(c.tags).map(function(t){return t.toLowerCase();}).indexOf('no contesta al renovar') >= 0; });

  return [
    {icon:'⏰', title:'Caducan pronto sin aviso', count:soonNoNotice.length, text:'Clientes que caducan pronto y todavía no están marcados como avisados.', filter:'warn_no_advised'},
    {icon:'💸', title:'Pagos pendientes', count:pendingPay.length, text:'Clientes con importes pendientes de cobrar.', filter:'paypend'},
    {icon:'👀', title:'Avisados sin contestar', count:noAnswer.length, text:'Clientes avisados que todavía no han contestado.', filter:'noanswer'},
    {icon:'⚠️', title:'Clientes caducados', count:expired.length, text:'Clientes que ya han pasado la fecha de expiración.', filter:'exp'},
    {icon:'📵', title:'No contesta al renovar', count:noRenewExpired.length, text:'Clientes marcados porque no suelen contestar al renovar.', filter:'tag_no_contesta_renovar'}
  ];
}

function renderAutoAlertCards(items, onlyWithCount) {
  var visible = onlyWithCount ? items.filter(function(it){ return it.count > 0; }) : items;
  if (!visible.length && onlyWithCount) {
    return '<div class="emptyMini">Todo al día. No hay avisos importantes ahora mismo.</div>';
  }
  return '<div class="autoAlertsGrid">' + visible.map(function(it){
    return '<button class="autoAlertCard" onclick="quickFilter(&quot;'+it.filter+'&quot;)">' +
      '<span class="autoAlertIcon">'+it.icon+'</span>' +
      '<span class="autoAlertText"><strong>'+it.title+'</strong><small>'+it.text+'</small></span>' +
      '<span class="autoAlertCount">'+it.count+'</span>' +
    '</button>';
  }).join('') + '</div>';
}

function renderAutoAlerts() {
  var box = document.getElementById('autoAlerts');
  if (!box) return;
  var items = getAutoAlertItems();
  box.style.display = 'block';
  box.innerHTML = '<div class="autoAlertsTitle">🔔 Avisos automáticos</div>' + renderAutoAlertCards(items, true);
}

function openAlertsPanel() {
  closeSheet('menuSheet','menuOverlay');
  renderAlertsPanelContent();
  openSheet('alertsSheet','alertsOverlay');
}

function renderAlertsPanelContent() {
  var box = document.getElementById('alertsPanelContent');
  if (!box) return;
  box.innerHTML = renderAutoAlertCards(getAutoAlertItems(), false) +
    '<div class="emptyMini" style="margin-top:10px">Aunque un contador esté a 0, el aviso quedará preparado para cuando aparezcan clientes en ese estado.</div>';
}
// ========== FIN AVISOS AUTOMATICOS ==========


function quickFilter(st) {
  filterSt = st;
  hasSelectedClientFilter = true;
  var bar = document.getElementById('activeFilterBar');
  var lbl = document.getElementById('activeFilterLabel');
  if (bar) bar.style.display = 'flex';
  if (lbl) {
    if (!st) lbl.textContent = 'Mostrando: Todos los clientes';
    if (st === 'ok') lbl.textContent = 'Mostrando: Clientes activos';
    if (st === 'warn') lbl.textContent = 'Mostrando: Expiran pronto (menos de 15 dias)';
    if (st === 'exp') lbl.textContent = 'Mostrando: Expirados';
    if (st === 'paypend') lbl.textContent = 'Mostrando: Pendientes de pago';
    if (st === 'advised') lbl.textContent = 'Mostrando: Clientes avisados';
    if (st === 'answered') lbl.textContent = 'Mostrando: Avisados que han contestado';
    if (st === 'noanswer') lbl.textContent = 'Mostrando: Avisados sin contestar';
    if (st === 'warn_no_advised') lbl.textContent = 'Mostrando: Expiran pronto sin aviso enviado';
    if (st === 'tag_no_contesta_renovar') lbl.textContent = 'Mostrando: No contesta al renovar';
  }
  renderCards();
  document.getElementById('mainScroll').scrollTo({top: 200, behavior: 'smooth'});
}

function updateStats() {
  document.getElementById('stTotal').textContent = clients.length;
  document.getElementById('stActive').textContent = clients.filter(function(c){ var s=getStatus(c.expiry); return s==='ok'||s==='warn'; }).length;
  document.getElementById('stSoon').textContent = clients.filter(function(c){ return getStatus(c.expiry)==='warn'; }).length;
  document.getElementById('stExp').textContent = clients.filter(function(c){ return getStatus(c.expiry)==='exp'; }).length;
  var pendingEl = document.getElementById('stPendingPay');
  if (pendingEl) pendingEl.textContent = clients.filter(function(c){ return clientHasPendingPayment(c); }).length;
  var advisedEl = document.getElementById('stAdvised');
  if (advisedEl) advisedEl.textContent = clients.filter(function(c){ return clientHasRenewalNotice(c); }).length;
  var answeredEl = document.getElementById('stAnswered');
  if (answeredEl) answeredEl.textContent = clients.filter(function(c){ return clientHasAnsweredRenewalNotice(c); }).length;
  var noAnswerEl = document.getElementById('stNoAnswer');
  if (noAnswerEl) noAnswerEl.textContent = clients.filter(function(c){ return clientHasUnansweredRenewalNotice(c); }).length;
  updateBackupReminder();
}

function copyText(txt, btn) {
  var fallback = function() {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  };
  if (navigator.clipboard) { navigator.clipboard.writeText(txt).catch(fallback); } else { fallback(); }
  btn.textContent = 'Copiado!'; btn.classList.add('done');
  setTimeout(function(){ btn.textContent = 'Copiar'; btn.classList.remove('done'); }, 1800);
}

function formatMacInput(input) {
  input.addEventListener('input', function(e) {
    var v = e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    var parts = [];
    for (var i = 0; i < v.length && i < 12; i += 2) {
      parts.push(v.substr(i, 2));
    }
    var formatted = parts.join(':');
    e.target.value = formatted;
  });
}

function renderCards() {
  var search = document.getElementById('searchBox').value.toLowerCase();
  var container = document.getElementById('cardsContainer');
  var empty = document.getElementById('emptyState');
  if (!hasSelectedClientFilter && !search) {
    if (container) container.innerHTML = '';
    if (empty) {
      empty.style.display = 'block';
      empty.innerHTML = '<div class="ico">&#128064;</div><div>Selecciona un filtro para ver clientes</div><small style="display:block;margin-top:8px;color:var(--muted);font-size:12px">Pulsa Total, Activos, Expiran pronto, Pendientes de pago, Avisados, Contestados o Sin contestar.</small>';
    }
    return;
  }
  if (search) hasSelectedClientFilter = true;
  var filtered = clients.filter(function(c) {
    var tagText = normalizeClientTags(c.tags).join(' ').toLowerCase();
    var ms = !search || c.name.toLowerCase().indexOf(search)>=0 || (c.user||'').toLowerCase().indexOf(search)>=0 || tagText.indexOf(search)>=0;
    var mv = !filterSvc || c.service===filterSvc;
    var mt = !filterSt || (filterSt==='paypend' ? clientHasPendingPayment(c) : (filterSt==='advised' ? clientHasRenewalNotice(c) : (filterSt==='answered' ? clientHasAnsweredRenewalNotice(c) : (filterSt==='noanswer' ? clientHasUnansweredRenewalNotice(c) : (filterSt==='warn_no_advised' ? (getStatus(c.expiry)==='warn' && !clientHasRenewalNotice(c)) : (filterSt==='tag_no_contesta_renovar' ? (normalizeClientTags(c.tags).map(function(t){return t.toLowerCase();}).indexOf('no contesta al renovar')>=0) : (filterSt==='ok' ? (getStatus(c.expiry)==='ok'||getStatus(c.expiry)==='warn') : getStatus(c.expiry)===filterSt)))))));
    var mtag = !activeTagFilter || normalizeClientTags(c.tags).indexOf(activeTagFilter) >= 0;
    return ms && mv && mt && mtag;
  });
  filtered = sortClientsByExpiryAsc(filtered);
  container.innerHTML = '';
  if (empty) {
    empty.style.display = filtered.length ? 'none' : 'block';
    if (!filtered.length) empty.innerHTML = '<div class="ico">&#128250;</div><div>No hay clientes para este filtro</div>';
  }
  filtered.forEach(function(c) {
    var mainApp = c.apps && c.apps.length ? c.apps[0].name : '-';
    var svcLabel = c.service === 'ESPANA' ? 'ESPA\u00D1A' : esc(c.service);
    var div = document.createElement('div');
    div.className = 'clientCard';
    div.innerHTML =
      '<div class="clientCard-header">' +
        '<div class="clientCard-avatar">' + esc(avatarLetter(c.name)) + '</div>' +
        '<div class="clientCard-info">' +
          '<div class="clientCard-name">' + esc(c.name) + '</div>' +
          '<div class="clientCard-app">' + esc(mainApp) + '</div>' +
        '</div>' +
        '<div class="clientCard-badges">' +
          '<span class="badge ' + (c.service==='TODO'?'badgeTodo':'badgeEs') + '">' + svcLabel + '</span>' +
          statusBadge(c.expiry) +
          (clientHasPendingPayment(c) ? '<span class="badge badgePayPending">Pago pendiente</span>' : '') +
          (clientHasRenewalNotice(c) ? '<span class="badge badgeAdvised">Avisado</span>' : '') +
          renewalReplyBadgeHtml(c) +
        '</div>' +
      '</div>' +
      '<div class="clientCard-body">' +
        '<div class="copyField" style="flex-direction:column;align-items:flex-start">' +
          '<div class="copyField-label">Usuario</div>' +
          '<div style="display:flex;align-items:center;gap:6px;width:100%">' +
            '<span class="copyField-val">' + esc(c.user||'-') + '</span>' +
            (c.user ? '<button class="btnCopy" data-copy="'+esc(c.user)+'" onclick="copyText(this.dataset.copy,this)">Copiar</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="copyField" style="flex-direction:column;align-items:flex-start">' +
          '<div class="copyField-label">Contrasena</div>' +
          '<div style="display:flex;align-items:center;gap:6px;width:100%">' +
            '<span class="copyField-val pass">' + esc(c.pass||'-') + '</span>' +
            (c.pass ? '<button class="btnCopy" data-copy="'+esc(c.pass)+'" onclick="copyText(this.dataset.copy,this)">Copiar</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="clientCard-expiry">Expira: <span>' + formatDate(c.expiry) + '</span></div>' +
      clientTagsHtml(c) +
      renewalNoticeHtml(c, 'card') +
      pendingPaymentNoticeHtml(c, 'card') +
      '<div class="clientCard-actions">' +
        '<button class="act-ver" data-id="'+c.id+'" onclick="viewClient(this.dataset.id)">&#128065; Ver</button>' +
        '<button class="act-edit" data-id="'+c.id+'" onclick="editClient(this.dataset.id)">&#9998; Editar</button>' +
        '<button class="act-renew" data-id="'+c.id+'" onclick="openRenew(this.dataset.id)">&#8635; Renovar</button>' +
        '<button class="act-msg" data-id="'+c.id+'" onclick="openClientMessages(this.dataset.id)">&#128203; Msg</button>' +
        '<button class="act-del" data-id="'+c.id+'" onclick="openDelete(this.dataset.id)">&#128465; Borrar</button>' +
      '</div>';
    container.appendChild(div);
  });
  updateStats();
}

function buildAppsGrid() {
  var grid = document.getElementById('appsGrid');
  grid.innerHTML = '';
  selectedApps = [];
  APPS.forEach(function(app) {
    var chip = document.createElement('div');
    chip.className = 'appChip';
    chip.dataset.app = app.name;
    chip.textContent = app.name + (app.needsMac||app.needsCode?' *':'');
    chip.addEventListener('click', function() {
      var idx = selectedApps.indexOf(app.name);
      if (idx===-1) { selectedApps.push(app.name); chip.classList.add('selected'); }
      else { selectedApps.splice(idx,1); chip.classList.remove('selected'); }
      updateAppRequirements();
    });
    grid.appendChild(chip);
  });
}

function updateAppRequirements() {
  var noteEl = document.getElementById('appNote');
  var macBox = document.getElementById('macCodeBox');
  var otraBox = document.getElementById('otraAppBox');
  var reqApps = selectedApps.filter(function(n){ var a=APPS.find(function(x){return x.name===n;}); return a&&(a.needsMac||a.needsCode); });
  if (reqApps.length > 0) {
    noteEl.style.display = 'block';
    noteEl.innerHTML = 'AVISO: ' + reqApps.map(function(n){ return '<strong>'+n+'</strong> requiere MAC y Codigo'; }).join(' &bull; ');
    macBox.style.display = 'block';
    renderMacCodeForms();
  } else {
    noteEl.style.display = 'none';
    macBox.innerHTML = '';
    macBox.style.display = 'none';
  }
  otraBox.style.display = selectedApps.indexOf('OTRA APP NO CONOCIDA')>=0 ? 'block' : 'none';
}

function getExistingMacCodes() {
  var map = {};
  var id = document.getElementById('editId').value;
  if (!id) return map;
  var c = clients.find(function(x){ return x.id===id; });
  if (!c||!c.apps) return map;
  c.apps.forEach(function(a){ if(a.mac||a.code) map[a.name]={mac:a.mac,code:a.code}; });
  return map;
}

function renderMacCodeForms() {
  var box = document.getElementById('macCodeBox');
  box.innerHTML = '';
  var existing = getExistingMacCodes();
  var reqApps = selectedApps.filter(function(n){ var a=APPS.find(function(x){return x.name===n;}); return a&&(a.needsMac||a.needsCode); });
  reqApps.forEach(function(appName) {
    var prev = existing[appName]||{};
    var k = appName.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    var row = document.createElement('div');
    row.className = 'formRow2';
    row.innerHTML =
      '<div class="formGroup"><label>MAC de '+esc(appName)+' <span class="required-star">*</span></label><input type="text" id="mac_'+k+'" placeholder="AA:BB:CC:DD:EE:FF" maxlength="17" value="'+esc(prev.mac||'')+'"/></div>' +
      '<div class="formGroup"><label>Codigo de '+esc(appName)+' <span class="required-star">*</span></label><input type="text" id="code_'+k+'" placeholder="Codigo" value="'+esc(prev.code||'')+'"/></div>';
    box.appendChild(row);
    var macInput = document.getElementById('mac_'+k);
    if (macInput) formatMacInput(macInput);
  });
}

function renderOtraExtras() {
  var hasMac = document.getElementById('fOtraHasMac').value==='si';
  var hasCode = document.getElementById('fOtraHasCode').value==='si';
  var box = document.getElementById('otraExtrasBox');
  box.innerHTML = '';
  if (hasMac||hasCode) {
    var row = document.createElement('div'); row.className='formRow2';
    if (hasMac) row.innerHTML += '<div class="formGroup"><label>MAC</label><input type="text" id="fOtraMac" placeholder="AA:BB:CC:DD:EE:FF" maxlength="17"/></div>';
    if (hasCode) row.innerHTML += '<div class="formGroup"><label>Codigo</label><input type="text" id="fOtraCode" placeholder="Codigo"/></div>';
    box.appendChild(row);
    if (hasMac && document.getElementById('fOtraMac')) formatMacInput(document.getElementById('fOtraMac'));
  }
}

function openNewClient() {
  document.getElementById('editId').value='';
  document.getElementById('clientSheetTitle').textContent='Nuevo Cliente';
  document.getElementById('fName').value='';
  document.getElementById('fUser').value='';
  document.getElementById('fPass').value='';
  document.getElementById('fExpiry').value='';
  document.getElementById('fService').value='TODO';
  document.getElementById('fNotes').value='';
  renderClientTagsInput([]);
  var initialBox = document.getElementById('initialPaymentBox');
  var savePendingBtn = document.getElementById('saveClientPendingBtn');
  if (initialBox) initialBox.style.display = 'block';
  if (savePendingBtn) savePendingBtn.style.display = 'block';
  if (document.getElementById('fInitialAmount')) { document.getElementById('fInitialAmount').value=''; document.getElementById('fInitialAmount').style.borderColor=''; }
  if (document.getElementById('fInitialPaymentMethod')) document.getElementById('fInitialPaymentMethod').value='Bizum';
  if (document.getElementById('fInitialPaymentNotes')) document.getElementById('fInitialPaymentNotes').value='';
  document.getElementById('formError').style.display='none';
  buildAppsGrid(); updateAppRequirements();
  openSheet('clientSheet','clientOverlay');
}

function editClient(id) {
  var c = clients.find(function(x){ return x.id===id; });
  if (!c) return;
  document.getElementById('editId').value=id;
  document.getElementById('clientSheetTitle').textContent='Editar Cliente';
  document.getElementById('fName').value=c.name;
  document.getElementById('fUser').value=c.user||'';
  document.getElementById('fPass').value=c.pass||'';
  document.getElementById('fExpiry').value=c.expiry||'';
  document.getElementById('fService').value=c.service||'TODO';
  document.getElementById('fNotes').value=c.notes||'';
  renderClientTagsInput(c.tags||[]);
  var initialBox = document.getElementById('initialPaymentBox');
  var savePendingBtn = document.getElementById('saveClientPendingBtn');
  if (initialBox) initialBox.style.display = 'none';
  if (savePendingBtn) savePendingBtn.style.display = 'none';
  if (document.getElementById('fInitialAmount')) document.getElementById('fInitialAmount').value='';
  if (document.getElementById('fInitialPaymentNotes')) document.getElementById('fInitialPaymentNotes').value='';
  document.getElementById('formError').style.display='none';
  buildAppsGrid();
  selectedApps=(c.apps||[]).map(function(a){return a.name;});
  selectedApps.forEach(function(n){ var ch=document.querySelector('[data-app="'+n+'"]'); if(ch) ch.classList.add('selected'); });
  updateAppRequirements();
  if (selectedApps.indexOf('OTRA APP NO CONOCIDA')>=0) {
    var otra=(c.apps||[]).find(function(a){return a.name==='OTRA APP NO CONOCIDA';});
    if (otra) {
      document.getElementById('fOtraApp').value=otra.customName||'';
      document.getElementById('fOtraHasMac').value=otra.mac?'si':'no';
      document.getElementById('fOtraHasCode').value=otra.code?'si':'no';
      renderOtraExtras();
      setTimeout(function(){
        if(otra.mac&&document.getElementById('fOtraMac')) document.getElementById('fOtraMac').value=otra.mac;
        if(otra.code&&document.getElementById('fOtraCode')) document.getElementById('fOtraCode').value=otra.code;
      },50);
    }
  }
  openSheet('clientSheet','clientOverlay');
}

async function saveClient(markInitialPending) {
  markInitialPending = !!markInitialPending;
  var errEl = document.getElementById('formError');
  errEl.style.display='none';
  var name=document.getElementById('fName').value.trim();
  var user=document.getElementById('fUser').value.trim();
  var pass=document.getElementById('fPass').value.trim();
  var expiry=document.getElementById('fExpiry').value;
  var service=document.getElementById('fService').value;
  var notes=document.getElementById('fNotes').value.trim();
  var tags=getSelectedClientTags();
  var id=document.getElementById('editId').value;
  var creatingNew = !id;
  var initialAmountEl = document.getElementById('fInitialAmount');
  var initialMethodEl = document.getElementById('fInitialPaymentMethod');
  var initialNotesEl = document.getElementById('fInitialPaymentNotes');
  var initialAmount = creatingNew ? parseEuroAmount(initialAmountEl ? initialAmountEl.value : '') : 0;
  if (creatingNew && isNaN(initialAmount)) {
    errEl.textContent='Importe inicial no valido. Ejemplo: 25 o 25,00';
    errEl.style.display='block';
    if (initialAmountEl) { initialAmountEl.style.borderColor='var(--red)'; initialAmountEl.focus(); }
    return;
  }
  if(!name){errEl.textContent='El nombre es obligatorio.';errEl.style.display='block';return;}
  if(!user){errEl.textContent='El usuario es obligatorio.';errEl.style.display='block';return;}
  if(!pass){errEl.textContent='La contrasena es obligatoria.';errEl.style.display='block';return;}
  if(!expiry){errEl.textContent='La fecha de expiracion es obligatoria.';errEl.style.display='block';return;}
  if(selectedApps.length===0){errEl.textContent='Selecciona al menos una app.';errEl.style.display='block';return;}
  for(var i=0;i<selectedApps.length;i++){
    var an=selectedApps[i];
    var ad=APPS.find(function(x){return x.name===an;});
    var k=an.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    if(ad&&ad.needsMac){var me=document.getElementById('mac_'+k);if(!me||!me.value.trim()){errEl.textContent='MAC de '+an+' es obligatoria.';errEl.style.display='block';return;}}
    if(ad&&ad.needsCode){var ce=document.getElementById('code_'+k);if(!ce||!ce.value.trim()){errEl.textContent='Codigo de '+an+' es obligatorio.';errEl.style.display='block';return;}}
  }
  if(selectedApps.indexOf('OTRA APP NO CONOCIDA')>=0&&!document.getElementById('fOtraApp').value.trim()){
    errEl.textContent='Especifica el nombre de la app.';errEl.style.display='block';return;
  }
  var appsData=selectedApps.map(function(an){
    var ad=APPS.find(function(x){return x.name===an;});
    var obj={name:an};
    if(an==='OTRA APP NO CONOCIDA'){
      obj.customName=document.getElementById('fOtraApp').value.trim();
      if(document.getElementById('fOtraHasMac').value==='si'&&document.getElementById('fOtraMac')) obj.mac=document.getElementById('fOtraMac').value.trim();
      if(document.getElementById('fOtraHasCode').value==='si'&&document.getElementById('fOtraCode')) obj.code=document.getElementById('fOtraCode').value.trim();
    } else if(ad&&(ad.needsMac||ad.needsCode)){
      var k=an.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      if(ad.needsMac) obj.mac=document.getElementById('mac_'+k).value.trim();
      if(ad.needsCode) obj.code=document.getElementById('code_'+k).value.trim();
    }
    return obj;
  });
  try {
    var existingClient = id ? clients.find(function(x){ return x.id === id; }) : null;
    var clientObj = {
      id:id||'',
      name:name,
      user:user,
      pass:pass,
      expiry:expiry,
      service:service,
      notes:notes,
      tags:tags,
      apps:appsData,
      createdAt: existingClient && existingClient.createdAt ? existingClient.createdAt : new Date().toISOString(),
      avisoRenovacionEnviado: existingClient ? !!existingClient.avisoRenovacionEnviado : false,
      avisoRenovacionFecha: existingClient ? existingClient.avisoRenovacionFecha : null,
      avisoRenovacionExpiracion: existingClient ? existingClient.avisoRenovacionExpiracion : null,
      avisoRenovacionContestado: existingClient ? !!existingClient.avisoRenovacionContestado : false,
      avisoRenovacionContestadoFecha: existingClient ? existingClient.avisoRenovacionContestadoFecha : null,
      avisoRenovacionContestadoExpiracion: existingClient ? existingClient.avisoRenovacionContestadoExpiracion : null
    };
    if (existingClient && existingClient.expiry !== expiry) {
      clientObj.avisoRenovacionEnviado = false;
      clientObj.avisoRenovacionFecha = null;
      clientObj.avisoRenovacionExpiracion = null;
      clientObj.avisoRenovacionContestado = false;
      clientObj.avisoRenovacionContestadoFecha = null;
      clientObj.avisoRenovacionContestadoExpiracion = null;
    }
    var saved = await saveClientToStore(clientObj);
    if(id){
      var idx=clients.findIndex(function(x){return x.id===id;});
      if(idx>=0) clients[idx]=saved; else clients.unshift(saved);
    } else {
      clients.unshift(saved);
    }

    var paymentMessage = '';
    if (creatingNew && (markInitialPending || Number(initialAmount || 0) > 0)) {
      try {
        var initialItem = await saveRenewalToStore({
          clientId: saved.id,
          clientName: saved.name,
          previousExpiry: '',
          newExpiry: saved.expiry || '',
          months: 0,
          amount: Number(initialAmount || 0),
          paymentMethod: markInitialPending ? 'Pendiente' : (initialMethodEl ? initialMethodEl.value : 'Bizum'),
          paymentStatus: markInitialPending ? 'pendiente' : 'pagado',
          paymentPaidAt: markInitialPending ? '' : new Date().toISOString(),
          notes: initialNotesEl ? initialNotesEl.value.trim() : ''
        });
        if (!renewals.find(function(r){ return r.id === initialItem.id; })) renewals.unshift(initialItem);
        paymentMessage = markInitialPending ? ' Pago pendiente registrado.' : ' Pago registrado: ' + euro(initialAmount);
      } catch(payErr) {
        console.error(payErr);
        paymentMessage = ' Cliente guardado, pero el pago inicial no se pudo registrar. Revisa SQL renovaciones.';
      }
    }

    saveData(); closeSheet('clientSheet','clientOverlay'); renderCards();
    if (typeof showToast === 'function') showToast('Cliente guardado.' + paymentMessage, paymentMessage.indexOf('no se pudo') >= 0 ? 'error' : undefined);
  } catch(ex) {
    errEl.textContent='Error al guardar: '+ex.message;
    errEl.style.display='block';
  }
}

function viewClient(id) {
  var c=clients.find(function(x){return x.id===id;});
  if(!c) return;
  document.getElementById('viewSheetTitle').textContent=c.name;
  var svcLabel = c.service === 'ESPANA' ? 'ESPA\u00D1A' : esc(c.service);
  var html='';
  html+='<div class="viewRow"><div class="vlabel">Servicio</div><div class="vval"><span class="badge '+(c.service==='TODO'?'badgeTodo':'badgeEs')+'">'+svcLabel+'</span></div></div>';
  html+='<div class="viewRow"><div class="vlabel">Expiracion</div><div class="vval">'+formatDate(c.expiry)+' '+statusBadge(c.expiry)+(clientHasPendingPayment(c)?' <span class="badge badgePayPending">Pago pendiente</span>':'')+(clientHasRenewalNotice(c)?' <span class="badge badgeAdvised">Avisado</span>':'')+renewalReplyBadgeHtml(c)+'</div></div>';
  if (normalizeClientTags(c.tags).length) html+='<div class="viewRow"><div class="vlabel">Etiquetas</div><div class="vval">'+clientTagsHtml(c)+'</div></div>';
  html+=renewalNoticeHtml(c, 'view');
  html+=pendingPaymentNoticeHtml(c, 'view');
  html+='<div class="viewRow"><div class="vlabel">Usuario</div><div style="display:flex;align-items:center;gap:8px"><span style="font-family:monospace;color:var(--cyan)">'+esc(c.user||'-')+'</span>'+(c.user?'<button class="btnCopy" data-copy="'+esc(c.user)+'" onclick="copyText(this.dataset.copy,this)">Copiar</button>':'')+'</div></div>';
  html+='<div class="viewRow"><div class="vlabel">Contrasena</div><div style="display:flex;align-items:center;gap:8px"><span style="font-family:monospace">'+esc(c.pass||'-')+'</span>'+(c.pass?'<button class="btnCopy" data-copy="'+esc(c.pass)+'" onclick="copyText(this.dataset.copy,this)">Copiar</button>':'')+'</div></div>';
  html+='<div class="vlabel" style="margin-bottom:10px">Apps instaladas</div>';
  (c.apps||[]).forEach(function(a,i){
    html+='<div class="viewApp"><div class="viewApp-name" style="color:'+(i===0?'var(--cyan)':'var(--text)')+'">'+esc(a.name)+(a.customName?' ('+esc(a.customName)+')':'')+(i===0?' <span style="font-size:.7rem;color:var(--green)">[Principal]</span>':'')+'</div>';
    if(a.mac) html+='<div style="font-size:.8rem;color:var(--muted);margin-top:6px;display:flex;align-items:center;gap:6px">MAC: <span style="font-family:monospace;color:var(--text)">'+esc(a.mac)+'</span><button class="btnCopy" data-copy="'+esc(a.mac)+'" onclick="copyText(this.dataset.copy,this)">Copiar</button></div>';
    if(a.code) html+='<div style="font-size:.8rem;color:var(--muted);margin-top:4px;display:flex;align-items:center;gap:6px">Cod: <span style="font-family:monospace;color:var(--text)">'+esc(a.code)+'</span><button class="btnCopy" data-copy="'+esc(a.code)+'" onclick="copyText(this.dataset.copy,this)">Copiar</button></div>';
    html+='</div>';
  });
  if(c.notes) html+='<div class="viewRow" style="margin-top:10px"><div class="vlabel">Notas</div><div class="vval" style="color:var(--muted)">'+esc(c.notes)+'</div></div>';
  html+=clientRenewalsHtml(c);
  html+='<button class="btnFull primary" data-id="'+c.id+'" onclick="openClientMessages(this.dataset.id)" style="margin-top:12px">&#128203; Copiar mensajes rapidos</button>';
  document.getElementById('viewSheetBody').innerHTML=html;
  openSheet('viewSheet','viewOverlay');
}



// ========== PLANTILLAS EDITABLES DE MENSAJES ==========
var MESSAGE_TEMPLATE_STORAGE_KEY = 'm17_message_templates_v1';
var messageTemplatesLoaded = false;
var DEFAULT_MESSAGE_TEMPLATES = {
  access: '{saludo}\n\nEstos son tus datos de acceso:\n\nApp: {app}\nUsuario: {usuario}\nContraseña: {password}\nFecha de expiración: {expiracion}\n\nRecuerda que te avisaré 15 días antes para su renovación.',
  expiry: '{saludo}\n\nEste es un aviso de que te quedan 15 días para que te caduque el servicio.\n\nFecha de caducidad: {expiracion}\n\nPuedes renovarlo cuando quieras para evitar cortes en el servicio.',
  renewed: '{saludo}\n\nTu servicio ha sido renovado correctamente.\n\nNueva fecha de expiración: {expiracion}\n\nEstamos en contacto.',
  expired: '{saludo}\n\nTu servicio expiró el día {expiracion}.\n\nSi quieres reactivarlo, dime y te lo renuevo.'
};
var messageTemplates = Object.assign({}, DEFAULT_MESSAGE_TEMPLATES);

function loadLocalMessageTemplates() {
  try {
    var saved = JSON.parse(localStorage.getItem(MESSAGE_TEMPLATE_STORAGE_KEY) || '{}');
    messageTemplates = Object.assign({}, DEFAULT_MESSAGE_TEMPLATES, saved || {});
  } catch(e) {
    messageTemplates = Object.assign({}, DEFAULT_MESSAGE_TEMPLATES);
  }
}

function saveLocalMessageTemplates() {
  try { localStorage.setItem(MESSAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(messageTemplates)); } catch(e) {}
}

async function loadMessageTemplates(showMsg) {
  loadLocalMessageTemplates();

  if (!USE_SUPABASE) {
    messageTemplatesLoaded = true;
    return messageTemplates;
  }

  try {
    var db = initSupabase();
    var result = await db.from(SUPABASE_MESSAGE_TEMPLATES_TABLE).select('tipo,texto');
    if (result.error) throw result.error;

    (result.data || []).forEach(function(row){
      if (row && row.tipo && Object.prototype.hasOwnProperty.call(DEFAULT_MESSAGE_TEMPLATES, row.tipo)) {
        messageTemplates[row.tipo] = row.texto || DEFAULT_MESSAGE_TEMPLATES[row.tipo];
      }
    });

    saveLocalMessageTemplates();
    messageTemplatesLoaded = true;
    if (showMsg && typeof showToast === 'function') showToast('Plantillas cargadas');
  } catch(ex) {
    console.warn('No se pudieron cargar plantillas desde Supabase', ex);
    messageTemplatesLoaded = true;
    if (showMsg && typeof showToast === 'function') showToast('Usando plantillas locales. Revisa SQL message_templates si quieres sincronizarlas.', 'error');
  }

  return messageTemplates;
}

function messageTemplateValue(type) {
  return (messageTemplates && messageTemplates[type]) || DEFAULT_MESSAGE_TEMPLATES[type] || '';
}

function messageTemplateVars(c) {
  var name = c && c.name ? c.name : '';
  var saludo = name ? 'Hola ' + name + ' 👋' : 'Hola 👋';
  return {
    saludo: saludo,
    nombre: name || '',
    app: getClientMainApp(c),
    usuario: c && c.user ? c.user : '-',
    password: c && c.pass ? c.pass : '-',
    contrasena: c && c.pass ? c.pass : '-',
    expiracion: formatDate(c && c.expiry ? c.expiry : ''),
    servicio: c && c.service ? c.service : '-',
    fecha_hoy: formatDate(new Date().toISOString().split('T')[0]),
    notas: c && c.notes ? c.notes : ''
  };
}

function applyMessageTemplate(type, c) {
  var tpl = messageTemplateValue(type);
  var vars = messageTemplateVars(c);
  return String(tpl || '').replace(/\{([a-zA-Z0-9_]+)\}/g, function(full, key){
    key = String(key || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : full;
  });
}

async function openMessageTemplateEditor() {
  await loadMessageTemplates(false);

  var map = {
    msgTplAccess: 'access',
    msgTplExpiry: 'expiry',
    msgTplRenewed: 'renewed',
    msgTplExpired: 'expired'
  };

  Object.keys(map).forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = messageTemplateValue(map[id]);
  });

  var err = document.getElementById('messageTemplateError');
  if (err) { err.textContent = ''; err.style.display = 'none'; }

  openSheet('messageTemplateSheet','messageTemplateOverlay');
}

async function saveMessageTemplates(btn) {
  var oldText = btn ? btn.textContent : '';
  var err = document.getElementById('messageTemplateError');
  var next = {
    access: (document.getElementById('msgTplAccess') || {}).value || DEFAULT_MESSAGE_TEMPLATES.access,
    expiry: (document.getElementById('msgTplExpiry') || {}).value || DEFAULT_MESSAGE_TEMPLATES.expiry,
    renewed: (document.getElementById('msgTplRenewed') || {}).value || DEFAULT_MESSAGE_TEMPLATES.renewed,
    expired: (document.getElementById('msgTplExpired') || {}).value || DEFAULT_MESSAGE_TEMPLATES.expired
  };

  messageTemplates = Object.assign({}, DEFAULT_MESSAGE_TEMPLATES, next);
  saveLocalMessageTemplates();

  try {
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    if (USE_SUPABASE) {
      var db = initSupabase();
      var userRes = await db.auth.getUser();
      var ownerId = userRes && userRes.data && userRes.data.user ? userRes.data.user.id : null;
      if (!ownerId) throw new Error('No se pudo identificar el usuario.');

      var rows = Object.keys(next).map(function(key){
        return {
          owner_id: ownerId,
          tipo: key,
          texto: next[key],
          updated_at: new Date().toISOString()
        };
      });

      var result = await db.from(SUPABASE_MESSAGE_TEMPLATES_TABLE).upsert(rows, { onConflict: 'owner_id,tipo' });
      if (result.error) throw result.error;
    }

    if (typeof showToast === 'function') showToast('Plantillas guardadas');
    closeSheet('messageTemplateSheet','messageTemplateOverlay');
  } catch(ex) {
    var msg = ex && ex.message ? ex.message : 'No se pudieron guardar las plantillas.';
    if (err) { err.textContent = 'Guardado local realizado. Error Supabase: ' + msg; err.style.display = 'block'; }
    else alert('Guardado local realizado. Error Supabase: ' + msg);
    if (typeof showToast === 'function') showToast('Guardado local. Revisa SQL de plantillas.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText || 'Guardar plantillas'; }
  }
}

function resetMessageTemplatesToDefault() {
  var ok = confirm('¿Restaurar los textos originales de las 4 plantillas?');
  if (!ok) return;
  messageTemplates = Object.assign({}, DEFAULT_MESSAGE_TEMPLATES);
  saveLocalMessageTemplates();

  var ids = {
    msgTplAccess: 'access',
    msgTplExpiry: 'expiry',
    msgTplRenewed: 'renewed',
    msgTplExpired: 'expired'
  };
  Object.keys(ids).forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = DEFAULT_MESSAGE_TEMPLATES[ids[id]];
  });

  if (typeof showToast === 'function') showToast('Textos originales restaurados. Pulsa Guardar plantillas para sincronizar.');
}


function cleanupDuplicateMessageTemplateButtons() {
  try {
    var messageSheet = document.getElementById('messageSheet');
    if (!messageSheet) return;
    var body = messageSheet.querySelector('.sheet-body');
    if (!body) return;

    var buttons = Array.prototype.slice.call(body.querySelectorAll('button')).filter(function(btn){
      return (btn.id === 'openMessageTemplateEditorBtn') ||
        (String(btn.getAttribute('onclick') || '').indexOf('openMessageTemplateEditor') >= 0) ||
        (String(btn.textContent || '').indexOf('Editar plantillas de mensajes') >= 0);
    });

    if (buttons.length <= 1) {
      if (buttons[0]) buttons[0].id = 'openMessageTemplateEditorBtn';
      return;
    }

    buttons.forEach(function(btn, index){
      if (index === 0) {
        btn.id = 'openMessageTemplateEditorBtn';
        btn.onclick = function(){ openMessageTemplateEditor(); };
      } else {
        btn.remove();
      }
    });
  } catch(e) {
    console.warn('No se pudieron limpiar botones duplicados de Msg', e);
  }
}

function ensureMessageTemplateEditorUi() {
  try {
    var messageSheet = document.getElementById('messageSheet');
    if (messageSheet) {
      var body = messageSheet.querySelector('.sheet-body');
      if (body && !body.querySelector('#openMessageTemplateEditorBtn, button[onclick*="openMessageTemplateEditor"]')) {
        var closeBtn = body.querySelector('button[onclick*="closeSheet"][onclick*="messageSheet"]');
        var btn = document.createElement('button');
        btn.className = 'btnFull primary';
        btn.id = 'openMessageTemplateEditorBtn';
        btn.style.marginTop = '12px';
        btn.innerHTML = '&#9998; Editar plantillas de mensajes';
        btn.onclick = function(){ openMessageTemplateEditor(); };
        if (closeBtn && closeBtn.parentNode === body) body.insertBefore(btn, closeBtn);
        else body.appendChild(btn);
      }
      var info = document.getElementById('messageInfo');
      if (info) info.textContent = 'Pulsa el tipo de mensaje para copiarlo. También puedes editar las plantillas y guardarlas para todos los clientes.';
    }

    if (!document.getElementById('messageTemplateSheet')) {
      var overlay = document.createElement('div');
      overlay.className = 'sheet-overlay';
      overlay.id = 'messageTemplateOverlay';
      overlay.onclick = function(){ closeSheet('messageTemplateSheet','messageTemplateOverlay'); };

      var sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.id = 'messageTemplateSheet';
      sheet.innerHTML =
        '<div class="sheet-handle"></div>' +
        '<div class="sheet-header">' +
          '<h3>&#9998; Editar plantillas Msg</h3>' +
          '<button class="sheet-close" onclick="closeSheet(&quot;messageTemplateSheet&quot;,&quot;messageTemplateOverlay&quot;)">x</button>' +
        '</div>' +
        '<div class="sheet-body">' +
          '<div class="messageTemplateHelp">' +
            'Puedes cambiar los textos y se aplicarán a todos los clientes. Mantén las variables entre llaves para que la app ponga los datos de cada cliente.' +
            '<div class="messageTemplateVars">{saludo} · {nombre} · {app} · {usuario} · {password} · {expiracion} · {servicio} · {fecha_hoy}</div>' +
          '</div>' +
          '<div class="formGroup"><label>Datos de acceso</label><textarea id="msgTplAccess" class="msgTemplateTextarea" rows="9"></textarea></div>' +
          '<div class="formGroup"><label>Aviso de caducidad</label><textarea id="msgTplExpiry" class="msgTemplateTextarea" rows="8"></textarea></div>' +
          '<div class="formGroup"><label>Renovación OK</label><textarea id="msgTplRenewed" class="msgTemplateTextarea" rows="7"></textarea></div>' +
          '<div class="formGroup"><label>Cliente caducado</label><textarea id="msgTplExpired" class="msgTemplateTextarea" rows="7"></textarea></div>' +
          '<div class="formError" id="messageTemplateError"></div>' +
          '<button class="btnFull primary" id="messageTemplateSaveBtn" onclick="saveMessageTemplates(this)">&#128190; Guardar plantillas</button>' +
          '<button class="btnFull gray" onclick="resetMessageTemplatesToDefault()" style="margin-top:8px">&#8634; Restaurar textos originales</button>' +
          '<button class="btnFull gray" onclick="closeSheet(&quot;messageTemplateSheet&quot;,&quot;messageTemplateOverlay&quot;)" style="margin-top:8px">Cerrar</button>' +
        '</div>';

      document.body.appendChild(overlay);
      document.body.appendChild(sheet);
    }
    cleanupDuplicateMessageTemplateButtons();
  } catch(e) {
    console.warn('No se pudo preparar el editor de plantillas de mensajes', e);
  }
}

// ========== FIN PLANTILLAS EDITABLES DE MENSAJES ==========


function getClientMainApp(c) {
  if (!c || !c.apps || !c.apps.length) return '-';
  var a = c.apps[0];
  return a.customName ? a.customName : (a.name || '-');
}

function getClientById(id) {
  return clients.find(function(x){ return x.id === id; });
}

function buildClientMessage(c, type) {
  return applyMessageTemplate(type, c);
}

function openClientMessages(id) {
  messageTargetId = id;
  ensureMessageTemplateEditorUi();
  var c = getClientById(id);
  if (!c) return;
  var title = document.getElementById('messageSheetTitle');
  var info = document.getElementById('messageInfo');
  if (title) title.textContent = 'Mensajes · ' + c.name;
  if (info) info.textContent = 'Pulsa el tipo de mensaje para copiarlo. Si quieres cambiar el texto para todos los clientes, entra en “Editar plantillas de mensajes”.';
  openSheet('messageSheet','messageOverlay');
  setTimeout(function(){ ensureMessageTemplateEditorUi(); cleanupDuplicateMessageTemplateButtons(); }, 80);
}

function copyMessageText(txt, btn) {
  var fallback = function() {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  };
  var done = function(){
    if (btn) {
      var old = btn.innerHTML;
      btn.innerHTML = '&#10003; Copiado';
      btn.disabled = true;
      setTimeout(function(){ btn.innerHTML = old; btn.disabled = false; }, 1400);
    }
    if (typeof showToast === 'function') showToast('Mensaje copiado');
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(done).catch(function(){ fallback(); done(); });
  } else {
    fallback();
    done();
  }
}

async function copyClientMessage(type, btn) {
  var c = getClientById(messageTargetId);
  if (!c) return;
  await loadMessageTemplates(false);
  var txt = buildClientMessage(c, type);
  copyMessageText(txt, btn);
}

function openDelete(id) { deleteTargetId=id; openSheet('deleteSheet','deleteOverlay'); }
async function confirmDelete() {
  try {
    await deleteClientFromStore(deleteTargetId);
    clients=clients.filter(function(x){return x.id!==deleteTargetId;});
    saveData(); closeSheet('deleteSheet','deleteOverlay'); renderCards();
    if (typeof showToast === 'function') showToast('Cliente eliminado');
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al eliminar: '+ex.message, 'error'); else alert('Error al eliminar: '+ex.message);
  }
}

function openDeleteAllClients() {
  closeSheet('menuSheet','menuOverlay');
  if (!clients.length) {
    if (typeof showToast === 'function') showToast('No hay clientes para borrar'); else alert('No hay clientes para borrar.');
    return;
  }
  var pass = document.getElementById('deleteAllPass');
  var err = document.getElementById('deleteAllError');
  var btn = document.getElementById('deleteAllConfirmBtn');
  if (pass) { pass.value = ''; pass.style.borderColor = ''; }
  if (err) { err.textContent = ''; err.style.display = 'none'; }
  if (btn) { btn.disabled = false; btn.textContent = 'Borrar todos los clientes'; }
  openSheet('deleteAllSheet','deleteAllOverlay');
  setTimeout(function(){ if (pass) pass.focus(); }, 250);
}


function setDeleteAllError(message) {
  var err = document.getElementById('deleteAllError');
  var passEl = document.getElementById('deleteAllPass');
  if (err) {
    err.textContent = message;
    err.style.display = 'block';
  }
  if (passEl) {
    passEl.style.borderColor = 'var(--red)';
    try { passEl.focus(); passEl.select(); } catch(e) {}
  }
  if (typeof showToast === 'function') showToast(message, 'error');
}

function clearDeleteAllError() {
  var err = document.getElementById('deleteAllError');
  var passEl = document.getElementById('deleteAllPass');
  if (err) {
    err.textContent = '';
    err.style.display = 'none';
  }
  if (passEl) passEl.style.borderColor = '';
}

async function verifyDeleteAllPassword(password) {
  if (!password) throw new Error('Escribe la contrasena para confirmar.');

  if (USE_SUPABASE) {
    var db = initSupabase();
    var userRes = await db.auth.getUser();
    if (userRes.error) throw userRes.error;
    var email = userRes.data && userRes.data.user && userRes.data.user.email;
    if (!email) throw new Error('No se ha podido comprobar el usuario actual. Cierra sesion y vuelve a entrar.');
    var res = await db.auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw new Error('Contrasena incorrecta.');
    return true;
  }

  var okPass = ADMIN_PASS_HASH && (await sha256Text(password)) === ADMIN_PASS_HASH;
  if (!okPass) throw new Error('Contrasena incorrecta.');
  return true;
}

async function confirmDeleteAllClients() {
  var passEl = document.getElementById('deleteAllPass');
  var err = document.getElementById('deleteAllError');
  var btn = document.getElementById('deleteAllConfirmBtn');
  try {
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    if (!clients.length) throw new Error('No hay clientes para borrar.');
    var password = passEl ? passEl.value : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Comprobando...'; }
    await verifyDeleteAllPassword(password);

    var total = clients.length;
    var really = confirm('Vas a borrar ' + total + ' clientes. Esta accion no se puede deshacer. ¿Continuar?');
    if (!really) {
      if (btn) { btn.disabled = false; btn.textContent = 'Borrar todos los clientes'; }
      return;
    }

    if (btn) btn.textContent = 'Borrando...';
    await deleteAllClientsFromStore();
    clients = [];
    saveData();
    closeSheet('deleteAllSheet','deleteAllOverlay');
    renderCards();
    updateStats();
    if (typeof showToast === 'function') showToast('Todos los clientes han sido borrados');
  } catch(ex) {
    var msg = ex && ex.message ? ex.message : 'Error al borrar clientes';
    var low = String(msg).toLowerCase();
    if (low.indexOf('contrasena incorrecta') !== -1 || low.indexOf('contraseña incorrecta') !== -1 || low.indexOf('invalid login') !== -1 || low.indexOf('invalid credentials') !== -1) {
      msg = 'Contraseña errónea. No se ha borrado ningún cliente.';
    }
    if (err) setDeleteAllError(msg);
    else alert('Error al borrar clientes: ' + msg);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Borrar todos los clientes'; }
  }
}

function openRenew(id) {
  renewTargetId=id;
  renewMonths=1;
  var c=clients.find(function(x){return x.id===id;});
  document.getElementById('renewInfo').textContent='Cliente: '+c.name+' \u00b7 Expira: '+formatDate(c.expiry);
  document.getElementById('renewMonthsVal').textContent='1';
  var amountEl = document.getElementById('renewAmount');
  var methodEl = document.getElementById('renewPaymentMethod');
  var notesEl = document.getElementById('renewPaymentNotes');
  var errEl = document.getElementById('renewPaymentError');
  var btn = document.getElementById('renewConfirmBtn');
  if (amountEl) {
    amountEl.value = '';
    amountEl.style.borderColor = '';
    amountEl.oninput = function(){
      if (String(amountEl.value || '').trim() !== '') {
        amountEl.style.borderColor = '';
        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      }
      if (btn) { btn.disabled = false; btn.innerHTML = '&#8635; Confirmar Renovacion'; }
    };
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '&#8635; Confirmar Renovacion'; }
  if (methodEl) methodEl.value = 'Bizum';
  if (notesEl) notesEl.value = '';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  updateRenewHint(c);
  openSheet('renewSheet','renewOverlay');
}
function changeRenewMonths(delta) {
  renewMonths = Math.max(1, Math.min(24, renewMonths + delta));
  document.getElementById('renewMonthsVal').textContent = renewMonths;
  var c=clients.find(function(x){return x.id===renewTargetId;});
  if(c) updateRenewHint(c);
}
function updateRenewHint(c) {
  var base=c.expiry?new Date(c.expiry):new Date();
  var preview=new Date(base);
  preview.setMonth(preview.getMonth()+renewMonths);
  var previewStr=preview.toISOString().split('T')[0];
  document.getElementById('renewMonthsHint').textContent='Nueva fecha: '+formatDate(previewStr);
}
async function doRenew(markAsPending) {
  markAsPending = !!markAsPending;
  var c=clients.find(function(x){return x.id===renewTargetId;});
  if(!c) return;
  var amountEl = document.getElementById('renewAmount');
  var methodEl = document.getElementById('renewPaymentMethod');
  var notesEl = document.getElementById('renewPaymentNotes');
  var errEl = document.getElementById('renewPaymentError');
  var btn = document.getElementById('renewConfirmBtn');
  var pendingBtn = document.getElementById('renewPendingBtn');
  var rawAmount = amountEl ? String(amountEl.value || '').trim() : '';

  // IMPORTANTE: el importe vacio NO confirma como pagado.
  // Debe usarse "Paga mas tarde" o escribir una cantidad. Para gratis, escribir 0.
  if (!markAsPending && rawAmount === '') {
    if (errEl) {
      errEl.textContent = 'Importe obligatorio: escribe una cantidad o 0 si es gratis. Si te pagara despues, pulsa “Paga mas tarde”.';
      errEl.style.display = 'block';
    }
    if (amountEl) { amountEl.style.borderColor = 'var(--red)'; amountEl.focus(); }
    if (btn) { btn.disabled = false; btn.innerHTML = '&#8635; Confirmar Renovacion'; }
    return;
  }

  var amount = parseEuroAmount(rawAmount);
  if (isNaN(amount)) {
    if (errEl) { errEl.textContent = 'Importe no valido. Ejemplo: 10, 10,50 o 0'; errEl.style.display = 'block'; }
    if (amountEl) { amountEl.style.borderColor = 'var(--red)'; amountEl.focus(); }
    if (btn) { btn.disabled = false; btn.innerHTML = '&#8635; Confirmar Renovacion'; }
    return;
  }
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (amountEl) amountEl.style.borderColor = '';
  var previousExpiry = c.expiry || '';
  var base=c.expiry?new Date(c.expiry):new Date();
  base.setMonth(base.getMonth()+renewMonths);
  var newExpiry = base.toISOString().split('T')[0];
  c.expiry=newExpiry;
  c.avisoRenovacionEnviado = false;
  c.avisoRenovacionFecha = null;
  c.avisoRenovacionExpiracion = null;
  c.avisoRenovacionContestado = false;
  c.avisoRenovacionContestadoFecha = null;
  c.avisoRenovacionContestadoExpiracion = null;
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando renovacion...'; }
    if (pendingBtn) { pendingBtn.disabled = true; pendingBtn.textContent = 'Guardando paga mas tarde...'; }
    var saved = await saveClientToStore(c);
    var idx=clients.findIndex(function(x){return x.id===renewTargetId;});
    if(idx>=0) clients[idx]=saved;

    var renewalSaved = false;
    try {
      var item = await saveRenewalToStore({
        clientId: saved.id,
        clientName: saved.name,
        previousExpiry: previousExpiry,
        newExpiry: saved.expiry,
        months: renewMonths,
        amount: amount,
        paymentMethod: markAsPending ? 'Pendiente' : (methodEl ? methodEl.value : ''),
        paymentStatus: markAsPending ? 'pendiente' : 'pagado',
        paymentPaidAt: markAsPending ? '' : new Date().toISOString(),
        notes: notesEl ? notesEl.value.trim() : ''
      });
      renewalSaved = true;
      if (!renewals.find(function(r){ return r.id === item.id; })) renewals.unshift(item);
    } catch(payErr) {
      console.error(payErr);
      if (typeof showToast === 'function') showToast('Cliente renovado, pero el pago no se guardo. Revisa SQL renovaciones.', 'error');
    }

    saveData(); closeSheet('renewSheet','renewOverlay'); renderCards();
    var msg = 'Renovado ' + renewMonths + ' mes(es)!\nNueva fecha: '+formatDate(saved.expiry);
    if (renewalSaved) msg += markAsPending ? '\nPago pendiente registrado. Aparecera en Pendientes de pago.' : '\nPago registrado: ' + euro(amount);
    alert(msg);
  } catch(ex) {
    if (typeof showToast === 'function') showToast('Error al renovar: '+ex.message, 'error'); else alert('Error al renovar: '+ex.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '&#8635; Confirmar Renovacion'; }
    if (pendingBtn) { pendingBtn.disabled = false; pendingBtn.innerHTML = '&#9203; Paga mas tarde'; }
  }
}


function pad2(n) { return String(n).padStart(2, '0'); }

function dateToIsoLocal(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function excelSerialToIsoDate(value) {
  var num = Number(value);
  if (!isFinite(num)) return '';
  // Excel/Sheets serial dates: day 1 = 1900-01-01. Using 1899-12-30 handles Excel's leap-year quirk.
  var utc = Math.round((num - 25569) * 86400 * 1000);
  var d = new Date(utc);
  return dateToIsoLocal(d);
}

function normalizeImportDate(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) return dateToIsoLocal(value);

  if (typeof value === 'number') return excelSerialToIsoDate(value);

  var s = String(value).trim();
  if (!s) return '';

  // Already in Supabase-friendly format.
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return iso[1] + '-' + pad2(iso[2]) + '-' + pad2(iso[3]);

  // Excel serial sometimes arrives as text: "46203".
  if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToIsoDate(Number(s));

  // Spanish format: dd/mm/yyyy or dd-mm-yyyy.
  var es = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (es) {
    var day = es[1], month = es[2], year = es[3];
    if (year.length === 2) year = '20' + year;
    return year + '-' + pad2(month) + '-' + pad2(day);
  }

  // Last fallback: try browser parsing and normalize.
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return dateToIsoLocal(parsed);

  return s;
}

function exportExcel() {
  closeSheet('menuSheet','menuOverlay');
  if(!clients.length){alert('No hay clientes para exportar.');return;}
  var rows = buildClientExportRows();
  var ws=XLSX.utils.json_to_sheet(rows);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Clientes M17LIV3');
  XLSX.writeFile(wb,'M17LIV3_clientes_'+new Date().toISOString().split('T')[0]+'.xlsx');
  setLastBackupNow();
  if (typeof showToast === 'function') showToast('Copia de clientes exportada');
}

function importExcel(event) {
  var file=event.target.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=async function(e){
    try {
      var wb=XLSX.read(e.target.result,{type:'binary', cellDates:true});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      var imported=0;
      for (var r=0; r<rows.length; r++) {
        var row = rows[r];
        if(!row['Nombre']||!row['Usuario']) continue;
        var svcRaw = (row['Servicio']||'TODO');
        var svc = (svcRaw==='ESPA\u00D1A'||svcRaw==='ESPANA') ? 'ESPANA' : 'TODO';
        var rowId = row['ID'] ? String(row['ID']).trim() : '';
        var existingIdx=clients.findIndex(function(c){return c.id===rowId;});
        // Para evitar errores al importar plantillas o excels con IDs antiguos,
        // solo conservamos el ID si existe ya en los clientes cargados.
        // Si no existe, se inserta como cliente nuevo y Supabase crea el ID.
        if (!rowId || existingIdx < 0 || !isUuid(rowId)) {
          rowId = '';
          existingIdx = -1;
        }
        var apps=(row['Apps']||'').split(' | ').filter(Boolean).map(function(a){
          var obj={};
          var mm=a.match(/MAC:([^\s]+)/); var cm=a.match(/CODE:([^\s]+)/);
          obj.mac=mm?mm[1]:''; obj.code=cm?cm[1]:'';
          obj.name=a.replace(/\s*MAC:[^\s]+/,'').replace(/\s*CODE:[^\s]+/,'').replace(/\s*\(.*?\)/,'').trim();
          var cu=a.match(/\(([^)]+)\)/); if(cu) obj.customName=cu[1];
          return obj;
        });
        var importedExpiry = normalizeImportDate(row['Expiracion']);
        var avisoRaw = String(row['AvisoRenovacion'] || '').trim().toLowerCase();
        var avisoImported = avisoRaw === 'si' || avisoRaw === 'sí' || avisoRaw === 'true' || avisoRaw === '1';
        var contestadoRaw = String(row['ContestadoAviso'] || '').trim().toLowerCase();
        var contestadoImported = contestadoRaw === 'si' || contestadoRaw === 'sí' || contestadoRaw === 'true' || contestadoRaw === '1';
        var nc={id:rowId,name:row['Nombre']||'',user:row['Usuario']||'',pass:row['Contrasena']||'',service:svc,expiry:importedExpiry,notes:row['Notas']||'',tags:normalizeClientTags(row['Etiquetas']||''),apps:apps.length?apps:[],createdAt:row['Creado']||new Date().toISOString(),avisoRenovacionEnviado:avisoImported,avisoRenovacionFecha:row['FechaAviso']?normalizeImportDate(row['FechaAviso']):null,avisoRenovacionExpiracion:avisoImported?importedExpiry:null,avisoRenovacionContestado:avisoImported&&contestadoImported,avisoRenovacionContestadoFecha:row['FechaContestacion']?normalizeImportDate(row['FechaContestacion']):null,avisoRenovacionContestadoExpiracion:(avisoImported&&contestadoImported)?importedExpiry:null};
        var saved = await saveClientToStore(nc);
        if(existingIdx>=0) clients[existingIdx]=saved; else clients.push(saved);
        imported++;
      }
      saveData(); renderCards(); closeSheet('menuSheet','menuOverlay');
      alert('Importados/actualizados: '+imported+' clientes.');
    } catch(err){ alert('Error al importar: '+err.message); }
    event.target.value='';
  };
  reader.readAsBinaryString(file);
}

try { renderCards(); } catch(e) {}


async function refreshWebApp() {
  try {
    if (typeof showToast === 'function') showToast('Actualizando web-app...');

    if ('serviceWorker' in navigator) {
      try {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < regs.length; i++) {
          try { await regs[i].update(); } catch (e) {}
        }
      } catch (e) {}
    }

    if ('caches' in window) {
      try {
        var keys = await caches.keys();
        await Promise.all(keys.filter(function(k){ return String(k).indexOf('m17liv3') !== -1; }).map(function(k){ return caches.delete(k); }));
      } catch (e) {}
    }

    setTimeout(function(){
      var url = new URL(window.location.href);
      url.searchParams.set('refresh', Date.now().toString());
      window.location.replace(url.toString());
    }, 350);
  } catch (ex) {
    window.location.reload();
  }
}


function showToast(msg, type) {
  var el = document.getElementById('toastMsg');
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.style.borderColor = type === 'error' ? 'rgba(255,77,77,0.5)' : 'rgba(57,255,20,0.4)';
  el.style.color = type === 'error' ? '#ff4d4d' : '#69ff47';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() {
    el.style.transform = 'translateX(-50%) translateY(100px)';
  }, 2800);
}


function cartUpdatePreview(record) {
  var texto = record.texto || '';
  var imgUrl = record.imagen_dia || '';
  // Update preview text
  var prevText = document.getElementById('cart-prev-texto');
  if (prevText) prevText.textContent = texto || 'Sin publicar todavia';
  // Update preview image
  var prevEvento = document.getElementById('cart-prev-evento');
  var prevImg = document.getElementById('cart-prev-img');
  if (prevEvento) prevEvento.style.display = imgUrl ? 'block' : 'none';
  if (prevImg) { prevImg.src = imgUrl; prevImg.style.display = imgUrl ? 'block' : 'none'; }
}

// ========== LINKS FIJOS APP ==========
var FIXED_IMAGE_BUCKET = CONFIG.fixedImageBucket || 'cartelera';
var FIXED_IMAGE_SLOTS = [
  { key: 'horarios_mundial', label: 'HORARIOS MUNDIAL', path: (CONFIG.fixedImagePath || 'imagen_actual.jpg'), icon: '&#9917;' },
  { key: 'pelicula_1', label: 'PELÍCULA RECOMENDADA 1', path: 'pelicula_recomendada_1.jpg', icon: '&#127916;' },
  { key: 'pelicula_2', label: 'PELÍCULA RECOMENDADA 2', path: 'pelicula_recomendada_2.jpg', icon: '&#127916;' },
  { key: 'pelicula_3', label: 'PELÍCULA RECOMENDADA 3', path: 'pelicula_recomendada_3.jpg', icon: '&#127916;' },
  { key: 'serie_1', label: 'SERIE RECOMENDADA 1', path: 'serie_recomendada_1.jpg', icon: '&#127909;' },
  { key: 'serie_2', label: 'SERIE RECOMENDADA 2', path: 'serie_recomendada_2.jpg', icon: '&#127909;' },
  { key: 'serie_3', label: 'SERIE RECOMENDADA 3', path: 'serie_recomendada_3.jpg', icon: '&#127909;' }
];

function fixedSlotByKey(key) {
  return FIXED_IMAGE_SLOTS.find(function(slot){ return slot.key === key; }) || FIXED_IMAGE_SLOTS[0];
}

function fixedAppImageBaseUrl(slotKey) {
  try {
    var slot = fixedSlotByKey(slotKey || 'horarios_mundial');
    var sb = initSupabase();
    if (!sb || !sb.storage) return '';
    var result = sb.storage.from(FIXED_IMAGE_BUCKET).getPublicUrl(slot.path);
    return result && result.data && result.data.publicUrl ? result.data.publicUrl : '';
  } catch(e) { return ''; }
}

function fixedAppImageUrl(slotKey, noCache) {
  var url = fixedAppImageBaseUrl(slotKey);
  if (!url) return '';
  return noCache ? (url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now()) : url;
}

function openFixedAppImage() {
  closeSheet('menuSheet','menuOverlay');
  openSheet('fixedImageSheet','fixedImageOverlay');
  try {
    renderFixedImageSlots();
  } catch(e) {
    console.error('Error al abrir Links fijos APP:', e);
    setFixedImageStatus('Error al cargar los links fijos: ' + (e && e.message ? e.message : 'desconocido'), 'error');
  }
}

function setFixedImageStatus(msg, type) {
  var el = document.getElementById('fixedImageStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = type === 'error' ? '#ff4d4d' : (type === 'ok' ? '#69ff47' : '#7AA3C8');
}

function renderFixedImageSlots() {
  var wrap = document.getElementById('fixedImageSlotsWrap');
  if (!wrap) return;
  wrap.innerHTML = FIXED_IMAGE_SLOTS.map(function(slot){
    var link = fixedAppImageBaseUrl(slot.key);
    return '<div class="fixedSlotCard" data-slot="'+slot.key+'">' +
      '<div class="fixedSlotTop">' +
        '<div><div class="fixedSlotTitle">'+slot.icon+' '+esc(slot.label)+'</div><div class="fixedSlotPath">'+esc(slot.path)+'</div></div>' +
        '<button class="fixedSlotSmallBtn" onclick="loadFixedSlotImage(\''+slot.key+'\')">&#8634;</button>' +
      '</div>' +
      '<div class="fixedSlotLink" id="fixed-link-'+slot.key+'" onclick="copyFixedSlotLink(\''+slot.key+'\')">'+esc(link || 'No se pudo generar el enlace')+'</div>' +
      '<div class="fixedSlotActions">' +
        '<button onclick="copyFixedSlotLink(\''+slot.key+'\')">&#128203; Copiar link</button>' +
        '<button onclick="document.getElementById(\'fixed-file-'+slot.key+'\').click()">&#11014; Elegir imagen</button>' +
        '<button onclick="uploadFixedSlotImage(\''+slot.key+'\')" id="fixed-upload-'+slot.key+'">&#8635; Sustituir</button>' +
        '<button class="danger" onclick="deleteFixedSlotImage(\''+slot.key+'\')">&#128465; Borrar</button>' +
      '</div>' +
      '<input type="file" id="fixed-file-'+slot.key+'" accept="image/*" style="display:none" onchange="showSelectedFixedSlotName(\''+slot.key+'\')">' +
      '<div class="fixedSlotSelected" id="fixed-selected-'+slot.key+'">Ninguna imagen seleccionada</div>' +
      '<div class="fixedSlotPreviewGrid">' +
        '<div class="fixedSlotPreviewPanel">' +
          '<div class="fixedSlotPreviewLabel">Imagen actual</div>' +
          '<div class="fixedSlotPreviewBox"><img id="fixed-preview-'+slot.key+'" alt="'+esc(slot.label)+'" src="'+esc(fixedAppImageUrl(slot.key, true))+'" onerror="this.style.display=\'none\'" onload="this.style.display=\'block\'"></div>' +
        '</div>' +
        '<div class="fixedSlotPreviewPanel fixedSlotNewPreviewPanel" id="fixed-new-panel-'+slot.key+'" style="display:none">' +
          '<div class="fixedSlotPreviewLabel new">Nueva imagen seleccionada</div>' +
          '<div class="fixedSlotPreviewBox new"><img id="fixed-new-preview-'+slot.key+'" alt="Nueva '+esc(slot.label)+'" style="display:none"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  setFixedImageStatus('Tienes 7 enlaces fijos. El primero mantiene la ruta antigua y ahora será HORARIOS MUNDIAL.', 'ok');
}

function loadFixedAppImage() {
  renderFixedImageSlots();
}

function loadFixedSlotImage(slotKey) {
  var slot = fixedSlotByKey(slotKey);
  var img = document.getElementById('fixed-preview-' + slot.key);
  var linkEl = document.getElementById('fixed-link-' + slot.key);
  if (linkEl) linkEl.textContent = fixedAppImageBaseUrl(slot.key) || 'No se pudo generar el enlace';
  if (img) {
    img.style.display = 'block';
    img.onerror = function(){ this.style.display='none'; setFixedImageStatus('Todavía no hay imagen subida para ' + slot.label + '.', 'error'); };
    img.onload = function(){ this.style.display='block'; setFixedImageStatus(slot.label + ' actualizada en pantalla.', 'ok'); };
    img.src = fixedAppImageUrl(slot.key, true);
  }
}

var FIXED_SLOT_OBJECT_URLS = {};

function showSelectedFixedSlotName(slotKey) {
  var input = document.getElementById('fixed-file-' + slotKey);
  var label = document.getElementById('fixed-selected-' + slotKey);
  var newPanel = document.getElementById('fixed-new-panel-' + slotKey);
  var newPreview = document.getElementById('fixed-new-preview-' + slotKey);
  var file = input && input.files ? input.files[0] : null;

  if (FIXED_SLOT_OBJECT_URLS[slotKey]) {
    try { URL.revokeObjectURL(FIXED_SLOT_OBJECT_URLS[slotKey]); } catch(e) {}
    delete FIXED_SLOT_OBJECT_URLS[slotKey];
  }

  if (!file) {
    if (label) label.textContent = 'Ninguna imagen seleccionada';
    if (newPanel) newPanel.style.display = 'none';
    if (newPreview) { newPreview.removeAttribute('src'); newPreview.style.display = 'none'; }
    return;
  }

  var sizeMb = file.size ? (file.size / (1024 * 1024)).toFixed(2) : '0.00';
  if (label) label.textContent = 'Seleccionada: ' + file.name + ' · ' + sizeMb + ' MB';

  if (!file.type || file.type.indexOf('image/') !== 0) {
    if (newPanel) newPanel.style.display = 'none';
    if (newPreview) { newPreview.removeAttribute('src'); newPreview.style.display = 'none'; }
    setFixedImageStatus('El archivo seleccionado no parece una imagen.', 'error');
    return;
  }

  if (newPanel && newPreview) {
    var objectUrl = URL.createObjectURL(file);
    FIXED_SLOT_OBJECT_URLS[slotKey] = objectUrl;
    newPreview.src = objectUrl;
    newPreview.style.display = 'block';
    newPanel.style.display = 'block';
    setFixedImageStatus('Previsualización lista. Revisa la imagen y pulsa “Sustituir” para subirla.', 'ok');
  }
}

function clearFixedSlotSelection(slotKey) {
  var input = document.getElementById('fixed-file-' + slotKey);
  if (input) input.value = '';
  if (FIXED_SLOT_OBJECT_URLS[slotKey]) {
    try { URL.revokeObjectURL(FIXED_SLOT_OBJECT_URLS[slotKey]); } catch(e) {}
    delete FIXED_SLOT_OBJECT_URLS[slotKey];
  }
  var label = document.getElementById('fixed-selected-' + slotKey);
  var newPanel = document.getElementById('fixed-new-panel-' + slotKey);
  var newPreview = document.getElementById('fixed-new-preview-' + slotKey);
  if (label) label.textContent = 'Ninguna imagen seleccionada';
  if (newPanel) newPanel.style.display = 'none';
  if (newPreview) { newPreview.removeAttribute('src'); newPreview.style.display = 'none'; }
}

async function copyFixedSlotLink(slotKey) {
  var link = fixedAppImageBaseUrl(slotKey);
  if (!link) { showToast('No hay link para copiar', 'error'); return; }
  try {
    await navigator.clipboard.writeText(link);
    showToast('Link fijo copiado');
  } catch(e) { showToast('No se pudo copiar', 'error'); }
}

async function copyFixedAppImageLink() {
  await copyFixedSlotLink('horarios_mundial');
}

async function uploadFixedSlotImage(slotKey) {
  var slot = fixedSlotByKey(slotKey);
  var fileInput = document.getElementById('fixed-file-' + slot.key);
  var file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (!file) { showToast('Selecciona una imagen primero', 'error'); return; }
  if (!file.type || file.type.indexOf('image/') !== 0) { showToast('El archivo debe ser una imagen', 'error'); return; }
  var btn = document.getElementById('fixed-upload-' + slot.key);
  if (btn) { btn.disabled = true; btn.textContent = 'Subiendo...'; }
  setFixedImageStatus('Subiendo y sustituyendo ' + slot.label + '...', '');
  try {
    var sb = initSupabase();
    var res = await sb.storage.from(FIXED_IMAGE_BUCKET).upload(slot.path, file, {
      cacheControl: '60',
      upsert: true,
      contentType: file.type || 'image/jpeg'
    });
    if (res.error) throw res.error;
    clearFixedSlotSelection(slot.key);
    loadFixedSlotImage(slot.key);
    showToast(slot.label + ' sustituida correctamente');
  } catch(e) {
    var msg = e && e.message ? e.message : 'Error al subir imagen';
    setFixedImageStatus('Error: ' + msg + '. Revisa el SQL de permisos para los 7 links fijos.', 'error');
    showToast('Error al subir imagen', 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '↻ Sustituir'; }
}

async function uploadFixedAppImage() {
  await uploadFixedSlotImage('horarios_mundial');
}

async function deleteFixedSlotImage(slotKey) {
  var slot = fixedSlotByKey(slotKey);
  if (!confirm('Borrar la imagen de ' + slot.label + '? El link seguirá siendo el mismo, pero no mostrará imagen hasta subir una nueva.')) return;
  try {
    var sb = initSupabase();
    var res = await sb.storage.from(FIXED_IMAGE_BUCKET).remove([slot.path]);
    if (res.error) throw res.error;
    var preview = document.getElementById('fixed-preview-' + slot.key);
    if (preview) { preview.removeAttribute('src'); preview.style.display = 'none'; }
    setFixedImageStatus(slot.label + ' borrada. Puedes subir una nueva cuando quieras.', 'ok');
    showToast('Imagen borrada');
  } catch(e) {
    setFixedImageStatus('Error al borrar: ' + (e && e.message ? e.message : 'desconocido'), 'error');
    showToast('Error al borrar imagen', 'error');
  }
}

async function deleteFixedAppImage() {
  await deleteFixedSlotImage('horarios_mundial');
}
// ========== FIN LINKS FIJOS APP ==========

// ========== CARTELERA ADMIN ==========
var CART_BIN_ID = CONFIG.cartBinId || '';
var CART_KEY = CONFIG.cartKey || '';
var CART_IMGBB_KEY = CONFIG.cartImgBBKey || '';

function openCartelera() {
  closeSheet('menuSheet','menuOverlay');
  var base = window.location.href.replace('index.html','').split('?')[0];
  if (!base.endsWith('/')) base += '/';
  document.getElementById('clienteLinkBox').textContent = base + 'cartelera.html';
  cartLoadExisting();
  openSheet('carteleraSheet','carteleraOverlay');
}

function copyClienteLink() {
  var link = document.getElementById('clienteLinkBox').textContent;
  navigator.clipboard.writeText(link).then(function() {
    showToast('Enlace copiado!');
  }).catch(function() { showToast('No se pudo copiar','error'); });
}

async function cartLoadExisting() {
  try {
    var res = await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY }
    });
    if (!res.ok) return;
    var data = await res.json();
    var record = data.record || {};
    var texto = record.texto || '';
    document.getElementById('cart-texto').value = texto;
    document.getElementById('cart-char-count').textContent = texto.length + ' caracteres';
    var imgUrl = record.imagen_dia || '';
    if (imgUrl) {
      document.getElementById('cart-img-link').textContent = imgUrl;
      document.getElementById('cart-imgbb-result').style.display = 'block';
      document.getElementById('cart-preview-img').src = imgUrl;
    } else {
      document.getElementById('cart-imgbb-result').style.display = 'none';
    }
    var today = new Date().toISOString().slice(0,10);
    var visits = record.visits || {};
    document.getElementById('cart-visits-today').textContent = visits[today] || 0;
    var total = Object.values(visits).reduce(function(a,b){ return a+b; }, 0);
    document.getElementById('cart-visits-total').textContent = total;

    // Preview clientes
    document.getElementById('cart-prev-texto').textContent = texto || 'Sin publicar todavia';
    if (imgUrl) {
      document.getElementById('cart-prev-img').src = imgUrl;
      document.getElementById('cart-prev-evento').style.display = 'block';
    } else {
      document.getElementById('cart-prev-evento').style.display = 'none';
    }
  } catch(e) {}
}

async function cartSave() {
  var btn = document.getElementById('cart-save-btn');
  var texto = document.getElementById('cart-texto').value;
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    var res = await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY }
    });
    var data = await res.json();
    var record = data.record || {};
    record.texto = texto;
    var saveRes = await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY },
      body: JSON.stringify(record)
    });
    if (saveRes.ok) { 
      showToast('Cartelera publicada!');
      cartUpdatePreview(record);
    }
    else { showToast('Error al guardar','error'); }
  } catch(e) { showToast('Error de red','error'); }
  btn.disabled = false;
  btn.textContent = 'Guardar y publicar';
}

async function cartClear() {
  if (!confirm('Borrar toda la cartelera?')) return;
  document.getElementById('cart-texto').value = '';
  document.getElementById('cart-char-count').textContent = '0 caracteres';
  await cartSave();
}

async function cartUploadImage() {
  var fileInput = document.getElementById('cart-img-file');
  var file = fileInput.files[0];
  if (!file) { showToast('Selecciona una imagen primero','error'); return; }
  var btn = document.getElementById('cart-upload-btn');
  btn.disabled = true;
  btn.textContent = 'Subiendo...';
  try {
    var formData = new FormData();
    formData.append('image', file);
    var res = await fetch('https://api.imgbb.com/1/upload?key=' + CART_IMGBB_KEY, { method: 'POST', body: formData });
    var data = await res.json();
    if (data.success) {
      var url = data.data.url;
      document.getElementById('cart-img-link').textContent = url;
      document.getElementById('cart-imgbb-result').style.display = 'block';
      document.getElementById('cart-preview-img').src = url;
      var r2 = await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID + '/latest', {
        headers: { 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY }
      });
      var d2 = await r2.json();
      var rec2 = d2.record || {};
      rec2.imagen_dia = url;
      var putRes = await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY },
        body: JSON.stringify(rec2)
      });
      if (putRes.ok) {
        showToast('Imagen publicada como evento!');
        cartUpdatePreview(rec2);
      } else { showToast('Imagen subida pero error al publicar','error'); }
    } else { throw new Error(); }
  } catch(e) { showToast('Error al subir imagen','error'); }
  btn.disabled = false;
  btn.textContent = 'Subir';
}

async function cartRemoveImage() {
  if (!confirm('Quitar la imagen del evento?')) return;
  try {
    var res = await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY }
    });
    var data = await res.json();
    var record = data.record || {};
    delete record.imagen_dia;
    await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY },
      body: JSON.stringify(record)
    });
    document.getElementById('cart-imgbb-result').style.display = 'none';
    document.getElementById('cart-img-file').value = '';
    showToast('Imagen del evento eliminada');
  } catch(e) { showToast('Error al eliminar imagen','error'); }
}

async function cartResetVisits() {
  if (!confirm('Resetear el contador de visitas de hoy?')) return;
  try {
    var res = await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY }
    });
    var data = await res.json();
    var record = data.record || {};
    var today = new Date().toISOString().slice(0,10);
    if (record.visits) delete record.visits[today];
    await fetch('https://api.jsonbin.io/v3/b/' + CART_BIN_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': CART_KEY, 'X-Access-Key': CART_KEY },
      body: JSON.stringify(record)
    });
    document.getElementById('cart-visits-today').textContent = '0';
    var total = Object.values(record.visits || {}).reduce(function(a,b){ return a+b; }, 0);
    document.getElementById('cart-visits-total').textContent = total;
    showToast('Contador reseteado');
  } catch(e) { showToast('Error al resetear','error'); }
}
// ========== FIN CARTELERA ADMIN ==========


// ========== PLANTILLAS PELICULAS ADMIN ==========
var MOVIE_TPL_TMDB_KEY = CONFIG.tmdbKey || '';
var MOVIE_TPL_IMGBB_KEY = CONFIG.templateImgBBKey || CONFIG.cartImgBBKey || '';
var MOVIE_TPL_LOGO_STORAGE_KEY = 'm17liv3_movie_template_logo_dataurl';
var movieTplInitialized = false;
var movieTplCanvas = null;
var movieTplCtx = null;
var movieTplW = 1600;
var movieTplH = 900;
var movieTplPosterImg = null;
var movieTplLogoImg = null;
var movieTplDebounceTimer = null;
var movieTplState = {
  title: 'TITULO DE LA PELICULA',
  genre: 'GENERO',
  rating: '0.0',
  duration: '00',
  synopsis: 'Escribe aqui la sinopsis de la pelicula. Tambien puedes buscar en TMDB para rellenar automaticamente titulo, genero, puntuacion, duracion, portada y descripcion.',
  posterUrl: '',
  logoDataUrl: null,
  posterZoom: 100,
  posterOffsetX: 0,
  posterOffsetY: 0
};

function openMovieTemplates() {
  closeSheet('menuSheet','menuOverlay');
  movieTplInit();
  openSheet('movieTplSheet','movieTplOverlay');
  setTimeout(function(){ movieTplDraw(); movieTplRenderFixedPreviews(); }, 80);
}

function movieTplInit() {
  if (movieTplInitialized) return;
  movieTplCanvas = document.getElementById('tplCanvas');
  if (!movieTplCanvas) return;
  movieTplCtx = movieTplCanvas.getContext('2d');
  movieTplW = movieTplCanvas.width;
  movieTplH = movieTplCanvas.height;

  var searchBtn = document.getElementById('tplSearchBtn');
  var searchInput = document.getElementById('tplSearchInput');
  if (searchBtn) searchBtn.addEventListener('click', movieTplDoSearch);
  if (searchInput) searchInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') movieTplDoSearch(); });

  ['tplTitle','tplGenre','tplRating','tplDuration','tplSynopsis','tplPosterUrl'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', movieTplSyncStateFromInputsDebounced);
  });

  var zoom = document.getElementById('tplPosterZoom');
  var offX = document.getElementById('tplPosterOffsetX');
  var offY = document.getElementById('tplPosterOffsetY');
  var reset = document.getElementById('tplPosterResetBtn');
  if (zoom) zoom.addEventListener('input', function(){
    movieTplState.posterZoom = parseFloat(zoom.value);
    document.getElementById('tplPosterZoomVal').textContent = zoom.value;
    movieTplDraw();
  });
  if (offX) offX.addEventListener('input', function(){ movieTplState.posterOffsetX = parseFloat(offX.value); movieTplDraw(); });
  if (offY) offY.addEventListener('input', function(){ movieTplState.posterOffsetY = parseFloat(offY.value); movieTplDraw(); });
  if (reset) reset.addEventListener('click', function(){ movieTplResetPosterAdjust(); movieTplDraw(); });

  var logoInput = document.getElementById('tplLogoInput');
  if (logoInput) logoInput.addEventListener('change', movieTplHandleLogoUpload);

  var downloadBtn = document.getElementById('tplDownloadBtn');
  var uploadBtn1 = document.getElementById('tplUploadFixed1Btn');
  var uploadBtn2 = document.getElementById('tplUploadFixed2Btn');
  var uploadBtn3 = document.getElementById('tplUploadFixed3Btn');
  if (downloadBtn) downloadBtn.addEventListener('click', movieTplDownloadJpeg);
  if (uploadBtn1) uploadBtn1.addEventListener('click', function(){ movieTplUploadToFixed('pelicula_1', this); });
  if (uploadBtn2) uploadBtn2.addEventListener('click', function(){ movieTplUploadToFixed('pelicula_2', this); });
  if (uploadBtn3) uploadBtn3.addEventListener('click', function(){ movieTplUploadToFixed('pelicula_3', this); });

  movieTplFillInputsFromState();
  movieTplRestoreLogo();
  movieTplDraw();
  movieTplInitialized = true;
}

document.addEventListener('DOMContentLoaded', movieTplInit);

function movieTplFillInputsFromState() {
  var map = {
    tplTitle: 'title', tplGenre: 'genre', tplRating: 'rating', tplDuration: 'duration', tplSynopsis: 'synopsis', tplPosterUrl: 'posterUrl'
  };
  Object.keys(map).forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = movieTplState[map[id]] || '';
  });
}

function movieTplResetAll() {
  movieTplState.title = 'TITULO DE LA PELICULA';
  movieTplState.genre = 'GENERO';
  movieTplState.rating = '0.0';
  movieTplState.duration = '00';
  movieTplState.synopsis = 'Escribe aqui la sinopsis de la pelicula. Tambien puedes buscar en TMDB para rellenar automaticamente titulo, genero, puntuacion, duracion, portada y descripcion.';
  movieTplState.posterUrl = '';
  movieTplPosterImg = null;
  movieTplFillInputsFromState();
  movieTplResetPosterAdjust();
  var results = document.getElementById('tplSearchResults');
  var gallery = document.getElementById('tplPosterGallery');
  var label = document.getElementById('tplPosterGalleryLabel');
  var linkBox = document.getElementById('tplLinkBox');
  if(results) results.innerHTML = '';
  if(gallery) gallery.innerHTML = '';
  if(label) label.style.display = 'none';
  if(linkBox) { linkBox.textContent = ''; linkBox.classList.remove('show'); }
  var copyBtn = document.getElementById('tplCopyBtn');
  if(copyBtn) { copyBtn.disabled = true; delete copyBtn.dataset.link; }
  movieTplSetStatus('Plantilla limpia', 'ok');
  movieTplDraw();
}

function movieTplLoadImage(src, crossOrigin) {
  return new Promise(function(resolve, reject){
    var img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = function(){ resolve(img); };
    img.onerror = function(e){ reject(e); };
    img.src = src;
  });
}

function movieTplEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function movieTplRoundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function movieTplWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
  var words = String(text || '').split(/\s+/).filter(Boolean);
  var line = '';
  var lines = [];
  for (var n=0; n<words.length; n++){
    var testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0){
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  if (maxLines && lines.length > maxLines){
    lines = lines.slice(0, maxLines);
    var last = lines[maxLines-1];
    while (ctx.measureText(last + '...').width > maxWidth && last.length > 0){ last = last.slice(0,-1); }
    lines[maxLines-1] = last.trim() + '...';
  }
  lines.forEach(function(l, i){ ctx.fillText(l, x, y + i*lineHeight); });
  return lines.length;
}

function movieTplDraw(){
  if(!movieTplCtx) return;
  var ctx = movieTplCtx, W = movieTplW, H = movieTplH;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0,0,W,H);

  var g1 = ctx.createRadialGradient(150,100,50,150,100,500);
  g1.addColorStop(0,'rgba(34,211,238,0.10)');
  g1.addColorStop(1,'rgba(34,211,238,0)');
  ctx.fillStyle = g1; ctx.fillRect(0,0,W,H);

  var g2 = ctx.createRadialGradient(W-150,H-100,50,W-150,H-100,600);
  g2.addColorStop(0,'rgba(163,230,53,0.06)');
  g2.addColorStop(1,'rgba(163,230,53,0)');
  ctx.fillStyle = g2; ctx.fillRect(0,0,W,H);

  movieTplDrawDots(W-340, 30, 280, 220);
  movieTplDrawDots(0, H-240, 100, 240);
  movieTplDrawLogo();
  movieTplDrawPoster();
  movieTplDrawTextContent();
  movieTplDrawNeonFrame();
}

function movieTplDrawDots(x0,y0,w,h){
  var ctx = movieTplCtx;
  ctx.save();
  ctx.fillStyle = 'rgba(34,211,238,0.25)';
  var gap = 22;
  for(var x=x0; x<x0+w; x+=gap){
    for(var y=y0; y<y0+h; y+=gap){
      ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}

function movieTplDrawNeonFrame(){
  var ctx = movieTplCtx, W = movieTplW, H = movieTplH;
  ctx.save();
  var margin = 6;
  var grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,'#22d3ee'); grad.addColorStop(1,'#a3e635');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(34,211,238,0.6)';
  ctx.shadowBlur = 18;
  movieTplRoundRect(ctx, margin, margin, W - margin*2, H - margin*2, 18);
  ctx.stroke();
  ctx.restore();
}

function movieTplDrawLogo(){
  var ctx = movieTplCtx;
  var posterX = 45, posterW = 580 * (2/3);
  var areaW = 320, areaH = 230;
  var areaX = posterX + (posterW - areaW)/2;
  var areaY = 25;
  if (movieTplLogoImg){
    var iw = movieTplLogoImg.width, ih = movieTplLogoImg.height;
    var scale = Math.min(areaW/iw, areaH/ih);
    var dw = iw*scale, dh = ih*scale;
    var dx = areaX + (areaW-dw)/2;
    var dy = areaY + (areaH-dh)/2;
    ctx.drawImage(movieTplLogoImg, dx, dy, dw, dh);
  } else {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8,8]);
    movieTplRoundRect(ctx, areaX, areaY, areaW, areaH, 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '600 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TU LOGO AQUI', areaX+areaW/2, areaY+areaH/2);
    ctx.restore();
  }
}

function movieTplDrawPoster(){
  var ctx = movieTplCtx;
  var h = 580, w = h * (2/3), x = 45, y = 280, r = 22;
  ctx.save();
  movieTplRoundRect(ctx, x, y, w, h, r);
  var grad = ctx.createLinearGradient(x,y,x+w,y+h);
  grad.addColorStop(0,'#22d3ee'); grad.addColorStop(1,'#a3e635');
  ctx.strokeStyle = grad; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(34,211,238,0.5)'; ctx.shadowBlur = 20; ctx.stroke();
  ctx.restore();

  ctx.save();
  movieTplRoundRect(ctx, x+2, y+2, w-4, h-4, r-2);
  ctx.clip();
  if (movieTplPosterImg){
    ctx.fillStyle = '#0d1422'; ctx.fillRect(x+2,y+2,w-4,h-4);
    var ir = movieTplPosterImg.width / movieTplPosterImg.height;
    var tr = (w-4) / (h-4);
    var sw, sh;
    if (ir > tr){ sh = movieTplPosterImg.height; sw = sh * tr; }
    else { sw = movieTplPosterImg.width; sh = sw / tr; }
    var zoom = (movieTplState.posterZoom || 100) / 100;
    sw = sw / zoom; sh = sh / zoom;
    var dw = w-4, dh = h-4;
    if (sw > movieTplPosterImg.width){ var ratioW = movieTplPosterImg.width / sw; sw = movieTplPosterImg.width; dw = (w-4) * ratioW; }
    if (sh > movieTplPosterImg.height){ var ratioH = movieTplPosterImg.height / sh; sh = movieTplPosterImg.height; dh = (h-4) * ratioH; }
    var maxOffX = movieTplPosterImg.width - sw;
    var maxOffY = movieTplPosterImg.height - sh;
    var sx = (movieTplPosterImg.width - sw) / 2;
    var sy = (movieTplPosterImg.height - sh) / 2;
    sx += (movieTplState.posterOffsetX || 0) / 100 * (maxOffX / 2);
    sy += (movieTplState.posterOffsetY || 0) / 100 * (maxOffY / 2);
    sx = Math.max(0, Math.min(maxOffX, sx));
    sy = Math.max(0, Math.min(maxOffY, sy));
    var dx = x+2 + ((w-4) - dw)/2;
    var dy = y+2 + ((h-4) - dh)/2;
    ctx.drawImage(movieTplPosterImg, sx, sy, sw, sh, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#0d1422'; ctx.fillRect(x+2,y+2,w-4,h-4);
    ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 4;
    var ix = x+w/2-65, iy = y+h/2-130, isz=130;
    movieTplRoundRect(ctx, ix, iy, isz, isz, 14); ctx.stroke();
    ctx.beginPath(); ctx.arc(ix+isz*.7, iy+isz*.3, 10, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix+15, iy+isz-20); ctx.lineTo(ix+isz*.4, iy+isz*.55); ctx.lineTo(ix+isz*.6, iy+isz*.75); ctx.lineTo(ix+isz*.8, iy+isz*.45); ctx.lineTo(ix+isz-15, iy+isz-20); ctx.stroke();
    ctx.fillStyle = '#5a6a85'; ctx.font = '700 36px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PORTADA', x+w/2, y+h/2+90); ctx.textAlign = 'left';
  }
  ctx.restore();
}

function movieTplDrawTextContent(){
  var ctx = movieTplCtx, W = movieTplW;
  var leftX = 590;
  ctx.fillStyle = '#f5f7fa'; ctx.font = '900 62px Arial, sans-serif'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('PELICULA', leftX, 95);
  var grad = ctx.createLinearGradient(leftX, 0, leftX+800, 0);
  grad.addColorStop(0,'#22d3ee'); grad.addColorStop(1,'#a3e635');
  ctx.fillStyle = grad; ctx.font = '900 62px Arial, sans-serif'; ctx.fillText('RECOMENDADA', leftX, 170);
  ctx.fillStyle = '#a3e635'; ctx.font = '700 34px Arial, sans-serif'; ctx.fillText('de la semana', leftX, 225);
  var lineY = 213, lineStartX = leftX + 380;
  ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lineStartX,lineY); ctx.lineTo(W-90,lineY); ctx.stroke();
  ctx.beginPath(); ctx.fillStyle = '#a3e635'; ctx.arc(W-90,lineY,7,0,Math.PI*2); ctx.fill();

  ctx.fillStyle = '#f5f7fa'; ctx.font = '900 52px Arial, sans-serif';
  var titleText = (movieTplState.title || 'TITULO DE LA PELICULA').toUpperCase();
  var titleLines = movieTplWrapText(ctx, titleText, leftX, 320, W-leftX-90, 60, 2);
  var yCursor = 320 + (titleLines > 1 ? 60 : 0) + 65;

  ctx.font = '700 26px Arial, sans-serif';
  var genreText = (movieTplState.genre || 'GENERO').toUpperCase();
  var padX = 26, pillH = 50, textW = ctx.measureText(genreText).width, pillW = textW + padX*2;
  movieTplRoundRect(ctx, leftX, yCursor-pillH+10, pillW, pillH, pillH/2);
  ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#a3e635'; ctx.textBaseline = 'middle'; ctx.fillText(genreText, leftX+padX, yCursor-pillH/2+10); ctx.textBaseline = 'alphabetic';
  yCursor += 75;

  movieTplDrawStar(leftX+18, yCursor-10, 22, '#a3e635');
  ctx.fillStyle = '#f5f7fa'; ctx.font = '600 30px Arial, sans-serif';
  var ratingVal = parseFloat(movieTplState.rating);
  var ratingStr = (isNaN(ratingVal) ? '0.0' : ratingVal.toFixed(1)) + '/10';
  ctx.fillText(ratingStr, leftX+50, yCursor);
  ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 2;
  var sepX = leftX + 50 + ctx.measureText(ratingStr).width + 30;
  ctx.beginPath(); ctx.moveTo(sepX, yCursor-25); ctx.lineTo(sepX, yCursor+5); ctx.stroke();
  movieTplDrawClock(sepX+35, yCursor-10, 18, '#22d3ee');
  ctx.fillStyle = '#f5f7fa'; ctx.font = '600 30px Arial, sans-serif';
  var durVal = parseInt(movieTplState.duration, 10);
  var durStr = (isNaN(durVal) ? '00' : durVal) + ' min';
  ctx.fillText(durStr, sepX+65, yCursor);
  yCursor += 50;

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(leftX, yCursor); ctx.lineTo(W-90, yCursor); ctx.stroke();
  yCursor += 55;
  ctx.fillStyle = '#22d3ee'; ctx.font = '800 32px Arial, sans-serif'; ctx.fillText('SINOPSIS', leftX, yCursor);
  yCursor += 45;
  ctx.fillStyle = '#e6e9ef'; ctx.font = '400 27px Arial, sans-serif';
  movieTplWrapText(ctx, movieTplState.synopsis || '', leftX, yCursor, W-leftX-90, 40, 7);
}

function movieTplDrawStar(cx, cy, r, color){
  var ctx = movieTplCtx;
  ctx.save(); ctx.fillStyle = color; ctx.beginPath();
  for(var i=0; i<5; i++){
    var outerAngle = -Math.PI/2 + i*(2*Math.PI/5);
    var innerAngle = outerAngle + Math.PI/5;
    var ox = cx + r*Math.cos(outerAngle), oy = cy + r*Math.sin(outerAngle);
    var ix = cx + (r*.45)*Math.cos(innerAngle), iy = cy + (r*.45)*Math.sin(innerAngle);
    if(i===0) ctx.moveTo(ox,oy); else ctx.lineTo(ox,oy);
    ctx.lineTo(ix,iy);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function movieTplDrawClock(cx, cy, r, color){
  var ctx = movieTplCtx;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-r*.55); ctx.moveTo(cx,cy); ctx.lineTo(cx+r*.4,cy+r*.2); ctx.stroke();
  ctx.restore();
}

async function movieTplSearchMovies(query){
  if(!MOVIE_TPL_TMDB_KEY) throw new Error('Falta la clave TMDB en config.js');
  var url = 'https://api.themoviedb.org/3/search/movie?api_key=' + MOVIE_TPL_TMDB_KEY + '&language=es-ES&query=' + encodeURIComponent(query);
  var res = await fetch(url);
  if(!res.ok) throw new Error('Error TMDB: ' + res.status);
  var data = await res.json();
  return data.results || [];
}

async function movieTplGetMovieDetails(id){
  var url = 'https://api.themoviedb.org/3/movie/' + id + '?api_key=' + MOVIE_TPL_TMDB_KEY + '&language=es-ES';
  var res = await fetch(url);
  if(!res.ok) throw new Error('Error TMDB detalle: ' + res.status);
  return res.json();
}

async function movieTplGetMovieImages(id){
  var url = 'https://api.themoviedb.org/3/movie/' + id + '/images?api_key=' + MOVIE_TPL_TMDB_KEY + '&include_image_language=es,en,null';
  var res = await fetch(url);
  if(!res.ok) throw new Error('Error TMDB imagenes: ' + res.status);
  var data = await res.json();
  return data.posters || [];
}

function movieTplRenderResults(results){
  var box = document.getElementById('tplSearchResults');
  if(!box) return;
  box.innerHTML = '';
  if(!results.length){
    box.innerHTML = '<p style="color:var(--muted);font-size:.8rem;">Sin resultados.</p>';
    return;
  }
  results.slice(0,8).forEach(function(movie){
    var item = document.createElement('div');
    item.className = 'movieTplResultItem';
    var posterSrc = movie.poster_path ? 'https://image.tmdb.org/t/p/w92' + movie.poster_path : '';
    var year = movie.release_date ? movie.release_date.slice(0,4) : '-';
    item.innerHTML = '<img src="' + movieTplEsc(posterSrc) + '" alt=""><div class="meta"><div class="t">' + movieTplEsc(movie.title) + '</div><div class="y">' + movieTplEsc(year) + '</div></div>';
    item.addEventListener('click', function(){ movieTplSelectMovie(movie.id); });
    box.appendChild(item);
  });
}

async function movieTplDoSearch(){
  var q = (document.getElementById('tplSearchInput') || {}).value || '';
  q = q.trim();
  if(!q) return;
  movieTplSetStatus('Buscando...', '');
  try{
    var results = await movieTplSearchMovies(q);
    movieTplRenderResults(results);
    movieTplSetStatus('', '');
  }catch(err){
    console.error(err);
    movieTplSetStatus('Error al buscar: ' + err.message, 'err');
  }
}

async function movieTplSelectMovie(id){
  movieTplSetStatus('Cargando datos de la pelicula...', '');
  try{
    var details = await movieTplGetMovieDetails(id);
    var year = details.release_date ? details.release_date.slice(0,4) : '';
    document.getElementById('tplTitle').value = details.title ? (details.title + (year ? ' (' + year + ')' : '')) : '';
    document.getElementById('tplGenre').value = (details.genres || []).map(function(g){ return g.name; }).join(', ');
    document.getElementById('tplRating').value = details.vote_average ? details.vote_average.toFixed(1) : '0.0';
    document.getElementById('tplDuration').value = details.runtime || 0;
    document.getElementById('tplSynopsis').value = details.overview || '';
    var posterUrl = details.poster_path ? 'https://image.tmdb.org/t/p/w780' + details.poster_path : '';
    document.getElementById('tplPosterUrl').value = posterUrl;
    await movieTplSyncStateFromInputs();
    movieTplSetStatus('Datos cargados', 'ok');
    try{
      var posters = await movieTplGetMovieImages(id);
      movieTplRenderPosterGallery(posters, posterUrl);
    }catch(e){ console.warn('No se pudieron cargar posters alternativos', e); }
  }catch(err){
    console.error(err);
    movieTplSetStatus('Error al cargar la pelicula: ' + err.message, 'err');
  }
}

function movieTplRenderPosterGallery(posters, currentUrl){
  var gallery = document.getElementById('tplPosterGallery');
  var label = document.getElementById('tplPosterGalleryLabel');
  if(!gallery || !label) return;
  gallery.innerHTML = '';
  if(!posters || !posters.length){ label.style.display = 'none'; return; }
  label.style.display = 'block';
  label.textContent = 'Elegir otro poster (' + posters.length + ' disponibles)';
  posters.forEach(function(poster){
    var fullUrl = 'https://image.tmdb.org/t/p/w780' + poster.file_path;
    var thumbUrl = 'https://image.tmdb.org/t/p/w154' + poster.file_path;
    var thumb = document.createElement('div');
    thumb.className = 'movieTplPosterThumb';
    if(fullUrl === currentUrl) thumb.classList.add('selected');
    var img = document.createElement('img');
    img.src = thumbUrl;
    img.alt = '';
    thumb.appendChild(img);
    thumb.addEventListener('click', async function(){
      document.querySelectorAll('.movieTplPosterThumb').forEach(function(el){ el.classList.remove('selected'); });
      thumb.classList.add('selected');
      document.getElementById('tplPosterUrl').value = fullUrl;
      await movieTplSyncStateFromInputs();
    });
    gallery.appendChild(thumb);
  });
}

function movieTplSyncStateFromInputsDebounced(){
  clearTimeout(movieTplDebounceTimer);
  movieTplDebounceTimer = setTimeout(movieTplSyncStateFromInputs, 250);
}

async function movieTplSyncStateFromInputs(){
  movieTplState.title = document.getElementById('tplTitle').value;
  movieTplState.genre = document.getElementById('tplGenre').value;
  movieTplState.rating = document.getElementById('tplRating').value;
  movieTplState.duration = document.getElementById('tplDuration').value;
  movieTplState.synopsis = document.getElementById('tplSynopsis').value;
  var newPosterUrl = document.getElementById('tplPosterUrl').value.trim();
  if(newPosterUrl !== movieTplState.posterUrl){
    movieTplState.posterUrl = newPosterUrl;
    if(newPosterUrl){
      try{ movieTplPosterImg = await movieTplLoadImage(newPosterUrl, true); }
      catch(e){
        try{ movieTplPosterImg = await movieTplLoadImage(newPosterUrl, false); }
        catch(e2){ movieTplPosterImg = null; console.warn('No se pudo cargar el poster', e2); }
      }
    } else {
      movieTplPosterImg = null;
    }
    movieTplResetPosterAdjust();
  }
  movieTplDraw();
}

function movieTplResetPosterAdjust(){
  movieTplState.posterZoom = 100;
  movieTplState.posterOffsetX = 0;
  movieTplState.posterOffsetY = 0;
  var zoom = document.getElementById('tplPosterZoom');
  var offX = document.getElementById('tplPosterOffsetX');
  var offY = document.getElementById('tplPosterOffsetY');
  var val = document.getElementById('tplPosterZoomVal');
  if(zoom) zoom.value = 100;
  if(offX) offX.value = 0;
  if(offY) offY.value = 0;
  if(val) val.textContent = '100';
}

function movieTplHandleLogoUpload(e){
  var file = e.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = async function(ev){
    movieTplState.logoDataUrl = ev.target.result;
    try{ localStorage.setItem(MOVIE_TPL_LOGO_STORAGE_KEY, movieTplState.logoDataUrl); }catch(err){}
    movieTplLogoImg = await movieTplLoadImage(movieTplState.logoDataUrl, false);
    var prev = document.getElementById('tplLogoPreviewSmall');
    if(prev) prev.src = movieTplState.logoDataUrl;
    movieTplDraw();
    movieTplSetStatus('Logo actualizado', 'ok');
  };
  reader.readAsDataURL(file);
}

async function movieTplRestoreLogo(){
  try{
    var saved = localStorage.getItem(MOVIE_TPL_LOGO_STORAGE_KEY);
    if(saved){
      movieTplState.logoDataUrl = saved;
      movieTplLogoImg = await movieTplLoadImage(saved, false);
      var prev = document.getElementById('tplLogoPreviewSmall');
      if(prev) prev.src = saved;
    } else {
      movieTplLogoImg = await movieTplLoadImage('assets/logo.png', false);
    }
    movieTplDraw();
  }catch(err){
    console.warn(err);
    movieTplDraw();
  }
}

function movieTplSetStatus(msg, cls){
  var el = document.getElementById('tplStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'movieTplStatus' + (cls ? ' ' + cls : '');
}

function movieTplCanvasToJpegBlob(){
  return new Promise(function(resolve, reject){
    try{
      movieTplCanvas.toBlob(function(blob){
        if(blob) resolve(blob);
        else reject(new Error('No se pudo generar el JPEG'));
      }, 'image/jpeg', 0.92);
    }catch(err){ reject(err); }
  });
}

async function movieTplDownloadJpeg(){
  try{
    movieTplDraw();
    var blob = await movieTplCanvasToJpegBlob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var safeTitle = (movieTplState.title || 'plantilla').toLowerCase().replace(/[^a-z0-9]+/gi,'_').slice(0,40);
    a.href = url;
    a.download = 'm17liv3_' + (safeTitle || 'plantilla') + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    movieTplSetStatus('JPEG descargado', 'ok');
  }catch(err){
    movieTplSetStatus('Error al descargar: posible problema CORS con el poster.', 'err');
  }
}

async function movieTplUploadImgBB(){
  if(!MOVIE_TPL_IMGBB_KEY){ movieTplSetStatus('Falta la clave de imgBB en config.js', 'err'); return; }
  movieTplSetStatus('Generando imagen...', '');
  movieTplDraw();
  var blob;
  try{ blob = await movieTplCanvasToJpegBlob(); }
  catch(err){ movieTplSetStatus('Error al generar la imagen. Puede ser CORS del poster.', 'err'); return; }
  movieTplSetStatus('Subiendo a imgBB...', '');
  try{
    var formData = new FormData();
    formData.append('image', blob);
    var res = await fetch('https://api.imgbb.com/1/upload?key=' + MOVIE_TPL_IMGBB_KEY, { method:'POST', body:formData });
    var data = await res.json();
    if(data.success){
      var link = data.data.url;
      var linkBox = document.getElementById('tplLinkBox');
      var copyBtn = document.getElementById('tplCopyBtn');
      if(linkBox){ linkBox.textContent = link; linkBox.classList.add('show'); }
      if(copyBtn){ copyBtn.disabled = false; copyBtn.dataset.link = link; }
      movieTplSetStatus('Subido correctamente', 'ok');
    } else {
      throw new Error((data.error && data.error.message) || 'Error desconocido de imgBB');
    }
  }catch(err){
    console.error(err);
    movieTplSetStatus('Error al subir a imgBB: ' + err.message, 'err');
  }
}

async function movieTplCopyLink(){
  var btn = document.getElementById('tplCopyBtn');
  var link = btn && btn.dataset.link;
  if(!link) return;
  try{
    await navigator.clipboard.writeText(link);
    movieTplSetStatus('Enlace copiado al portapapeles', 'ok');
  }catch(err){
    movieTplSetStatus('No se pudo copiar automaticamente. Copialo manualmente.', 'err');
  }
}

function movieTplRenderFixedPreviews(){
  [
    {slot:'pelicula_1', imgId:'tplFixedPreview1'},
    {slot:'pelicula_2', imgId:'tplFixedPreview2'},
    {slot:'pelicula_3', imgId:'tplFixedPreview3'}
  ].forEach(function(item){
    movieTplRefreshFixedPreview(item.slot, item.imgId);
  });
}

function movieTplRefreshFixedPreview(slotKey, imgId){
  var img = document.getElementById(imgId);
  if(!img) return;
  img.onerror = function(){ this.style.display = 'none'; };
  img.onload = function(){ this.style.display = 'block'; };
  img.src = fixedAppImageUrl(slotKey, true);
}

async function uploadBlobToFixedSlot(slotKey, blob, contentType){
  var slot = fixedSlotByKey(slotKey);
  var sb = initSupabase();
  if (!sb || !sb.storage) throw new Error('Supabase no esta disponible');
  var res = await sb.storage.from(FIXED_IMAGE_BUCKET).upload(slot.path, blob, {
    cacheControl: '60',
    upsert: true,
    contentType: contentType || 'image/jpeg'
  });
  if (res.error) throw res.error;
  return fixedAppImageBaseUrl(slotKey);
}

async function movieTplUploadToFixed(slotKey, btnEl){
  var slot = fixedSlotByKey(slotKey);
  if(!slot) return;
  movieTplSetStatus('Generando imagen para ' + slot.label + '...', '');
  movieTplDraw();
  var blob;
  try { blob = await movieTplCanvasToJpegBlob(); }
  catch(err){ movieTplSetStatus('Error al generar la imagen. Puede ser CORS del poster.', 'err'); return; }
  var oldText = btnEl ? btnEl.textContent : '';
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Subiendo...'; }
  try {
    await uploadBlobToFixedSlot(slotKey, blob, 'image/jpeg');
    movieTplSetStatus('Subida correctamente a ' + slot.label, 'ok');
    movieTplRenderFixedPreviews();
    try { loadFixedSlotImage(slotKey); } catch(e) {}
    showToast(slot.label + ' sustituida correctamente');
  } catch(err){
    console.error(err);
    movieTplSetStatus('Error al subir a ' + slot.label + ': ' + (err && err.message ? err.message : 'error desconocido'), 'err');
    showToast('Error al sustituir ' + slot.label, 'error');
  }
  if (btnEl) { btnEl.disabled = false; btnEl.textContent = oldText || 'Subir'; }
}

// ========== FIN PLANTILLAS PELICULAS ADMIN ==========

// ========== PLANTILLAS SERIES ADMIN ==========
var SERIES_TPL_TMDB_KEY = CONFIG.tmdbKey || '';
var SERIES_TPL_IMGBB_KEY = CONFIG.templateImgBBKey || CONFIG.cartImgBBKey || '';
var SERIES_TPL_LOGO_STORAGE_KEY = 'm17liv3_series_template_logo_dataurl';
var seriesTplInitialized = false;
var seriesTplCanvas = null;
var seriesTplCtx = null;
var seriesTplW = 1600;
var seriesTplH = 900;
var seriesTplPosterImg = null;
var seriesTplLogoImg = null;
var seriesTplDebounceTimer = null;
var seriesTplState = {
  title: 'TITULO DE LA SERIE',
  genre: 'GENERO',
  year: '2026',
  rating: '0.0',
  seasons: '1',
  episodes: '8',
  creator: 'CREADOR/A',
  cast: 'REPARTO PRINCIPAL',
  synopsis: 'Escribe aqui la sinopsis de la serie. Tambien puedes buscar en TMDB para rellenar automaticamente titulo, genero, puntuacion, temporadas, episodios, reparto, portada y descripcion.',
  posterUrl: '',
  logoDataUrl: null,
  posterZoom: 100,
  posterOffsetX: 0,
  posterOffsetY: 0
};

function openSeriesTemplates() {
  closeSheet('menuSheet','menuOverlay');
  seriesTplInit();
  openSheet('seriesTplSheet','seriesTplOverlay');
  setTimeout(function(){ seriesTplDraw(); seriesTplRenderFixedPreviews(); }, 80);
}

function seriesTplInit() {
  if (seriesTplInitialized) return;
  seriesTplCanvas = document.getElementById('seriesTplCanvas');
  if (!seriesTplCanvas) return;
  seriesTplCtx = seriesTplCanvas.getContext('2d');
  seriesTplW = seriesTplCanvas.width;
  seriesTplH = seriesTplCanvas.height;

  var searchBtn = document.getElementById('seriesTplSearchBtn');
  var searchInput = document.getElementById('seriesTplSearchInput');
  if (searchBtn) searchBtn.addEventListener('click', seriesTplDoSearch);
  if (searchInput) searchInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') seriesTplDoSearch(); });

  ['seriesTplTitle','seriesTplGenre','seriesTplYear','seriesTplRating','seriesTplSeasons','seriesTplEpisodes','seriesTplCreator','seriesTplCast','seriesTplSynopsis','seriesTplPosterUrl'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', seriesTplSyncStateFromInputsDebounced);
  });

  var zoom = document.getElementById('seriesTplPosterZoom');
  var offX = document.getElementById('seriesTplPosterOffsetX');
  var offY = document.getElementById('seriesTplPosterOffsetY');
  var reset = document.getElementById('seriesTplPosterResetBtn');
  if (zoom) zoom.addEventListener('input', function(){
    seriesTplState.posterZoom = parseFloat(zoom.value);
    document.getElementById('seriesTplPosterZoomVal').textContent = zoom.value;
    seriesTplDraw();
  });
  if (offX) offX.addEventListener('input', function(){ seriesTplState.posterOffsetX = parseFloat(offX.value); seriesTplDraw(); });
  if (offY) offY.addEventListener('input', function(){ seriesTplState.posterOffsetY = parseFloat(offY.value); seriesTplDraw(); });
  if (reset) reset.addEventListener('click', function(){ seriesTplResetPosterAdjust(); seriesTplDraw(); });

  var logoInput = document.getElementById('seriesTplLogoInput');
  if (logoInput) logoInput.addEventListener('change', seriesTplHandleLogoUpload);

  var downloadBtn = document.getElementById('seriesTplDownloadBtn');
  var uploadBtn1 = document.getElementById('seriesTplUploadFixed1Btn');
  var uploadBtn2 = document.getElementById('seriesTplUploadFixed2Btn');
  var uploadBtn3 = document.getElementById('seriesTplUploadFixed3Btn');
  if (downloadBtn) downloadBtn.addEventListener('click', seriesTplDownloadJpeg);
  if (uploadBtn1) uploadBtn1.addEventListener('click', function(){ seriesTplUploadToFixed('serie_1', this); });
  if (uploadBtn2) uploadBtn2.addEventListener('click', function(){ seriesTplUploadToFixed('serie_2', this); });
  if (uploadBtn3) uploadBtn3.addEventListener('click', function(){ seriesTplUploadToFixed('serie_3', this); });

  seriesTplFillInputsFromState();
  seriesTplRestoreLogo();
  seriesTplDraw();
  seriesTplInitialized = true;
}

document.addEventListener('DOMContentLoaded', seriesTplInit);

function seriesTplFillInputsFromState() {
  var map = {
    seriesTplTitle: 'title',
    seriesTplGenre: 'genre',
    seriesTplYear: 'year',
    seriesTplRating: 'rating',
    seriesTplSeasons: 'seasons',
    seriesTplEpisodes: 'episodes',
    seriesTplCreator: 'creator',
    seriesTplCast: 'cast',
    seriesTplSynopsis: 'synopsis',
    seriesTplPosterUrl: 'posterUrl'
  };
  Object.keys(map).forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = seriesTplState[map[id]] || '';
  });
}

function seriesTplResetAll() {
  seriesTplState.title = 'TITULO DE LA SERIE';
  seriesTplState.genre = 'GENERO';
  seriesTplState.year = '2026';
  seriesTplState.rating = '0.0';
  seriesTplState.seasons = '1';
  seriesTplState.episodes = '8';
  seriesTplState.creator = 'CREADOR/A';
  seriesTplState.cast = 'REPARTO PRINCIPAL';
  seriesTplState.synopsis = 'Escribe aqui la sinopsis de la serie. Tambien puedes buscar en TMDB para rellenar automaticamente titulo, genero, puntuacion, temporadas, episodios, reparto, portada y descripcion.';
  seriesTplState.posterUrl = '';
  seriesTplPosterImg = null;
  seriesTplFillInputsFromState();
  seriesTplResetPosterAdjust();
  var results = document.getElementById('seriesTplSearchResults');
  var gallery = document.getElementById('seriesTplPosterGallery');
  var label = document.getElementById('seriesTplPosterGalleryLabel');
  var linkBox = document.getElementById('seriesTplLinkBox');
  if(results) results.innerHTML = '';
  if(gallery) gallery.innerHTML = '';
  if(label) label.style.display = 'none';
  if(linkBox) { linkBox.textContent = ''; linkBox.classList.remove('show'); }
  var copyBtn = document.getElementById('seriesTplCopyBtn');
  if(copyBtn) { copyBtn.disabled = true; delete copyBtn.dataset.link; }
  seriesTplSetStatus('Plantilla limpia', 'ok');
  seriesTplDraw();
}

function seriesTplLoadImage(src, crossOrigin) {
  return new Promise(function(resolve, reject){
    var img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = function(){ resolve(img); };
    img.onerror = function(e){ reject(e); };
    img.src = src;
  });
}

function seriesTplEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function seriesTplRoundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function seriesTplWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
  var words = String(text || '').split(/\s+/).filter(Boolean);
  var line = '';
  var lines = [];
  for (var n=0; n<words.length; n++){
    var testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0){
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  if (maxLines && lines.length > maxLines){
    lines = lines.slice(0, maxLines);
    var last = lines[maxLines-1];
    while (ctx.measureText(last + '...').width > maxWidth && last.length > 0){ last = last.slice(0,-1); }
    lines[maxLines-1] = last.trim() + '...';
  }
  lines.forEach(function(l, i){ ctx.fillText(l, x, y + i*lineHeight); });
  return lines.length;
}

function seriesTplDraw(){
  if(!seriesTplCtx) return;
  var ctx = seriesTplCtx, W = seriesTplW, H = seriesTplH;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0,0,W,H);

  var g1 = ctx.createRadialGradient(150,100,50,150,100,500);
  g1.addColorStop(0,'rgba(34,211,238,0.10)');
  g1.addColorStop(1,'rgba(34,211,238,0)');
  ctx.fillStyle = g1; ctx.fillRect(0,0,W,H);

  var g2 = ctx.createRadialGradient(W-150,H-100,50,W-150,H-100,600);
  g2.addColorStop(0,'rgba(163,230,53,0.06)');
  g2.addColorStop(1,'rgba(163,230,53,0)');
  ctx.fillStyle = g2; ctx.fillRect(0,0,W,H);

  seriesTplDrawDots(W-340, 30, 280, 220);
  seriesTplDrawDots(0, H-240, 100, 240);
  seriesTplDrawLogo();
  seriesTplDrawPoster();
  seriesTplDrawTextContent();
  seriesTplDrawNeonFrame();
}

function seriesTplDrawDots(x0,y0,w,h){
  var ctx = seriesTplCtx;
  ctx.save();
  ctx.fillStyle = 'rgba(34,211,238,0.25)';
  var gap = 22;
  for(var x=x0; x<x0+w; x+=gap){
    for(var y=y0; y<y0+h; y+=gap){
      ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}

function seriesTplDrawNeonFrame(){
  var ctx = seriesTplCtx, W = seriesTplW, H = seriesTplH;
  ctx.save();
  var margin = 6;
  var grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,'#22d3ee'); grad.addColorStop(1,'#a3e635');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(34,211,238,0.6)';
  ctx.shadowBlur = 18;
  seriesTplRoundRect(ctx, margin, margin, W - margin*2, H - margin*2, 18);
  ctx.stroke();
  ctx.restore();
}

function seriesTplDrawLogo(){
  var ctx = seriesTplCtx;
  var posterX = 45, posterW = 580 * (2/3);
  var areaW = 320, areaH = 230;
  var areaX = posterX + (posterW - areaW)/2;
  var areaY = 25;
  if (seriesTplLogoImg){
    var iw = seriesTplLogoImg.width, ih = seriesTplLogoImg.height;
    var scale = Math.min(areaW/iw, areaH/ih);
    var dw = iw*scale, dh = ih*scale;
    var dx = areaX + (areaW-dw)/2;
    var dy = areaY + (areaH-dh)/2;
    ctx.drawImage(seriesTplLogoImg, dx, dy, dw, dh);
  } else {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8,8]);
    seriesTplRoundRect(ctx, areaX, areaY, areaW, areaH, 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '600 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TU LOGO AQUI', areaX+areaW/2, areaY+areaH/2);
    ctx.restore();
  }
}

function seriesTplDrawPoster(){
  var ctx = seriesTplCtx;
  var h = 580, w = h * (2/3), x = 45, y = 280, r = 22;
  ctx.save();
  seriesTplRoundRect(ctx, x, y, w, h, r);
  var grad = ctx.createLinearGradient(x,y,x+w,y+h);
  grad.addColorStop(0,'#22d3ee'); grad.addColorStop(1,'#a3e635');
  ctx.strokeStyle = grad; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(34,211,238,0.5)'; ctx.shadowBlur = 20; ctx.stroke();
  ctx.restore();

  ctx.save();
  seriesTplRoundRect(ctx, x+2, y+2, w-4, h-4, r-2);
  ctx.clip();
  if (seriesTplPosterImg){
    ctx.fillStyle = '#0d1422'; ctx.fillRect(x+2,y+2,w-4,h-4);
    var ir = seriesTplPosterImg.width / seriesTplPosterImg.height;
    var tr = (w-4) / (h-4);
    var sw, sh;
    if (ir > tr){ sh = seriesTplPosterImg.height; sw = sh * tr; }
    else { sw = seriesTplPosterImg.width; sh = sw / tr; }
    var zoom = (seriesTplState.posterZoom || 100) / 100;
    sw = sw / zoom; sh = sh / zoom;
    var dw = w-4, dh = h-4;
    if (sw > seriesTplPosterImg.width){ var ratioW = seriesTplPosterImg.width / sw; sw = seriesTplPosterImg.width; dw = (w-4) * ratioW; }
    if (sh > seriesTplPosterImg.height){ var ratioH = seriesTplPosterImg.height / sh; sh = seriesTplPosterImg.height; dh = (h-4) * ratioH; }
    var maxOffX = seriesTplPosterImg.width - sw;
    var maxOffY = seriesTplPosterImg.height - sh;
    var sx = (seriesTplPosterImg.width - sw) / 2;
    var sy = (seriesTplPosterImg.height - sh) / 2;
    sx += (seriesTplState.posterOffsetX || 0) / 100 * (maxOffX / 2);
    sy += (seriesTplState.posterOffsetY || 0) / 100 * (maxOffY / 2);
    sx = Math.max(0, Math.min(maxOffX, sx));
    sy = Math.max(0, Math.min(maxOffY, sy));
    var dx = x+2 + ((w-4)-dw)/2;
    var dy = y+2 + ((h-4)-dh)/2;
    ctx.drawImage(seriesTplPosterImg, sx, sy, sw, sh, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#0d1422'; ctx.fillRect(x+2,y+2,w-4,h-4);
    ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 4;
    var ix = x+w/2-65, iy = y+h/2-130, isz = 130;
    seriesTplRoundRect(ctx, ix, iy, isz, isz, 14); ctx.stroke();
    ctx.beginPath(); ctx.arc(ix+isz*.7, iy+isz*.3, 10, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix+15, iy+isz-20); ctx.lineTo(ix+isz*.4, iy+isz*.55); ctx.lineTo(ix+isz*.6, iy+isz*.75); ctx.lineTo(ix+isz*.8, iy+isz*.45); ctx.lineTo(ix+isz-15, iy+isz-20); ctx.stroke();
    ctx.fillStyle = '#5a6a85'; ctx.font = '700 36px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PORTADA', x+w/2, y+h/2+90); ctx.textAlign = 'left';
  }
  ctx.restore();
}

function seriesTplDrawTextContent(){
  var ctx = seriesTplCtx, W = seriesTplW;
  var leftX = 590;

  ctx.fillStyle = '#f5f7fa';
  ctx.font = '900 62px Arial, sans-serif';
  ctx.fillText('SERIE', leftX, 95);
  var grad = ctx.createLinearGradient(leftX,0,leftX+800,0);
  grad.addColorStop(0,'#22d3ee'); grad.addColorStop(1,'#a3e635');
  ctx.fillStyle = grad; ctx.font = '900 62px Arial, sans-serif'; ctx.fillText('RECOMENDADA', leftX, 170);
  ctx.fillStyle = '#a3e635'; ctx.font = '700 34px Arial, sans-serif'; ctx.fillText('de la semana', leftX, 225);
  ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(leftX+380, 213); ctx.lineTo(W-90, 213); ctx.stroke();
  ctx.beginPath(); ctx.fillStyle = '#a3e635'; ctx.arc(W-90, 213, 7, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#f5f7fa';
  ctx.font = '900 50px Arial, sans-serif';
  var titleText = (seriesTplState.title || 'TITULO DE LA SERIE').toUpperCase();
  var titleLines = seriesTplWrapText(ctx, titleText, leftX, 310, W-leftX-90, 56, 2);
  var yCursor = 310 + (titleLines>1 ? 56 : 0) + 58;

  ctx.font = '700 24px Arial, sans-serif';
  var genreText = (seriesTplState.genre || 'GENERO').toUpperCase();
  var padX = 24;
  var pillH = 46;
  var pillW = Math.min(ctx.measureText(genreText).width + padX*2, W-leftX-90);
  seriesTplRoundRect(ctx, leftX, yCursor-pillH+10, pillW, pillH, pillH/2);
  ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#a3e635'; ctx.textBaseline = 'middle';
  var clippedGenre = genreText;
  while(ctx.measureText(clippedGenre).width > pillW - padX*2 && clippedGenre.length > 0){ clippedGenre = clippedGenre.slice(0, -1); }
  if(clippedGenre !== genreText) clippedGenre = clippedGenre.slice(0, -3) + '...';
  ctx.fillText(clippedGenre, leftX+padX, yCursor-pillH/2+10);
  ctx.textBaseline = 'alphabetic';
  yCursor += 68;

  seriesTplDrawStar(leftX+18, yCursor-10, 22, '#a3e635');
  ctx.fillStyle = '#f5f7fa'; ctx.font = '600 28px Arial, sans-serif';
  var ratingVal = parseFloat(seriesTplState.rating);
  var ratingStr = (isNaN(ratingVal) ? '0.0' : ratingVal.toFixed(1)) + '/10';
  ctx.fillText(ratingStr, leftX+50, yCursor);

  ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 2;
  var sepX = leftX + 50 + ctx.measureText(ratingStr).width + 28;
  ctx.beginPath(); ctx.moveTo(sepX, yCursor-25); ctx.lineTo(sepX, yCursor+5); ctx.stroke();
  ctx.fillStyle = '#22d3ee'; ctx.font = '700 25px Arial, sans-serif';
  var yearText = (seriesTplState.year || '----');
  ctx.fillText('ESTRENO ' + yearText, sepX+30, yCursor);
  yCursor += 48;

  ctx.fillStyle = '#e6e9ef'; ctx.font = '600 25px Arial, sans-serif';
  var seasons = seriesTplState.seasons || '1';
  var episodes = seriesTplState.episodes || '8';
  ctx.fillText(seasons + ' temp.  ·  ' + episodes + ' episodios', leftX, yCursor);
  yCursor += 48;

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(leftX, yCursor); ctx.lineTo(W-90, yCursor); ctx.stroke();
  yCursor += 43;

  ctx.fillStyle = '#22d3ee'; ctx.font = '800 25px Arial, sans-serif'; ctx.fillText('CREADA POR', leftX, yCursor);
  ctx.fillStyle = '#e6e9ef'; ctx.font = '400 24px Arial, sans-serif';
  seriesTplWrapText(ctx, seriesTplState.creator || '-', leftX+190, yCursor, W-leftX-280, 30, 1);
  yCursor += 42;

  ctx.fillStyle = '#22d3ee'; ctx.font = '800 25px Arial, sans-serif'; ctx.fillText('REPARTO', leftX, yCursor);
  ctx.fillStyle = '#e6e9ef'; ctx.font = '400 24px Arial, sans-serif';
  seriesTplWrapText(ctx, seriesTplState.cast || '-', leftX+150, yCursor, W-leftX-240, 30, 2);
  yCursor += 62;

  ctx.fillStyle = '#22d3ee'; ctx.font = '800 28px Arial, sans-serif'; ctx.fillText('SINOPSIS', leftX, yCursor);
  yCursor += 38;
  ctx.fillStyle = '#e6e9ef'; ctx.font = '400 24px Arial, sans-serif';
  seriesTplWrapText(ctx, seriesTplState.synopsis || '', leftX, yCursor, W-leftX-90, 34, 7);
}

function seriesTplDrawStar(cx, cy, r, color){
  var ctx = seriesTplCtx;
  ctx.save(); ctx.fillStyle = color; ctx.beginPath();
  for(var i=0; i<5; i++){
    var outerAngle = -Math.PI/2 + i*(2*Math.PI/5);
    var innerAngle = outerAngle + Math.PI/5;
    var ox = cx + r*Math.cos(outerAngle), oy = cy + r*Math.sin(outerAngle);
    var ix = cx + (r*.45)*Math.cos(innerAngle), iy = cy + (r*.45)*Math.sin(innerAngle);
    if(i===0) ctx.moveTo(ox,oy); else ctx.lineTo(ox,oy);
    ctx.lineTo(ix,iy);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

async function seriesTplSearchShows(query){
  if(!SERIES_TPL_TMDB_KEY) throw new Error('Falta la clave TMDB en config.js');
  var url = 'https://api.themoviedb.org/3/search/tv?api_key=' + SERIES_TPL_TMDB_KEY + '&language=es-ES&query=' + encodeURIComponent(query);
  var res = await fetch(url);
  if(!res.ok) throw new Error('Error TMDB: ' + res.status);
  var data = await res.json();
  return data.results || [];
}

async function seriesTplGetShowDetails(id){
  var url = 'https://api.themoviedb.org/3/tv/' + id + '?api_key=' + SERIES_TPL_TMDB_KEY + '&language=es-ES&append_to_response=credits';
  var res = await fetch(url);
  if(!res.ok) throw new Error('Error TMDB detalle: ' + res.status);
  return res.json();
}

async function seriesTplGetShowImages(id){
  var url = 'https://api.themoviedb.org/3/tv/' + id + '/images?api_key=' + SERIES_TPL_TMDB_KEY + '&include_image_language=es,en,null';
  var res = await fetch(url);
  if(!res.ok) throw new Error('Error TMDB imagenes: ' + res.status);
  var data = await res.json();
  return data.posters || [];
}

function seriesTplRenderResults(results){
  var box = document.getElementById('seriesTplSearchResults');
  if(!box) return;
  box.innerHTML = '';
  if(!results.length){
    box.innerHTML = '<p style="color:var(--muted);font-size:.8rem;">Sin resultados.</p>';
    return;
  }
  results.slice(0,8).forEach(function(show){
    var item = document.createElement('div');
    item.className = 'movieTplResultItem';
    var posterSrc = show.poster_path ? 'https://image.tmdb.org/t/p/w92' + show.poster_path : '';
    var year = show.first_air_date ? show.first_air_date.slice(0,4) : '-';
    item.innerHTML = '<img src="' + seriesTplEsc(posterSrc) + '" alt=""><div class="meta"><div class="t">' + seriesTplEsc(show.name) + '</div><div class="y">' + seriesTplEsc(year) + '</div></div>';
    item.addEventListener('click', function(){ seriesTplSelectShow(show.id); });
    box.appendChild(item);
  });
}

async function seriesTplDoSearch(){
  var q = (document.getElementById('seriesTplSearchInput') || {}).value || '';
  q = q.trim();
  if(!q) return;
  seriesTplSetStatus('Buscando...', '');
  try{
    var results = await seriesTplSearchShows(q);
    seriesTplRenderResults(results);
    seriesTplSetStatus('', '');
  }catch(err){
    console.error(err);
    seriesTplSetStatus('Error al buscar: ' + err.message, 'err');
  }
}

async function seriesTplSelectShow(id){
  seriesTplSetStatus('Cargando datos de la serie...', '');
  try{
    var details = await seriesTplGetShowDetails(id);
    var year = details.first_air_date ? details.first_air_date.slice(0,4) : '';
    document.getElementById('seriesTplTitle').value = details.name ? (details.name + (year ? ' (' + year + ')' : '')) : '';
    document.getElementById('seriesTplGenre').value = (details.genres || []).map(function(g){ return g.name; }).join(', ');
    document.getElementById('seriesTplYear').value = year || '';
    document.getElementById('seriesTplRating').value = details.vote_average ? details.vote_average.toFixed(1) : '0.0';
    document.getElementById('seriesTplSeasons').value = details.number_of_seasons || 0;
    document.getElementById('seriesTplEpisodes').value = details.number_of_episodes || 0;
    document.getElementById('seriesTplCreator').value = (details.created_by || []).map(function(c){ return c.name; }).join(', ') || '-';
    var cast = details.credits && details.credits.cast ? details.credits.cast.slice(0,5).map(function(c){ return c.name; }).join(', ') : '';
    document.getElementById('seriesTplCast').value = cast || '-';
    document.getElementById('seriesTplSynopsis').value = details.overview || '';
    var posterUrl = details.poster_path ? 'https://image.tmdb.org/t/p/w780' + details.poster_path : '';
    document.getElementById('seriesTplPosterUrl').value = posterUrl;
    await seriesTplSyncStateFromInputs();
    seriesTplSetStatus('Datos cargados', 'ok');
    try{
      var posters = await seriesTplGetShowImages(id);
      seriesTplRenderPosterGallery(posters, posterUrl);
    }catch(e){ console.warn('No se pudieron cargar posters alternativos', e); }
  }catch(err){
    console.error(err);
    seriesTplSetStatus('Error al cargar la serie: ' + err.message, 'err');
  }
}

function seriesTplRenderPosterGallery(posters, currentUrl){
  var gallery = document.getElementById('seriesTplPosterGallery');
  var label = document.getElementById('seriesTplPosterGalleryLabel');
  if(!gallery || !label) return;
  gallery.innerHTML = '';
  if(!posters || !posters.length){ label.style.display = 'none'; return; }
  label.style.display = 'block';
  label.textContent = 'Elegir otro poster (' + posters.length + ' disponibles)';
  posters.forEach(function(poster){
    var fullUrl = 'https://image.tmdb.org/t/p/w780' + poster.file_path;
    var thumbUrl = 'https://image.tmdb.org/t/p/w154' + poster.file_path;
    var thumb = document.createElement('div');
    thumb.className = 'movieTplPosterThumb seriesTplPosterThumb';
    if(fullUrl === currentUrl) thumb.classList.add('selected');
    var img = document.createElement('img');
    img.src = thumbUrl;
    img.alt = '';
    thumb.appendChild(img);
    thumb.addEventListener('click', async function(){
      document.querySelectorAll('.seriesTplPosterThumb').forEach(function(el){ el.classList.remove('selected'); });
      thumb.classList.add('selected');
      document.getElementById('seriesTplPosterUrl').value = fullUrl;
      await seriesTplSyncStateFromInputs();
    });
    gallery.appendChild(thumb);
  });
}

function seriesTplSyncStateFromInputsDebounced(){
  clearTimeout(seriesTplDebounceTimer);
  seriesTplDebounceTimer = setTimeout(seriesTplSyncStateFromInputs, 250);
}

async function seriesTplSyncStateFromInputs(){
  seriesTplState.title = document.getElementById('seriesTplTitle').value;
  seriesTplState.genre = document.getElementById('seriesTplGenre').value;
  seriesTplState.year = document.getElementById('seriesTplYear').value;
  seriesTplState.rating = document.getElementById('seriesTplRating').value;
  seriesTplState.seasons = document.getElementById('seriesTplSeasons').value;
  seriesTplState.episodes = document.getElementById('seriesTplEpisodes').value;
  seriesTplState.creator = document.getElementById('seriesTplCreator').value;
  seriesTplState.cast = document.getElementById('seriesTplCast').value;
  seriesTplState.synopsis = document.getElementById('seriesTplSynopsis').value;
  var newPosterUrl = document.getElementById('seriesTplPosterUrl').value.trim();
  if(newPosterUrl !== seriesTplState.posterUrl){
    seriesTplState.posterUrl = newPosterUrl;
    if(newPosterUrl){
      try{ seriesTplPosterImg = await seriesTplLoadImage(newPosterUrl, true); }
      catch(e){
        try{ seriesTplPosterImg = await seriesTplLoadImage(newPosterUrl, false); }
        catch(e2){ seriesTplPosterImg = null; console.warn('No se pudo cargar el poster', e2); }
      }
    } else {
      seriesTplPosterImg = null;
    }
    seriesTplResetPosterAdjust();
  }
  seriesTplDraw();
}

function seriesTplResetPosterAdjust(){
  seriesTplState.posterZoom = 100;
  seriesTplState.posterOffsetX = 0;
  seriesTplState.posterOffsetY = 0;
  var zoom = document.getElementById('seriesTplPosterZoom');
  var offX = document.getElementById('seriesTplPosterOffsetX');
  var offY = document.getElementById('seriesTplPosterOffsetY');
  var val = document.getElementById('seriesTplPosterZoomVal');
  if(zoom) zoom.value = 100;
  if(offX) offX.value = 0;
  if(offY) offY.value = 0;
  if(val) val.textContent = '100';
}

function seriesTplHandleLogoUpload(e){
  var file = e.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = async function(ev){
    seriesTplState.logoDataUrl = ev.target.result;
    try{ localStorage.setItem(SERIES_TPL_LOGO_STORAGE_KEY, seriesTplState.logoDataUrl); }catch(err){}
    seriesTplLogoImg = await seriesTplLoadImage(seriesTplState.logoDataUrl, false);
    var prev = document.getElementById('seriesTplLogoPreviewSmall');
    if(prev) prev.src = seriesTplState.logoDataUrl;
    seriesTplDraw();
    seriesTplSetStatus('Logo actualizado', 'ok');
  };
  reader.readAsDataURL(file);
}

async function seriesTplRestoreLogo(){
  try{
    var saved = localStorage.getItem(SERIES_TPL_LOGO_STORAGE_KEY);
    if(saved){
      seriesTplState.logoDataUrl = saved;
      seriesTplLogoImg = await seriesTplLoadImage(saved, false);
      var prev = document.getElementById('seriesTplLogoPreviewSmall');
      if(prev) prev.src = saved;
    } else {
      seriesTplLogoImg = await seriesTplLoadImage('assets/logo.png', false);
    }
    seriesTplDraw();
  }catch(err){
    console.warn(err);
    seriesTplDraw();
  }
}

function seriesTplSetStatus(msg, cls){
  var el = document.getElementById('seriesTplStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'movieTplStatus' + (cls ? ' ' + cls : '');
}

function seriesTplCanvasToJpegBlob(){
  return new Promise(function(resolve, reject){
    try{
      seriesTplCanvas.toBlob(function(blob){
        if(blob) resolve(blob);
        else reject(new Error('No se pudo generar el JPEG'));
      }, 'image/jpeg', 0.92);
    }catch(err){ reject(err); }
  });
}

async function seriesTplDownloadJpeg(){
  try{
    seriesTplDraw();
    var blob = await seriesTplCanvasToJpegBlob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var safeTitle = (seriesTplState.title || 'serie').toLowerCase().replace(/[^a-z0-9]+/gi,'_').slice(0,40);
    a.href = url;
    a.download = 'm17liv3_serie_' + (safeTitle || 'plantilla') + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    seriesTplSetStatus('JPEG descargado', 'ok');
  }catch(err){
    seriesTplSetStatus('Error al descargar: posible problema CORS con el poster.', 'err');
  }
}

async function seriesTplUploadImgBB(){
  if(!SERIES_TPL_IMGBB_KEY){ seriesTplSetStatus('Falta la clave de imgBB en config.js', 'err'); return; }
  seriesTplSetStatus('Generando imagen...', '');
  seriesTplDraw();
  var blob;
  try{ blob = await seriesTplCanvasToJpegBlob(); }
  catch(err){ seriesTplSetStatus('Error al generar la imagen. Puede ser CORS del poster.', 'err'); return; }
  seriesTplSetStatus('Subiendo a imgBB...', '');
  try{
    var formData = new FormData();
    formData.append('image', blob);
    var res = await fetch('https://api.imgbb.com/1/upload?key=' + SERIES_TPL_IMGBB_KEY, { method:'POST', body:formData });
    var data = await res.json();
    if(data.success){
      var link = data.data.url;
      var linkBox = document.getElementById('seriesTplLinkBox');
      var copyBtn = document.getElementById('seriesTplCopyBtn');
      if(linkBox){ linkBox.textContent = link; linkBox.classList.add('show'); }
      if(copyBtn){ copyBtn.disabled = false; copyBtn.dataset.link = link; }
      seriesTplSetStatus('Subido correctamente', 'ok');
    } else {
      throw new Error((data.error && data.error.message) || 'Error desconocido de imgBB');
    }
  }catch(err){
    console.error(err);
    seriesTplSetStatus('Error al subir a imgBB: ' + err.message, 'err');
  }
}

async function seriesTplCopyLink(){
  var btn = document.getElementById('seriesTplCopyBtn');
  var link = btn && btn.dataset.link;
  if(!link) return;
  try{
    await navigator.clipboard.writeText(link);
    seriesTplSetStatus('Enlace copiado al portapapeles', 'ok');
  }catch(err){
    seriesTplSetStatus('No se pudo copiar automaticamente. Copialo manualmente.', 'err');
  }
}

function seriesTplRenderFixedPreviews(){
  [
    {slot:'serie_1', imgId:'seriesTplFixedPreview1'},
    {slot:'serie_2', imgId:'seriesTplFixedPreview2'},
    {slot:'serie_3', imgId:'seriesTplFixedPreview3'}
  ].forEach(function(item){
    seriesTplRefreshFixedPreview(item.slot, item.imgId);
  });
}

function seriesTplRefreshFixedPreview(slotKey, imgId){
  var img = document.getElementById(imgId);
  if(!img) return;
  img.onerror = function(){ this.style.display = 'none'; };
  img.onload = function(){ this.style.display = 'block'; };
  img.src = fixedAppImageUrl(slotKey, true);
}

async function seriesTplUploadToFixed(slotKey, btnEl){
  var slot = fixedSlotByKey(slotKey);
  if(!slot) return;
  seriesTplSetStatus('Generando imagen para ' + slot.label + '...', '');
  seriesTplDraw();
  var blob;
  try { blob = await seriesTplCanvasToJpegBlob(); }
  catch(err){ seriesTplSetStatus('Error al generar la imagen. Puede ser CORS del poster.', 'err'); return; }
  var oldText = btnEl ? btnEl.textContent : '';
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Subiendo...'; }
  try {
    await uploadBlobToFixedSlot(slotKey, blob, 'image/jpeg');
    seriesTplSetStatus('Subida correctamente a ' + slot.label, 'ok');
    seriesTplRenderFixedPreviews();
    try { loadFixedSlotImage(slotKey); } catch(e) {}
    showToast(slot.label + ' sustituida correctamente');
  } catch(err){
    console.error(err);
    seriesTplSetStatus('Error al subir a ' + slot.label + ': ' + (err && err.message ? err.message : 'error desconocido'), 'err');
    showToast('Error al sustituir ' + slot.label, 'error');
  }
  if (btnEl) { btnEl.disabled = false; btnEl.textContent = oldText || 'Subir'; }
}

// ========== FIN PLANTILLAS SERIES ADMIN ==========


// ========== SORTEOS CLIENTES ==========
function raffleTypeLabel(type) {
  if (type === 'active') return 'Clientes activos';
  if (type === 'soon') return 'Expiran pronto (15 dias)';
  if (type === 'expired') return 'Clientes caducados';
  if (type === 'all') return 'Todos los clientes';
  return type || '-';
}

function getRaffleParticipants(type) {
  type = type || 'active';
  return clients.filter(function(c){
    var st = getStatus(c.expiry);
    if (type === 'all') return true;
    if (type === 'active') return st === 'ok' || st === 'warn';
    if (type === 'soon') return st === 'warn';
    if (type === 'expired') return st === 'exp';
    return true;
  });
}

function updateRaffleParticipantCount() {
  var sel = document.getElementById('raffleParticipantsType');
  var box = document.getElementById('raffleParticipantsCount');
  if (!box) return;
  var type = sel ? sel.value : 'active';
  var total = getRaffleParticipants(type).length;
  box.textContent = total + (total === 1 ? ' participante disponible' : ' participantes disponibles');
  box.style.color = total ? 'var(--green)' : 'var(--orange)';
}

function raffleRowToItem(row) {
  return {
    id: row.id,
    nombre: row.nombre || '',
    premio: row.premio || '',
    ganadorId: row.ganador_id || '',
    ganadorNombre: row.ganador_nombre || '',
    participantesTipo: row.participantes_tipo || '',
    participantesTotal: row.participantes_total || 0,
    createdAt: row.created_at || ''
  };
}

async function loadRaffles(showMsg) {
  try {
    if (!USE_SUPABASE) {
      try { raffles = JSON.parse(localStorage.getItem('m17_raffles') || '[]'); } catch(e) { raffles = []; }
      renderRaffleHistory();
      return raffles;
    }
    var db = initSupabase();
    var result = await db.from(SUPABASE_RAFFLES_TABLE).select('*').order('created_at', { ascending: false }).limit(30);
    if (result.error) throw result.error;
    raffles = (result.data || []).map(raffleRowToItem);
    renderRaffleHistory();
    if (showMsg && typeof showToast === 'function') showToast('Historial actualizado');
    return raffles;
  } catch(ex) {
    console.error(ex);
    if (typeof showToast === 'function') showToast('Error al cargar sorteos: ' + ex.message, 'error');
    return [];
  }
}

async function saveRaffleToStore(item) {
  if (!USE_SUPABASE) {
    item.id = genId();
    item.createdAt = new Date().toISOString();
    raffles.unshift(item);
    localStorage.setItem('m17_raffles', JSON.stringify(raffles));
    return item;
  }
  var db = initSupabase();
  var payload = {
    nombre: item.nombre || '',
    premio: item.premio || '',
    ganador_id: item.ganadorId || null,
    ganador_nombre: item.ganadorNombre || '',
    participantes_tipo: item.participantesTipo || '',
    participantes_total: item.participantesTotal || 0
  };
  var result = await db.from(SUPABASE_RAFFLES_TABLE).insert(payload).select('*').single();
  if (result.error) throw result.error;
  return raffleRowToItem(result.data);
}

function renderRaffleHistory() {
  var box = document.getElementById('raffleHistory');
  if (!box) return;
  if (!raffles.length) {
    box.innerHTML = '<div class="emptyMini">Todavia no hay sorteos guardados.</div>';
    return;
  }
  box.innerHTML = raffles.map(function(r){
    var d = '-';
    if (r.createdAt) {
      try { d = new Date(r.createdAt).toLocaleDateString('es-ES') + ' ' + new Date(r.createdAt).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}); } catch(e) {}
    }
    return '<div class="raffleItem">' +
      '<div class="raffleItemTop">' +
        '<div class="raffleItemName">' + esc(r.nombre || 'Sorteo') + '</div>' +
        '<div class="raffleItemDate">' + esc(d) + '</div>' +
      '</div>' +
      '<div class="raffleItemMeta">Premio: <span style="color:var(--text)">' + esc(r.premio || '-') + '</span></div>' +
      '<div class="raffleItemMeta">Ganador: <span style="color:var(--green)">' + esc(r.ganadorNombre || '-') + '</span></div>' +
      '<div class="raffleItemMeta">Participantes: ' + esc(raffleTypeLabel(r.participantesTipo)) + ' · ' + esc(String(r.participantesTotal || 0)) + '</div>' +
    '</div>';
  }).join('');
}

async function openRaffles() {
  closeSheet('menuSheet','menuOverlay');
  var nameEl = document.getElementById('raffleName');
  var prizeEl = document.getElementById('rafflePrize');
  var typeEl = document.getElementById('raffleParticipantsType');
  var resultEl = document.getElementById('raffleResult');
  if (nameEl && !nameEl.value) nameEl.value = 'Sorteo mensual';
  if (prizeEl && !prizeEl.value) prizeEl.value = '1 mes gratis';
  if (typeEl && !typeEl.value) typeEl.value = 'active';
  if (resultEl) resultEl.style.display = 'none';
  lastRaffleResult = null;
  updateRaffleParticipantCount();
  openSheet('raffleSheet','raffleOverlay');
  await loadRaffles(false);
  updateRaffleParticipantCount();
}

async function runRaffle() {
  var btn = document.getElementById('raffleRunBtn');
  var nameEl = document.getElementById('raffleName');
  var prizeEl = document.getElementById('rafflePrize');
  var typeEl = document.getElementById('raffleParticipantsType');
  var nombre = (nameEl && nameEl.value ? nameEl.value : '').trim() || 'Sorteo';
  var premio = (prizeEl && prizeEl.value ? prizeEl.value : '').trim();
  var type = typeEl ? typeEl.value : 'active';

  if (!premio) {
    if (typeof showToast === 'function') showToast('Escribe el premio del sorteo', 'error');
    if (prizeEl) prizeEl.focus();
    return;
  }

  var participantes = getRaffleParticipants(type);
  if (!participantes.length) {
    if (typeof showToast === 'function') showToast('No hay participantes para este filtro', 'error');
    return;
  }

  var ok = confirm('Se elegira 1 ganador entre ' + participantes.length + ' participantes. ¿Realizar sorteo ahora?');
  if (!ok) return;

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Realizando sorteo...'; }
    var winner = participantes[Math.floor(Math.random() * participantes.length)];
    var item = {
      nombre: nombre,
      premio: premio,
      ganadorId: winner.id,
      ganadorNombre: winner.name,
      participantesTipo: type,
      participantesTotal: participantes.length
    };
    var saved = await saveRaffleToStore(item);
    lastRaffleResult = saved;
    if (!raffles.find(function(r){ return r.id === saved.id; })) raffles.unshift(saved);
    renderRaffleResult(saved);
    renderRaffleHistory();
    if (typeof showToast === 'function') showToast('Sorteo realizado: ' + saved.ganadorNombre);
  } catch(ex) {
    console.error(ex);
    if (typeof showToast === 'function') showToast('Error al guardar sorteo: ' + ex.message, 'error');
    else alert('Error al guardar sorteo: ' + ex.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '&#127922; Realizar sorteo'; }
  }
}

function renderRaffleResult(r) {
  var box = document.getElementById('raffleResult');
  var name = document.getElementById('raffleWinnerName');
  var prize = document.getElementById('rafflePrizeText');
  if (!box) return;
  if (name) name.textContent = r.ganadorNombre || '-';
  if (prize) prize.textContent = 'Premio: ' + (r.premio || '-') + ' · Participantes: ' + (r.participantesTotal || 0);
  box.style.display = 'block';
}

function buildRaffleWinnerMessage(r) {
  if (!r) return '';
  return '🎉 ¡Enhorabuena!\n\n' +
    'Has sido seleccionado/a en nuestro sorteo interno.\n\n' +
    'Premio: ' + (r.premio || '-') + '\n\n' +
    'Nos pondremos en contacto contigo para aplicarlo.';
}

function buildRafflePublicMessage(r) {
  if (!r) return '';
  return '🎁 Resultado del sorteo\n\n' +
    'Sorteo: ' + (r.nombre || 'Sorteo') + '\n' +
    'Premio: ' + (r.premio || '-') + '\n' +
    'Ganador/a: ' + (r.ganadorNombre || '-') + '\n' +
    'Participantes: ' + (r.participantesTotal || 0) + '\n\n' +
    'Gracias a todos por participar.';
}

function copyRaffleWinnerMessage(btn) {
  if (!lastRaffleResult) {
    if (typeof showToast === 'function') showToast('Primero realiza un sorteo', 'error');
    return;
  }
  copyMessageText(buildRaffleWinnerMessage(lastRaffleResult), btn);
}

function copyRafflePublicMessage(btn) {
  if (!lastRaffleResult) {
    if (typeof showToast === 'function') showToast('Primero realiza un sorteo', 'error');
    return;
  }
  copyMessageText(buildRafflePublicMessage(lastRaffleResult), btn);
}
// ========== FIN SORTEOS CLIENTES ==========

// ========== MODO APP INSTALABLE PWA ==========
var deferredPWAInstallPrompt = null;

function isPWAStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updatePWAInstallMenu(){
  var item = document.getElementById('pwaInstallMenuItem');
  if(!item) return;
  if(isPWAStandalone()){
    item.style.display = 'none';
  } else {
    item.style.display = 'flex';
  }
}

window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  deferredPWAInstallPrompt = e;
  updatePWAInstallMenu();
});

window.addEventListener('appinstalled', function(){
  deferredPWAInstallPrompt = null;
  updatePWAInstallMenu();
});

async function installPWA(){
  if(isPWAStandalone()){
    alert('La app ya esta instalada en este dispositivo.');
    return;
  }

  if(deferredPWAInstallPrompt){
    deferredPWAInstallPrompt.prompt();
    try{
      await deferredPWAInstallPrompt.userChoice;
    }catch(err){}
    deferredPWAInstallPrompt = null;
    updatePWAInstallMenu();
    return;
  }

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua);
  if(isIOS){
    alert('Para instalarla en iPhone/iPad: abre esta web en Safari, toca Compartir y elige "Anadir a pantalla de inicio".');
  } else {
    alert('Para instalarla: abre el menu del navegador y pulsa "Instalar app" o "Anadir a pantalla de inicio". En Chrome Android tambien puede aparecer el aviso automaticamente.');
  }
}

if('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./sw.js').catch(function(err){
      console.warn('No se pudo registrar el Service Worker PWA:', err);
    });
    updatePWAInstallMenu();
  });
} else {
  window.addEventListener('load', updatePWAInstallMenu);
}
// ========== FIN MODO APP INSTALABLE PWA ==========



// Refuerzo visual: añade el botón Borrar al historial aunque la PWA conserve parte del listado en caché.
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(ensurePaymentDeleteButtons, 500);
  setTimeout(ensurePaymentDeleteButtons, 1500);
});
setInterval(function(){
  var paymentsSheet = document.getElementById('paymentsSheet');
  if (paymentsSheet && paymentsSheet.classList.contains('open')) ensurePaymentDeleteButtons();
}, 1200);

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(ensureMessageTemplateEditorUi, 700);
});

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(cleanupDuplicateMessageTemplateButtons, 900);
});


function finalEnhancementsBoot() {
  try { renderTagFilterBar(); } catch(e) {}
}
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(finalEnhancementsBoot, 800);
});
