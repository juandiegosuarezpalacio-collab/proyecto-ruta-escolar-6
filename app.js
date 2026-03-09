const ROUTES = ['Bachillerato', 'Primaria', 'Transición', 'Especial'];
const STORAGE_KEY = 'ruta-master-pro-v2';
const DEFAULT_CONFIG = { serviceName: 'Ruta escolar Montenegro', schoolName: 'Institución Educativa', sendMode: 'wa', backendUrl: '', publicKey: '', autoSend: true, autoSave: true, globalTone: 'cercano', globalRadius: 250, neighborhoodRadius: 700, etaMinutes: 4 };
const FALLBACK_BARRIOS = JSON.parse(document.currentScript?.dataset?.barrios || '[]');
const FALLBACK_ROUTE_BARRIOS = [
  'Centro','La Isabela','La Julia','Villa Juliana','Villa Marlen','Santa Helena','La Castellana','Ciudad Alegría','Guaduales de la Villa','La Mariela','El Cacique','Buenos Aires','Pueblo Nuevo','La Alhambra','Turbay Ayala','La Esperanza','Villa Natalia','Villa Carolina','Jardín de Montenegro','La Camelia','El Carmen','Obrero','Marín','Santander','Galán','Santa Rita','El Prado','La Ceiba','La Floresta','La Primavera','Bosques de Pinares','La Soledad','El Mirador','Brisas del Roble','Zuldemayda','Colinas de la Primavera','Portal de Comfenalco','Villa Jericó','Las Colinas','San José','Isaac Tobón','La 18','La 20','La Unión','La España','Los Kioscos','Tierra Linda','Los Fundadores','Villa Rocío','El Tesoro'
];
const DEFAULT_STUDENTS = [
  { id:'s1', nombre:'Samuel López', acudiente:'Martha López', telefono:'3201112233', ruta:'Bachillerato', barrio:'La Isabela', direccion:'Casa azul', lat:4.5663, lng:-75.7514, pickupOrder:1, dropoffOrder:5, radioAviso:220, tono:'cercano', nota:'Salir con maleta lista.', statusPickup:'pending', statusDropoff:'pending', active:true, messageCount:0 },
  { id:'s2', nombre:'Sara Gómez', acudiente:'Carlos Gómez', telefono:'3152223344', ruta:'Bachillerato', barrio:'Villa Juliana', direccion:'Frente al parque', lat:4.5670, lng:-75.7496, pickupOrder:2, dropoffOrder:4, radioAviso:250, tono:'formal', nota:'Avisar si hay retraso.', statusPickup:'pending', statusDropoff:'pending', active:true, messageCount:0 },
  { id:'s3', nombre:'Valentina Pérez', acudiente:'Lina Pérez', telefono:'3015556677', ruta:'Transición', barrio:'Villa Marlen', direccion:'Portón blanco', lat:4.5681, lng:-75.7483, pickupOrder:1, dropoffOrder:3, radioAviso:180, tono:'breve', nota:'Debe salir con acudiente.', statusPickup:'pending', statusDropoff:'pending', active:true, messageCount:0 }
];
const state = { route:'Bachillerato', tripMode:'pickup', students:[], barrios:[], logs:[], routeStarted:false, currentIndex:0, currentPosition:null, watchId:null, currentBarrio:'', queue:[], autoSent:{}, neighborhoodAlerts:{}, config:{...DEFAULT_CONFIG} };
let map, busMarker, studentMarker, circle;
const $ = id => document.getElementById(id);
const logTime = () => new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});

window.editStudent = id => loadStudentIntoForm(id);
window.toggleStudent = id => toggleStudentActive(id);
window.removeStudent = id => removeStudent(id);
window.addEventListener('load', init);

async function init(){
  bindTabs();
  bindEvents();
  await loadState();
  initMap();
  renderEverything();
  addLog('Sistema listo', 'App cargada y optimizada para celular con panel mejorado.', 'ok');
}

function bindTabs(){ document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); document.getElementById(`panel-${btn.dataset.panel}`).classList.add('active'); })); }

function bindEvents(){
  $('routeSelect').addEventListener('change', e => { state.route = e.target.value; state.currentIndex = 0; renderEverything(); });
  $('tripMode').addEventListener('change', e => { state.tripMode = e.target.value; state.currentIndex = 0; renderEverything(); });
  $('globalRadius').addEventListener('change', e => { state.config.globalRadius = Number(e.target.value || 250); saveState(); syncMessagePreview(); });
  $('neighborhoodRadius').addEventListener('change', e => { state.config.neighborhoodRadius = Number(e.target.value || 700); saveState(); });
  $('globalTone').addEventListener('change', e => { state.config.globalTone = e.target.value; syncMessagePreview(); saveState(); });
  $('etaMinutes').addEventListener('change', e => { state.config.etaMinutes = Number(e.target.value || 4); syncMessagePreview(); saveState(); });
  $('btnStartRoute').addEventListener('click', startRoute);
  $('btnToggleGps').addEventListener('click', toggleGps);
  $('btnNextStudent').addEventListener('click', () => moveCurrent(1));
  $('btnStudentBoarded').addEventListener('click', () => markCurrent('subio','done'));
  $('btnStudentAbsent').addEventListener('click', () => markCurrent('noSalio','skip'));
  $('btnStudentDelivered').addEventListener('click', () => markCurrent(state.tripMode === 'pickup' ? 'llegadaColegio' : 'entregado', 'done'));
  $('btnRoutePreparing').addEventListener('click', () => bulkSend('alistando','route'));
  $('btnRouteNear').addEventListener('click', () => bulkSend('cerca','route'));
  $('btnBarrioNow').addEventListener('click', () => bulkSend('ingresoBarrio','barrio'));
  $('btnImproveCurrent').addEventListener('click', () => { $('currentPreview').value = RouteAI.improve($('currentPreview').value,'amable'); });
  $('btnSendCurrent').addEventListener('click', sendCurrent);
  $('btnOpenNextQueue').addEventListener('click', openNextQueue);
  $('messageStudent').addEventListener('change', syncMessagePreview);
  $('messageType').addEventListener('change', syncMessagePreview);
  $('messageTone').addEventListener('change', syncMessagePreview);
  $('messageExtra').addEventListener('input', syncMessagePreview);
  $('messageChannel').addEventListener('change', e => { state.config.sendMode = e.target.value; saveState(); refreshBadges(); });
  $('btnImproveMessage').addEventListener('click', () => { $('messagePreview').value = RouteAI.improve($('messagePreview').value,'amable'); });
  $('btnCopyMessage').addEventListener('click', () => copyText($('messagePreview').value));
  $('btnSendMessage').addEventListener('click', sendMessagePanel);
  $('bulkGroup').addEventListener('change', syncBulkPreview);
  $('bulkType').addEventListener('change', syncBulkPreview);
  $('bulkTone').addEventListener('change', syncBulkPreview);
  $('bulkBarrio').addEventListener('change', syncBulkPreview);
  $('bulkExtra').addEventListener('input', syncBulkPreview);
  $('btnBuildBulk').addEventListener('click', syncBulkPreview);
  $('btnSendBulk').addEventListener('click', () => bulkSend($('bulkType').value, $('bulkGroup').value));
  document.querySelectorAll('.chip-btn').forEach(btn => btn.addEventListener('click', () => runAI(btn.dataset.ai)));
  $('btnRunAi').addEventListener('click', () => runAI());
  $('btnAiToMessage').addEventListener('click', () => { $('messagePreview').value = $('aiOutput').value; document.querySelector('[data-panel="messages"]').click(); });
  $('studentForm').addEventListener('submit', saveStudentForm);
  $('btnResetForm').addEventListener('click', clearStudentForm);
  $('studentSearch').addEventListener('input', renderStudents);
  $('btnClearLogs').addEventListener('click', () => { state.logs = []; renderLogs(); saveState(); });
  $('btnSaveConfig').addEventListener('click', saveConfig);
  $('btnTestBackend').addEventListener('click', testBackend);
}

async function loadState(){
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  state.route = saved.route || state.route;
  state.tripMode = saved.tripMode || state.tripMode;
  state.logs = saved.logs || [];
  state.queue = saved.queue || [];
  state.autoSent = saved.autoSent || {};
  state.neighborhoodAlerts = saved.neighborhoodAlerts || {};
  state.config = { ...DEFAULT_CONFIG, ...(saved.config || {}) };
  state.barrios = saved.barrios || [];
  state.students = saved.students || [];

  if (!state.barrios.length) state.barrios = await fetchJson('data/barrios.json', FALLBACK_ROUTE_BARRIOS);
  if (!state.students.length) state.students = await fetchJson('data/estudiantes.json', DEFAULT_STUDENTS);
  state.students = state.students.map(normalizeStudent);
}

function normalizeStudent(s){
  return { id:s.id || crypto.randomUUID(), nombre:s.nombre || '', acudiente:s.acudiente || '', telefono:String(s.telefono || '').replace(/\D/g,''), ruta:ROUTES.includes(s.ruta) ? s.ruta : ROUTES[0], barrio:s.barrio || '', direccion:s.direccion || '', lat:Number(s.lat || 0), lng:Number(s.lng || 0), pickupOrder:Number(s.pickupOrder || 999), dropoffOrder:Number(s.dropoffOrder || 999), radioAviso:Number(s.radioAviso || 250), tono:s.tono || 'cercano', nota:s.nota || '', statusPickup:s.statusPickup || 'pending', statusDropoff:s.statusDropoff || 'pending', active:s.active !== false, messageCount:Number(s.messageCount || 0) };
}

async function fetchJson(url, fallback){
  try { const res = await fetch(url); if (!res.ok) throw new Error('no'); return await res.json(); } catch { return fallback; }
}

function saveState(){
  if (!state.config.autoSave) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ route:state.route, tripMode:state.tripMode, logs:state.logs, queue:state.queue, autoSent:state.autoSent, neighborhoodAlerts:state.neighborhoodAlerts, config:state.config, barrios:state.barrios, students:state.students }));
}

function renderEverything(){
  fillBasics();
  renderCurrent();
  renderQueue();
  renderOrder();
  renderSummary();
  renderStudents();
  renderLogs();
  syncMessagePreview();
  syncBulkPreview();
  refreshBadges();
  $('heroRoute').textContent = state.route;
  $('heroMode').textContent = state.tripMode === 'pickup' ? 'Recorrido de recogida.' : 'Recorrido de dejada.';
  $('footerInfo').textContent = `Barrios cargados: ${state.barrios.length}. Envío actual: ${state.config.sendMode}.`;
  saveState();
}

function fillBasics(){
  fillSelect($('routeSelect'), ROUTES, state.route);
  fillSelect($('studentRoute'), ROUTES, state.route);
  fillSelect($('studentBarrio'), state.barrios, '');
  fillSelect($('bulkBarrio'), [''].concat(state.barrios), '');
  $('tripMode').value = state.tripMode;
  $('globalRadius').value = state.config.globalRadius;
  $('neighborhoodRadius').value = state.config.neighborhoodRadius;
  $('globalTone').value = state.config.globalTone;
  $('etaMinutes').value = state.config.etaMinutes;
  $('cfgServiceName').value = state.config.serviceName;
  $('cfgSchoolName').value = state.config.schoolName;
  $('cfgSendMode').value = state.config.sendMode;
  $('cfgBackendUrl').value = state.config.backendUrl;
  $('cfgPublicKey').value = state.config.publicKey;
  $('cfgAutoSend').checked = !!state.config.autoSend;
  $('cfgAutoSave').checked = !!state.config.autoSave;
  $('messageChannel').value = state.config.sendMode;
  const currentRouteStudents = getRouteStudents();
  $('messageStudent').innerHTML = currentRouteStudents.map(s => `<option value="${s.id}">${escape(s.nombre)} · ${escape(s.barrio)}</option>`).join('');
}

function fillSelect(select, items, value=''){
  select.innerHTML = items.map(item => `<option value="${escape(item)}">${item || 'Barrio actual detectado'}</option>`).join('');
  if (value !== undefined) select.value = value;
}

function getRouteStudents(){
  const orderKey = state.tripMode === 'pickup' ? 'pickupOrder' : 'dropoffOrder';
  return state.students.filter(s => s.active !== false && s.ruta === state.route).sort((a,b) => (a[orderKey]||999) - (b[orderKey]||999));
}

function getCurrentStudent(){ return getRouteStudents()[state.currentIndex] || null; }
function tripStatusKey(){ return state.tripMode === 'pickup' ? 'statusPickup' : 'statusDropoff'; }
function tripLabel(){ return state.tripMode === 'pickup' ? 'la recogida' : 'la dejada'; }

function renderCurrent(){
  const s = getCurrentStudent();
  $('currentStudentName').textContent = s ? s.nombre : 'Sin estudiantes';
  $('currentGuardian').textContent = s?.acudiente || '--';
  $('currentPhone').textContent = s?.telefono || '--';
  $('currentStudentMeta').textContent = s ? `${s.barrio} · ${s.direccion || 'Sin dirección'} · orden ${state.tripMode === 'pickup' ? s.pickupOrder : s.dropoffOrder}` : 'No hay estudiantes en esta ruta.';
  $('currentState').textContent = s ? labelStatus(s[tripStatusKey()]) : 'Pendiente';
  $('currentDistance').textContent = s && state.currentPosition && s.lat && s.lng ? `${Math.round(distanceMeters(state.currentPosition.lat,state.currentPosition.lng,s.lat,s.lng))} m` : '--';
  $('currentMessageCount').textContent = String(s?.messageCount || 0);
  if (s) $('currentPreview').value = RouteAI.buildMessage(defaultCurrentType(), s.tono || state.config.globalTone, buildMessageData(s));
  else $('currentPreview').value = '';
  updateStudentMarker(s);
}

function renderOrder(){
  const list = getRouteStudents();
  const current = getCurrentStudent();
  $('orderTitle').textContent = `${state.tripMode === 'pickup' ? 'Recogida' : 'Dejada'} - ${state.route}`;
  $('orderCount').textContent = `${list.length} estudiantes`;
  $('routeOrderList').innerHTML = list.length ? list.map((s,i) => `<div class="list-item ${current && current.id === s.id ? 'current-order' : ''}"><div class="card-top"><strong>${i+1}. ${escape(s.nombre)}</strong><span class="student-state ${stateClass(s[tripStatusKey()])}">${labelStatus(s[tripStatusKey()])}</span></div><div class="subtext">${escape(s.barrio)} · ${escape(s.acudiente)} · ${escape(s.telefono)}</div></div>`).join('') : '<div class="empty">No hay estudiantes en esta ruta.</div>';
}

function renderSummary(){
  const list = getRouteStudents();
  const key = tripStatusKey();
  const pending = list.filter(s => s[key] === 'pending').length;
  const done = list.filter(s => s[key] === 'done').length;
  const ids = ['sumActive','sumPending','sumDone','sumQueue'];
  if (!ids.every(id => document.getElementById(id))) return;
  $('sumActive').textContent = String(list.length);
  $('sumPending').textContent = String(pending);
  $('sumDone').textContent = String(done);
  $('sumQueue').textContent = String(state.queue.length);
}

function renderQueue(){
  $('queueList').innerHTML = state.queue.length ? state.queue.map((q, i) => `<div class="queue-item"><div class="card-top"><strong>${i+1}. ${escape(q.guardian)}</strong><span class="route-badge">${escape(q.phone)}</span></div><div class="subtext">${escape(q.message)}</div></div>`).join('') : '<div class="empty">No hay envíos en cola.</div>';
}

function renderStudents(){
  const q = $('studentSearch').value.trim().toLowerCase();
  const list = state.students.filter(s => !q || `${s.nombre} ${s.acudiente} ${s.ruta} ${s.barrio}`.toLowerCase().includes(q));
  $('studentsList').innerHTML = list.length ? list.map(s => `<div class="list-item"><div class="card-top"><strong>${escape(s.nombre)}</strong><span class="route-badge">${escape(s.ruta)}</span></div><div class="subtext">${escape(s.acudiente)} · ${escape(s.telefono)}<br>${escape(s.barrio)} · Rec ${s.pickupOrder || '-'} · Dej ${s.dropoffOrder || '-'}<br>${escape(s.nota || 'Sin nota')}</div><div class="button-row margin-top"><button class="btn secondary small" onclick="editStudent('${s.id}')">Editar</button><button class="btn warning small" onclick="toggleStudent('${s.id}')">${s.active === false ? 'Activar' : 'Desactivar'}</button><button class="btn dark small" onclick="removeStudent('${s.id}')">Borrar</button></div></div>`).join('') : '<div class="empty">No hay resultados.</div>';
}

function renderLogs(){
  $('logsList').innerHTML = state.logs.length ? state.logs.map(log => `<div class="log-item ${log.level}"><div class="card-top"><strong>${escape(log.title)}</strong><small>${escape(log.time)}</small></div><div class="subtext">${escape(log.detail)}</div></div>`).join('') : '<div class="empty">Sin eventos todavía.</div>';
}

function addLog(title, detail, level='info'){
  state.logs.unshift({ title, detail, level, time: logTime() });
  state.logs = state.logs.slice(0, 150);
  $('headerStatus').textContent = detail;
  renderLogs();
  saveState();
}

function saveStudentForm(e){
  e.preventDefault();
  const payload = normalizeStudent({
    id: $('studentId').value || crypto.randomUUID(),
    nombre: $('studentName').value,
    acudiente: $('studentGuardian').value,
    telefono: $('studentPhone').value,
    ruta: $('studentRoute').value,
    barrio: $('studentBarrio').value,
    direccion: $('studentAddress').value,
    lat: $('studentLat').value,
    lng: $('studentLng').value,
    pickupOrder: $('studentPickupOrder').value,
    dropoffOrder: $('studentDropoffOrder').value,
    radioAviso: $('studentRadius').value,
    tono: $('studentTone').value,
    nota: $('studentNote').value,
    active: true,
    messageCount: 0
  });
  const idx = state.students.findIndex(s => s.id === payload.id);
  if (idx >= 0) state.students[idx] = { ...state.students[idx], ...payload };
  else state.students.push(payload);
  clearStudentForm();
  addLog('Estudiante guardado', `${payload.nombre} fue guardado correctamente.`, 'ok');
  renderEverything();
}

function clearStudentForm(){ $('studentForm').reset(); $('studentId').value = ''; $('studentRadius').value = 250; }

function loadStudentIntoForm(id){
  const s = byId(id); if (!s) return;
  $('studentId').value = s.id; $('studentName').value = s.nombre; $('studentGuardian').value = s.acudiente; $('studentPhone').value = s.telefono; $('studentRoute').value = s.ruta; $('studentBarrio').value = s.barrio; $('studentAddress').value = s.direccion || ''; $('studentLat').value = s.lat || ''; $('studentLng').value = s.lng || ''; $('studentPickupOrder').value = s.pickupOrder || ''; $('studentDropoffOrder').value = s.dropoffOrder || ''; $('studentRadius').value = s.radioAviso || 250; $('studentTone').value = s.tono || 'cercano'; $('studentNote').value = s.nota || ''; document.querySelector('[data-panel="students"]').click();
}

function toggleStudentActive(id){ const s = byId(id); if (!s) return; s.active = !(s.active !== false); addLog('Estado estudiante', `${s.nombre}: ${s.active ? 'activado' : 'desactivado'}.`, 'warn'); renderEverything(); }
function removeStudent(id){ const s = byId(id); state.students = state.students.filter(x => x.id !== id); addLog('Estudiante eliminado', `${s?.nombre || 'Registro'} eliminado.`, 'warn'); renderEverything(); }

function saveConfig(){
  state.config.serviceName = $('cfgServiceName').value.trim() || DEFAULT_CONFIG.serviceName;
  state.config.schoolName = $('cfgSchoolName').value.trim() || DEFAULT_CONFIG.schoolName;
  state.config.sendMode = $('cfgSendMode').value;
  state.config.backendUrl = $('cfgBackendUrl').value.trim();
  state.config.publicKey = $('cfgPublicKey').value.trim();
  state.config.autoSend = $('cfgAutoSend').checked;
  state.config.autoSave = $('cfgAutoSave').checked;
  refreshBadges();
  addLog('Configuración guardada', `Modo de envío: ${state.config.sendMode}.`, 'ok');
  saveState();
}

function refreshBadges(){ $('sendBadge').textContent = state.config.sendMode === 'backend' ? 'WhatsApp Business' : state.config.sendMode === 'demo' ? 'Solo demo' : 'WhatsApp web'; $('gpsBadge').textContent = state.watchId ? 'GPS activo' : 'GPS apagado'; }
function defaultCurrentType(){ return state.tripMode === 'pickup' ? 'cerca' : 'entregado'; }

function buildMessageData(student, extra=''){
  const dist = state.currentPosition && student?.lat && student?.lng ? distanceMeters(state.currentPosition.lat, state.currentPosition.lng, student.lat, student.lng) : null;
  return { acudiente: student?.acudiente || 'familia', estudiante: student?.nombre || 'estudiante', ruta: state.route, barrio: student?.barrio || state.currentBarrio || 'su barrio', nota: student?.nota || '', extra, minutos: dist ? Math.max(1, Math.round(dist / 80)) : state.config.etaMinutes, momento: state.tripMode === 'pickup' ? 'la recogida' : 'la dejada' };
}

function syncMessagePreview(){
  const s = byId($('messageStudent').value) || getCurrentStudent();
  if (!s) return $('messagePreview').value = '';
  $('messagePreview').value = RouteAI.buildMessage($('messageType').value, $('messageTone').value, buildMessageData(s, $('messageExtra').value));
}

function syncBulkPreview(){
  const info = getBulkTargets($('bulkGroup').value, $('bulkBarrio').value);
  $('bulkTargetCount').textContent = `${info.list.length} contactos`;
  $('detectedBarrioCount').textContent = `${info.label === state.currentBarrio ? info.list.length : getBarrioStudents(state.currentBarrio).length} estudiantes`;
  const bulkTone = $('bulkTone').value || state.config.globalTone;
  $('bulkPreview').value = info.list.map((s, i) => `${i+1}. ${s.acudiente}: ${RouteAI.buildMessage($('bulkType').value, bulkTone, buildMessageData(s, $('bulkExtra').value || ( $('bulkGroup').value === 'barrio' ? `Ya ingresamos al barrio ${info.label}.` : '' )) )}`).join('\n\n');
}

function getBulkTargets(group, manualBarrio=''){
  if (group === 'barrio') {
    const label = manualBarrio || state.currentBarrio;
    return { label, list: getBarrioStudents(label) };
  }
  return { label: state.route, list: getRouteStudents() };
}

function getBarrioStudents(barrio) { return getRouteStudents().filter(s => s.barrio === barrio); }

async function sendMessagePanel(){
  const s = byId($('messageStudent').value); if (!s) return addLog('Sin destinatario', 'Selecciona un estudiante.', 'error');
  const message = $('messagePreview').value.trim(); if (!message) return addLog('Mensaje vacío', 'Genera un mensaje antes de enviar.', 'error');
  await sendOneMessage(s, $('messageType').value, message, $('messageChannel').value);
}

async function sendCurrent(){
  const s = getCurrentStudent(); if (!s) return addLog('Sin estudiante actual', 'No hay estudiante activo.', 'error');
  await sendOneMessage(s, defaultCurrentType(), $('currentPreview').value.trim(), state.config.sendMode);
}

async function sendOneMessage(student, type, message, mode){
  const phone = normalizePhone(student.telefono);
  try {
    if (mode === 'backend') {
      await sendBackend([{ student, phone, type, message }], 'single', student.nombre);
      addLog('WhatsApp Business enviado', `${student.nombre}: mensaje enviado.`, 'ok');
    } else if (mode === 'demo') {
      addLog('Vista previa generada', `${student.nombre}: sin envío real.`, 'info');
    } else {
      openWhatsApp(phone, message);
      addLog('WhatsApp abierto', `${student.nombre}: mensaje preparado para envío.`, 'ok');
    }
    student.messageCount = Number(student.messageCount || 0) + 1;
    rememberAuto(student.id, type);
    saveState();
    renderEverything();
  } catch (err) {
    addLog('Error al enviar', err.message || String(err), 'error');
  }
}

function rememberAuto(studentId, type){ state.autoSent[`${state.route}::${state.tripMode}::${studentId}::${type}`] = Date.now(); }
function sentRecently(studentId, type){ const ts = state.autoSent[`${state.route}::${state.tripMode}::${studentId}::${type}`] || 0; return Date.now() - ts < 5*60*1000; }

async function bulkSend(type, group, forcedBarrio=''){
  const { list, label } = getBulkTargets(group, forcedBarrio);
  if (!list.length) return addLog('Sin destinatarios', 'No hay estudiantes para este envío.', 'error');
  const bulkTone = $('bulkTone').value || state.config.globalTone;
  const messages = list.map(student => ({ student, phone: normalizePhone(student.telefono), type, message: RouteAI.buildMessage(type, bulkTone, buildMessageData(student, group === 'barrio' ? (`Ya ingresamos al barrio ${label}. ` + ($('bulkExtra').value || '')).trim() : $('bulkExtra').value)) }));
  if (state.config.sendMode === 'backend') {
    try {
      await sendBackend(messages, group, label);
      messages.forEach(m => { m.student.messageCount = Number(m.student.messageCount || 0) + 1; rememberAuto(m.student.id, type); });
      addLog('Envío masivo', `${messages.length} mensajes enviados para ${label}.`, 'ok');
      renderEverything();
    } catch (err) { addLog('Error masivo', err.message || String(err), 'error'); }
    return;
  }
  if (state.config.sendMode === 'demo') {
    $('bulkPreview').value = messages.map((m,i) => `${i+1}. ${m.student.acudiente}: ${m.message}`).join('\n\n');
    addLog('Demo de grupo', `${messages.length} mensajes listos para ${label}.`, 'info');
    return;
  }
  state.queue = messages.slice();
  renderQueue();
  renderSummary();
  openNextQueue();
  addLog('Cola preparada', `${messages.length} mensajes listos para ${label}.`, 'ok');
}

function openNextQueue(){
  const next = state.queue.shift();
  renderQueue();
  renderSummary();
  if (!next) return addLog('Cola vacía', 'No hay más mensajes preparados.', 'info');
  openWhatsApp(next.phone, next.message);
  addLog('Mensaje abierto', `${next.student.acudiente}: siguiente de la cola.`, 'ok');
  next.student.messageCount = Number(next.student.messageCount || 0) + 1;
  rememberAuto(next.student.id, next.type);
  saveState();
}

function normalizePhone(phone){ const digits = String(phone || '').replace(/\D/g,''); return digits.startsWith('57') ? digits : `57${digits}`; }

function openWhatsApp(phone, message){
  const text = encodeURIComponent(message);
  const mobileUrl = `whatsapp://send?phone=${phone}&text=${text}`;
  const webUrl = `https://wa.me/${phone}?text=${text}`;
  const waWebUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const fallback = () => setTimeout(() => window.open(webUrl, '_blank', 'noopener'), 800);
    try {
      window.location.href = mobileUrl;
      fallback();
    } catch {
      window.open(webUrl, '_blank', 'noopener');
    }
    return;
  }
  window.open(waWebUrl, '_blank', 'noopener');
}

async function sendBackend(messages, targetType, label){
  if (!state.config.backendUrl) throw new Error('Falta la URL del backend.');
  const res = await fetch(state.config.backendUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-api-key': state.config.publicKey || '' }, body: JSON.stringify({ route: state.route, tripMode: state.tripMode, targetType, label, messages: messages.map(m => ({ phone:m.phone, message:m.message, type:m.type, studentId:m.student.id, student:m.student.nombre, guardian:m.student.acudiente, barrio:m.student.barrio })) }) });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Fallo del backend.');
  return data;
}

function runAI(action=''){
  const current = getCurrentStudent();
  const prompt = $('aiInput').value.trim() || action;
  const data = current ? buildMessageData(current) : { ruta: state.route, barrio: state.currentBarrio || 'sector actual', momento: tripLabel() };
  $('aiOutput').value = RouteAI.answer(prompt, { currentStudent: current, routeList: getRouteStudents(), tone: state.config.globalTone, data });
}

function toggleGps(){
  if (!navigator.geolocation) return addLog('GPS no disponible', 'Este navegador no soporta geolocalización.', 'error');
  if (state.watchId) {
    navigator.geolocation.clearWatch(state.watchId); state.watchId = null; refreshBadges(); addLog('GPS apagado', 'Seguimiento detenido.', 'warn'); return;
  }
  state.watchId = navigator.geolocation.watchPosition(onGpsOk, err => addLog('GPS error', err.message || 'No se pudo leer la ubicación.', 'error'), { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
  refreshBadges();
}

function initMap(){
  map = L.map('map').setView([4.5667,-75.751], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution:'© OpenStreetMap' }).addTo(map);
  busMarker = L.marker([4.5667,-75.751]).addTo(map).bindPopup('Ruta escolar');
  studentMarker = L.marker([4.5667,-75.751]).addTo(map).bindPopup('Estudiante');
  circle = L.circle([4.5667,-75.751], { radius:30 }).addTo(map);
}

function onGpsOk(pos){
  state.currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 30 };
  busMarker.setLatLng([state.currentPosition.lat, state.currentPosition.lng]);
  circle.setLatLng([state.currentPosition.lat, state.currentPosition.lng]).setRadius(state.currentPosition.accuracy);
  map.setView([state.currentPosition.lat, state.currentPosition.lng], 16);
  $('coordsText').textContent = `Lat ${state.currentPosition.lat.toFixed(5)} / Lng ${state.currentPosition.lng.toFixed(5)}`;
  refreshBadges();
  renderCurrent();
  detectNeighborhoodEntry();
  detectStudentProximity();
}

function updateStudentMarker(student){
  if (!student || !student.lat || !student.lng) return;
  studentMarker.setLatLng([student.lat, student.lng]).bindPopup(student.nombre);
}

function detectStudentProximity(){
  if (!state.routeStarted || !state.config.autoSend) return;
  const student = getCurrentStudent();
  if (!student || !state.currentPosition || !student.lat || !student.lng) return;
  const dist = distanceMeters(state.currentPosition.lat, state.currentPosition.lng, student.lat, student.lng);
  const radius = Number(student.radioAviso || state.config.globalRadius || 250);
  if (dist <= radius && !sentRecently(student.id, 'cerca')) {
    const message = RouteAI.buildMessage('cerca', student.tono || state.config.globalTone, buildMessageData(student));
    sendOneMessage(student, 'cerca', message, state.config.sendMode);
    $('headerStatus').textContent = `Aviso automático enviado a ${student.nombre}.`;
  }
}

function detectNeighborhoodEntry(){
  if (!state.routeStarted || !state.config.autoSend || !state.currentPosition) return;
  const candidates = getRouteStudents().filter(s => s.lat && s.lng && s.barrio);
  if (!candidates.length) return;
  let nearest = null;
  for (const student of candidates) {
    const dist = distanceMeters(state.currentPosition.lat, state.currentPosition.lng, student.lat, student.lng);
    if (!nearest || dist < nearest.distance) nearest = { student, distance: dist };
  }
  if (!nearest) return;
  state.currentBarrio = nearest.student.barrio;
  $('detectedBarrio').textContent = nearest.student.barrio;
  $('detectedBarrioCount').textContent = `${getBarrioStudents(nearest.student.barrio).length} estudiantes`;
  $('detectedBarrioInfo').textContent = `Barrio detectado por cercanía a ${nearest.student.nombre}. Distancia ${Math.round(nearest.distance)} m.`;
  const sentBarrios = state.neighborhoodAlerts[`${state.route}::${state.tripMode}`] || [];
  if (nearest.distance <= Number(state.config.neighborhoodRadius || 700) && !sentBarrios.includes(nearest.student.barrio)) {
    sentBarrios.push(nearest.student.barrio);
    state.neighborhoodAlerts[`${state.route}::${state.tripMode}`] = sentBarrios;
    bulkSend('ingresoBarrio', 'barrio', nearest.student.barrio);
    $('headerStatus').textContent = `Ingreso automático al barrio ${nearest.student.barrio}.`;
  }
}

function startRoute(){
  state.routeStarted = true;
  state.currentIndex = 0;
  resetTripStatuses();
  state.neighborhoodAlerts[`${state.route}::${state.tripMode}`] = [];
  addLog('Ruta iniciada', `${state.route} en ${state.tripMode === 'pickup' ? 'recogida' : 'dejada'}.`, 'ok');
  renderEverything();
}

function resetTripStatuses(){
  const key = tripStatusKey();
  state.students.forEach(s => { if (s.ruta === state.route) s[key] = 'pending'; });
}

function moveCurrent(step){
  const list = getRouteStudents();
  if (!list.length) return;
  state.currentIndex = Math.max(0, Math.min(list.length - 1, state.currentIndex + step));
  renderCurrent();
}

function markCurrent(type, stateValue){
  const s = getCurrentStudent(); if (!s) return;
  s[tripStatusKey()] = stateValue;
  const message = RouteAI.buildMessage(type, s.tono || state.config.globalTone, buildMessageData(s));
  sendOneMessage(s, type, message, state.config.sendMode);
  moveCurrent(1);
  renderEverything();
}

function testBackend(){
  if (!state.config.backendUrl) return addLog('Backend faltante', 'Agrega la URL del worker.', 'error');
  fetch(state.config.backendUrl.replace(/\/send$/, '/health')).then(r => r.json()).then(data => addLog('Backend activo', JSON.stringify(data), 'ok')).catch(err => addLog('Backend error', err.message, 'error'));
}

function labelStatus(value){ return value === 'done' ? 'Hecho' : value === 'skip' ? 'No salió' : 'Pendiente'; }
function stateClass(value){ return value === 'done' ? 'done' : value === 'skip' ? 'skip' : 'pending'; }
function distanceMeters(lat1, lon1, lat2, lon2){ const R = 6371000; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180; const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); }
function escape(text){ return String(text || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function copyText(text){ navigator.clipboard.writeText(text || '').then(() => addLog('Texto copiado','Se copió al portapapeles.','ok')).catch(() => addLog('Copia manual','No se pudo copiar automáticamente.','warn')); }
