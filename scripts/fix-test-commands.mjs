#!/usr/bin/env node

/**
 * Fix Test Command References
 * Updates test files to use correct command names after architectural changes
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Command mappings: old command -> new command
const commandMappings = {
  update: 'sync', // Update command was replaced by sync
  import: 'migrate', // Import command was replaced by migrate
  'hub-status': 'status', // Hub-status was merged into status
};

// Commands that were completely removed
const removedCommands = ['UpdateCommand', 'ImportCommand', 'HubStatusCommand', 'MigrateCommand'];

async function updateTestFile(filePath) {
  console.log(`Processing: ${path.relative(process.cwd(), filePath)}`);

  let content = await fs.readFile(filePath, 'utf-8');
  let modified = false;

  // Replace command references in test calls
  for (const [oldCmd, newCmd] of Object.entries(commandMappings)) {
    const patterns = [
      new RegExp(`'${oldCmd}'`, 'g'),
      new RegExp(`"${oldCmd}"`, 'g'),
      new RegExp(`\\['${oldCmd}'`, 'g'),
      new RegExp(`\\["${oldCmd}"`, 'g'),
      new RegExp(`${oldCmd} command`, 'g'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, match => {
          modified = true;
          return match.replace(oldCmd, newCmd);
        });
      }
    }
  }

  // Comment out or skip tests for removed commands
  const removePatterns = [
    /it\(['"`]should.*update command.*['"`],/g,
    /describe\(['"`].*UpdateCommand.*['"`],/g,
    /describe\(['"`].*Update Command.*['"`],/g,
  ];

  for (const pattern of removePatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, match => {
        modified = true;
        return `// DISABLED: ${match.slice(0, -1)} // Command removed`;
      });
    }
  }

  // Update test descriptions to reflect new command names
  content = content.replace(/update command/gi, match => {
    modified = true;
    return 'sync command';
  });

  content = content.replace(/Update Command/g, match => {
    modified = true;
    return 'Sync Command';
  });

  if (modified) {
    await fs.writeFile(filePath, content);
    console.log(`  ✓ Updated command references`);
  } else {
    console.log(`  - No changes needed`);
  }
}

async function main() {
  console.log('🔧 Fixing test command references...\n');

  const testDir = path.join(__dirname, 'tests');
  const testFiles = await fs.readdir(testDir, { recursive: true });

  // Filter for .js test files
  const testFilesToFix = testFiles
    .filter(file => file.endsWith('.test.js'))
    .map(file => path.join(testDir, file));

  console.log(`Found ${testFilesToFix.length} test files to check\n`);

  for (const filePath of testFilesToFix) {
    try {
      await updateTestFile(filePath);
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  }

  console.log('\n✅ Test command reference fixes completed!');
}

main().catch(console.error);
