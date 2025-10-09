export default async function handler(req, res) {
  try {
    const apiUrl = "https://registro-de-ventas-eight.vercel.app/";
    const token = process.env.AIRTABLE_TOKEN;

    console.log("URL solicitada:", apiUrl);
    console.log("Token presente:", !!token);

    const response = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    console.log("Código de respuesta:", response.status);

    const text = await response.text(); // lee el cuerpo crudo
    console.log("Primeros 200 caracteres:\n", text.slice(0, 200));

    // Si es JSON válido, parsea
    try {
      const data = JSON.parse(text);
      res.status(200).json(data);
    } catch {
      res.status(response.status).send(text); // muestra el HTML directamente
    }

  } catch (err) {
    console.error("Error en proxy:", err);
    res.status(500).json({ error: "Error interno en el proxy" });
  }
}