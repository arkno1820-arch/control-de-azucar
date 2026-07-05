// ============================================================
// CONFIGURACIÓN - CAMBIA ESTO SEGÚN TUS DATOS
// ============================================================
const PIN_CORRECTO = '1234';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2vclfUpmWr0L3Jo_EeSsC0p_q-QJmeDCmzWvYggIFjRkiU88LiTgSIqwm__zYaRqF/exec';
const EMAIL_DESARROLLADOR = 'cesarandresmanriquezfigueroa@gmail.com';

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
const btnExportarCSV = document.getElementById('btnExportarCSV');
const btnDescargarJSON = document.getElementById('btnDescargarJSON');
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
// GOOGLE DRIVE - OPERACIONES
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
        btn.addEventListener('click', async function() {
            const idx = parseInt(this.dataset.idx, 10);
            if (!isNaN(idx) && idx < registros.length) {
                if (confirm(`¿Eliminar registro de ${registros[idx].nivel} mg/dL?`)) {
                    registros.splice(idx, 1);
                    await guardarEnDrive(registros);
                    renderizar();
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
async function agregarRegistro(nivel, fechaStr, comida) {
    if (!datosCargados) {
        mostrarMensaje('⏳ Espera a que carguen los datos', 'warning');
        return false;
    }
    
    if (typeof nivel !== 'number' || isNaN(nivel) || nivel < 10 || nivel > 500) {
        mostrarMensaje('❌ Nivel válido: 10-500 mg/dL', 'error');
        return false;
    }
    if (!['ayuno','almuerzo','cena'].includes(comida)) {
        mostrarMensaje('❌ Selecciona una comida', 'error');
        return false;
    }
    
    let fecha = fechaStr || new Date().toISOString();
    const d = new Date(fecha);
    if (isNaN(d)) {
        mostrarMensaje('❌ Fecha inválida', 'error');
        return false;
    }
    fecha = d.toISOString();
    
    registros.unshift({ fecha, nivel, comida });
    
    const guardado = await guardarEnDrive(registros);
    
    if (guardado) {
        renderizar();
        mostrarMensaje('✅ Registro guardado', 'success');
        return true;
    } else {
        registros.shift();
        mostrarMensaje('❌ Error al guardar', 'error');
        return false;
    }
}

// ============================================================
// EXPORTAR CSV
// ============================================================
function exportarCSV() {
    if (!registros.length) {
        mostrarMensaje('📭 No hay datos para exportar', 'warning');
        return;
    }
    let csv = 'Fecha,Comida,Nivel (mg/dL),Estado\n';
    registros.forEach(r => {
        const d = new Date(r.fecha);
        const fecha = d.toLocaleDateString('es-ES');
        const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const estado = obtenerEstado(r.nivel).texto;
        csv += `"${fecha} ${hora}","${r.comida}",${r.nivel},"${estado}"\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glucemia_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarMensaje('📥 CSV exportado', 'success');
}

// ============================================================
// DESCARGAR JSON (NUEVO)
// ============================================================
function descargarJSON() {
    if (!registros.length) {
        mostrarMensaje('📭 No hay datos para descargar', 'warning');
        return;
    }
    
    // Crear un objeto con metadatos
    const dataCompleta = {
        fechaExportacion: new Date().toISOString(),
        totalRegistros: registros.length,
        datos: registros
    };
    
    const jsonStr = JSON.stringify(dataCompleta, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glucemia_completa_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarMensaje('💾 JSON descargado', 'success');
}

// ============================================================
// INICIALIZAR APP
// ============================================================
async function inicializarApp() {
    userEmailEl.textContent = '☁️ Nube';
    
    const cargado = await cargarDeDrive();
    
    if (!cargado) {
        mostrarMensaje('❌ Error de conexión. Reintenta con "Sincronizar"', 'error');
        btnAgregar.disabled = true;
        setTimeout(() => {
            btnAgregar.disabled = false;
        }, 5000);
    }
    
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().slice(0,10);
    
    // ===== EVENTOS =====
    btnAgregar.addEventListener('click', async function() {
        const nivel = parseFloat(nivelInput.value);
        const fecha = fechaInput.value ? new Date(fechaInput.value).toISOString() : null;
        const comida = comidaSelect.value;
        const agregado = await agregarRegistro(nivel, fecha, comida);
        if (agregado) {
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
        await cargarDeDrive();
    });
    
    btnLimpiar.addEventListener('click', async function() {
        if (!registros.length) return;
        if (confirm('⚠️ ¿Eliminar TODOS los registros? Esta acción no se puede deshacer.')) {
            registros = [];
            const guardado = await guardarEnDrive(registros);
            if (guardado) {
                renderizar();
                mostrarMensaje('🗑️ Todos los registros eliminados', 'warning');
            }
        }
    });
    
    btnExportarCSV.addEventListener('click', exportarCSV);
    btnDescargarJSON.addEventListener('click', descargarJSON);
    
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
            mostrarMensaje('👋 Sesión cerrada', 'info');
        }
    });
    
    renderizar();
}

// ============================================================
// INICIO
// ============================================================
console.log('✅ App iniciada - esperando PIN');
