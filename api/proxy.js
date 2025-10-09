export default async function handler(req, res) {
  const response = await fetch("https://registro-de-ventas-eight.vercel.app/", {
    headers: {
      "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`
    }
  });

  const data = await response.json();

  // Permitir que tu página (GitHub Pages) lo use
  res.setHeader("Access-Control-Allow-Origin", "https://villapinzonadmnistracion-oss.github.io");
  res.status(200).json(data);
}