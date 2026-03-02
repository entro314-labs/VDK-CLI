import fs from 'node:fs/promises';

const target = process.argv[2] || '../VDK-Blueprints/library';
console.log(`Checking ${target} from ${process.cwd()}`);

try {
  const entries = await fs.readdir(target);
  console.log(`Found ${entries.length} entries.`);
  console.log('First 5:', entries.slice(0, 5));
} catch (e) {
  console.error('Error:', e);
}
