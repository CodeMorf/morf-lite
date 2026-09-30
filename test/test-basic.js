const assert = require('node:assert');
const { MorfClient, Morf, MorfSession } = require('../dist');

console.log('🧪 Iniciando tests unitarios básicos para morf-lite...');

// 1. Instanciación del cliente
const client = new MorfClient({
  baseUrl: 'https://morf.codes/api/morf',
  apiKey: 'test-key-no-secrets',
});

assert.ok(client, 'El cliente debe existir');
assert.ok(client.chat, 'client.chat debe existir');
assert.ok(client.chat.completions, 'client.chat.completions debe existir');
assert.strictEqual(typeof client.chat.completions.create, 'function', 'create debe ser función');
assert.strictEqual(typeof client.models.list, 'function', 'models.list debe ser función');
assert.strictEqual(typeof client.stats, 'function', 'stats debe ser función');
assert.strictEqual(typeof client.health, 'function', 'health debe ser función');

// 2. Alias Morf
const client2 = new Morf();
assert.ok(client2 instanceof MorfClient, 'Morf debe ser alias de MorfClient');

// 3. MorfSession y gestión de contexto en memoria
const session = client.chat.createSession({
  model: 'morf-ai-auto',
  systemPrompt: 'System instructions',
});

assert.ok(session instanceof MorfSession, 'session debe ser instancia de MorfSession');
const history1 = session.getHistory();
assert.strictEqual(history1.length, 1, 'Debe contener el system prompt inicial');
assert.strictEqual(history1[0].role, 'system');

session.addMessage('user', 'Hola');
session.addMessage('assistant', 'Hola, ¿en qué te ayudo?');
const history2 = session.getHistory();
assert.strictEqual(history2.length, 3, 'Debe registrar los mensajes agregados');

session.clear(true);
assert.strictEqual(session.getHistory().length, 1, 'clear(true) debe conservar el system prompt');

session.clear(false);
assert.strictEqual(session.getHistory().length, 0, 'clear(false) debe vaciar todo');

console.log('✅ Todos los tests unitarios pasaron correctamente.');
