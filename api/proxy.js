export default async function handler(req, res) {
  try {
    // Lee tus variables de entorno desde Vercel
    const tokenAirtable = process.env.AIRTABLE_TOKEN;
    const clientesTable = process.env.CLIENTES_TABLE_ID;
    const baseId = process.env.BASE_ID;
    const ventasTable = process.env.VENTAS_TABLE_ID;
    const anfitrionesTable = process.env.ANFITRIONES_TABLE_ID;
    const inventarioTable = process.env.INVENTARIO_TABLE_ID;
    const productosTable = process.env.PRODUCTOS_TABLE_ID;

    // Valida que todas existan
    if (!tokenAirtable || !clientesTable || !baseId || !ventasTable || !anfitrionesTable || !inventarioTable || !productosTable) {
      return res.status(500).json({
        error: "Una o más variables de entorno no están definidas",
        variables: {
          airtable_: !!tokenAirtable,
          clientesTable_: !!clientesTable,
          baseId_: !!baseId,
          ventasTable_: !!ventasTable,
          anfitrionesTable_: !!anfitrionesTable,
          inventarioTable_: !!inventarioTable,
          productosTable_: !!productosTable
        }
      });
    }

    // Devuelve un objeto JSON con todas las variables
    res.status(200).json({
      airtableToken: tokenAirtable,
      clientesTable_: clientesTable,
      baseId_: baseId,
      ventasTable_: ventasTable,
      anfitrionesTable_: anfitrionesTable,
      inventarioTable_: inventarioTable,
      productosTable_: productosTable
    });
    
  } catch (err) {
    console.error("Error en proxy:", err);
    res.status(500).json({ error: "Error interno en el proxy" });
  }
}