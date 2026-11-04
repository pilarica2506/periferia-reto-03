import { leer_paquete, oc_validar, oc_construir_payload, oc_generar_evidencia, oc_crear } from "./src/tools/oc";

async function ejecutarDemo() {
  console.log("=== INICIO DE PRUEBAS AUTOMATIZADAS RETO 3 (SAP / OC) ===");
  const casos = ["sol-001", "sol-002", "sol-003", "sol-004", "sol-005", "sol-006"];

  for (const caso of casos) {
    console.log(`\n----------------------------------------`);
    console.log(`Procesando caso: ${caso}`);
    
    try {
      // 1. Leer paquete
      const resPaquete = JSON.parse(await leer_paquete({ caso }));
      if (!resPaquete.ok) {
        console.log(`❌ [${caso}] Error al leer paquete:`, resPaquete.error);
        continue;
      }

      // 2. Validar contra reglas de control
      const resValidar = JSON.parse(await oc_validar({ caso, paquete: resPaquete.data }));
      const { apta, bloqueos, confirmaciones, derivados } = resValidar.data;

      console.log(`📌 Apta para procesar: ${apta}`);
      if (bloqueos && bloqueos.length > 0) {
        console.log(`⚠️ Bloqueos encontrados:`, bloqueos);
      }
      if (confirmaciones && confirmaciones.length > 0) {
        console.log(`ℹ️ Confirmaciones:`, confirmaciones);
      }

      if (apta) {
        // 3. Construir Payload
        const resPayload = JSON.parse(await oc_construir_payload({ caso, paquete: resPaquete.data, derivados }));
        
        // 📋 DETALLE COMPLETO EN CONSOLA (Payload, montos, valores e ítems)
        console.log(`\n📋 --- DETALLE DE LA ORDEN DE COMPRA (${caso}) ---`);
        console.log(JSON.stringify(resPayload.data, null, 2));
        console.log(`--------------------------------------------------\n`);

        // 4. Generar Evidencia
        await oc_generar_evidencia({ caso });

        // 5. Crear OC en SAP simulado
        const resCrear = JSON.parse(await oc_crear({ caso, payload: resPayload.data }));
        console.log(`✅ [${caso}] Orden creada con éxito en SAP:`, resCrear.data.numero_oc);
      } else {
        console.log(`🛑 [${caso}] El caso se desvía a excepción y requiere revisión humana.`);
      }

    } catch (error) {
      console.error(`❌ [${caso}] Error crítico procesando el caso:`, error);
    }
  }

  console.log("\n=== FIN DE LAS PRUEBAS ===");
}

ejecutarDemo();