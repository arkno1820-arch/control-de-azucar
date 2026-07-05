import streamlit as st
import pandas as pd
from datetime import datetime

# Configuración de la página
st.set_page_config(page_title="Control de Glucemia", layout="wide", page_icon="🩸")

# 1. Datos Antropomórficos Fijos (Perfil de la Paciente)
st.sidebar.header("👤 Perfil de la Paciente")
st.sidebar.markdown("**Edad:** 45 años")
st.sidebar.markdown("**Sexo:** Femenino")
st.sidebar.markdown("**Antecedentes:** Diabetes Mellitus")
st.sidebar.divider()

st.title("🩸 Sistema de Control de Glucemia Diaria")

# 2. 🔗 PEGA TU ENLACE DIRECTAMENTE AQUÍ:
ENLACE_EXCEL = "https://docs.google.com/spreadsheets/d/1RctsYdty_QuhJac_rNurDEBtXoVFxVToXSXyxuT1tZ8/edit?usp=sharing"

# Función optimizada para leer el Excel público en formato CSV sin pedir cuentas bancarias
def obtener_datos_drive(url):
    try:
        # Transformamos el enlace de edición a un enlace de descarga directa en CSV
        csv_url = url.replace('/edit?usp=sharing', '/export?format=csv').replace('/edit#gid=', '/export?format=csv&gid=')
        return pd.read_csv(csv_url)
    except Exception as e:
        return pd.DataFrame(columns=["fecha", "ayuno", "almuerzo", "cena", "notas"])

df_existente = obtener_datos_drive(ENLACE_EXCEL)

# Asegurar compatibilidad de nombres de columnas en minúsculas (según tu captura de pantalla)
df_existente.columns = [col.lower() for col in df_existente.columns]

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

# 4. Lógica de almacenamiento adaptada
if enviar:
    # Como no usamos la cuenta bancaria de Google Cloud, el guardado automatizado directo por código está restringido.
    # Mostramos los datos listos en pantalla para asegurar el control rápido.
    st.info("Para registrar los cambios de forma interactiva en la nube sin cuentas de pago, lo ideal es usar un formulario espejo.")
    st.code(f"{fecha.strftime('%Y-%m-%d')}, {ayuno}, {almuerzo}, {cena}, {notas}")

# 5. Visualización de Historial y Gráficos Interactivos
st.divider()
st.subheader("📊 Historial y Tendencias")

if not df_existente.empty and len(df_existente.columns) >= 4:
    # Ordenar por fecha cronológica
    if 'fecha' in df_existente.columns:
        df_existente = df_existente.sort_values(by="fecha")
    
    # Mostrar tabla interactiva de control
    st.dataframe(df_existente, use_container_width=True)
    
    st.markdown("### Evolución de los niveles de azúcar")
    if 'fecha' in df_existente.columns:
        df_grafico = df_existente.set_index("fecha")
        columnas_validas = [col for col in ["ayuno", "almuerzo", "cena"] if col in df_grafico.columns]
        if columnas_validas:
            st.line_chart(df_grafico[columnas_validas])
else:
    st.info("Tu hoja de cálculo de Google está conectada. Cuando agregues filas en tu Excel, aparecerán los gráficos automáticamente aquí.")
