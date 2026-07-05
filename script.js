// ============================================================
// CONFIGURACIÓN - CAMBIA ESTO SEGÚN TUS DATOS
// ============================================================
const PIN_CORRECTO = '1234'; // PIN de acceso para el usuario
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycUutATeJhL8v1_OIZygV91SHCZy2DZrhVw7IfbS1rXlM_2PB92OEzEe4XNfaezIDj/exec'; // ← TU URL DE APPS SCRIPT
const EMAIL_DESARROLLADOR = 'cesarandresmanriquezfigueroa@gmail.com'; // ← TU EMAIL (los datos se guardan en TU Drive)

// ============================================================
// ESTADO
// ============================================================
let registros = [];
let pinIngresado = '';
let datosCargados = false;
let cargando = false;

// ============================================================
// DOM REFS
// ============================================================
const lockScreen = document.getElementById('lockScreen');
const mainApp = document.getElementById('mainApp');
const pinDisplay = document.getElementById('pinDisplay');
const pinError = document.getElementById('pinError');
const pinPad = document.getElementById('pinPad');

const ultimoAyuno = document.getElementById('ultimoAyuno');
const ultimoAlmuerzo = document.getElementById('ultimoAlmuerzo');
const ultimoCena = document.getElementById('ultimoCena');
const promAyuno = document.getElementById('promAyuno');
const promAlmuerzo = document.getElementById('promAlmuerzo');
const promCena = document.getElementById('promCena');
const totalRegistrosEl = document.getElementById('totalRegistros');

const comidaSelect = document.getElementById('comidaSelect');
const nivelInput = document.getElementById('nivelInput');
const fechaInput = document.getElementById('fechaInput');
const btnAgregar = document.getElementById('btnAgregar');
const tablaCuerpo = document.getElementById('tablaCuerpo');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnExportar = document.getElementById('btnExportar');
const filtroComida = document.getElementById('filtroComida');
const btnSync = document.getElementById('btnSincronizar');
const btnLogout = document.getElementById('btnCerrarSesion');
const syncIndicator = document.getElementById('syncIndicator');
const syncText = document.getElementById('syncText');
const userEmailEl = document.getElementById('userEmail');

let chartInstance = null;
const ctx = document.getElementById('glucChart').getContext('2d');

// ============================================================
// PIN LOGIC
// ============================================================
function actualizarDisplayPin() {
    const dots = pinDisplay.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
        if (i < pinIngresado.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

function verificarPin() {
    if (pinIngresado === PIN_CORRECTO) {
        lockScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        pinError.textContent = '';
        pinIngresado = '';
        actualizarDisplayPin();
        inicializarApp();
    } else if (pinIngresado.length === 4) {
        pinError.textContent = '❌ PIN incorrecto. Intenta de nuevo.';
        pinIngresado = '';
        actualizarDisplayPin();
        setTimeout(() => { pinError.textContent = ''; }, 2000);
    }
}

pinPad.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const num = btn.dataset.num;
    
    if (num === 'borrar') {
        pinIngresado = pinIngresado.slice(0, -1);
        actualizarDisplayPin();
        pinError.textContent = '';
        return;
    }
    
    if (num === 'entrar') {
        verificarPin();
        return;
    }
    
    if (pinIngresado.length < 4) {
        pinIngresado += num;
        actualizarDisplayPin();
        pinError.textContent = '';
        if (pinIngresado.length === 4) {
            verificarPin();
        }
    }
});

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================
function obtenerEstado(nivel) {
    if (nivel < 70) return { texto: 'Hipoglucemia', clase: 'status-bajo' };
    if (nivel <= 140) return { texto: 'Normal', clase: 'status-normal' };
    if (nivel <= 180) return { texto: 'Elevado', clase: 'status-alto' };
    return { texto: 'Alto riesgo', clase: 'status-peligro' };
}

function formatearFecha(fechaStr) {
    const d = new Date(fechaStr);
    if (isNaN(d)) return fechaStr;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getComidaTag(comida) {
    const map = {
        'ayuno': '<span class="comida-tag tag-ayuno">🌅 Ayuno</span>',
        'almuerzo': '<span class="comida-tag tag-almuerzo">🍽️ Almuerzo</span>',
        'cena': '<span class="comida-tag tag-cena">🌙 Cena</span>'
    };
    return map[comida] || comida;
}

// ============================================================
// GOOGLE DRIVE - OPERACIONES (USANDO EMAIL DEL DESARROLLADOR)
// ============================================================
function mostrarMensaje(texto, tipo = 'info') {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    const colores = {
        info: '#1a2a3a',
        success: '#198754',
        error: '#dc3545',
        warning: '#ffc107'
    };
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colores[tipo] || colores.info};
        color: ${tipo === 'warning' ? '#1a2a3a' : 'white'};
        padding: 0.8rem 1.5rem;
        border-radius: 30px;
        font-size: 0.9rem;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10001;
        max-width: 90%;
        text-align: center;
        animation: slideUp 0.3s ease-out;
        pointer-events: none;
    `;
    toast.textContent = texto;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function guardarEnDrive(datos) {
    try {
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Guardando...';
        btnAgregar.disabled = true;
        
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'guardar',
                email: EMAIL_DESARROLLADOR,
                datos: datos
            })
        });
        
        syncIndicator.textContent = '✅';
        syncText.textContent = 'Guardado en Drive';
        mostrarMensaje('✅ Datos guardados', 'success');
        
        setTimeout(() => {
            syncIndicator.textContent = '🟢';
            syncText.textContent = 'Sincronizado';
        }, 2000);
        
        btnAgregar.disabled = false;
        return true;
        
    } catch (error) {
        console.error('Error al guardar:', error);
        syncIndicator.textContent = '🔴';
        syncText.textContent = 'Error al guardar';
        mostrarMensaje('❌ Error al guardar', 'error');
        btnAgregar.disabled = false;
        return false;
    }
}

async function cargarDeDrive() {
    try {
        cargando = true;
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Cargando datos...';
        mostrarMensaje('📥 Cargando datos...', 'info');
        
        const url = `${SCRIPT_URL}?action=cargar&email=${encodeURIComponent(EMAIL_DESARROLLADOR)}&t=${Date.now()}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            if (data.datos && Array.isArray(data.datos)) {
                registros = data.datos;
                registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                datosCargados = true;
                syncIndicator.textContent = '✅';
                syncText.textContent = `Cargados ${registros.length} registros`;
                mostrarMensaje(`✅ Cargados ${registros.length} registros`, 'success');
                setTimeout(() => {
                    syncIndicator.textContent = '🟢';
                    syncText.textContent = 'Sincronizado';
                }, 2000);
                renderizar();
                return true;
            } else {
                registros = [];
                datosCargados = true;
                syncIndicator.textContent = '📭';
                syncText.textContent = 'Sin datos previos';
                mostrarMensaje('📭 Sin datos previos', 'warning');
                setTimeout(() => {
                    syncIndicator.textContent = '🟢';
                    syncText.textContent = 'Listo';
                }, 2000);
                renderizar();
                return true;
            }
        } else {
            throw new Error(data.error || 'Error al cargar');
        }
    } catch (error) {
        console.error('Error al cargar:', error);
        syncIndicator.textContent = '🔴';
        syncText.textContent = 'Error de conexión';
        mostrarMensaje('❌ Error al cargar datos', 'error');
        cargando = false;
        btnAgregar.disabled = true;
        setTimeout(() => {
            btnAgregar.disabled = false;
        }, 5000);
        return false;
    } finally {
        cargando = false;
    }
}

// ============================================================
// RENDERIZADO
// ============================================================
function renderizar() {
    if (!datosCargados) {
        tablaCuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7a8f;">⏳ Cargando datos...</td></tr>`;
        return;
    }
    
    if (!registros.length) {
        ['ultimoAyuno','ultimoAlmuerzo','ultimoCena'].forEach(id => document.getElementById(id).textContent = '--');
        ['promAyuno','promAlmuerzo','promCena'].forEach(id => document.getElementById(id).textContent = 'Promedio: --');
        totalRegistrosEl.textContent = '0';
        tablaCuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7a8f;">📭 Sin registros. ¡Agrega tu primera medición!</td></tr>`;
        actualizarGrafica([]);
        return;
    }

    const comidas = ['ayuno', 'almuerzo', 'cena'];
    const stats = {};
    comidas.forEach(c => {
        const items = registros.filter(r => r.comida === c);
        if (items.length === 0) {
            stats[c] = { ultimo: null, promedio: null };
        } else {
