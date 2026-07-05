import streamlit as pd
import streamlit as st
import pandas as pd
from datetime import date
import os

# --------------------------------------------------------------------------
# Configuración de la Página (Debe ser la primera instrucción de Streamlit)
# --------------------------------------------------------------------------
st.set_page_config(
    page_title="Glisemia Tracker",
    page_icon="🩸",
    layout="centered",  # Centrado se ve mucho mejor en celulares y pantallas grandes
    initial_sidebar_state="collapsed"
)

# --------------------------------------------------------------------------
# Configuración de Archivos Locales
# --------------------------------------------------------------------------
CSV_PATH = "data/glisemia.csv"
CSV_COLUMNS = ["fecha", "ayuno", "almuerzo", "cena"]

# Umbrales de referencia (mg/dL)
THRESHOLDS = {
    "ayuno":    {"normal": (0, 99),   "prediabetes": (100, 125), "alto_desde": 126},
    "almuerzo": {"normal": (0, 139),  "prediabetes": (140, 199), "alto_desde": 200},
    "cena":     {"normal": (0, 139),  "prediabetes": (140, 199), "alto_desde": 200},
}

def asegurar_csv():
    os.makedirs("data", exist_ok=True)
    if not os.path.exists(CSV_PATH):
        df = pd.DataFrame(columns=CSV_COLUMNS)
        df.to_csv(CSV_PATH, index=False)

def cargar_datos() -> pd.DataFrame:
    asegurar_csv()
    df = pd.read_csv(CSV_PATH)
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df = df.sort_values("fecha").reset_index(drop=True)
    return df

def guardar_datos(df: pd.DataFrame):
    df_out = df.copy()
    df_out["fecha"] = df_out["fecha"].dt.strftime("%Y-%m-%d")
    df_out.to_csv(CSV_PATH, index=False)

def clasificar(valor, columna):
    if pd.isna(valor) or valor is None:
        return "Sin registro", "normal"
    t = THRESHOLDS[columna]
    if t["normal"][0] <= valor <= t["normal"][1]:
        return "Normal", "normal"
    if t["prediabetes"][0] <= valor <= t["prediabetes"][1]:
        return "Elevado", "off"
    return "Alto", "inverse"

# --------------------------------------------------------------------------
# Interfaz de Usuario (Streamlit)
# --------------------------------------------------------------------------
st.title("🩸 Glisemia Tracker")
st.markdown("Registro diario y monitoreo inteligente de niveles de azúcar.")

df = cargar_datos()

# --- SECCIÓN 1: COMPARATIVA Y MÉTRICAS ---
st.subheader("📊 Estado Actual vs Anterior")

if len(df) >= 1:
    actual = df.iloc[-1]
    # Si solo hay 1 registro, el anterior toma valores vacíos para que no falle
    anterior = df.iloc[-2] if len(df) >= 2 else pd.Series({"ayuno": pd.NA, "almuerzo": pd.NA, "cena": pd.NA, "fecha": pd.NA})
    
    # Creamos 3 columnas adaptables para las métricas de Ayuno, Almuerzo y Cena
    col1, col2, col3 = st.columns(3)
    
    metricas = [
        ("Ayuno", "ayuno", col1),
        ("Post-Almuerzo", "almuerzo", col2),
        ("Post-Cena", "cena", col3)
    ]
    
    for etiqueta, col_name, columna_web in metricas:
        v_act = actual[col_name]
        v_ant = anterior[col_name]
        
        # Calcular la diferencia (Delta)
        if pd.notna(v_act) and pd.notna(v_ant):
            delta_val = v_act - v_ant
            delta_str = f"{delta_val:+.0f} mg/dL vs anterior"
            # Invertimos el color del delta porque en glucemia, que suba (+) es malo (red) y que baje (-) es bueno (green)
            delta_color = "inverse" if delta_val > 0 else "normal"
        else:
            delta_str = "Sin datos previos"
            delta_color = "normal"
            
        val_str = f"{v_act:.0f} mg/dL" if pd.notna(v_act) else "---"
        
        # Clasificación del estado actual (Normal, Elevado, Alto)
        estado, _ = clasificar(v_act, col_name)
        
        with columna_web:
            st.metric(label=etiqueta, value=val_str, delta=delta_str, delta_color=delta_color)
            if pd.notna(v_act):
                if estado == "Normal":
                    st.success(f"🟢 {estado}")
                elif estado == "Elevado":
                    st.warning(f"🟡 {estado}")
                else:
                    st.error(f"🔴 {estado}")

    if pd.notna(actual["fecha"]):
        st.caption(f"Última actualización registrada el: **{actual['fecha'].strftime('%d-%m-%Y')}**")
else:
    st.info("👋 ¡Bienvenido! Aún no hay registros de glicemia guardados. Ingresa tu primer dato abajo.")

st.divider()

# --- SECCIÓN 2: FORMULARIO DE INGRESO ---
st.subheader("📝 Agregar o Actualizar Registro")

# Usamos st.form para que la página no se recargue con cada número que escribe el usuario
with st.form("formulario_glicemia", clear_on_submit=True):
    fecha_sel = st.date_input("Fecha del registro:", value=date.today())
    
    # Inputs numéricos organizados en columnas
    c1, c2, c3 = st.columns(3)
    with c1:
        ayuno_in = st.number_input("Ayuno (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0, help="Deja en 0 si no deseas registrar este campo")
    with c2:
        almuerzo_in = st.number_input("Post-Almuerzo (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0)
    with c3:
        cena_in = st.number_input("Post-Cena (mg/dL):", min_value=0.0, max_value=500.0, step=1.0, value=0.0)
        
    boton_guardar = st.form_submit_button("💾 Guardar Registro", use_container_width=True)

if boton_guardar:
    fecha_dt = pd.to_datetime(fecha_sel)
    
    # Convertir los 0.0 a pd.NA si el usuario no los alteró (asumiendo que 0 significa que no se midió)
    ayuno_val = ayuno_in if ayuno_in > 0 else pd.NA
    almuerzo_val = almuerzo_in if almuerzo_in > 0 else pd.NA
    cena_val = cena_in if cena_in > 0 else pd.NA
    
    mismo_dia = df["fecha"] == fecha_dt
    nueva_fila = {"fecha": fecha_dt, "ayuno": ayuno_val, "almuerzo": almuerzo_val, "cena": cena_val}
    
    if mismo_dia.any():
        # Si ya existe la fecha, actualizamos solo los campos que traigan datos nuevos
        for k, v in nueva_fila.items():
            if pd.notna(v):
                df.loc[mismo_dia, k] = v
        st.toast("🔄 ¡Registro existente actualizado!", icon="ℹ️")
    else:
        # Si es un día nuevo, lo añadimos
        df = pd.concat([df, pd.DataFrame([nueva_fila])], ignore_index=True)
        st.toast("✅ ¡Nuevo registro guardado con éxito!", icon="🎉")
        
    df = df.sort_values("fecha").reset_index(drop=True)
    guardar_datos(df)
    
    # Forzar recarga de la página para que se actualicen las métricas superiores inmediatamente
    st.rerun()

# --- SECCIÓN 3: HISTORIAL DE DATOS ---
if len(df) > 0:
    st.divider()
    st.subheader("📋 Historial Completo")
    
    # Formateamos el DataFrame para que se vea limpio en la web
    df_visual = df.copy()
    df_visual["fecha"] = df_visual["fecha"].dt.strftime("%d-%m-%Y")
    
    # st.dataframe crea una tabla interactiva excelente para computadoras y celulares
    st.dataframe(
        df_visual,
        column_config={
            "fecha": "Fecha",
            "ayuno": st.column_config.NumberColumn("Ayuno (mg/dL)", format="%.0f"),
            "almuerzo": st.column_config.NumberColumn("Post-Almuerzo (mg/dL)", format="%.0f"),
            "cena": st.column_config.NumberColumn("Post-Cena (mg/dL)", format="%.0f"),
        },
        hide_index=True,
        use_container_width=True
    )
