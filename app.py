import streamlit as st
import pandas as pd
from datetime import date
from google.oauth2 import service_account
from googleapiclient.discovery import build

# --------------------------------------------------------------------------
# 1. Configuración de la Página
# --------------------------------------------------------------------------
st.set_page_config(
    page_title="Glisemia Tracker",
    page_icon="🩸",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Umbrales médicos de referencia (mg/dL) con tuplas de (mínimo, máximo)
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
# 2. Conexión nativa con Google Sheets API (Lectura y Escritura Directa)
# --------------------------------------------------------------------------
def obtener_servicio():
    info_claves = dict(st.secrets["gcp_service_account"])
    info_claves["private_key"] = info_claves["private_key"].replace("\\n", "\n")
    credenciales = service_account.Credentials.from_service_account_info(
        info_claves, 
        scopes=['https://googleapis.com']
    )
    return build('sheets', 'v4', credentials=credenciales)

def cargar_datos_cloud() -> pd.DataFrame:
    try:
        servicio = obtener_servicio()
        spreadsheet_id = st.secrets["spreadsheet"]["id"]
        
        # CORRECCIÓN: Apunta al nombre real de la pestaña en tu Google Sheets ('Hoja 1')
        resultado = servicio.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, 
            range="Hoja 1!A:D"
        ).execute()
        
        filas = resultado.get('values', [])
        
        if not filas or len(filas) <= 1:
            return pd.DataFrame(columns=["fecha", "ayuno", "almuerzo", "cena"])
            
        df = pd.DataFrame(filas[1:], columns=["fecha", "ayuno", "almuerzo", "cena"])
        df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
        df = df.dropna(subset=["fecha"])
        df = df.sort_values("fecha").reset_index(drop=True)
        return df
    except Exception as e:
        st.error(f"Error de conexión con la base de datos de Google: {e}")
        return pd.DataFrame(columns=["fecha", "ayuno", "almuerzo", "cena"])

def guardar_datos_cloud(df_nuevo: pd.DataFrame):
    try:
        servicio = obtener_servicio()
        spreadsheet_id = st.secrets["spreadsheet"]["id"]
        
        df_out = df_nuevo.copy()
        df_out["fecha"] = df_out["fecha"].dt.strftime("%Y-%m-%d")
        df_out = df_out.fillna("")
        
        valores = [df_out.columns.tolist()] + df_out.values.tolist()
        cuerpo = {'values': valores}
        
        # CORRECCIÓN: Limpia y actualiza usando 'Hoja 1'
        servicio.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id, 
            range="Hoja 1!A:D"
        ).execute()
        
        servicio.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id, 
            range="Hoja 1!A1", 
            valueInputOption="USER_ENTERED", 
            body=cuerpo
        ).execute()
    except Exception as e:
        st.error(f"Error al escribir en la planilla: {e}")

# Carga inicial de datos
df = cargar_datos_cloud()

# --------------------------------------------------------------------------
# 3. Interfaz Gráfica del Panel de Control
# --------------------------------------------------------------------------
st.title("🩸 Glisemia Tracker Cloud")
st.markdown("Monitoreo inteligente de niveles de azúcar integrado con Google Drive.")

# --- SECCIÓN A: MÉTRICAS ---
st.subheader("📊 Estado Actual vs Registro Anterior")

if not df.empty and len(df) >= 1:
    actual = df.iloc[-1]
    anterior = df.iloc[-2] if len(df) >= 2 else pd.Series({"ayuno": pd.NA, "almuerzo": pd.NA, "cena": pd.NA, "fecha": pd.NA})
    
    col1, col2, col3 = st.columns(3)
    metricas = [("Ayuno", "ayuno", col1), ("Post-Almuerzo", "almuerzo", col2), ("Post-Cena", "cena", col3)]
    
    for etiqueta, col_name, columna_web in metricas:
        v_act = pd.to_numeric(actual[col_name], errors='coerce') if col_name in actual else pd.NA
        v_ant = pd.to_numeric(anterior[col_name], errors='coerce') if col_name in anterior else pd.NA
        
        if pd.notna(v_act) and v_act > 0 and pd.notna(v_ant) and v_ant > 0:
            delta_val = v_act - v_ant
            delta_str = f"{delta_val:+.0f} mg/dL"
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

# --- SECCIÓN B: GRÁFICO ---
if not df.empty and len(df) > 0:
    st.subheader("📈 Gráfico de Tendencias")
    df_grafico = df.copy()
    df_grafico["fecha"] = pd.to_datetime(df_grafico["fecha"])
    df_grafico = df_grafico.set_index("fecha")
    
    columnas_validas = [c for c in ["ayuno", "almuerzo", "cena"] if c in df_grafico.columns]
    if columnas_validas:
        df_grafico = df_grafico[columnas_validas].apply(pd.to_numeric, errors='coerce')
        st.line_chart(df_grafico, color=["#2ca02c", "#ff7f0e", "#d62728"])
        st.caption("Usa el zoom táctil en el móvil para inspeccionar los días.")
    st.divider()

# --- SECCIÓN C: FORMULARIO ---
st.subheader("📝 Agregar o Actualizar Registro")

with st.form("formulario_glicemia", clear_on_submit=True):
    fecha_sel = st.date_input("Fecha de las mediciones:", value=date.today())
    
    c1, c2, c3 = st.columns(3)
    with c1: ayuno_in = st.number_input("Ayuno (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0)
    with c2: almuerzo_in = st.number_input("Post-Almuerzo (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0)
    with c3: cena_in = st.number_input("Post-Cena (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0)
        
    boton_guardar = st.form_submit_button("💾 Guardar y Sincronizar en Nube", use_container_width=True)

if boton_guardar:
    fecha_dt = pd.to_datetime(fecha_sel)
    
    ayuno_val = ayuno_in if ayuno_in > 0 else pd.NA
    almuerzo_val = almuerzo_in if almuerzo_in > 0 else pd.NA
    cena_val = cena_in if cena_in > 0 else pd.NA
    
    nueva_fila = pd.DataFrame([{"fecha": fecha_dt, "ayuno": ayuno_val, "almuerzo": almuerzo_val, "cena": cena_val}])
    
    if not df.empty and "fecha" in df.columns:
        mismo_dia = df["fecha"] == fecha_dt
        if mismo_dia.any():
            if pd.notna(ayuno_val): df.loc[mismo_dia, "ayuno"] = ayuno_val
            if pd.notna(almuerzo_val): df.loc[mismo_dia, "almuerzo"] = almuerzo_val
            if pd.notna(cena_val): df.loc[mismo_dia, "cena"] = cena_val
            st.toast("🔄 Actualizando día existente...", icon="ℹ️")
        else:
            df = pd.concat([df, nueva_fila], ignore_index=True)
            st.toast("✅ Añadiendo nuevo día...", icon="🎉")
    else:
        df = nueva_fila

    df = df.sort_values("fecha").reset_index(drop=True)
    
    guardar_datos_cloud(df)
    
    st.success("☁️ ¡Datos sincronizados con éxito en Google Sheets!")
    st.rerun()
