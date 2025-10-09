export default async function handler(req, res) {
  try {
    // 1️⃣ Lee tus variables de entorno desde Vercel
    const tokenAirtable = process.env.AIRTABLE_TOKEN;
    const clientesTable = process.env.CLIENTES_TABLE_ID;
    const baseId = process.env.BASE_ID;
    const ventasTable = process.env.VENTAS_TABLE_ID;

    // 2️⃣ Valida que todas existan
    if (!tokenAirtable || !apiKey || !baseId || !secretKey) {
      return res.status(500).json({
        error: "Una o más variables de entorno no están definidas",
        variables: {
          airtable_: !!tokenAirtable,
          clientesTable_: !!clientesTable,
          baseId_: !!baseId,
          ventasTable_: !!ventasTable
        }
      });
    }

    // 3️⃣ Devuelve un objeto JSON con las cuatro variables
    res.status(200).json({
      airtableToken: tokenAirtable,
      clientesTable_: clientesTable,
      baseId_: baseId,
      ventasTable_: ventasTable
    });
    
  } catch (err) {
    console.error("Error en proxy:", err);
    res.status(500).json({ error: "Error interno en el proxy" });
  }
}