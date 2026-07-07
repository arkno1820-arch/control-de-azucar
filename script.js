// ============================================================
// CONFIGURACIÓN - ACTUALIZADO CON URL FUNCIONAL
// ============================================================
const PIN_HASH = 'fce1eda2d2a507fea1c09ef0bb92500280534c3d9c35418b87cd41fb4239de93'; // Hash de "1234"
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxj6BSeApb-oLREyLUbWam_zLLLNPF3IunBGYjjGK4LdguEz5wiIdoDyTLkS89nrVL9/exec';
const EMAIL_DESARROLLADOR = 'cesarandresmanriquezfigueroa@gmail.com';

// ============================================================
// ESTADO
// ============================================================
let registros = [];
let pinIngresado = '';
let datosCargados = false;
let cargando = false;
let medicamentos = [];
let medEditandoId = null;

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

const medNombreInput = document.getElementById('medNombreInput');
const medDosisInput = document.getElementById('medDosisInput');
const medHoraInput = document.getElementById('medHoraInput');
const medFechaInput = document.getElementById('medFechaInput');
const btnAgregarMed = document.getElementById('btnAgregarMed');
const tablaMedCuerpo = document.getElementById('tablaMedCuerpo');
const btnLimpiarMed = document.getElementById('btnLimpiarMed');
const listaMedicamentos = document.getElementById('listaMedicamentos');

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
    if (nivel <= 100) return { texto: 'Normal', clase: 'status-normal' };
    if (nivel <= 180) return { texto: 'Elevado', clase: 'status-alto' };
    return { texto: 'Alto riesgo', clase: 'status-peligro' };
}

function formatearFecha(fechaStr) {
    const d = new Date(fechaStr);
    if (isNaN(d)) return fechaStr;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
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
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
    if (!datosCargados && registros.length === 0) {
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
    const registrosPorDia = {};
    registros.forEach(r => {
        const fechaKey = new Date(r.fecha).toISOString().split('T')[0];
        if (!registrosPorDia[fechaKey]) {
            registrosPorDia[fechaKey] = { ayuno: null, almuerzo: null, cena: null };
        }
        registrosPorDia[fechaKey][r.comida] = r.nivel;
    });

    const diasOrdenados = Object.keys(registrosPorDia).sort((a, b) => b.localeCompare(a));

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
    if (!datosCargados && registros.length === 0) {
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
        mostrarMensaje('❌ Error al guardar en Drive', 'error');
        renderizar();
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

    const registrosPorDia = {};
    registros.forEach(r => {
        const fechaKey = new Date(r.fecha).toISOString().split('T')[0];
        if (!registrosPorDia[fechaKey]) {
            registrosPorDia[fechaKey] = { ayuno: null, almuerzo: null, cena: null };
        }
        registrosPorDia[fechaKey][r.comida] = r.nivel;
    });

    const diasOrdenados = Object.keys(registrosPorDia).sort();

    let csv = 'Fecha;Ayuno (mg/dL);Almuerzo (mg/dL);Cena (mg/dL);Máximo Diario\n';
    diasOrdenados.forEach(dia => {
        const r = registrosPorDia[dia];
        const valores = [];
        if (r.ayuno !== null) valores.push(r.ayuno);
        if (r.almuerzo !== null) valores.push(r.almuerzo);
        if (r.cena !== null) valores.push(r.cena);
        const maximo = valores.length > 0 ? Math.max(...valores) : '';

        const fechaFormateada = formatearFecha(dia);
        csv += `${fechaFormateada};${r.ayuno !== null ? r.ayuno : ''};${r.almuerzo !== null ? r.almuerzo : ''};${r.cena !== null ? r.cena : ''};${maximo}\n`;
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
// BORRAR TODOS LOS DATOS
// ============================================================
async function borrarTodosLosDatos() {
    if (!registros.length) {
        mostrarMensaje('📭 No hay datos para borrar', 'warning');
        return;
    }

    const confirmacion = confirm(
        '⚠️ ¿ESTÁS SEGURO DE BORRAR TODOS LOS DATOS?\n\n' +
        'Esta acción eliminará permanentemente:\n' +
        `• ${registros.length} registros de glucosa\n` +
        '• Todos los datos de las 3 comidas\n\n' +
        '¡Esta acción NO SE PUEDE DESHACER!'
    );

    if (!confirmacion) {
        mostrarMensaje('✅ Borrado cancelado', 'info');
        return;
    }

    try {
        mostrarMensaje('🗑️ Eliminando todos los registros...', 'warning');
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Eliminando...';
        btnLimpiar.disabled = true;

        registros = [];
        const guardado = await guardarEnDrive(registros);

        if (guardado) {
            renderizar();
            mostrarMensaje('🗑️ Todos los registros han sido eliminados', 'warning');
            syncIndicator.textContent = '✅';
            syncText.textContent = 'Datos eliminados';
        } else {
            renderizar();
            mostrarMensaje('⚠️ Datos eliminados localmente, pero hubo error al sincronizar con Drive', 'error');
            syncIndicator.textContent = '⚠️';
            syncText.textContent = 'Error al sincronizar';
        }

    } catch (error) {
        console.error('❌ Error al borrar:', error);
        mostrarMensaje('❌ Error al borrar: ' + error.message, 'error');
        syncIndicator.textContent = '🔴';
        syncText.textContent = 'Error al borrar';
    } finally {
        btnLimpiar.disabled = false;
        setTimeout(() => {
            syncIndicator.textContent = '🟢';
            syncText.textContent = 'Sincronizado';
        }, 3000);
    }
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
    medFechaInput.value = hoy.toISOString().slice(0, 10);
    await cargarMedsDeDrive();

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

    btnLimpiar.addEventListener('click', borrarTodosLosDatos);

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
// MEDICAMENTOS
// ============================================================
async function guardarMedsEnDrive(datos) {
    try {
        const payload = { action: 'guardarMedicamentos', email: EMAIL_DESARROLLADOR, datos: datos };
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const data = JSON.parse(await response.text());
        if (data.success) return true;
        throw new Error(data.error || 'Error al guardar medicamentos');
    } catch (error) {
        console.error('❌ Error al guardar medicamentos:', error);
        mostrarMensaje('❌ Error: ' + error.message, 'error');
        return false;
    }
}

async function cargarMedsDeDrive() {
    try {
        const url = `${SCRIPT_URL}?action=cargarMedicamentos&email=${encodeURIComponent(EMAIL_DESARROLLADOR)}&t=${Date.now()}`;
        const response = await fetch(url);
        const data = JSON.parse(await response.text());
        if (data.success) {
            medicamentos = Array.isArray(data.datos) ? data.datos : [];
            medicamentos.forEach(m => { if (!m.id) m.id = crypto.randomUUID(); });
            medicamentos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            poblarDatalistConHistorial();
            renderizarMedicamentos();
            return true;
        }
        throw new Error(data.error || 'Error al cargar medicamentos');
    } catch (error) {
        console.error('❌ Error al cargar medicamentos:', error);
        return false;
    }
}

function poblarDatalistConHistorial() {
    const existentes = new Set(
        Array.from(listaMedicamentos.options).map(o => o.value.toLowerCase())
    );
    medicamentos.forEach(m => {
        if (m.medicamento && !existentes.has(m.medicamento.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = m.medicamento;
            listaMedicamentos.appendChild(opt);
            existentes.add(m.medicamento.toLowerCase());
        }
    });
}

function renderizarMedicamentos() {
    if (!medicamentos.length) {
        tablaMedCuerpo.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#6b7a8f;">📭 Sin medicamentos registrados</td></tr>`;
        return;
    }

    // Agrupar por día (clave YYYY-MM-DD, consistente con el resto de la app)
    const porDia = {};
    medicamentos.forEach(m => {
        const key = new Date(m.fecha).toISOString().split('T')[0];
        if (!porDia[key]) porDia[key] = [];
        porDia[key].push(m);
    });

    // Dentro de cada día, ordenar por hora ascendente
    Object.values(porDia).forEach(lista => {
        lista.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    });

    const diasOrdenados = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

    let html = '';
    diasOrdenados.forEach(dia => {
        const lista = porDia[dia];
        html += `<tr>
            <td colspan="4" style="background:#f8f9fb; padding:0.9rem 0.6rem 0.5rem; border-top:2px solid #e2e8f0;">
                <strong style="color:#1a1a2e;">📅 ${formatearFecha(dia)}</strong>
                <span style="color:#6b7a8f; font-weight:normal; font-size:0.85em; margin-left:0.5rem;">${lista.length} ${lista.length === 1 ? 'medicamento' : 'medicamentos'}</span>
            </td>
        </tr>`;
        lista.forEach(m => {
            if (medEditandoId === m.id) {
                const fechaValor = new Date(m.fecha).toISOString().slice(0, 10);
                html += `<tr style="background:#fffbea;">
                    <td colspan="4" style="padding:0.7rem 0.6rem;">
                        <div style="display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
                            <input type="date" id="editFecha-${m.id}" value="${fechaValor}" style="padding:0.4rem; border-radius:8px; border:1px solid #e2e8f0;" />
                            <input type="time" id="editHora-${m.id}" value="${m.hora || ''}" style="padding:0.4rem; border-radius:8px; border:1px solid #e2e8f0;" />
                            <input type="text" id="editNombre-${m.id}" value="${m.medicamento || ''}" list="listaMedicamentos" style="padding:0.4rem; flex:1; min-width:120px; border-radius:8px; border:1px solid #e2e8f0;" />
                            <input type="text" id="editDosis-${m.id}" value="${m.dosis || ''}" placeholder="Dosis" style="padding:0.4rem; width:100px; border-radius:8px; border:1px solid #e2e8f0;" />
                            <button class="btn-primary" style="padding:0.4rem 0.8rem;" onclick="guardarEdicionMedicamento('${m.id}')">✅ Guardar</button>
                            <button class="btn-danger" style="padding:0.4rem 0.8rem;" onclick="cancelarEdicionMedicamento()">✖ Cancelar</button>
                        </div>
                    </td>
                </tr>`;
            } else {
                html += `<tr>
                    <td>${m.hora || '—'}</td>
                    <td>${m.medicamento}</td>
                    <td>${m.dosis || '—'}</td>
                    <td>
                        <button title="Editar" onclick="iniciarEdicionMedicamento('${m.id}')" style="background:none;border:none;cursor:pointer;font-size:1.05rem;">✏️</button>
                        <button title="Eliminar" onclick="eliminarMedicamento('${m.id}')" style="background:none;border:none;cursor:pointer;font-size:1.05rem;">🗑️</button>
                    </td>
                </tr>`;
            }
        });
    });

    tablaMedCuerpo.innerHTML = html;
}

function iniciarEdicionMedicamento(id) {
    medEditandoId = id;
    renderizarMedicamentos();
}

function cancelarEdicionMedicamento() {
    medEditandoId = null;
    renderizarMedicamentos();
}

async function guardarEdicionMedicamento(id) {
    const registro = medicamentos.find(m => m.id === id);
    if (!registro) return;

    const nuevaFecha = document.getElementById(`editFecha-${id}`).value;
    const nuevaHora = document.getElementById(`editHora-${id}`).value;
    const nuevoNombre = document.getElementById(`editNombre-${id}`).value;
    const nuevaDosis = document.getElementById(`editDosis-${id}`).value;

    if (!nuevoNombre || !nuevoNombre.trim()) {
        mostrarMensaje('❌ El nombre del medicamento no puede quedar vacío', 'error');
        return;
    }

    const anterior = { ...registro };
    registro.fecha = nuevaFecha ? new Date(nuevaFecha).toISOString() : registro.fecha;
    registro.hora = nuevaHora || '';
    registro.medicamento = nuevoNombre.trim();
    registro.dosis = nuevaDosis || '';

    const guardado = await guardarMedsEnDrive(medicamentos);
    if (guardado) {
        medEditandoId = null;
        medicamentos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        poblarDatalistConHistorial();
        renderizarMedicamentos();
        mostrarMensaje('✅ Medicamento actualizado', 'success');
    } else {
        Object.assign(registro, anterior);
        renderizarMedicamentos();
    }
}

async function eliminarMedicamento(id) {
    const registro = medicamentos.find(m => m.id === id);
    if (!registro) return;

    const confirmacion = confirm(`¿Eliminar "${registro.medicamento}" del ${formatearFecha(registro.fecha)}?`);
    if (!confirmacion) return;

    const respaldo = medicamentos.slice();
    medicamentos = medicamentos.filter(m => m.id !== id);

    const guardado = await guardarMedsEnDrive(medicamentos);
    if (guardado) {
        renderizarMedicamentos();
        mostrarMensaje('🗑️ Medicamento eliminado', 'warning');
    } else {
        medicamentos = respaldo;
        renderizarMedicamentos();
    }
}

async function agregarMedicamento(nombre, dosis, hora, fechaStr) {
    if (!nombre || !nombre.trim()) {
        mostrarMensaje('❌ Ingresa el nombre del medicamento', 'error');
        return false;
    }
    let fecha = fechaStr ? new Date(fechaStr).toISOString() : new Date().toISOString();

    medicamentos.unshift({ id: crypto.randomUUID(), fecha, hora: hora || '', medicamento: nombre.trim(), dosis: dosis || '' });

    const guardado = await guardarMedsEnDrive(medicamentos);
    if (guardado) {
        poblarDatalistConHistorial();
        renderizarMedicamentos();
        mostrarMensaje('✅ Medicamento guardado', 'success');
        return true;
    } else {
        medicamentos.shift();
        renderizarMedicamentos();
        return false;
    }
}

async function borrarTodosLosMedicamentos() {
    if (!medicamentos.length) {
        mostrarMensaje('📭 No hay medicamentos para borrar', 'warning');
        return;
    }
    const confirmacion = confirm('⚠️ ¿Borrar todo el historial de medicamentos? Esta acción no se puede deshacer.');
    if (!confirmacion) return;

    medicamentos = [];
    const guardado = await guardarMedsEnDrive(medicamentos);
    renderizarMedicamentos();
    mostrarMensaje(guardado ? '🗑️ Historial de medicamentos eliminado' : '⚠️ Error al sincronizar el borrado', guardado ? 'warning' : 'error');
}

btnAgregarMed.addEventListener('click', async function() {
    const ok = await agregarMedicamento(
        medNombreInput.value,
        medDosisInput.value,
        medHoraInput.value,
        medFechaInput.value
    );
    if (ok) {
        medNombreInput.value = '';
        medDosisInput.value = '';
        medHoraInput.value = '';
    }
});

btnLimpiarMed.addEventListener('click', borrarTodosLosMedicamentos);

// ============================================================
// INICIO
// ============================================================
console.log('✅ App iniciada - esperando PIN');
console.log('📧 Email:', EMAIL_DESARROLLADOR);
console.log('🔗 Script URL:', SCRIPT_URL);
