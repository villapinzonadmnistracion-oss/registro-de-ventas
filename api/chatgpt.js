export default async function handler(req, res) {
  // Solo acepta POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Leer el token de OpenAI desde variable de entorno
    const openaiApiKey = process.env.API_OPENAI;

    // Validar que exista
    if (!openaiApiKey) {
      return res.status(500).json({ 
        error: 'Token de OpenAI no configurado en variables de entorno' 
      });
    }

    // Obtener los mensajes del body
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Se requiere un array de mensajes' 
      });
    }

    // Llamar a la API de OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 300,
        temperature: 0.7
      })
    });

    const data = await response.json();

    // Manejar errores de OpenAI
    if (data.error) {
      console.error('Error de OpenAI:', data.error);
      return res.status(500).json({ 
        error: data.error.message || 'Error al procesar con ChatGPT' 
      });
    }

    // Retornar la respuesta
    res.status(200).json({
      response: data.choices[0].message.content,
      usage: data.usage // Opcional: para tracking de uso
    });

  } catch (err) {
    console.error('Error en proxy ChatGPT:', err);
    res.status(500).json({ 
      error: 'Error interno al conectar con ChatGPT' 
    });
  }
}
