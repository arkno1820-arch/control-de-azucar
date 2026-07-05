import streamlit as st
import pandas as pd
from datetime import datetime, timedelta

# Configuración visual de la aplicación
st.set_page_config(page_title="Dashboard de Glucemia", layout="wide", page_icon="🩸")

# 1. Perfil Antropomórfico Fijo (Barra Lateral)
st.sidebar.header("👤 Perfil de la Paciente")
st.sidebar.markdown("**Edad:** 45 años")
st.sidebar.markdown("**Sexo:** Femenino")
st.sidebar.markdown("**Antecedentes:** Diabetes Mellitus")
st.sidebar.divider()

st.title("🩸 Panel de Control de Glucemia Diaria")

# -----------------------------------------------------------------------------
# ⚠️ CONFIGURACIÓN DE TUS ENLACES DE GOOGLE DRIVE:
# Reemplaza 'ENLACE_EXCEL_CSV' con tu enlace real. Asegúrate de que el documento esté compartido como "Lector".
# Reemplaza 'ENLACE_FORMULARIO_EMBED' con el enlace para rellenar tu Google Form.
# -----------------------------------------------------------------------------
ENLACE_EXCEL_CSV = "https://docs.google.com/spreadsheets/d/1RctsYdty_QuhJac_rNurDEBtXoVFxVToXSXyxuT1tZ8/edit?usp=sharing"
ENLACE_FORMULARIO_EMBED = "https://docs.google.com/spreadsheets/d/1RctsYdty_QuhJac_rNurDEBtXoVFxVToXSXyxuT1tZ8/edit?gid=0#gid=0"
# -----------------------------------------------------------------------------

# Función optimizada para descargar los datos del Excel público
def cargar_datos(url):
    try:
        csv_url = url.replace('/edit?usp=sharing', '/export?format=csv').replace('/edit#gid=', '/export?format=csv&gid=')
        df = pd.read_csv(csv_url)
        # Normalizar nombres de columnas a minúsculas
        df.columns = [col.lower() for col in df.columns]
        
        # Google Forms añade una columna "marca temporal" al principio. 
        # Si tiene 6 columnas, remapeamos los nombres estándar:
        if len(df.columns) == 6:
            df.columns = ["timestamp", "fecha", "ayuno", "almuerzo", "cena", "notas"]
        return df
    except Exception as e:
        # Retornar estructura base vacía ante fallos
        return pd.DataFrame(columns=["fecha", "ayuno", "almuerzo", "cena", "notas"])

df_base = cargar_datos(ENLACE_EXCEL_CSV)

# 2. SECCIÓN: MÉTRICAS COMPARATIVAS CON EL DÍA ANTERIOR
st.subheader("📊 Resumen del Estado Actual")

if not df_base.empty and 'fecha' in df_base.columns:
    try:
        # Limpieza rápida y orden cronológico
        df_base['fecha'] = pd.to_datetime(df_base['fecha']).dt.strftime('%Y-%m-%d')
        df_base = df_base.sort_values(by="fecha").reset_index(drop=True)
        
        # Obtener los dos últimos días con datos registrados
        fechas_unicas = df_base['fecha'].unique()
        
        if len(fechas_unicas) >= 1:
            fecha_hoy = fechas_unicas[-1]
            datos_hoy = df_base[df_base['fecha'] == fecha_hoy].iloc[-1]
            
            # Valores de hoy
            val_ayuno_hoy = datos_hoy.get('ayuno', 0)
            val_almuerzo_hoy = datos_hoy.get('almuerzo', 0)
            val_cena_hoy = datos_hoy.get('cena', 0)
            
            # Inicializar deltas vacíos
            delta_ayuno = None
            delta_almuerzo = None
            delta_cena = None
            
            # Si hay un día anterior registrado en el historial, calculamos el delta
            if len(fechas_unicas) >= 2:
                fecha_ayer = fechas_unicas[-2]
                datos_ayer = df_base[df_base['fecha'] == fecha_ayer].iloc[-1]
                
                val_ayuno_ayer = datos_ayer.get('ayuno', 0)
                val_almuerzo_ayer = datos_ayer.get('almuerzo', 0)
                val_cena_ayer = datos_ayer.get('cena', 0)
                
                if pd.notna(val_ayuno_hoy) and pd.notna(val_ayuno_ayer):
                    delta_ayuno = int(val_ayuno_hoy - val_ayuno_ayer)
                if pd.notna(val_almuerzo_hoy) and pd.notna(val_almuerzo_ayer):
                    delta_almuerzo = int(val_almuerzo_hoy - val_almuerzo_ayer)
                if pd.notna(val_cena_hoy) and pd.notna(val_cena_ayer):
                    delta_cena = int(val_cena_hoy - val_cena_ayer)

            # Dibujar tarjetas de control en columnas limpias
            m1, m2, m3 = st.columns(3)
            
            with m1:
                st.metric(
                    label=f"Glucemia Ayuno ({fecha_hoy})", 
                    value=f"{int(val_ayuno_hoy)} mg/dL" if pd.notna(val_ayuno_hoy) else "Sin registro",
                    delta=f"{delta_ayuno} mg/dL vs día anterior" if delta_ayuno is not None else None,
                    delta_color="inverse" # Rojo si sube, verde si baja
                )
            with m2:
                st.metric(
                    label="Glucemia Almuerzo", 
                    value=f"{int(val_almuerzo_hoy)} mg/dL" if pd.notna(val_almuerzo_hoy) else "Sin registro",
                    delta=f"{delta_almuerzo} mg/dL vs día anterior" if delta_almuerzo is not None else None,
                    delta_color="inverse"
                )
            with m3:
                st.metric(
                    label="Glucemia Cena", 
                    value=f"{int(val_cena_hoy)} mg/dL" if pd.notna(val_cena_hoy) else "Sin registro",
                    delta=f"{delta_cena} mg/dL vs día anterior" if delta_cena is not None else None,
                    delta_color="inverse"
                )
    except Exception as ex:
        st.info("Calculando variaciones de parámetros...")

else:
    st.info("Las métricas comparativas aparecerán de forma automática una vez ingreses tus primeros registros en la base de datos.")

st.divider()

# 3. FILAS EN PARALELO: HISTORIAL E INGRESO DE DATOS (GOOGLE FORM)
col_grafico, col_formulario = st.columns([6, 4])

with col_grafico:
    st.subheader("📈 Historial y Tendencias")
    if not df_base.empty and 'fecha' in df_base.columns:
        # Generar gráfico interactivo de líneas
        df_grafico = df_base.set_index("fecha")
        columnas_grafica = [col for col in ["ayuno", "almuerzo", "cena"] if col in df_grafico.columns]
        if columnas_grafica:
            st.line_chart(df_grafico[columnas_grafica])
            
        # Tabla interactiva inferior con datos limpios
        st.markdown("### 📋 Tabla General de Registros")
        columnas_mostrar = [col for col in ["fecha", "ayuno", "almuerzo", "cena", "notas"] if col in df_base.columns]
        st.dataframe(df_base[columnas_mostrar], use_container_width=True)
    else:
        st.info("Aún no hay curvas de tendencias disponibles.")

with col_formulario:
    st.subheader("📝 Registrar Nueva Toma")
    if ENLACE_FORMULARIO_EMBED != "AQUI_PEGA_EL_ENLACE_DE_TU_GOOGLE_FORM":
        st.markdown("Usa el siguiente formulario para guardar tus datos directamente en Google Drive:")
        # Integra el formulario directamente dentro de la aplicación de manera nativa
        st.components.v1.iframe(ENLACE_FORMULARIO_EMBED, height=650, scrolling=True)
    else:
        st.warning("⚠️ Falta configurar el enlace de tu Google Form en la línea 22 del archivo app.py para habilitar el guardado.")
