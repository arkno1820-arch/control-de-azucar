import streamlit as st
import pandas as pd
import requests
from datetime import datetime

# Configuración del Dashboard Profesional
st.set_page_config(page_title="Control de Glucemia Profesional", layout="wide", page_icon="🩸")

# 1. Perfil de la Paciente (Barra Lateral)
st.sidebar.header("👤 Perfil de la Paciente")
st.sidebar.markdown("**Edad:** 45 años")
st.sidebar.markdown("**Sexo:** Femenino")
st.sidebar.markdown("**Antecedentes:** Diabetes Mellitus")
st.sidebar.divider()

st.title("🩸 Panel de Control de Glucemia Diaria")
st.markdown("Registre y analice sus niveles de azúcar de forma rápida y visual.")

# -----------------------------------------------------------------------------
# ⚠️ CONFIGURACIÓN ÚNICA (Reemplaza con tus datos de Google)
# -----------------------------------------------------------------------------
ENLACE_EXCEL_LECTURA = "https://docs.google.com/spreadsheets/d/1RctsYdty_QuhJac_rNurDEBtXoVFxVToXSXyxuT1tZ8/edit?usp=sharing"

# Para el envío automático, necesitamos el ID de tu formulario de Google y los IDs de las preguntas.
# Reemplaza esto con los datos de tu Google Form (Ver instrucciones abajo)
FORM_ID = "1FAIpQLSfXXXXXXXXXXXXX"  # Reemplaza con el ID real de tu formulario
ENTRY_FECHA = "entry.111111111"      # ID de la pregunta Fecha
ENTRY_AYUNO = "entry.222222222"      # ID de la pregunta Ayuno
ENTRY_ALMUERZO = "entry.333333333"   # ID de la pregunta Almuerzo
ENTRY_CENA = "entry.444444444"       # ID de la pregunta Cena
ENTRY_NOTAS = "entry.555555555"      # ID de la pregunta Notas
# -----------------------------------------------------------------------------

# Función para leer el Excel en tiempo real
def cargar_datos_reales(url):
    try:
        csv_url = url.replace('/edit?usp=sharing', '/export?format=csv').replace('/edit#gid=', '/export?format=csv&gid=')
        df = pd.read_csv(csv_url)
        df.columns = [col.lower() for col in df.columns]
        if len(df.columns) == 6:
            df.columns = ["timestamp", "fecha", "ayuno", "almuerzo", "cena", "notas"]
        return df
    except:
        return pd.DataFrame(columns=["fecha", "ayuno", "almuerzo", "cena", "notas"])

df_datos = cargar_datos_reales(ENLACE_EXCEL_LECTURA)

# 2. SECCIÓN PUNCHY: INGRESO NATIVO DE DATOS
st.subheader("📝 Registrar Nueva Toma del Día")
with st.form(key="registro_directo", clear_on_submit=True):
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        f_ingreso = st.date_input("Fecha de la Toma", datetime.now())
    with col2:
        v_ayuno = st.number_input("Ayuno (mg/dL)", min_value=0, max_value=500, step=1, help="Normal: < 100 mg/dL")
    with col3:
        v_almuerzo = st.number_input("Almuerzo (mg/dL)", min_value=0, max_value=500, step=1, help="Normal: < 140 mg/dL")
    with col4:
        v_cena = st.number_input("Cena (mg/dL)", min_value=0, max_value=500, step=1, help="Normal: < 140 mg/dL")
        
    v_notas = st.text_input("Observaciones o Síntomas (opcional)")
    boton_guardar = st.form_submit_button("Guardar en Google Drive", use_container_width=True)

if boton_guardar:
    if FORM_ID == "1FAIpQLSfXXXXXXXXXXXXX":
        st.error("⚠️ El registro falló: Debes configurar primero el FORM_ID y los Entry IDs de tu formulario en el código.")
    else:
        # Envío invisible en segundo plano a Google Sheets a través de la API pública de formularios
        url_envio = f"https://google.com{FORM_ID}/formResponse"
        payload = {
            ENTRY_FECHA: f_ingreso.strftime("%Y-%m-%d"),
            ENTRY_AYUNO: v_ayuno if v_ayuno > 0 else "",
            ENTRY_ALMUERZO: v_almuerzo if v_almuerzo > 0 else "",
            ENTRY_CENA: v_cena if v_cena > 0 else "",
            ENTRY_NOTAS: v_notas
        }
        try:
            requests.post(url_envio, data=payload)
            st.success("¡Medición guardada con éxito en tu Excel! Refrescando panel...")
            st.rerun()
        except:
            st.error("Error de conexión al guardar los datos.")

st.divider()

# 3. SECCIÓN: MÉTRICAS ÚTILES Y ALERTAS CLARAS
st.subheader("📊 Análisis y Estado de Alertas")

if not df_datos.empty and 'fecha' in df_datos.columns:
    df_datos['fecha'] = pd.to_datetime(df_datos['fecha']).dt.strftime('%Y-%m-%d')
    df_datos = df_datos.sort_values(by="fecha").reset_index(drop=True)
    fechas_registradas = df_datos['fecha'].unique()
    
    if len(fechas_registradas) >= 1:
        f_actual = fechas_registradas[-1]
        ultimo_registro = df_datos[df_datos['fecha'] == f_actual].iloc[-1]
        
        a_hoy = ultimo_idx = ultimo_registro.get('ayuno')
        al_hoy = ultimo_registro.get('almuerzo')
        c_hoy = ultimo_registro.get('cena')
        
        # Calcular variaciones vs día anterior si existe
        d_ayuno, d_almuerzo, d_cena = None, None, None
        if len(fechas_registradas) >= 2:
            f_previa = fechas_registradas[-2]
            registro_previo = df_datos[df_datos['fecha'] == f_previa].iloc[-1]
            if pd.notna(a_hoy) and pd.notna(registro_previo.get('ayuno')):
                d_ayuno = int(a_hoy - registro_previo.get('ayuno'))
            if pd.notna(al_hoy) and pd.notna(registro_previo.get('almuerzo')):
                d_almuerzo = int(al_hoy - registro_previo.get('almuerzo'))
            if pd.notna(c_hoy) and pd.notna(registro_previo.get('cena')):
                d_cena = int(c_hoy - registro_previo.get('cena'))

        # Desplegar tarjetas informativas nativas
        m1, m2, m3 = st.columns(3)
        with m1:
            st.metric(label=f"Ayuno ({f_actual})", value=f"{int(a_hoy)} mg/dL" if pd.notna(a_hoy) else "N/A", 
                      delta=f"{d_ayuno} mg/dL vs ayer" if d_ayuno else None, delta_color="inverse")
            if pd.notna(a_hoy):
                if a_hoy >= 126: st.error("🚨 Alerta: Nivel Alto en Ayuno (Sugerencia Médica: >=126)")
                elif a_hoy < 70: st.warning("⚠️ Alerta: Posible Hipoglucemia (<70)")
                else: st.success("✅ Nivel Óptimo en Ayuno")

        with m2:
            st.metric(label="Almuerzo", value=f"{int(al_hoy)} mg/dL" if pd.notna(al_hoy) else "N/A", 
                      delta=f"{d_almuerzo} mg/dL vs ayer" if d_almuerzo else None, delta_color="inverse")
            if pd.notna(al_hoy):
                if al_hoy >= 140: st.error("🚨 Alerta: Glucemia Postprandial Elevada (>=140)")
                else: st.success("✅ Nivel Óptimo")

        with m3:
            st.metric(label="Cena", value=f"{int(c_hoy)} mg/dL" if pd.notna(c_hoy) else "N/A", 
                      delta=f"{d_cena} mg/dL vs ayer" if d_cena else None, delta_color="inverse")
            if pd.notna(c_hoy):
                if c_hoy >= 140: st.error("🚨 Alerta: Glucemia Postprandial Elevada (>=140)")
                else: st.success("✅ Nivel Óptimo")

    # 4. HISTORIAL Y GRÁFICAS INTERACTIVAS EN LA PARTE INFERIOR
    st.markdown("### 📈 Histórico y Tendencias Cronológicas")
    df_grafica = df_datos.set_index("fecha")
    cols_validas = [c for c in ["ayuno", "almuerzo", "cena"] if c in df_grafica.columns]
    if cols_validas:
        st.line_chart(df_grafica[cols_validas])
    
    st.dataframe(df_datos[["fecha", "ayuno", "almuerzo", "cena", "notas"]], use_container_width=True)
else:
    st.info("Dashboard listo. Ingrese datos en el formulario superior para generar los gráficos y alertas automáticas.")
