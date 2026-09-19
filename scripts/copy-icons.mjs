// Copies node icons into dist so n8n can serve them (replaces the gulp task from the starter template).
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/nodes/TypeSafe', { recursive: true });
cpSync('nodes/TypeSafe/typesafe.svg', 'dist/nodes/TypeSafe/typesafe.svg');
console.log('icons copied');
