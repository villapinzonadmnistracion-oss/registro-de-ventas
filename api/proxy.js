export default async function handler(req, res) {
  try {
    const tokenAirtable = process.env.AIRTABLE_TOKEN;
    const clientesTable = process.env.CLIENTES_TABLE_ID;
    const baseId = process.env.BASE_ID;
    const ventasTable = process.env.VENTAS_TABLE_ID;
    const anfitrionesTable = process.env.ANFITRIONES_TABLE_ID;
    const inventarioTable = process.env.INVENTARIO_TABLE_ID;
    const productosTable = process.env.PRODUCTOS_TABLE_ID;
    const promocionesTable = process.env.PROMOCIONES_TABLE_ID; // ← NUEVA LÍNEA

    // Validación actualizada
    if (!tokenAirtable || !clientesTable || !baseId || !ventasTable || 
        !anfitrionesTable || !inventarioTable || !productosTable || !promocionesTable) {
      return res.status(500).json({
        error: "Una o más variables de entorno no están definidas",
        variables: {
          airtable_: !!tokenAirtable,
          clientesTable_: !!clientesTable,
          baseId_: !!baseId,
          ventasTable_: !!ventasTable,
          anfitrionesTable_: !!anfitrionesTable,
          inventarioTable_: !!inventarioTable,
          productosTable_: !!productosTable,
          promocionesTable_: !!promocionesTable // ← NUEVA LÍNEA
        }
      });
    }

    // Respuesta actualizada
    res.status(200).json({
      airtableToken: tokenAirtable,
      clientesTable_: clientesTable,
      baseId_: baseId,
      ventasTable_: ventasTable,
      anfitrionesTable_: anfitrionesTable,
      inventarioTable_: inventarioTable,
      productosTable_: productosTable,
      promocionesTable_: promocionesTable // ← NUEVA LÍNEA
    });
    
  } catch (err) {
    console.error("Error en proxy:", err);
    res.status(500).json({ error: "Error interno en el proxy" });
  }
}