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
  document.getElementById('viewSheetBody').innerHTML=html;
  openSheet('viewSheet','viewOverlay');
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
