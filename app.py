#!/usr/bin/env python3
"""
Glisemia Tracker
-----------------
Registro diario de glisemia (ayuno, almuerzo, cena), con:
  - Almacenamiento local en CSV
  - Sincronización con Google Drive (subir / descargar)
  - Comparativa contra el registro anterior + gráfico de tendencia
  - Salida atractiva en consola usando 'rich'

Autor: generado con Claude
"""

import csv
import json
import os
from datetime import date, datetime

import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# --------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
CSV_PATH = os.path.join(DATA_DIR, "glisemia.csv")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
CREDENTIALS_PATH = os.path.join(BASE_DIR, "credentials.json")

CSV_COLUMNS = ["fecha", "ayuno", "almuerzo", "cena"]

console = Console()

# Umbrales de referencia (mg/dL) - valores orientativos generales para
# adultos sin diagnóstico previo. NO reemplaza indicación médica.
THRESHOLDS = {
    "ayuno":    {"normal": (0, 99),   "prediabetes": (100, 125), "alto_desde": 126},
    "almuerzo": {"normal": (0, 139),  "prediabetes": (140, 199), "alto_desde": 200},
    "cena":     {"normal": (0, 139),  "prediabetes": (140, 199), "alto_desde": 200},
}


def clasificar(valor, columna):
    """Devuelve (etiqueta, color) según el valor y la columna."""
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return "-", "dim"
    t = THRESHOLDS[columna]
    if t["normal"][0] <= valor <= t["normal"][1]:
        return "Normal", "green"
    if t["prediabetes"][0] <= valor <= t["prediabetes"][1]:
        return "Elevado", "yellow"
    return "Alto", "red"


# --------------------------------------------------------------------------
# Manejo de datos locales
# --------------------------------------------------------------------------
def asegurar_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CSV_PATH):
        with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(CSV_COLUMNS)


def cargar_datos() -> pd.DataFrame:
    asegurar_csv()
    df = pd.read_csv(CSV_PATH)
    for col in CSV_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df = df.sort_values("fecha").reset_index(drop=True)
    return df


def guardar_datos(df: pd.DataFrame):
    df_out = df.copy()
    df_out["fecha"] = df_out["fecha"].dt.strftime("%Y-%m-%d")
    df_out.to_csv(CSV_PATH, index=False, columns=CSV_COLUMNS)


def pedir_float(mensaje):
    while True:
        raw = console.input(mensaje).strip()
        if raw == "":
            return None
        try:
            return float(raw)
        except ValueError:
            console.print("[red]Ingresa un número válido o deja vacío para omitir.[/red]")


def agregar_registro():
    console.print(Panel.fit("Nuevo registro de glisemia", style="bold cyan"))
    fecha_raw = console.input(f"Fecha [YYYY-MM-DD] (Enter = hoy {date.today()}): ").strip()
    fecha = fecha_raw if fecha_raw else date.today().isoformat()
    try:
        fecha_dt = pd.to_datetime(fecha)
    except Exception:
        console.print("[red]Fecha inválida. Se usará la fecha de hoy.[/red]")
        fecha_dt = pd.to_datetime(date.today())

    ayuno = pedir_float("Glisemia en ayuno (mg/dL): ")
    almuerzo = pedir_float("Glisemia post-almuerzo (mg/dL): ")
    cena = pedir_float("Glisemia post-cena (mg/dL): ")

    df = cargar_datos()
    mismo_dia = df["fecha"] == fecha_dt
    nueva_fila = {"fecha": fecha_dt, "ayuno": ayuno, "almuerzo": almuerzo, "cena": cena}

    if mismo_dia.any():
        console.print("[yellow]Ya existe un registro para esta fecha. Se actualizará.[/yellow]")
        for k, v in nueva_fila.items():
            if v is not None:
                df.loc[mismo_dia, k] = v
    else:
        df = pd.concat([df, pd.DataFrame([nueva_fila])], ignore_index=True)

    df = df.sort_values("fecha").reset_index(drop=True)
    guardar_datos(df)
    console.print("[bold green]Registro guardado correctamente.[/bold green]")


def ver_historial():
    df = cargar_datos()
    if df.empty:
        console.print("[yellow]Todavía no hay registros.[/yellow]")
        return

    table = Table(title="Historial de Glisemia", box=box.ROUNDED, header_style="bold cyan")
    table.add_column("Fecha")
    table.add_column("Ayuno", justify="right")
    table.add_column("Almuerzo", justify="right")
    table.add_column("Cena", justify="right")

    for _, row in df.iterrows():
        table.add_row(
            row["fecha"].strftime("%Y-%m-%d") if pd.notna(row["fecha"]) else "-",
            _fmt(row["ayuno"]),
            _fmt(row["almuerzo"]),
            _fmt(row["cena"]),
        )
    console.print(table)


def _fmt(v):
    return "-" if pd.isna(v) else f"{v:.0f}"


# --------------------------------------------------------------------------
# Comparativa y gráfico
# --------------------------------------------------------------------------
def ver_comparativa():
    df = cargar_datos()
    df = df.dropna(subset=["fecha"])
    if len(df) == 0:
        console.print("[yellow]No hay registros para comparar.[/yellow]")
        return
    if len(df) == 1:
        console.print("[yellow]Solo hay un registro. Agrega otro día para ver la comparativa.[/yellow]")
        _mostrar_estado_actual(df.iloc[-1])
        return

    actual = df.iloc[-1]
    anterior = df.iloc[-2]

    table = Table(
        title=f"Comparativa: {anterior['fecha'].date()} → {actual['fecha'].date()}",
        box=box.ROUNDED,
        header_style="bold cyan",
    )
    table.add_column("Métrica")
    table.add_column("Anterior", justify="right")
    table.add_column("Actual", justify="right")
    table.add_column("Cambio", justify="right")
    table.add_column("Estado", justify="center")

    for col, etiqueta in [("ayuno", "Ayuno"), ("almuerzo", "Almuerzo"), ("cena", "Cena")]:
        v_ant, v_act = anterior[col], actual[col]
        cambio = "-"
        if pd.notna(v_ant) and pd.notna(v_act):
            delta = v_act - v_ant
            flecha = "↑" if delta > 0 else ("↓" if delta < 0 else "→")
            color = "red" if delta > 0 else ("green" if delta < 0 else "white")
            cambio = f"[{color}]{flecha} {abs(delta):.0f}[/{color}]"
        estado, color_estado = clasificar(v_act, col)
        table.add_row(etiqueta, _fmt(v_ant), _fmt(v_act), cambio, f"[{color_estado}]{estado}[/{color_estado}]")

    console.print(table)

    # Promedios de los últimos 7 y 30 registros
    _mostrar_promedios(df)

    # Gráfico de tendencia
    ruta_grafico = generar_grafico(df)
    console.print(f"\n[bold cyan]Gráfico de tendencia guardado en:[/bold cyan] {ruta_grafico}")


def _mostrar_estado_actual(fila):
    table = Table(title=f"Estado del {fila['fecha'].date()}", box=box.ROUNDED, header_style="bold cyan")
    table.add_column("Métrica")
    table.add_column("Valor", justify="right")
    table.add_column("Estado", justify="center")
    for col, etiqueta in [("ayuno", "Ayuno"), ("almuerzo", "Almuerzo"), ("cena", "Cena")]:
        estado, color = clasificar(fila[col], col)
        table.add_row(etiqueta, _fmt(fila[col]), f"[{color}]{estado}[/{color}]")
    console.print(table)


def _mostrar_promedios(df):
    for n in (7, 30):
        subset = df.tail(n)
        if len(subset) < 2:
            continue
        table = Table(title=f"Promedio últimos {len(subset)} registros", box=box.SIMPLE)
        table.add_column("Ayuno", justify="center")
        table.add_column("Almuerzo", justify="center")
        table.add_column("Cena", justify="center")
        table.add_row(
            _fmt(subset["ayuno"].mean()),
            _fmt(subset["almuerzo"].mean()),
            _fmt(subset["cena"].mean()),
        )
        console.print(table)


def generar_grafico(df, ultimos_n=30):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    subset = df.tail(ultimos_n)

    plt.figure(figsize=(10, 5))
    plt.plot(subset["fecha"], subset["ayuno"], marker="o", label="Ayuno", color="#2563eb")
    plt.plot(subset["fecha"], subset["almuerzo"], marker="o", label="Almuerzo", color="#f59e0b")
    plt.plot(subset["fecha"], subset["cena"], marker="o", label="Cena", color="#dc2626")

    plt.axhspan(0, 99, color="#2563eb", alpha=0.05)
    plt.title("Tendencia de Glisemia")
    plt.xlabel("Fecha")
    plt.ylabel("mg/dL")
    plt.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()

    ruta = os.path.join(REPORTS_DIR, "tendencia_glisemia.png")
    plt.savefig(ruta, dpi=150)
    plt.close()
    return ruta


# --------------------------------------------------------------------------
# Google Drive
# --------------------------------------------------------------------------
def cargar_config():
    if not os.path.exists(CONFIG_PATH):
        console.print(
            "[red]No se encontró config.json. Copia config.example.json a config.json "
            "y completa drive_folder_id.[/red]"
        )
        return None
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def obtener_servicio_drive():
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        console.print(
            "[red]Faltan dependencias de Google. Ejecuta: "
            "pip install -r requirements.txt[/red]"
        )
        return None

    if not os.path.exists(CREDENTIALS_PATH):
        console.print(
            f"[red]No se encontró {CREDENTIALS_PATH}. Sigue las instrucciones del "
            "README para crear tu cuenta de servicio.[/red]"
        )
        return None

    scopes = ["https://www.googleapis.com/auth/drive"]
    creds = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=scopes)
    return build("drive", "v3", credentials=creds)


def _buscar_archivo_drive(servicio, folder_id, nombre):
    query = f"'{folder_id}' in parents and name = '{nombre}' and trashed = false"
    resultado = servicio.files().list(q=query, fields="files(id, name)").execute()
    archivos = resultado.get("files", [])
    return archivos[0]["id"] if archivos else None


def subir_a_drive():
    config = cargar_config()
    if not config:
        return
    servicio = obtener_servicio_drive()
    if not servicio:
        return

    from googleapiclient.http import MediaFileUpload

    folder_id = config["drive_folder_id"]
    nombre_archivo = "glisemia.csv"
    file_id = _buscar_archivo_drive(servicio, folder_id, nombre_archivo)
    media = MediaFileUpload(CSV_PATH, mimetype="text/csv")

    if file_id:
        servicio.files().update(fileId=file_id, media_body=media).execute()
        console.print("[bold green]Archivo actualizado en Google Drive.[/bold green]")
    else:
        metadata = {"name": nombre_archivo, "parents": [folder_id]}
        servicio.files().create(body=metadata, media_body=media, fields="id").execute()
        console.print("[bold green]Archivo subido a Google Drive.[/bold green]")


def descargar_de_drive():
    config = cargar_config()
    if not config:
        return
    servicio = obtener_servicio_drive()
    if not servicio:
        return

    import io
    from googleapiclient.http import MediaIoBaseDownload

    folder_id = config["drive_folder_id"]
    nombre_archivo = "glisemia.csv"
    file_id = _buscar_archivo_drive(servicio, folder_id, nombre_archivo)

    if not file_id:
        console.print("[yellow]No se encontró glisemia.csv en la carpeta de Drive.[/yellow]")
        return

    request = servicio.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    asegurar_csv()
    with open(CSV_PATH, "wb") as f:
        f.write(fh.getvalue())
    console.print("[bold green]Datos descargados desde Google Drive.[/bold green]")


# --------------------------------------------------------------------------
# Menú principal
# --------------------------------------------------------------------------
def menu():
    opciones = {
        "1": ("Agregar registro de hoy", agregar_registro),
        "2": ("Ver historial completo", ver_historial),
        "3": ("Ver comparativa y gráfico de tendencia", ver_comparativa),
        "4": ("Subir datos a Google Drive", subir_a_drive),
        "5": ("Descargar datos desde Google Drive", descargar_de_drive),
        "6": ("Salir", None),
    }

    while True:
        console.print(Panel.fit("🩸 Glisemia Tracker", style="bold magenta"))
        for k, (texto, _) in opciones.items():
            console.print(f"  [cyan]{k}[/cyan]. {texto}")
        eleccion = console.input("\nElige una opción: ").strip()

        if eleccion == "6":
            console.print("[bold]Hasta la próxima. Cuida tu salud.[/bold]")
            break
        elif eleccion in opciones:
            try:
                opciones[eleccion][1]()
            except Exception as e:
                console.print(f"[red]Ocurrió un error: {e}[/red]")
        else:
            console.print("[red]Opción no válida.[/red]")
        console.print()


if __name__ == "__main__":
    menu()
