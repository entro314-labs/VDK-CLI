import fs from 'node:fs';
console.log('Starting debug');
fs.writeFileSync('debug.txt', 'hello world');
console.log('Finished debug');
