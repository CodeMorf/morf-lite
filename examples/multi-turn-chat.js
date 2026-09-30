// Ejemplo de conversación continua multi-turno (con memoria de contexto automática)
const { MorfClient } = require('../dist');

async function main() {
  const client = new MorfClient();

  // Crea una sesión interactiva que acumula el contexto automáticamente
  const session = client.chat.createSession({
    model: 'morf-ai-auto',
    systemPrompt: 'Eres un tutor experto en bases de datos.',
  });

  console.log('Turno 1:');
  const res1 = await session.sendMessage('Hola, mi base de datos favorita es PostgreSQL.');
  console.log('Asistente:', res1.content);

  console.log('\nTurno 2 (haciendo referencia al contexto anterior sin repetirlo):');
  const res2 = await session.sendMessage('¿Cuáles son 2 grandes ventajas de la base de datos que te mencioné?');
  console.log('Asistente:', res2.content);

  console.log('\nHistorial total acumulado en memoria:', session.getHistory().length, 'mensajes.');
}

main().catch(console.error);
