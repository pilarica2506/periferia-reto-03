# Reto 3: Automatización de Órdenes de Compra (SAP / Periferia IT)

Repositorio oficial para la solución del Reto 3, orientado al diseño y desarrollo de un agente determinista en TypeScript para la auditoría, validación y procesamiento de Órdenes de Compra (OC) bajo normativas corporativas y simulación de SAP.

---

## 🛠️ Stack Tecnológico y Arquitectura
- **Lenguaje**: TypeScript / Node.js
- **Validación de esquemas**: Zod
- **Motor de Reglas**: Lógica determinista basada en 10 Reglas de Control (`RC1` a `RC10`) y ciclo de agente (`CA1` a `CA5`).
- **Persistencia**: Registro transaccional en formato JSON y simulación de base de datos SAP (`out/sap/ordenes.jsonl`).

---

## 📂 Estructura del Proyecto
- `agent/`: Contiene el prompt del sistema (`prompt.md`) con las directrices, rol y reglas estrictas del agente (incluyendo la política de cero alucinaciones).
- `fixtures/`: Archivos maestros de referencia (`proveedores.json`, `centros-costo.json`, etc.) y paquetes de solicitudes de prueba (`sol-001` a `sol-006`).
- `src/`: Lógica central del sistema y herramientas tipadas del agente (`oc.ts`, etc.).
- `out/`: Carpeta de salida donde se almacena la trazabilidad detallada por caso y el registro de órdenes procesadas.
- `SOLUCION.md`: Documentación técnica exhaustiva que cubre los 12 requisitos de la rúbrica, análisis de riesgos y diagramas de arquitectura.

---

## 🚀 Instrucciones de Ejecución y Demostración

Para validar de forma automatizada el comportamiento del agente, la evaluación de las Reglas de Control y la generación de evidencia transaccional, sigue estos pasos en tu terminal (local o en GitHub Codespaces):

1. **Instalar dependencias**:
   ```bash
   npm install

2. Ejecutar la demostración del agente:
   ```bash
   npx tsx demo.ts

3. Verificar los resultados
   
   Los registros de auditoría y la trazabilidad de los casos evaluados se almacenarán automáticamente en la carpeta out/.
   
