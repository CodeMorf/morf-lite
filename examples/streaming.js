// Ejemplo de respuesta en streaming en tiempo real (SSE)
const { MorfClient } = require('../dist');

async function main() {
  const client = new MorfClient();

  console.log('Iniciando stream con morf-ai-auto...\n');
  const stream = await client.chat.completions.create({
    model: 'morf-ai-auto',
    messages: [
      { role: 'user', content: 'Escribe un poema breve sobre servidores y microservicios.' }
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    process.stdout.write(delta);
  }

  console.log('\n\n--- Stream completado ---');
}

main().catch(console.error);
