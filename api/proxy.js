export default async function handler(req, res) {
  try {
    const token = process.env.AIRTABLE_TOKEN;

    if (!token) {
      return res.status(500).json({ error: "Token no definido en variables de entorno" });
    }

    // Devuelve el token o los datos que quieras exponer
    res.status(200).json({ token });
  } catch (err) {
    console.error("Error en proxy:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}