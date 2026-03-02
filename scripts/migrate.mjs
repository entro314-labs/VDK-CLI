import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const logFile = 'migration.log';
async function log(msg) {
  await fs.appendFile(logFile, `${msg}\n`);
}

async function migrate() {
  await fs.writeFile(logFile, 'Starting migration...\n');

  const libraryPath = process.argv[2];
  await log(`Target: ${libraryPath}`);
  await log(`CWD: ${process.cwd()}`);

  try {
    const files = await findMdcFiles(libraryPath);
    await log(`Found ${files.length} files.`);

    for (const filePath of files) {
      await log(`Migrating ${filePath}`);
      await migrateFile(filePath);
    }
    await log('Done.');
  } catch (error) {
    await log(`Fatal error: ${error.stack}`);
  }
}

async function findMdcFiles(dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await findMdcFiles(fullPath)));
      } else if (entry.name.endsWith('.mdc')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    await log(`Error reading dir ${dir}: ${e.message}`);
  }
  return files;
}

async function migrateFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = matter(content);
    const data = parsed.data;

    if (data.schemaVersion === '3.0') {
      await log(`Skipping ${filePath} (already v3.0)`);
      return;
    }

    data.schemaVersion = '3.0';

    if (data.platforms) {
      const newPlatforms = {};

      if (data.platforms['claude-code']) {
        const old = data.platforms['claude-code'];
        newPlatforms['claude-code'] = {
          enabled: true,
          components: {
            main: { type: 'claude-main', enabled: old.memory !== false, location: 'CLAUDE.md' },
            commands: {
              type: 'claude-command',
              enabled: old.command !== false,
              manifests: old.allowedTools ? [{ allowedTools: old.allowedTools }] : [],
            },
          },
        };
      }

      // Copy other logic roughly...
      if (data.platforms.cursor) {
        const old = data.platforms.cursor;
        newPlatforms.cursor = {
          enabled: true,
          components: {
            rules: {
              type: 'cursor-rule',
              enabled: old.compatible !== false,
              format: 'mdc',
              manifests: [
                {
                  globs: old.globs || [],
                  activation: old.activation,
                },
              ],
            },
          },
        };
      }

      if (data.platforms.windsurf) {
        const old = data.platforms.windsurf;
        newPlatforms.windsurf = {
          enabled: true,
          components: {
            rules: {
              type: 'windsurf-rule',
              enabled: old.compatible !== false,
              manifests: [
                {
                  mode: old.mode === 'workspace' ? 'always' : 'glob',
                  globs: old.globs || [],
                },
              ],
            },
          },
        };
      }

      data.platforms = newPlatforms;
    }

    const newContent = matter.stringify(parsed.content, data);
    await fs.writeFile(filePath, newContent);
    await log(`Updated ${filePath}`);
  } catch (e) {
    await log(`Error processing ${filePath}: ${e.message}`);
  }
}

migrate();
