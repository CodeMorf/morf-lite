import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Genera index.mjs que envuelve dist/index.js para compatibilidad dual ESM
const esmContent = `import cjs from './index.js';
export default cjs.default || cjs;
export const MorfClient = cjs.MorfClient;
export const Morf = cjs.Morf;
export const MorfSession = cjs.MorfSession;
export const MorfError = cjs.MorfError;
export const parseEventStream = cjs.parseEventStream;
`;

fs.writeFileSync(path.join(distDir, 'index.mjs'), esmContent, 'utf-8');
console.log('✅ index.mjs dual-export generated successfully.');
