import streamlit as st
import pandas as pd
from datetime import date
from streamlit_gsheets import GSheetsConnection

# --------------------------------------------------------------------------
# 1. Configuración de la Página (Responsiva por defecto)
# --------------------------------------------------------------------------
st.set_page_config(
    page_title="Glisemia Tracker",
    page_icon="🩸",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Umbrales médicos de referencia (mg/dL)
THRESHOLDS = {
    "ayuno":    {"normal": (0, 99),   "prediabetes": (100, 125)},
    "almuerzo": {"normal": (0, 139),  "prediabetes": (140, 199)},
    "cena":     {"normal": (0, 139),  "prediabetes": (140, 199)},
}

def clasificar(valor, columna):
    if pd.isna(valor) or valor is None or valor == 0:
        return "Sin registro"
    t = THRESHOLDS[columna]
    if t["normal"][0] <= valor <= t["normal"][1]:
        return "Normal"
    if t["prediabetes"][0] <= valor <= t["prediabetes"][1]:
        return "Elevado"
    return "Alto"

# --------------------------------------------------------------------------
# 2. Conexión Directa con Google Sheets (Lectura y Escritura)
# --------------------------------------------------------------------------
# Inicializa la conexión segura usando los Secrets guardados
conn = st.connection("gsheets", type=GSheetsConnection)

def cargar_datos_cloud() -> pd.DataFrame:
    try:
        # Lee la planilla usando la URL guardada en tus Secrets
        url_excel = st.secrets["excel"]["url"]
        df = conn.read(spreadsheet=url_excel, ttl="0d") # ttl="0d" evita que guarde caché vieja
        
        # Asegura la consistencia de los datos
        if df.empty:
            df = pd.DataFrame(columns=["fecha", "ayuno", "almuerzo", "cena"])
        else:
            df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
            df = df.dropna(subset=["fecha"])
            df = df.sort_values("fecha").reset_index(drop=True)
        return df
    except Exception as e:
        st.error(f"Error al conectar con Google Sheets: {e}")
        return pd.DataFrame(columns=["fecha", "ayuno", "almuerzo", "cena"])

def guardar_datos_cloud(df_nuevo: pd.DataFrame):
    try:
        url_excel = st.secrets["excel"]["url"]
        df_out = df_nuevo.copy()
        # Formatea la fecha a texto para que Google Sheets la guarde limpiamente
        df_out["fecha"] = df_out["fecha"].dt.strftime("%Y-%m-%d")
        
        # Envía y sobreescribe la tabla en la nube de Google
        conn.update(spreadsheet=url_excel, data=df_out)
        st.cache_data.clear() # Limpia la memoria interna de la app para ver los cambios
    except Exception as e:
        st.error(f"Error crítico al guardar en la nube: {e}")

# Carga los datos de inmediato al entrar a la app
df = cargar_datos_cloud()

# --------------------------------------------------------------------------
# 3. Interfaz Gráfica del Panel de Control
# --------------------------------------------------------------------------
st.title("🩸 Glisemia Tracker Cloud")
st.markdown("Monitoreo inteligente de niveles de azúcar integrado con Google Drive.")

# --- SECCIÓN A: COMPARATIVA Y TARJETAS DE MÉTRICAS ---
st.subheader("📊 Estado Actual vs Registro Anterior")

if len(df) >= 1:
    actual = df.iloc[-1]
    anterior = df.iloc[-2] if len(df) >= 2 else pd.Series({"ayuno": pd.NA, "almuerzo": pd.NA, "cena": pd.NA, "fecha": pd.NA})
    
    # Crea 3 columnas que se apilarán solas si la paciente usa un celular
    col1, col2, col3 = st.columns(3)
    metricas = [("Ayuno", "ayuno", col1), ("Post-Almuerzo", "almuerzo", col2), ("Post-Cena", "cena", col3)]
    
    for etiqueta, col_name, columna_web in metricas:
        v_act = pd.to_numeric(actual[col_name], errors='coerce')
        v_ant = pd.to_numeric(anterior[col_name], errors='coerce')
        
        # Lógica de colores de tendencia (Subir glucosa = malo/rojo, Bajar = bueno/verde)
        if pd.notna(v_act) and v_act > 0 and pd.notna(v_ant) and v_ant > 0:
            delta_val = v_act - v_ant
            delta_str = f"{delta_val:+.0f} mg/dL vs anterior"
            delta_color = "inverse" if delta_val > 0 else "normal" 
        else:
            delta_str = "Sin registro previo"
            delta_color = "normal"
            
        val_str = f"{v_act:.0f} mg/dL" if (pd.notna(v_act) and v_act > 0) else "---"
        estado = clasificar(v_act, col_name)
        
        with columna_web:
            st.metric(label=etiqueta, value=val_str, delta=delta_str, delta_color=delta_color)
            if pd.notna(v_act) and v_act > 0:
                if estado == "Normal": st.success(f"🟢 {estado}")
                elif estado == "Elevado": st.warning(f"🟡 {estado}")
                else: st.error(f"🔴 {estado}")

    if pd.notna(actual["fecha"]):
        st.caption(f"Último análisis correspondiente al día: **{actual['fecha'].strftime('%d-%m-%Y')}**")
else:
    st.info("👋 ¡Bienvenido! La planilla de Google Sheets está conectada pero vacía. Registra el primer día abajo.")

st.divider()

# --- SECCIÓN B: GRÁFICO DE TENDENCIAS ARMONIOSO ---
if len(df) > 0:
    st.subheader("📈 Gráfico de Tendencias")
    
    # Prepara los datos aislando las columnas numéricas para graficar líneas continuas limpia
    df_grafico = df.copy()
    df_grafico["fecha"] = pd.to_datetime(df_grafico["fecha"])
    df_grafico = df_grafico.set_index("fecha")
    df_grafico = df_grafico[["ayuno", "almuerzo", "cena"]].apply(pd.to_numeric, errors='coerce')
    
    # st.line_chart ajusta de forma exacta las escalas al tamaño de pantalla del móvil
    st.line_chart(
        df_grafico, 
        y=["ayuno", "almuerzo", "cena"],
        color=["#2ca02c", "#ff7f0e", "#d62728"] # Colores limpios: Verde (Ayuno), Naranja (Almuerzo), Rojo (Cena)
    )
    st.caption("Toca las líneas en el móvil o pasa el cursor en la PC para ver las métricas exactas.")
    st.divider()

# --- SECCIÓN C: FORMULARIO TÁCTIL DE INGRESO ---
st.subheader("📝 Agregar o Actualizar Registro")

with st.form("formulario_glicemia", clear_on_submit=True):
    fecha_sel = st.date_input("Fecha de las mediciones:", value=date.today())
    
    c1, c2, c3 = st.columns(3)
    with c1: ayuno_in = st.number_input("Ayuno (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0, help="Coloca 0 si no te mediste")
    with c2: almuerzo_in = st.number_input("Post-Almuerzo (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0)
    with c3: cena_in = st.number_input("Post-Cena (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0)
        
    boton_guardar = st.form_submit_button("💾 Guardar y Sincronizar en Nube", use_container_width=True)

if boton_guardar:
    fecha_dt = pd.to_datetime(fecha_sel)
    
    # Transforma los 0 a vacíos para no arruinar los promedios ni los gráficos de la paciente
    ayuno_val = ayuno_in if ayuno_in > 0 else pd.NA
    almuerzo_val = almuerzo_in if almuerzo_in > 0 else pd.NA
    cena_val = cena_in if cena_in > 0 else pd.NA
    
    mismo_dia = df["fecha"] == fecha_dt
    nueva_fila = {"fecha": fecha_dt, "ayuno": ayuno_val, "almuerzo": almuerzo_val, "cena": cena_val}
    
    if mismo_dia.any():
        # Si la paciente ya subió un dato hoy, actualiza solo el nuevo campo ingresado
        for k, v in nueva_fila.items():
            if pd.notna(v): df.loc[mismo_dia, k] = v
        st.toast("🔄 Actualizando registro del mismo día...", icon="ℹ️")
    else:
        # Si es un día nuevo, añade la fila
        df = pd.concat([df, pd.DataFrame([nueva_fila])], ignore_index=True)
        st.toast("✅ Creando nuevo registro diario...", icon="🎉")
        
    df = df.sort_values("fecha").reset_index(drop=True)
    
    # Ejecuta el guardado directo en la nube
    guardar_datos_cloud(df)
    
    st.success("☁️ ¡Guardado correctamente en tu Google Sheets!")
    st.rerun()
