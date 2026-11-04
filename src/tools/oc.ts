import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import { z } from "zod";

// ========================================================
// ESQUEMAS DE ZOD TIPados CORRECTAMENTE
// ========================================================

const LeerPaqueteSchema = z.object({
  caso: z.string().min(1, "El identificador del caso es obligatorio")
});

const OcValidarSchema = z.object({
  caso: z.string().min(1),
  paquete: z.record(z.string(), z.any())
});

const OcConstruirPayloadSchema = z.object({
  caso: z.string().min(1),
  paquete: z.record(z.string(), z.any()),
  derivados: z.record(z.string(), z.any())
});

const OcGenerarEvidenciaSchema = z.object({
  caso: z.string().min(1)
});

const OcCrearSchema = z.object({
  caso: z.string().min(1),
  payload: z.record(z.string(), z.any())
});

// 1. Leer paquete de solicitud
export async function leer_paquete(input: { caso: string }) {
  try {
    const validado = LeerPaqueteSchema.parse(input);
    const basePath = path.join(process.cwd(), "fixtures", "solicitudes", validado.caso);
    
    if (!fs.existsSync(basePath)) {
      throw new Error(`No se encontró la carpeta para el caso ${validado.caso}`);
    }
    
    const archivos = fs.readdirSync(basePath);
    const paquete: Record<string, any> = {};

    for (const archivo of archivos) {
      const rutaArchivo = path.join(basePath, archivo);
      const contenido = fs.readFileSync(rutaArchivo, "utf-8");
      if (archivo.endsWith(".json")) {
        try {
          paquete[archivo] = JSON.parse(contenido);
        } catch {
          paquete[archivo] = contenido;
        }
      } else {
        paquete[archivo] = contenido;
      }
    }

    return JSON.stringify({ ok: true, data: paquete });
  } catch (error: any) {
    return JSON.stringify({ ok: false, error: error.message });
  }
}

// Utilidad para normalizar texto (para RC1)
function normalizarTexto(texto: string): string {
  return (texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// 2. Validar las 10 Reglas de Control oficiales (RC1 - RC10)
export async function oc_validar(input: { caso: string; paquete: any }) {
  try {
    const validado = OcValidarSchema.parse(input);
    const bloqueos: string[] = [];
    const confirmaciones: string[] = [];
    const derivados: Record<string, any> = {};

    const cargarMaestro = (nombre: string) => {
      const p = path.join(process.cwd(), "fixtures", "maestros", nombre);
      if (fs.existsSync(p)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
          return Array.isArray(parsed) ? parsed : (parsed.data || parsed.proveedores || parsed.centros_costo || []);
        } catch { return []; }
      }
      return [];
    };

    const proveedores = cargarMaestro("proveedores.json");
    const centrosCosto = cargarMaestro("centros-costo.json");

    const sol: any = validado.paquete["solicitud.json"] || validado.paquete;
    const aprobacion: any = validado.paquete["aprobacion.json"];
    const cotizacionRaw = validado.paquete["cotizacion.json"] || validado.paquete["cotizacion.txt"];
    const facturaRaw = validado.paquete["factura.json"] || validado.paquete["factura.txt"];

    const nitSol = String(sol.nit_proveedor || sol.proveedor_nit || sol.nit || "").trim();
    const nombreSol = normalizarTexto(sol.proveedor_nombre || sol.nombre_proveedor || "");
    const cecoSol = sol.centro_costo || sol.ceco;
    const subareaSol = sol.subarea;
    const valorTotal = Number(sol.valor_total || sol.total || 0);
    const cantidad = Number(sol.cantidad || 0);
    const valorUnitario = Number(sol.valor_unitario || sol.precio_unitario || 0);

    // ========================================================
    // REGLAS DE CONTROL OFICIALES (RC1 - RC10)
    // ========================================================

    // RC1: Proveedor existente y activo
    let provEncontrado: any = null;
    if (nitSol) {
      provEncontrado = proveedores.find((p: any) => String(p.nit || "").trim() === nitSol);
    }
    if (!provEncontrado && nombreSol) {
      provEncontrado = proveedores.find((p: any) => normalizarTexto(p.nombre || p.razon_social || "") === nombreSol);
    }

    if (!provEncontrado) {
      bloqueos.push("RC1: El proveedor no existe en el maestro de proveedores.");
    } else if (provEncontrado.activo !== true) {
      bloqueos.push("RC1: El proveedor existe pero no se encuentra activo.");
    }

    const centroData = centrosCosto.find((c: any) => c.centro_costo === cecoSol || c.codigo === cecoSol || c.id === cecoSol);

    // RC2: Aprobación existente, con estado "Aprobado" y correo autorizado
    if (!aprobacion) {
      bloqueos.push("RC2: Falta el documento de aprobación (aprobacion.json).");
    } else {
      const textoApr = String(aprobacion.estado || aprobacion.mensaje || aprobacion.cuerpo || aprobacion.asunto || "");
      const correoApr = String(aprobacion.correo_aprobador || aprobacion.correo || aprobacion.email || aprobacion.de || "").trim();
      const aprobadoresValidos = centroData?.aprobadores || [];

      if (!textoApr.toLowerCase().includes("aprobado")) {
        bloqueos.push("RC2: La aprobación no contiene el estado 'Aprobado'.");
      }

      const aprobadorAutorizado = aprobadoresValidos.find((ap: any) => String(ap.email || "").trim().toLowerCase() === correoApr.toLowerCase());
      if (aprobadoresValidos.length > 0 && !aprobadorAutorizado) {
        bloqueos.push("RC2: El correo del aprobador no está autorizado para este centro de costo.");
      }

      // RC3: valor_total <= tope del aprobador
      if (aprobadorAutorizado) {
        const topeAprobador = Number(aprobadorAutorizado.tope || 999999999);
        if (valorTotal > topeAprobador) {
          bloqueos.push(`RC3: El valor total (${valorTotal}) excede el tope permitido (${topeAprobador}) para el aprobador.`);
        }
      }
    }

    // RC4: subarea pertenece al centro_costo
    if (centroData && subareaSol) {
      const subareasValidas = centroData.subareas || [];
      if (subareasValidas.length > 0 && !subareasValidas.includes(subareaSol)) {
        bloqueos.push(`RC4: La subárea '${subareaSol}' no pertenece al centro de costos '${cecoSol}'.`);
      }
    }

    // RC5: Variación de cotización <= 2%
    let valCot = 0;
    if (cotizacionRaw) {
      if (typeof cotizacionRaw === "object") {
        valCot = Number(cotizacionRaw.total || cotizacionRaw.valor_total || 0);
      } else if (typeof cotizacionRaw === "string") {
        const matchTotal = cotizacionRaw.match(/TOTAL\s*\(.*?\):\s*COP\s*([\d\.]+)/i) || cotizacionRaw.match(/TOTAL[:\s]*([\d\.]+)/i);
        if (matchTotal) {
          valCot = Number(matchTotal[1].replace(/\./g, ""));
        }
      }
    }

    if (!cotizacionRaw) {
      confirmaciones.push("RC5: No se adjuntó cotización para validar la variación de valor.");
    } else if (valCot > 0 && valorTotal > 0) {
      const variacion = Math.abs(valCot - valorTotal) / valorTotal;
      if (variacion > 0.02) {
        confirmaciones.push(`RC5: La variación entre cotización (${valCot}) y solicitud (${valorTotal}) excede el 2%.`);
      }
    }

    // RC6: Indicador de IVA ausente -> derivado del proveedor
    if (sol.indicador_iva === undefined || sol.indicador_iva === null || sol.indicador_iva === "") {
      if (provEncontrado && provEncontrado.indicador_iva_default !== undefined) {
        derivados.indicador_iva = provEncontrado.indicador_iva_default;
        confirmaciones.push("RC6: Indicador de IVA ausente; derivado automáticamente del maestro del proveedor.");
      } else {
        confirmaciones.push("RC6: Indicador de IVA ausente y sin valor por defecto en el proveedor.");
      }
    }

    // RC7: Condiciones de pago ausentes -> derivado del proveedor
    if (sol.condiciones_pago === undefined || sol.condiciones_pago === null || sol.condiciones_pago === "") {
      if (provEncontrado && provEncontrado.condiciones_pago_default !== undefined) {
        derivados.condiciones_pago = provEncontrado.condiciones_pago_default;
      }
    }

    // RC8: Factura con fecha < fecha_solicitud -> retroactiva = true
    let fechaFactura: string | null = null;
    if (facturaRaw) {
      if (typeof facturaRaw === "object" && facturaRaw.fecha) {
        fechaFactura = facturaRaw.fecha;
      } else if (typeof facturaRaw === "string") {
        const matchFecha = facturaRaw.match(/Fecha[:\s]*([\d-]+)/i);
        if (matchFecha) fechaFactura = matchFecha[1];
      }
    }
    if (fechaFactura && sol.fecha_solicitud) {
      if (new Date(fechaFactura) < new Date(sol.fecha_solicitud)) {
        derivados.retroactiva = true;
        confirmaciones.push("RC8: La fecha de la factura es anterior a la fecha de solicitud (Transacción retroactiva).");
      }
    }

    // RC9: Fecha de aprobación >= fecha_solicitud
    if (aprobacion && aprobacion.fecha && sol.fecha_solicitud) {
      if (new Date(aprobacion.fecha) < new Date(sol.fecha_solicitud)) {
        confirmaciones.push("RC9: La fecha de aprobación es anterior a la fecha de solicitud.");
      }
    }

    // RC10: cantidad * valor_unitario = valor_total (± 1)
    if (cantidad > 0 && valorUnitario > 0) {
      const calculado = cantidad * valorUnitario;
      if (Math.abs(calculado - valorTotal) > 1) {
        bloqueos.push(`RC10: El cálculo de cantidad (${cantidad}) * valor unitario (${valorUnitario}) = ${calculado} no coincide con el valor total (${valorTotal}).`);
      }
    }

    const apta = bloqueos.length === 0;

    return JSON.stringify({
      ok: true,
      data: {
        apta,
        bloqueos,
        confirmaciones,
        derivados
      }
    });
  } catch (error: any) {
    return JSON.stringify({ ok: false, error: error.message });
  }
}

// 3. Construir Payload
export async function oc_construir_payload(input: { caso: string; paquete: any; derivados: any }) {
  try {
    const validado = OcConstruirPayloadSchema.parse(input);
    const sol = validado.paquete["solicitud.json"] || validado.paquete;
    return JSON.stringify({
      ok: true,
      data: {
        caso: validado.caso,
        orden_compra: { ...sol, ...validado.derivados }
      }
    });
  } catch (error: any) {
    return JSON.stringify({ ok: false, error: error.message });
  }
}

// 4. Generar Evidencia
export async function oc_generar_evidencia(input: { caso: string }) {
  try {
    const validado = OcGenerarEvidenciaSchema.parse(input);
    const outDir = path.join(process.cwd(), "out", validado.caso);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(outDir, "trazabilidad.json"),
      JSON.stringify({ caso: validado.caso, timestamp: new Date().toISOString(), estado: "VALIDADO_CON_ZOD" }, null, 2)
    );
    return JSON.stringify({ ok: true });
  } catch (error: any) {
    return JSON.stringify({ ok: false, error: error.message });
  }
}

// 5. Simulado SAP
export async function oc_crear(input: { caso: string; payload: any }) {
  try {
    const validado = OcCrearSchema.parse(input);
    const sapDir = path.join(process.cwd(), "out", "sap");
    if (!fs.existsSync(sapDir)) {
      fs.mkdirSync(sapDir, { recursive: true });
    }

    const numOc = `OC-${Math.floor(100000 + Math.random() * 900000)}`;
    const registro = JSON.stringify({ numero_oc: numOc, caso: validado.caso, payload: validado.payload }) + "\n";
    
    fs.appendFileSync(path.join(sapDir, "ordenes.jsonl"), registro);
    
    return JSON.stringify({
      ok: true,
      data: { numero_oc: numOc }
    });
  } catch (error: any) {
    return JSON.stringify({ ok: false, error: error.message });
  }
}