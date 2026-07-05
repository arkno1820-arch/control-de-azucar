import streamlit as st
import pandas as pd
from datetime import datetime
import gspread
from json import loads

# Configuración de la página
st.set_page_config(page_title="Control de Glucemia", layout="wide", page_icon="🩸")

# 1. Datos Antropomórficos Fijos (Perfil de la Paciente)
st.sidebar.header("👤 Perfil de la Paciente")
st.sidebar.markdown("**Edad:** 45 años")
st.sidebar.markdown("**Sexo:** Femenino")
st.sidebar.markdown("**Antecedentes:** Diabetes Mellitus")
st.sidebar.divider()

st.title("🩸 Sistema de Control de Glucemia Diaria")

# 2. Conexión con Google Sheets
@st.cache_resource
def obtener_conexion_sheets():
    try:
        # Intenta conectar usando las credenciales secretas
        credenciales = loads(st.secrets["gcp_service_account"])
        gc = gspread.service_account_from_dict(credenciales)
        # Abre la hoja por su URL guardada en Secrets
        sh = gc.open_by_url(st.secrets["connections"]["gsheets"]["spreadsheet"])
        return sh.get_worksheet(0)
    except Exception as e:
        # Alternativa simple si usas el enlace público directo
        try:
            url = st.secrets["connections"]["gsheets"]["spreadsheet"]
            # Convertir URL normal a formato de exportación CSV
            csv_url = url.replace('/edit?usp=sharing', '/export?format=csv').replace('/edit#gid=', '/export?format=csv&gid=')
            return csv_url
        except:
            return None

ws_o_url = obtener_conexion_sheets()

# Leer datos existentes
if isinstance(ws_o_url, str):
    try:
        df_existente = pd.read_csv(ws_o_url)
    except:
        df_existente = pd.DataFrame(columns=["Fecha", "Ayuno", "Almuerzo", "Cena", "Notas"])
elif ws_o_url is not None:
    datos = ws_o_url.get_all_records()
    df_existente = pd.DataFrame(datos) if datos else pd.DataFrame(columns=["Fecha", "Ayuno", "Almuerzo", "Cena", "Notas"])
else:
    df_existente = pd.DataFrame(columns=["Fecha", "Ayuno", "Almuerzo", "Cena", "Notas"])

# 3. Formulario de Ingreso de Datos
st.subheader("📝 Registrar Nueva Toma")

with st.form(key="glucemia_form", clear_on_submit=True):
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        fecha = st.date_input("Fecha", datetime.now())
    with col2:
        ayuno = st.number_input("Ayuno (mg/dL)", min_value=0, max_value=500, value=0, step=1)
    with col3:
        almuerzo = st.number_input("Almuerzo (mg/dL)", min_value=0, max_value=500, value=0, step=1)
    with col4:
        cena = st.number_input("Cena (mg/dL)", min_value=0, max_value=500, value=0, step=1)
        
    notas = st.text_input("Notas / Observaciones (opcional)")
    
    enviar = st.form_submit_button("Guardar Registro")

# 4. Lógica para guardar los datos
if enviar:
    nueva_fila = {
        "Fecha": fecha.strftime("%Y-%m-%d"),
        "Ayuno": int(ayuno) if ayuno > 0 else "",
        "Almuerzo": int(almuerzo) if almuerzo > 0 else "",
        "Cena": int(cena) if cena > 0 else "",
        "Notas": notas
    }
    
    if ws_o_url is not None and not isinstance(ws_o_url, str):
        ws_o_url.append_row(list(nueva_fila.values()))
        st.success("¡Datos guardados correctamente en Google Drive!")
        st.rerun()
    else:
        st.error("Para guardar datos de forma interactiva, necesitas configurar las credenciales completas de Google Cloud. Mientras tanto, puedes visualizar tus tendencias.")

# 5. Visualización de Historial y Gráficos
st.divider()
st.subheader("📊 Historial y Tendencias")

if not df_existente.empty:
    df_existente = df_existente.sort_values(by="Fecha")
    st.dataframe(df_existente, use_container_width=True)
    
    st.markdown("### Evolución de los niveles de azúcar")
    df_grafico = df_existente.set_index("Fecha")
    columnas_validas = [col for col in ["Ayuno", "Almuerzo", "Cena"] if col in df_grafico.columns]
    if columnas_validas:
        st.line_chart(df_grafico[columnas_validas])
else:
    st.info("Aún no hay datos registrados en tu Google Sheet.")
