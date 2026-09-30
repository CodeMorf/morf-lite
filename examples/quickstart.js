// Ejemplo básico de inferencia con MorfClient
const { MorfClient } = require('../dist');

async function main() {
  // Inicialización limpia: toma la URL y API key de variables de entorno o parámetros
  const client = new MorfClient({
    // baseUrl: process.env.MORF_BASE_URL || 'https://morf.codes/api/morf',
    // apiKey: process.env.MORF_API_KEY
  });

  console.log('Enviando petición a morf-ai-auto...');
  const response = await client.chat.completions.create({
    model: 'morf-ai-auto',
    messages: [
      { role: 'system', content: 'Eres un asistente conciso y profesional.' },
      { role: 'user', content: '¿Cuáles son los 3 pilares del desarrollo de software limpio?' },
    ],
    temperature: 0.7,
  });

  console.log('\nRespuesta del Asistente:');
  console.log(response.choices[0].message.content);

  if (response._morf) {
    console.log('\nMetadatos de Morf Gateway:');
    console.log(`- Modelo despachado: ${response._morf.display || response._morf.model}`);
    console.log(`- Proveedor: ${response._morf.provider}`);
    console.log(`- Categoría auto-enrutada: ${response._morf.category}`);
  }
}

main().catch(console.error);
