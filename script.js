// ============================================================
// CONFIGURACIÓN - CAMBIA ESTO SEGÚN TUS DATOS
// ============================================================
// La clave de acceso se genera con hash SHA-256
// Para generar el hash de tu clave, usa: https://emn178.github.io/online-tools/sha256.html
// Ejemplo: "1234" = "key"
const PIN_HASH = 'fce1eda2d2a507fea1c09ef0bb92500280534c3d9c35418b87cd41fb4239de93'; // ← Hash de "1234"
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzHi3HU3i0luZLTf076VZRA-FplKxLECqyqOx7R9KIvTh5oxxl0rMkxT2sqSmvJNhYg/exec';
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
const filtroComida = document.getElementById('filtroComida');
const btnSync = document.getElementById('btnSincronizar');
const btnLogout = document.getElementById('btnCerrarSesion');
const syncIndicator = document.getElementById('syncIndicator');
const syncText = document.getElementById('syncText');
const userEmailEl = document.getElementById('userEmail');

let chartInstance = null;
const ctx = document.getElementById('glucChart').getContext('2d');

// ============================================================
// FUNCIÓN PARA GENERAR HASH SHA-256
// ============================================================
async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

async function verificarPin() {
    const hashIngresado = await hashPin(pinIngresado);
    if (hashIngresado === PIN_HASH) {
        lockScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        pinError.textContent = '';
        pinIngresado = '';
        actualizarDisplayPin();
        inicializarApp();
    } else if (pinIngresado.length === 4) {
        pinError.textContent = '❌ Clave incorrecta. Intenta de nuevo.';
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
        info: '#1a1a2e',
        success: '#00b894',
        error: '#e53e3e',
        warning: '#f6ad55'
    };
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colores[tipo] || colores.info};
        color: ${tipo === 'warning' ? '#1a1a2e' : 'white'};
        padding: 0.8rem 1.5rem;
        border-radius: 30px;
        font-size: 0.9rem;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10001;
        max-width: 90%;
        text-align: center;
        animation: slideUp 0.3s ease-out;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
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

        const payload = {
            action: 'guardar',
            email: EMAIL_DESARROLLADOR,
            datos: datos
        };

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        const data = JSON.parse(text);

        if (data.success) {
            syncIndicator.textContent = '✅';
            syncText.textContent = `Guardado en Drive (${data.registros || datos.length} registros)`;
            mostrarMensaje(`✅ ${data.registros || datos.length} registros guardados`, 'success');
            return true;
        } else {
            throw new Error(data.error || 'Error al guardar');
        }

    } catch (error) {
        console.error('❌ Error al guardar:', error);
        syncIndicator.textContent = '🔴';
        syncText.textContent = 'Error al guardar';
        mostrarMensaje('❌ Error: ' + error.message, 'error');
        return false;
    } finally {
        btnAgregar.disabled = false;
        setTimeout(() => {
            syncIndicator.textContent = '🟢';
            syncText.textContent = 'Sincronizado';
        }, 3000);
    }
}

async function cargarDeDrive() {
    try {
        cargando = true;
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Cargando datos...';
        mostrarMensaje('📥 Cargando datos de Drive...', 'info');

        const url = `${SCRIPT_URL}?action=cargar&email=${encodeURIComponent(EMAIL_DESARROLLADOR)}&t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        const data = JSON.parse(text);

        if (data.success) {
            if (data.datos && Array.isArray(data.datos)) {
                registros = data.datos;
                registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                datosCargados = true;
                syncIndicator.textContent = '✅';
                syncText.textContent = `Cargados ${registros.length} registros`;
                mostrarMensaje(`✅ ${registros.length} registros cargados`, 'success');
                renderizar();
                return true;
            } else {
                registros = [];
                datosCargados = true;
                syncIndicator.textContent = '📭';
                syncText.textContent = 'Sin datos previos';
                mostrarMensaje('📭 Sin datos previos en Drive', 'warning');
                renderizar();
                return true;
            }
        } else {
            throw new Error(data.error || 'Error al cargar datos');
        }
    } catch (error) {
        console.error('❌ Error al cargar:', error);
        syncIndicator.textContent = '🔴';
        syncText.textContent = 'Error de conexión';
        mostrarMensaje('❌ Error: ' + error.message, 'error');
        return false;
    } finally {
        cargando = false;
        setTimeout(() => {
            syncIndicator.textContent = '🟢';
            syncText.textContent = 'Listo';
        }, 3000);
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
        ['ultimoAyuno', 'ultimoAlmuerzo', 'ultimoCena'].forEach(id => document.getElementById(id).textContent = '--');
        ['promAyuno', 'promAlmuerzo', 'promCena'].forEach(id => document.getElementById(id).textContent = 'Promedio: --');
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
            const promedio = niveles.reduce((s, n) => s + n, 0) / niveles.length;
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

    // ===== TABLA POR DÍA CON MÁXIMO =====
    // Agrupar registros por día
    const registrosPorDia = {};
    registros.forEach(r => {
        const fechaKey = new Date(r.fecha).toISOString().split('T')[0];
        if (!registrosPorDia[fechaKey]) {
            registrosPorDia[fechaKey] = { ayuno: null, almuerzo: null, cena: null };
        }
        registrosPorDia[fechaKey][r.comida] = r.nivel;
    });

    // Ordenar días de más reciente a más antiguo
    const diasOrdenados = Object.keys(registrosPorDia).sort((a, b) => b.localeCompare(a));

    // Construir tabla
    let html = '';
    diasOrdenados.forEach(dia => {
        const registrosDia = registrosPorDia[dia];
        const valores = [];
        if (registrosDia.ayuno !== null) valores.push(registrosDia.ayuno);
        if (registrosDia.almuerzo !== null) valores.push(registrosDia.almuerzo);
        if (registrosDia.cena !== null) valores.push(registrosDia.cena);
        const maximo = valores.length > 0 ? Math.max(...valores) : null;

        const fechaFormateada = formatearFecha(dia);

        html += `<tr>
            <td><strong>${fechaFormateada}</strong></td>
            <td>${registrosDia.ayuno !== null ? `<span class="nivel-valor">${registrosDia.ayuno}</span> <span class="status-badge ${obtenerEstado(registrosDia.ayuno).clase}">${obtenerEstado(registrosDia.ayuno).texto}</span>` : '—'}</td>
            <td>${registrosDia.almuerzo !== null ? `<span class="nivel-valor">${registrosDia.almuerzo}</span> <span class="status-badge ${obtenerEstado(registrosDia.almuerzo).clase}">${obtenerEstado(registrosDia.almuerzo).texto}</span>` : '—'}</td>
            <td>${registrosDia.cena !== null ? `<span class="nivel-valor">${registrosDia.cena}</span> <span class="status-badge ${obtenerEstado(registrosDia.cena).clase}">${obtenerEstado(registrosDia.cena).texto}</span>` : '—'}</td>
            <td>${maximo !== null ? `<span class="nivel-maximo">${maximo}</span>` : '—'}</td>
        </tr>`;
    });

    tablaCuerpo.innerHTML = html;

    // ===== GRÁFICA =====
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
        ayuno: { border: '#6c5ce7', bg: 'rgba(108,92,231,0.1)' },
        almuerzo: { border: '#00b894', bg: 'rgba(0,184,148,0.1)' },
        cena: { border: '#fdcb6e', bg: 'rgba(253,203,110,0.1)' }
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
            tension: 0.3,
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
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10, family: '-apple-system, sans-serif' } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} mg/dL` } }
            },
            scales: {
                y: { beginAtZero: false, grid: { color: '#edf2f7' } },
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
    if (!['ayuno', 'almuerzo', 'cena'].includes(comida)) {
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
// EXPORTAR CSV - Formato por día y comidas
// ============================================================
function exportarCSV() {
    if (!registros.length) {
        mostrarMensaje('📭 No hay datos para exportar', 'warning');
        return;
    }

    // Agrupar por día
    const registrosPorDia = {};
    registros.forEach(r => {
        const fechaKey = new Date(r.fecha).toISOString().split('T')[0];
        if (!registrosPorDia[fechaKey]) {
            registrosPorDia[fechaKey] = { ayuno: null, almuerzo: null, cena: null };
        }
        registrosPorDia[fechaKey][r.comida] = r.nivel;
    });

    const diasOrdenados = Object.keys(registrosPorDia).sort();

    // Crear CSV con estructura por día
    let csv = 'Fecha,Ayuno (mg/dL),Almuerzo (mg/dL),Cena (mg/dL),Máximo Diario\n';
    diasOrdenados.forEach(dia => {
        const r = registrosPorDia[dia];
        const valores = [];
        if (r.ayuno !== null) valores.push(r.ayuno);
        if (r.almuerzo !== null) valores.push(r.almuerzo);
        if (r.cena !== null) valores.push(r.cena);
        const maximo = valores.length > 0 ? Math.max(...valores) : '';

        const fechaFormateada = formatearFecha(dia);
        csv += `"${fechaFormateada}",${r.ayuno !== null ? r.ayuno : ''},${r.almuerzo !== null ? r.almuerzo : ''},${r.cena !== null ? r.cena : ''},${maximo}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glucemia_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarMensaje('📥 CSV exportado correctamente', 'success');
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
    fechaInput.value = hoy.toISOString().slice(0, 10);

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

    filtroComida.addEventListener('change', renderizar);

    btnSync.addEventListener('click', async function() {
        await cargarDeDrive();
    });

    btnLimpiar.addEventListener('click', async function() {
        if (!registros.length) return;
        if (confirm('⚠️ ¿Estás seguro de que quieres ELIMINAR TODOS los registros?\n\nEsta acción no se puede deshacer.')) {
            registros = [];
            const guardado = await guardarEnDrive(registros);
            if (guardado) {
                renderizar();
                mostrarMensaje('🗑️ Todos los registros eliminados', 'warning');
            }
        }
    });

    btnExportarCSV.addEventListener('click', exportarCSV);

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
