// ============================================================
// CONFIGURACIÓN
// ============================================================
const PIN_CORRECTO = '1234'; // CAMBIA ESTO POR TU PIN
const STORAGE_KEY = 'glucosa_pro';

// ============================================================
// ESTADO
// ============================================================
let registros = [];
let pinIngresado = '';
let usuarioEmail = '';

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

// Eventos del teclado numérico
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
// GOOGLE DRIVE - GUARDAR Y CARGAR
// ============================================================
// NOTA: Necesitarás un Google Apps Script para esto
// URL de tu Web App (después de desplegar)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycUutATeJhL8v1_OIZygV91SHCZy2DZrhVw7IfbS1rXlM_2PB92OEzEe4XNfaezIDj/exec';

async function guardarEnDrive(datos) {
    try {
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Guardando...';
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Importante para Google Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'guardar',
                email: usuarioEmail,
                datos: datos
            })
        });
        
        // Con no-cors no podemos leer la respuesta, asumimos éxito
        syncIndicator.textContent = '✅';
        syncText.textContent = 'Datos guardados en Drive';
        setTimeout(() => {
            syncIndicator.textContent = '🟢';
            syncText.textContent = 'Sincronizado';
        }, 3000);
        
    } catch (error) {
        console.error('Error al guardar:', error);
        syncIndicator.textContent = '🔴';
        syncText.textContent = 'Error al guardar';
    }
}

async function cargarDeDrive() {
    try {
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Cargando...';
        
        const response = await fetch(`${SCRIPT_URL}?action=cargar&email=${usuarioEmail}`);
        const data = await response.json();
        
        if (data.success && data.datos) {
            registros = data.datos;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
            syncIndicator.textContent = '✅';
            syncText.textContent = 'Datos cargados de Drive';
            setTimeout(() => {
                syncIndicator.textContent = '🟢';
                syncText.textContent = 'Sincronizado';
            }, 3000);
            renderizar();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error al cargar:', error);
        syncIndicator.textContent = '🔴';
        syncText.textContent = 'Error al cargar';
        return false;
    }
}

// ============================================================
// GESTIÓN DE DATOS LOCAL
// ============================================================
function cargarRegistros() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            registros = JSON.parse(stored);
            registros = registros.filter(r => r.fecha && typeof r.nivel === 'number' && r.comida);
        } catch(e) { registros = []; }
    } else {
        // Datos de ejemplo
        const hoy = new Date();
        const base = (d, h) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0).toISOString();
        registros = [
            { fecha: base(hoy, 7), nivel: 92, comida: 'ayuno' },
            { fecha: base(hoy, 14), nivel: 134, comida: 'almuerzo' },
            { fecha: base(hoy, 21), nivel: 118, comida: 'cena' },
            { fecha: base(new Date(Date.now()-86400000), 7), nivel: 88, comida: 'ayuno' },
            { fecha: base(new Date(Date.now()-86400000), 14), nivel: 156, comida: 'almuerzo' },
        ];
        guardarRegistros();
    }
    registros.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    guardarRegistros();
}

function guardarRegistros() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
}

// ============================================================
// RENDERIZADO
// ============================================================
function renderizar() {
    if (!registros.length) {
        ['ultimoAyuno','ultimoAlmuerzo','ultimoCena'].forEach(id => document.getElementById(id).textContent = '--');
        ['promAyuno','promAlmuerzo','promCena'].forEach(id => document.getElementById(id).textContent = 'Promedio: --');
        totalRegistrosEl.textContent = '0';
        tablaCuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7a8f;">Sin registros</td></tr>`;
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
            const ultimo = items[0];
            const niveles = items.map(r => r.nivel);
            const promedio = niveles.reduce((s,n) => s+n, 0) / niveles.length;
            stats[c] = { ultimo: ultimo.nivel, promedio: promedio };
        }
    });

    ultimoAyuno.textContent = stats.ayuno.ultimo !== null ? stats.ayuno.ultimo : '--';
    ultimoAlmuerzo.textContent = stats.almuerzo.ultimo !== null ? stats.almuerzo.ultimo : '--';
    ultimoCena.textContent = stats.cena.ultimo !== null ? stats.cena.ultimo : '--';
    promAyuno.textContent = stats.ayuno.promedio !== null ? `Promedio: ${stats.ayuno.promedio.toFixed(0)}` : 'Promedio: --';
    promAlmuerzo.textContent = stats.almuerzo.promedio !== null ? `Promedio: ${stats.almuerzo.promedio.toFixed(0)}` : 'Promedio: --';
    promCena.textContent = stats.cena.promedio !== null ? `Promedio: ${stats.cena.promedio.toFixed(0)}` : 'Promedio: --';
    totalRegistrosEl.textContent = registros.length;

    // Tabla
    const mostrar = registros.slice(0, 15);
    tablaCuerpo.innerHTML = mostrar.map((r, idx) => {
        const est = obtenerEstado(r.nivel);
        return `<tr>
            <td>${formatearFecha(r.fecha)}</td>
            <td>${getComidaTag(r.comida)}</td>
            <td><strong>${r.nivel}</strong></td>
            <td><span class="status-badge ${est.clase}">${est.texto}</span></td>
            <td><button class="accion-boton" data-idx="${idx}">✕</button></td>
        </tr>`;
    }).join('');

    document.querySelectorAll('.accion-boton').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.idx, 10);
            if (!isNaN(idx) && idx < registros.length) {
                if (confirm(`¿Eliminar registro de ${registros[idx].nivel} mg/dL?`)) {
                    registros.splice(idx, 1);
                    guardarRegistros();
                    renderizar();
                    if (usuarioEmail) guardarEnDrive(registros);
                }
            }
        });
    });

    // Gráfica
    const filtro = filtroComida.value;
    let datosFiltrados = registros.slice(0, 14);
    if (filtro !== 'todas') {
        datosFiltrados = datosFiltrados.filter(r => r.comida === filtro);
    }
    datosFiltrados = datosFiltrados.reverse();
    actualizarGrafica(datosFiltrados);
}

// ============================================================
// GRÁFICA
// ============================================================
function actualizarGrafica(datos) {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    if (!datos.length) {
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: ['Sin datos'], datasets: [{ label: 'mg/dL', data: [0], borderColor: '#ccc' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
        return;
    }

    const colores = {
        ayuno: { border: '#0d6efd', bg: 'rgba(13,110,253,0.1)' },
        almuerzo: { border: '#198754', bg: 'rgba(25,135,84,0.1)' },
        cena: { border: '#ffc107', bg: 'rgba(255,193,7,0.1)' }
    };

    const comidas = ['ayuno', 'almuerzo', 'cena'];
    const datasets = [];
    const todasFechas = datos.map(r => formatearFecha(r.fecha));

    comidas.forEach(comida => {
        const items = datos.filter(r => r.comida === comida);
        if (items.length === 0) return;
        datasets.push({
            label: comida === 'ayuno' ? 'Ayuno' : comida === 'almuerzo' ? 'Almuerzo' : 'Cena',
            data: items.map(r => r.nivel),
            borderColor: colores[comida].border,
            backgroundColor: colores[comida].bg,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: colores[comida].border,
            fill: true,
            spanGaps: true,
        });
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: todasFechas, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} mg/dL` } }
            },
            scales: {
                y: { beginAtZero: false, grid: { color: '#edf2f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ============================================================
// AGREGAR REGISTRO
// ============================================================
function agregarRegistro(nivel, fechaStr, comida) {
    if (typeof nivel !== 'number' || isNaN(nivel) || nivel < 10 || nivel > 500) {
        alert('Nivel válido: 10-500 mg/dL');
        return false;
    }
    if (!['ayuno','almuerzo','cena'].includes(comida)) {
        alert('Selecciona una comida');
        return false;
    }
    let fecha = fechaStr || new Date().toISOString();
    const d = new Date(fecha);
    if (isNaN(d)) { alert('Fecha inválida'); return false; }
    fecha = d.toISOString();
    
    registros.unshift({ fecha, nivel, comida });
    guardarRegistros();
    renderizar();
    
    if (usuarioEmail) {
        guardarEnDrive(registros);
    }
    return true;
}

// ============================================================
// EXPORTAR CSV
// ============================================================
function exportarCSV() {
    if (!registros.length) { alert('No hay datos'); return; }
    let csv = 'Fecha,Comida,Nivel (mg/dL),Estado\n';
    registros.forEach(r => {
        const d = new Date(r.fecha);
        const fecha = d.toLocaleDateString('es-ES');
        const estado = obtenerEstado(r.nivel).texto;
        csv += `"${fecha}","${r.comida}",${r.nivel},"${estado}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glucemia_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// INICIALIZAR APP
// ============================================================
async function inicializarApp() {
    // Pedir email del usuario
    usuarioEmail = prompt('📧 Ingresa tu correo electrónico para identificar tus datos:');
    if (!usuarioEmail) {
        usuarioEmail = 'anonimo@ejemplo.com';
    }
    userEmailEl.textContent = usuarioEmail;
    
    // Cargar datos locales
    cargarRegistros();
    
    // Intentar cargar de Drive
    const cargado = await cargarDeDrive();
    if (!cargado) {
        // Si no se pudo cargar, usamos los locales
        renderizar();
    }
    
    // Configurar fecha por defecto
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().slice(0,10);
    
    // Eventos
    btnAgregar.addEventListener('click', function() {
        const nivel = parseFloat(nivelInput.value);
        const fecha = fechaInput.value ? new Date(fechaInput.value).toISOString() : null;
        const comida = comidaSelect.value;
        if (agregarRegistro(nivel, fecha, comida)) {
            nivelInput.value = '';
        }
    });
    
    nivelInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnAgregar.click(); });
    fechaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnAgregar.click(); });
    
    document.querySelectorAll('.btn-quick').forEach(btn => {
        btn.addEventListener('click', function() {
            const val = parseInt(this.dataset.fast, 10);
            if (!isNaN(val)) {
                nivelInput.value = val;
                btnAgregar.click();
            }
        });
    });
    
    filtroComida.addEventListener('change', renderizar);
    
    btnSync.addEventListener('click', async function() {
        if (usuarioEmail) {
            await guardarEnDrive(registros);
            await cargarDeDrive();
        }
    });
    
    btnLimpiar.addEventListener('click', function() {
        if (!registros.length) return;
        if (confirm('¿Eliminar TODOS los registros locales?')) {
            registros = [];
            guardarRegistros();
            renderizar();
            if (usuarioEmail) guardarEnDrive(registros);
        }
    });
    
    btnExportar.addEventListener('click', exportarCSV);
    
    btnLogout.addEventListener('click', function() {
        if (confirm('¿Cerrar sesión?')) {
            lockScreen.classList.remove('hidden');
            mainApp.classList.add('hidden');
            pinIngresado = '';
            actualizarDisplayPin();
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }
        }
    });
    
    renderizar();
}

// ============================================================
// INICIO - Mostrar pantalla de bloqueo
// ============================================================
// La app inicia con el lock screen visible
// El usuario debe ingresar el PIN para acceder