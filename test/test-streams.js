const assert = require('node:assert/strict');
const { parseEventStream, parseRunEvents, createCliExecutor } = require('../dist');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const encoder = new TextEncoder();
function stream(parts) { return new ReadableStream({ start(controller) { for (const p of parts) controller.enqueue(encoder.encode(p)); controller.close(); } }); }
async function collect(iterator) { const rows = []; for await (const row of iterator) rows.push(row); return rows; }
(async () => {
  const text = 'data: '+JSON.stringify({ choices:[{delta:{content:'Hola'},finish_reason:null}] })+'\n\n';
  const finish = 'data: '+JSON.stringify({ choices:[{delta:{},finish_reason:'stop'}] })+'\n\n';
  assert.equal((await collect(parseEventStream(stream([text,finish,'data: [DONE]\n\n'])))).length,2);
  await assert.rejects(collect(parseEventStream(stream([text]))), /completion/);
  await assert.rejects(collect(parseEventStream(stream([text,'data: [DONE]\n\n']))), /completion/);
  await assert.rejects(collect(parseEventStream(stream(['data: [DONE]\n\n']))), /output/);
  await assert.rejects(collect(parseEventStream(stream(['data: {invalid}\n\n']))), /Invalid JSON/);
  await assert.rejects(collect(parseEventStream(stream(['data: {"error":{"message":"upstream failed"}}']))), /upstream failed/);
  const events = 'id: 1\nevent: agent.message\ndata: {"type":"agent.message","sequence":1}\n\nid: 2\nevent: run.completed\ndata: {"type":"run.completed","sequence":2}\n\n';
  assert.equal((await collect(parseRunEvents(stream([events.slice(0,40),events.slice(40)])))).length,2);
  await assert.rejects(collect(parseRunEvents(stream(['data: {"type":"agent.started"}\n\n']))), /before completion/);
  await assert.rejects(collect(parseRunEvents(stream(['data: {invalid}\n\n']))), /Invalid JSON/);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(),'morf-worker-test-'));
  try {
    const worker = createCliExecutor({ workingDirectory:cwd,apiKey:'test-key-no-secrets',executables:{grok:process.execPath} });
    assert.equal(worker.executor.working_directory,fs.realpathSync(cwd));
    await assert.rejects(worker.execute('run_cli',{cli:'claude',prompt:'read README'}),/authorized/);
    await assert.rejects(worker.execute('unknown',{}),/Unknown/);
  } finally {fs.rmSync(cwd,{recursive:true,force:true});}
  console.log('SSE truncation, errors, resume semantics and CLI authorization passed');
})().catch(error => {console.error(error);process.exit(1);});
