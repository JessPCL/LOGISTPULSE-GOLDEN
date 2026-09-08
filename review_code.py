import os
import sys
import google.generativeai as genai

# 1. Configurar la API Key de Gemini desde las variables de entorno de GitHub
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: No se encontró la GEMINI_API_KEY")
    sys.exit(1)

genai.configure(api_key=api_key)

# 2. Leer el archivo 'changes.diff' generado por la GitHub Action
try:
    with open("changes.diff", "r", encoding="utf-8") as f:
        pr_diff = f.read()
except FileNotFoundError:
    print("No se encontró el archivo de diferencias (changes.diff).")
    sys.exit(0)

if not pr_diff.strip():
    print("No hay cambios de código detectados en este Pull Request.")
    sys.exit(0)

# 3. Inicializar el modelo (Se recomienda gemini-1.5-flash por su velocidad y bajo costo)
model = genai.GenerativeModel("gemini-1.5-flash")

# 4. Diseñar el Prompt para la revisión
prompt = f"""
Actúa como un ingeniero de software Senior y experto en Code Review. 
Analiza los siguientes cambios de código provenientes de un archivo .diff de Git y genera un reporte breve en español.

Por favor, estructura tu respuesta de la siguiente manera:
1. **Resumen**: Qué hace este cambio de forma general.
2. **Errores Potenciales / Bugs**: Si detectas fallos lógicos, problemas de seguridad o desbordamientos.
3. **Sugerencias de Mejora**: Consejos de optimización, legibilidad o buenas prácticas.

Aquí tienes el código diff para revisar:
{pr_diff}
"""

print("Enviando código a Gemini para su revisión...")
try:
    response = model.generate_content(prompt)
    
    # 5. Guardar la respuesta en un archivo markdown que usaremos para el comentario en GitHub
    with open("review_response.md", "w", encoding="utf-8") as out_f:
        out_f.write("### 🤖 Revisión Automática de Código con Gemini\n\n")
        out_f.write(response.text)
        
    print("Revisión completada exitosamente.")

except Exception as e:
    print(f"Error al conectar con la API de Gemini: {e}")
    sys.exit(1)
review_code.py
