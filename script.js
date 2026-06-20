var CONFIG = window.M17_CONFIG || {};
var ADMIN_USER = CONFIG.adminUser || 'admin';
var ADMIN_PASS_HASH = CONFIG.adminPassHash || '';
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
try { clients = JSON.parse(localStorage.getItem('m17_clients') || '[]'); } catch(e) {}
var selectedApps = [];
var deleteTargetId = null;
var renewTargetId = null;
var renewMonths = 1;
var messageTargetId = null;
var filterSvc = '';
var filterSt = '';
var showFilters = false;


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
  try {
    var u = document.getElementById('lUser').value.trim();
    var p = document.getElementById('lPass').value;
    var okPass = ADMIN_PASS_HASH && (await sha256Text(p)) === ADMIN_PASS_HASH;
    if (u === ADMIN_USER && okPass) {
      var lp = document.getElementById('loginPage');
      var ap = document.getElementById('appPage');
      lp.style.display = 'none';
      ap.classList.add('active');
      ap.style.display = 'flex';
      ap.style.flexDirection = 'column';
      ap.style.height = '100vh';
      renderCards(); 
      updateStats();
    } else {
      var err = document.getElementById('loginErr');
      if(err) err.style.display = 'block';
    }
  } catch(ex) { showToast ? showToast('Error login: ' + ex.message, 'error') : alert('Error login: ' + ex.message); }
}
document.addEventListener('DOMContentLoaded', function() {
  var lp = document.getElementById('lPass');
  var lu = document.getElementById('lUser');
  if(lp) lp.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  if(lu) lu.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
});
function doLogout() {
  closeSheet('menuSheet','menuOverlay');
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

function saveData() { localStorage.setItem('m17_clients', JSON.stringify(clients)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function getStatus(expiry) {
  if (!expiry) return 'unknown';
  var now = new Date(); now.setHours(0,0,0,0);
  var diff = Math.floor((new Date(expiry) - now) / 86400000);
  if (diff < 0) return 'exp';
  if (diff <= 7) return 'warn';
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
function formatDate(d) {
  if (!d) return '-';
  var p = d.split('-'); return p[2]+'/'+p[1]+'/'+p[0];
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

function toggleFilters() {
  showFilters = !showFilters;
  document.getElementById('filterPills').style.display = showFilters ? 'flex' : 'none';
  document.getElementById('filterToggleBtn').classList.toggle('active', showFilters);
}
function setPillSvc(el, val) {
  document.querySelectorAll('[data-svc]').forEach(function(p){ p.classList.remove('active'); });
  el.classList.add('active'); filterSvc = val; renderCards();
}

function quickFilter(st) {
  filterSt = st;
  var bar = document.getElementById('activeFilterBar');
  var lbl = document.getElementById('activeFilterLabel');
  if (!st) {
    bar.style.display = 'none';
  } else {
    bar.style.display = 'flex';
    if (st === 'ok') lbl.textContent = 'Mostrando: Clientes activos';
    if (st === 'warn') lbl.textContent = 'Mostrando: Expiran pronto (menos de 7 dias)';
    if (st === 'exp') lbl.textContent = 'Mostrando: Expirados';
  }
  renderCards();
  document.getElementById('mainScroll').scrollTo({top: 200, behavior: 'smooth'});
}

function updateStats() {
  document.getElementById('stTotal').textContent = clients.length;
  document.getElementById('stActive').textContent = clients.filter(function(c){ var s=getStatus(c.expiry); return s==='ok'||s==='warn'; }).length;
  document.getElementById('stSoon').textContent = clients.filter(function(c){ return getStatus(c.expiry)==='warn'; }).length;
  document.getElementById('stExp').textContent = clients.filter(function(c){ return getStatus(c.expiry)==='exp'; }).length;
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
  var filtered = clients.filter(function(c) {
    var ms = !search || c.name.toLowerCase().indexOf(search)>=0 || (c.user||'').toLowerCase().indexOf(search)>=0;
    var mv = !filterSvc || c.service===filterSvc;
    var mt = !filterSt || (filterSt==='ok' ? (getStatus(c.expiry)==='ok'||getStatus(c.expiry)==='warn') : getStatus(c.expiry)===filterSt);
    return ms && mv && mt;
  });
  var container = document.getElementById('cardsContainer');
  container.innerHTML = '';
  document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'block';
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

function saveClient() {
  var errEl = document.getElementById('formError');
  errEl.style.display='none';
  var name=document.getElementById('fName').value.trim();
  var user=document.getElementById('fUser').value.trim();
  var pass=document.getElementById('fPass').value.trim();
  var expiry=document.getElementById('fExpiry').value;
  var service=document.getElementById('fService').value;
  var notes=document.getElementById('fNotes').value.trim();
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
  var id=document.getElementById('editId').value;
  if(id){
    var idx=clients.findIndex(function(x){return x.id===id;});
    clients[idx]=Object.assign({},clients[idx],{name:name,user:user,pass:pass,expiry:expiry,service:service,notes:notes,apps:appsData});
  } else {
    clients.push({id:genId(),name:name,user:user,pass:pass,expiry:expiry,service:service,notes:notes,apps:appsData,createdAt:new Date().toISOString()});
  }
  saveData(); closeSheet('clientSheet','clientOverlay'); renderCards();
}

function viewClient(id) {
  var c=clients.find(function(x){return x.id===id;});
  if(!c) return;
  document.getElementById('viewSheetTitle').textContent=c.name;
  var svcLabel = c.service === 'ESPANA' ? 'ESPA\u00D1A' : esc(c.service);
  var html='';
  html+='<div class="viewRow"><div class="vlabel">Servicio</div><div class="vval"><span class="badge '+(c.service==='TODO'?'badgeTodo':'badgeEs')+'">'+svcLabel+'</span></div></div>';
  html+='<div class="viewRow"><div class="vlabel">Expiracion</div><div class="vval">'+formatDate(c.expiry)+' '+statusBadge(c.expiry)+'</div></div>';
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
  html+='<button class="btnFull primary" data-id="'+c.id+'" onclick="openClientMessages(this.dataset.id)" style="margin-top:12px">&#128203; Copiar mensajes rapidos</button>';
  document.getElementById('viewSheetBody').innerHTML=html;
  openSheet('viewSheet','viewOverlay');
}


function getClientMainApp(c) {
  if (!c || !c.apps || !c.apps.length) return '-';
  var a = c.apps[0];
  return a.customName ? a.customName : (a.name || '-');
}

function getClientById(id) {
  return clients.find(function(x){ return x.id === id; });
}

function buildClientMessage(c, type) {
  var name = c && c.name ? c.name : '';
  var greeting = name ? 'Hola ' + name + ' 👋' : 'Hola 👋';
  var expiry = formatDate(c && c.expiry ? c.expiry : '');
  var user = c && c.user ? c.user : '-';
  var pass = c && c.pass ? c.pass : '-';
  var app = getClientMainApp(c);

  if (type === 'access') {
    return greeting + '\n\n' +
      'Estos son tus datos de acceso:\n\n' +
      'App: ' + app + '\n' +
      'Usuario: ' + user + '\n' +
      'Contraseña: ' + pass + '\n' +
      'Fecha de expiración: ' + expiry + '\n\n' +
      'Recuerda que te avisaré 15 días antes para su renovación.';
  }

  if (type === 'expiry') {
    return greeting + '\n\n' +
      'Este es un aviso de que te quedan 15 días para que te caduque el servicio.\n\n' +
      'Fecha de caducidad: ' + expiry + '\n\n' +
      'Puedes renovarlo cuando quieras para evitar cortes en el servicio.';
  }

  if (type === 'renewed') {
    return greeting + '\n\n' +
      'Tu servicio ha sido renovado correctamente.\n\n' +
      'Nueva fecha de expiración: ' + expiry + '\n\n' +
      'Estamos en contacto.';
  }

  if (type === 'expired') {
    return greeting + '\n\n' +
      'Tu servicio expiró el día ' + expiry + '.\n\n' +
      'Si quieres reactivarlo, dime y te lo renuevo.';
  }

  return '';
}

function openClientMessages(id) {
  messageTargetId = id;
  var c = getClientById(id);
  if (!c) return;
  var title = document.getElementById('messageSheetTitle');
  var info = document.getElementById('messageInfo');
  var prev = document.getElementById('messagePreview');
  if (title) title.textContent = 'Mensajes · ' + c.name;
  if (info) info.textContent = 'Elige un mensaje. Se copiará al portapapeles para pegarlo manualmente en WhatsApp, Telegram, Instagram o donde quieras.';
  if (prev) prev.value = buildClientMessage(c, 'access');
  openSheet('messageSheet','messageOverlay');
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

function copyClientMessage(type, btn) {
  var c = getClientById(messageTargetId);
  if (!c) return;
  var txt = buildClientMessage(c, type);
  var prev = document.getElementById('messagePreview');
  if (prev) prev.value = txt;
  copyMessageText(txt, btn);
}

function copyGeneratedMessage(btn) {
  var prev = document.getElementById('messagePreview');
  if (!prev || !prev.value.trim()) return;
  copyMessageText(prev.value, btn);
}

function openDelete(id) { deleteTargetId=id; openSheet('deleteSheet','deleteOverlay'); }
function confirmDelete() {
  clients=clients.filter(function(x){return x.id!==deleteTargetId;});
  saveData(); closeSheet('deleteSheet','deleteOverlay'); renderCards();
}

function openRenew(id) {
  renewTargetId=id;
  renewMonths=1;
  var c=clients.find(function(x){return x.id===id;});
  document.getElementById('renewInfo').textContent='Cliente: '+c.name+' \u00b7 Expira: '+formatDate(c.expiry);
  document.getElementById('renewMonthsVal').textContent='1';
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
function doRenew() {
  var c=clients.find(function(x){return x.id===renewTargetId;});
  if(!c) return;
  var base=c.expiry?new Date(c.expiry):new Date();
  base.setMonth(base.getMonth()+renewMonths);
  c.expiry=base.toISOString().split('T')[0];
  saveData(); closeSheet('renewSheet','renewOverlay'); renderCards();
  alert('Renovado ' + renewMonths + ' mes(es)!\nNueva fecha: '+formatDate(c.expiry));
}

function exportExcel() {
  closeSheet('menuSheet','menuOverlay');
  if(!clients.length){alert('No hay clientes para exportar.');return;}
  var rows=clients.map(function(c){
    var svc = c.service === 'ESPANA' ? 'ESPA\u00D1A' : c.service;
    var appsStr=(c.apps||[]).map(function(a){var s=a.name;if(a.customName) s+=' ('+a.customName+')';if(a.mac) s+=' MAC:'+a.mac;if(a.code) s+=' CODE:'+a.code;return s;}).join(' | ');
    return {'ID':c.id,'Nombre':c.name,'Usuario':c.user,'Contrasena':c.pass,'Servicio':svc,'Expiracion':c.expiry,'Apps':appsStr,'Notas':c.notes,'Creado':c.createdAt?c.createdAt.split('T')[0]:''};
  });
  var ws=XLSX.utils.json_to_sheet(rows);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Clientes M17LIV3');
  XLSX.writeFile(wb,'M17LIV3_clientes_'+new Date().toISOString().split('T')[0]+'.xlsx');
}

function importExcel(event) {
  var file=event.target.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    try {
      var wb=XLSX.read(e.target.result,{type:'binary'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws);
      var imported=0;
      rows.forEach(function(row){
        if(!row['Nombre']||!row['Usuario']) return;
        var svcRaw = (row['Servicio']||'TODO');
        var svc = (svcRaw==='ESPA\u00D1A'||svcRaw==='ESPANA') ? 'ESPANA' : 'TODO';
        var existingIdx=clients.findIndex(function(c){return c.id===row['ID'];});
        var apps=(row['Apps']||'').split(' | ').filter(Boolean).map(function(a){
          var obj={};
          var mm=a.match(/MAC:([^\s]+)/); var cm=a.match(/CODE:([^\s]+)/);
          obj.mac=mm?mm[1]:''; obj.code=cm?cm[1]:'';
          obj.name=a.replace(/\s*MAC:[^\s]+/,'').replace(/\s*CODE:[^\s]+/,'').replace(/\s*\(.*?\)/,'').trim();
          var cu=a.match(/\(([^)]+)\)/); if(cu) obj.customName=cu[1];
          return obj;
        });
        var nc={id:row['ID']||genId(),name:row['Nombre']||'',user:row['Usuario']||'',pass:row['Contrasena']||'',service:svc,expiry:row['Expiracion']||'',notes:row['Notas']||'',apps:apps.length?apps:[],createdAt:row['Creado']||new Date().toISOString()};
        if(existingIdx>=0) clients[existingIdx]=nc; else clients.push(nc);
        imported++;
      });
      saveData(); renderCards(); closeSheet('menuSheet','menuOverlay');
      alert('Importados/actualizados: '+imported+' clientes.');
    } catch(err){ alert('Error al importar: '+err.message); }
    event.target.value='';
  };
  reader.readAsBinaryString(file);
}

try { renderCards(); } catch(e) {}


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
  setTimeout(movieTplDraw, 80);
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
  var uploadBtn = document.getElementById('tplUploadBtn');
  var copyBtn = document.getElementById('tplCopyBtn');
  if (downloadBtn) downloadBtn.addEventListener('click', movieTplDownloadJpeg);
  if (uploadBtn) uploadBtn.addEventListener('click', movieTplUploadImgBB);
  if (copyBtn) copyBtn.addEventListener('click', movieTplCopyLink);

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
  setTimeout(seriesTplDraw, 80);
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
  var uploadBtn = document.getElementById('seriesTplUploadBtn');
  var copyBtn = document.getElementById('seriesTplCopyBtn');
  if (downloadBtn) downloadBtn.addEventListener('click', seriesTplDownloadJpeg);
  if (uploadBtn) uploadBtn.addEventListener('click', seriesTplUploadImgBB);
  if (copyBtn) copyBtn.addEventListener('click', seriesTplCopyLink);

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
// ========== FIN PLANTILLAS SERIES ADMIN ==========

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

