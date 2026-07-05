import streamlit as st
import pandas as pd
from datetime import datetime
from streamlit_gsheets import GSheetsConnection

# Configuración de la página
st.set_page_config(page_title="Control de Glucemia", layout="wide", page_icon="🩸")

# 1. Datos Antropomórficos Fijos (Perfil de la Paciente)
st.sidebar.header("👤 Perfil de la Paciente")
st.sidebar.markdown("**Edad:** 45 años")
st.sidebar.markdown("**Sexo:** Femenino")
st.sidebar.markdown("**Antecedentes:** Diabetes Mellitus")
st.sidebar.divider()

st.title("🩸 Sistema de Control de Glucemia Diaria")

# 2. Conexión con Google Sheets (Google Drive)
# Se usa la conexión nativa de Streamlit para guardar datos
try:
    conn = st.connection("gsheets", type=GSheetsConnection)
    # Intenta leer datos existentes, si no, crea un DataFrame vacío
    df_existente = conn.read(ttl=0)
except Exception:
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
    nueva_fila = pd.DataFrame([{
        "Fecha": fecha.strftime("%Y-%m-%d"),
        "Ayuno": ayuno if ayuno > 0 else None,
        "Almuerzo": almuerzo if almuerzo > 0 else None,
        "Cena": cena if cena > 0 else None,
        "Notas": notas
    }])
    
    # Combinar datos viejos con el nuevo registro
    df_actualizado = pd.concat([df_existente, nueva_fila], ignore_index=True)
    
    # Limpiar duplicados por fecha si se reescribe el mismo día
    df_actualizado = df_actualizado.drop_duplicates(subset=["Fecha"], keep="last")
    
    # Guardar directamente en Google Sheets
    conn.update(data=df_actualizado)
    st.success("¡Datos guardados correctamente en Google Drive!")
    st.rerun()

# 5. Visualización de Historial y Gráficos
st.divider()
st.subheader("📊 Historial y Tendencias")

if not df_existente.empty:
    # Asegurar orden cronológico
    df_existente = df_existente.sort_values(by="Fecha")
    
    # Mostrar tabla de datos
    st.dataframe(df_existente, use_container_width=True)
    
    # Gráfico de líneas interactivo
    st.markdown("### Evolución de los niveles de azúcar")
    df_grafico = df_existente.set_index("Fecha")[["Ayuno", "Almuerzo", "Cena"]]
    st.line_chart(df_grafico)
else:
    st.info("Aún no hay datos registrados. Usa el formulario de arriba para empezar.")
