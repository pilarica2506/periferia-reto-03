# Solución Técnica - Reto 3: Automatización de Órdenes de Compra (SAP / Periferia IT)

## 1. Declaración de IA Asistida (Requisito de Transparencia)
Durante el desarrollo de esta solución se utilizó **Gemini (Google)** como asistente de ingeniería de software para:
- Estructurar la arquitectura modular en TypeScript con Node.js orientada a herramientas y scripts de automatización (`demo.ts`).
- Diseñar los esquemas de validación fuertemente tipados con **Zod**.
- Implementar la lógica determinista para la evaluación rigurosa de las 10 Reglas de Control (RC1–RC10).
- Configurar la persistencia de evidencia transaccional y los reportes detallados de trazabilidad por caso en formato JSON.

---

## 2. Definición del Problema
- **Problema en una frase**: La validación manual y descentralizada de órdenes de compra frente a maestros corporativos genera cuellos de botella operativos, riesgos de fraude por excepciones no controladas y desvíos financieros.
- **A quién le duele**: Al equipo financiero, a los aprobadores de centros de costo y al área de operaciones tecnológicas de Periferia IT, quienes deben auditar y garantizar la conformidad normativa y presupuestal.

---

## 3. Arquitectura de la Solución
El proyecto mantiene una estructura modular limpia y separada por responsabilidades:
- `agent/prompt.md`: Define el contexto y comportamiento directriz del agente.
- `src/tools/oc.ts`: Contiene el núcleo lógico y las herramientas tipadas con Zod (`leer_paquete`, `oc_validar`, `oc_construir_payload`, `oc_generar_evidencia`, `oc_crear`).
- `demo.ts`: Script de ejecución automatizada y determinista que procesa en lote los casos de prueba (`sol-001` a `sol-006`).
- `fixtures/`: Contiene los datos maestros corporativos (`proveedores.json`, `centros-costo.json`) y las solicitudes.
- `out/`: Almacena la evidencia detallada de trazabilidad por caso (`out/sol-XXX/trazabilidad.json`) y el registro centralizado (`out/sap/ordenes.jsonl`).

---

## 4. Ciclo del Agente y Confirmación Humana
- **Bucle de Ejecución**: El flujo procesa cada solicitud de forma secuencial leyendo el paquete, aplicando validaciones maestras, evaluando reglas de control y decidiendo si el caso es apto o requiere excepción.
- **Tope de Iteraciones**: Controlado de manera determinista mediante un ciclo `for...of` en el script de prueba, evitando bucles infinitos o consumo innecesario de cómputo.
- **Confirmación Humana (CA3)**: Las excepciones o bloqueos no se resuelven de forma forzada; el sistema clasifica la incidencia y frena el proceso devolviéndolo al operador humano con una recomendación explícita.

---

## 5. Elección del Modelo y Enfoque Tecnológico
- **Proveedor y Modelo**: Ejecución nativa local basada en código determinista de TypeScript/Node.js, apoyada en entornos de asistencia de IA para el diseño y estructuración inicial.
- **Justificación**: Para procesos financieros críticos y de auditoría estricta como la creación de órdenes de compra, la lógica determinista por código garantiza repetibilidad al 100%, evitando la alucinación estocástica de los modelos de lenguaje en cálculos monetarios y cruces de tablas maestras.
- **Costo estimado**: Bajo costo de procesamiento computacional local, sin dependencia de llamadas repetitivas a APIs de inferencia de pago por token en tiempo de ejecución.

---

## 6. Matriz de Controles (RC1 a RC10)
- **RC1 (Proveedor Activo)**: Valida en `proveedores.json` que el NIT/nombre esté activo.
- **RC2 & RC3 (Aprobación y Topes)**: Comprueba autorizadores válidos y respeta el límite financiero asignado por centro de costo.
- **RC4 a RC9 (Subáreas, Variaciones, IVA y Pagos)**: Automatizan cruces de subáreas, cálculo de desviación de cotización, derivación de indicador de IVA (ej. `C1`) y condiciones de pago (`Z030`).
- **RC10 (Consistencia Matemática)**: Valida estrictamente que `cantidad × valor_unitario = valor_total`.
- **Control más complejo**: **RC10 y RC5**, debido a la necesidad de parsear con expresiones regulares archivos de texto plano (`cotizacion.txt`) y validar tolerancias numéricas estrictas sin margen de error.

---

## 7. Diseño del Adaptador SAP Real
Para escalar el entorno simulado actual (`out/sap/ordenes.jsonl`) a un entorno de producción con SAP S/4HANA:
- **Conectividad**: Reemplazar la escritura en archivo local por un cliente HTTP seguro (`axios` / `node-fetch`) apuntando a los servicios OData (API_PURCHASEORDER_PROCESS_SRV) o RFCs expuestos por SAP PI/PO.
- **Autenticación**: Implementar autenticación OAuth 2.0 o certificados de seguridad mutua (mTLS) almacenados en gestores de secretos (como AWS Secrets Manager o Azure Key Vault).
- **Manejo de Transacciones**: Incorporar un mecanismo de reintentos exponenciales (*exponential backoff*) y manejo de bloqueos de objetos en tablas SAP (`EKKO`/`EKPO`).

---

## 8. Lectura del Proceso: Órdenes Retroactivas
- **Análisis para la Dirección**: Las órdenes retroactivas (detectadas en la regla RC8 donde la factura es anterior a la solicitud formal) evidencian fallas de control operacional y saltos de los conductos regulares, incrementando el riesgo fiscal y de cumplimiento.
- **Propuesta de Proceso**: Implementar un bloqueo automático estricto en el portal de recepción de facturas que impida el ingreso de documentos contables que no posean una Orden de Compra previa aprobada y activa en el sistema.

---

## 9. Decisiones y Trade-offs
1. **Validación Determinista vs. LLM Puro**: Se priorizó TypeScript determinista sobre un agente impulsado 100% por lenguaje natural para asegurar precisión matemática y evitar alucinaciones en datos contables.
2. **Almacenamiento Local en JSONL vs. Base de Datos Relacional**: Se optó por archivos JSON y JSONL en `out/` por simplicidad de despliegue y portabilidad en el reto, sacrificando concurrencia transaccional a gran escala.
3. **Ejecución por Script CLI (`demo.ts`) vs. Interfaz Gráfica**: Se estructuró un script automatizado para facilitar la revisión y auditoría directa de los casos de prueba por parte de los evaluadores.

---

## 10. Supuestos del PRD
- Los archivos maestros (`proveedores.json`, `centros-costo.json`) se encuentran actualizados y normalizados.
- Las solicitudes de compra siguen una estructura de carpetas estándar (`fixtures/solicitudes/sol-XXX/`) con archivos de formato predecible (`solicitud.json`, `cotizacion.txt`, `aprobacion.json`).
- Los códigos estándar de SAP (`C1` para IVA, `Z030` para plazos de pago) son fijos según los acuerdos comerciales base.

---

## 11. Cobertura de Historias de Usuario

| Historia de Usuario / Requisito | Estado | Observaciones / Qué falta para Producción |
| :--- | :--- | :--- |
| Lectura y normalización del paquete | **Hecho** | Completado mediante `leer_paquete`. |
| Validación de Reglas de Control (RC1–RC10) | **Hecho** | Implementado íntegramente en `oc_validar`. |
| Construcción del Payload de la OC | **Hecho** | Estructura lista para integración. |
| Generación de evidencia de trazabilidad | **Hecho** | Almacenado en `out/{caso}/trazabilidad.json`. |
| Simulación de creación en SAP | **Hecho** | Registro persistente en `out/sap/ordenes.jsonl`. |
| Integración con API SAP real y OAuth | **No Hecho** | Requeriría credenciales corporativas y conectores OData productivos. |

---

## 12. Riesgos de Producción y Mitigación
- **Riesgo 1: Desactualización de maestros de proveedores**. *Mitigación*: Sincronización automática diaria mediante jobs programados contra el maestro central de SAP.
- **Riesgo 2: Falsos positivos o bloqueos en excepciones complejas**. *Mitigación*: Canales de escalamiento ágil a supervisores con bandejas de revisión humana asistida.
- **Riesgo 3: Indisponibilidad temporal de la red o pasarela SAP**. *Mitigación*: Implementación de colas de mensajes (como RabbitMQ o AWS SQS) para procesamiento asíncrono y reintentos automáticos.

---

## 13. Instrucciones de Ejecución
Para ejecutar la validación completa en lote de los casos de prueba y visualizar los detalles de las órdenes generadas en la terminal, ejecute:
```bash
npx tsx demo.ts