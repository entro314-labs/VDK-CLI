/**
 * Realistic IDE/AI Combination Tests
 * Tests real-world scenarios with accurate IDE and AI tool combinations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Realistic IDE/AI Scenarios', () => {
  let tempDir
  let originalCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = path.join(__dirname, 'temp', `realistic-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('Next.js + Supabase + Claude Code CLI', () => {
    it('should generate appropriate Claude Code CLI configuration for Next.js Supabase project', async () => {
      await setupNextjsSupabaseProject(tempDir)

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Detected.*Claude Code CLI/)
      expect(result.stdout).toMatch(/Next\.js/)
      expect(result.stdout).toMatch(/Supabase/)

      // Verify Claude Code CLI specific files
      const claudeConfig = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).toContain('Next.js + Supabase Full-Stack Application')
      expect(claudeConfig).toContain('Supabase')
      expect(claudeConfig).toContain('TypeScript')

      // Check for appropriate slash commands
      const commandsExist = await fs.readdir(path.join(tempDir, '.claude', 'commands')).catch(() => [])
      expect(commandsExist.length).toBeGreaterThan(0)

      // Verify Next.js specific commands exist
      const commands = await Promise.all(
        commandsExist.map(async (cmd) => ({
          name: cmd,
          content: await fs.readFile(path.join(tempDir, '.claude', 'commands', cmd), 'utf-8'),
        }))
      )

      const hasNextjsCommand = commands.some(
        (cmd) => cmd.content.toLowerCase().includes('next.js') || cmd.content.toLowerCase().includes('app router')
      )
      expect(hasNextjsCommand).toBe(true)
    })
  })

  describe('React Native + Cursor', () => {
    it('should generate Cursor rules for React Native project', async () => {
      await setupReactNativeProject(tempDir)
      await simulateCursorEnvironment(tempDir)

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Detected.*Cursor/)
      expect(result.stdout).toMatch(/React Native/)

      // Verify Cursor-specific rules file
      const cursorRules = await fs.readFile(path.join(tempDir, '.cursorrules'), 'utf-8')
      expect(cursorRules).toContain('React Native')
      expect(cursorRules).toContain('Expo')
      expect(cursorRules).toContain('Mobile development')
      expect(cursorRules).toContain('iOS')
      expect(cursorRules).toContain('Android')

      // Should NOT contain web-specific patterns
      expect(cursorRules).not.toContain('Next.js')
      expect(cursorRules).not.toContain('DOM manipulation')
    })
  })

  describe('Astro + Windsurf', () => {
    it('should generate Windsurf configuration for Astro project', async () => {
      await setupAstroProject(tempDir)
      await simulateWindsurfEnvironment(tempDir)

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Detected.*Windsurf/)
      expect(result.stdout).toMatch(/Astro/)

      // Verify Windsurf workspace configuration
      const windsurfConfig = await fs.readFile(path.join(tempDir, '.windsurf', 'rules.md'), 'utf-8')
      expect(windsurfConfig).toContain('Astro')
      expect(windsurfConfig).toContain('Static site generation')
      expect(windsurfConfig).toContain('Content collections')
      expect(windsurfConfig).toContain('Islands architecture')
    })
  })

  describe('Enterprise Node.js + VS Code + GitHub Copilot', () => {
    it('should generate appropriate config for VS Code with GitHub Copilot', async () => {
      await setupEnterpriseNodejsProject(tempDir)
      await simulateVSCodeCopilotEnvironment(tempDir)

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Detected.*VS Code/)
      expect(result.stdout).toMatch(/GitHub Copilot/)
      expect(result.stdout).toMatch(/Express\.js/)

      // Verify VS Code workspace settings
      const vscodeSettings = JSON.parse(await fs.readFile(path.join(tempDir, '.vscode', 'settings.json'), 'utf-8'))
      expect(vscodeSettings).toHaveProperty('github.copilot.enable')
      expect(vscodeSettings['github.copilot.enable']).toBe(true)

      // Verify GitHub Copilot compatible prompts (shorter, focused)
      const copilotPrompts = await fs.readFile(path.join(tempDir, '.github', 'copilot-instructions.md'), 'utf-8')
      expect(copilotPrompts).toContain('Node.js')
      expect(copilotPrompts).toContain('Express')
      expect(copilotPrompts.length).toBeLessThan(2000) // Copilot prefers shorter instructions
    })
  })

  describe('Python FastAPI + JetBrains + JetBrains AI', () => {
    it('should generate JetBrains AI configuration for FastAPI project', async () => {
      await setupFastAPIProject(tempDir)
      await simulateJetBrainsEnvironment(tempDir)

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Detected.*JetBrains/)
      expect(result.stdout).toMatch(/FastAPI/)
      expect(result.stdout).toMatch(/Python/)

      // Verify JetBrains specific configuration
      const ideaConfig = await fs.readdir(path.join(tempDir, '.idea'))
      expect(ideaConfig).toContain('vcs.xml')
      expect(ideaConfig).toContain('modules.xml')

      // Verify AI Assistant prompts for JetBrains
      const aiPrompts = await fs.readFile(path.join(tempDir, '.idea', 'ai-assistant-prompts.md'), 'utf-8')
      expect(aiPrompts).toContain('FastAPI')
      expect(aiPrompts).toContain('Python')
      expect(aiPrompts).toContain('Pydantic')
      expect(aiPrompts).toContain('SQLAlchemy')
    })
  })

  describe('Multi-IDE Team Scenario', () => {
    it('should handle team with different IDE preferences gracefully', async () => {
      await setupMixedTeamProject(tempDir)

      const result = await runCliCommand(['init', '--team-mode', '--detect-all'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Multiple IDEs detected/)
      expect(result.stdout).toMatch(/Claude Code CLI/)
      expect(result.stdout).toMatch(/Cursor/)
      expect(result.stdout).toMatch(/VS Code/)

      // Should generate configurations for all detected IDEs
      const claudeExists = await fs
        .access(path.join(tempDir, 'CLAUDE.md'))
        .then(() => true)
        .catch(() => false)
      const cursorExists = await fs
        .access(path.join(tempDir, '.cursorrules'))
        .then(() => true)
        .catch(() => false)
      const vscodeExists = await fs
        .access(path.join(tempDir, '.vscode', 'settings.json'))
        .then(() => true)
        .catch(() => false)

      expect(claudeExists).toBe(true)
      expect(cursorExists).toBe(true)
      expect(vscodeExists).toBe(true)

      // Verify team harmony - consistent code style across configs
      const claudeConfig = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8')
      const cursorConfig = await fs.readFile(path.join(tempDir, '.cursorrules'), 'utf-8')

      // Both should mention same indentation preference
      expect(claudeConfig).toContain('2-space indentation')
      expect(cursorConfig).toContain('2 spaces')
    })
  })

  describe('IDE Detection Accuracy', () => {
    it('should correctly distinguish between similar IDE configurations', async () => {
      // Create ambiguous scenario - both Cursor and VS Code files present
      await setupAmbiguousIDEProject(tempDir)

      const result = await runCliCommand(['init', '--auto-detect', '--verbose'])

      expect(result.exitCode).toBe(0)

      // Should detect the more actively used IDE based on file timestamps and content
      if (result.stdout.includes('Primary IDE: Cursor')) {
        expect(result.stdout).toMatch(/Cursor.*high confidence/)
        expect(result.stdout).toMatch(/VS Code.*medium confidence/)
      } else {
        expect(result.stdout).toMatch(/VS Code.*high confidence/)
        expect(result.stdout).toMatch(/Cursor.*medium confidence/)
      }
    })

    it('should handle IDE without AI assistant separately', async () => {
      await setupPlainVSCodeProject(tempDir) // VS Code without Copilot

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/VS Code.*detected/)
      expect(result.stdout).not.toMatch(/GitHub Copilot/)
      expect(result.stdout).not.toMatch(/AI assistant/)

      // Should generate generic IDE configuration without AI-specific features
      const vscodeSettings = JSON.parse(await fs.readFile(path.join(tempDir, '.vscode', 'settings.json'), 'utf-8'))
      expect(vscodeSettings).not.toHaveProperty('github.copilot.enable')
      expect(vscodeSettings).toHaveProperty('editor.formatOnSave')
    })
  })

  describe('Project Type Detection Accuracy', () => {
    it('should correctly identify Astro Starlight documentation site', async () => {
      await setupAstroStarlightProject(tempDir)

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)

      const claudeConfig = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).toContain('Astro Starlight Documentation Site')
      expect(claudeConfig).not.toContain('React Application') // Should be specific, not generic
    })

    it('should distinguish between React and Next.js projects', async () => {
      await setupPlainReactProject(tempDir) // React without Next.js

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)

      const claudeConfig = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).toContain('React Application')
      expect(claudeConfig).not.toContain('Next.js')
    })
  })
})

// Realistic project setup helpers

async function setupNextjsSupabaseProject(tempDir) {
  // Next.js with Supabase
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'nextjs-supabase-app',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          '@supabase/supabase-js': '^2.38.0',
          '@supabase/auth-helpers-nextjs': '^0.8.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/react': '^18.0.0',
        },
      },
      null,
      2
    )
  )

  await fs.writeFile(
    path.join(tempDir, 'next.config.js'),
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}
module.exports = nextConfig`
  )

  await fs.writeFile(
    path.join(tempDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'es6'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2
    )
  )

  // Create app directory structure (Next.js 13+ App Router)
  await fs.mkdir(path.join(tempDir, 'src', 'app'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, 'src', 'app', 'page.tsx'),
    `export default function Page() {
  return <div>Next.js + Supabase App</div>
}`
  )

  // Supabase configuration
  await fs.writeFile(
    path.join(tempDir, '.env.local.example'),
    `NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`
  )

  // Claude Code CLI is standalone, doesn't need special files to be detected
}

async function setupReactNativeProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'react-native-app',
        version: '0.0.1',
        private: true,
        scripts: {
          android: 'react-native run-android',
          ios: 'react-native run-ios',
          start: 'react-native start',
        },
        dependencies: {
          react: '18.2.0',
          'react-native': '0.72.0',
          '@react-navigation/native': '^6.1.0',
          expo: '~49.0.0',
        },
        devDependencies: {
          '@babel/core': '^7.20.0',
          '@babel/preset-env': '^7.20.0',
          '@types/react': '^18.0.0',
        },
      },
      null,
      2
    )
  )

  await fs.writeFile(
    path.join(tempDir, 'app.json'),
    JSON.stringify(
      {
        expo: {
          name: 'ReactNativeApp',
          slug: 'react-native-app',
          version: '1.0.0',
          platforms: ['ios', 'android'],
        },
      },
      null,
      2
    )
  )

  await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, 'src', 'App.tsx'),
    `import React from 'react';
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>React Native App</Text>
    </View>
  );
}`
  )
}

async function simulateCursorEnvironment(tempDir) {
  // Cursor creates .cursor directory and cursor-specific files
  await fs.mkdir(path.join(tempDir, '.cursor'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, '.cursor', 'settings.json'),
    JSON.stringify(
      {
        'cursor.chat.enabled': true,
        'cursor.cpp.disabledLanguages': [],
      },
      null,
      2
    )
  )
}

async function setupAstroProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'astro-site',
        type: 'module',
        version: '0.0.1',
        scripts: {
          dev: 'astro dev',
          start: 'astro dev',
          build: 'astro build',
          preview: 'astro preview',
        },
        dependencies: {
          astro: '^4.0.0',
          '@astrojs/tailwind': '^5.0.0',
        },
      },
      null,
      2
    )
  )

  await fs.writeFile(
    path.join(tempDir, 'astro.config.mjs'),
    `import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
});`
  )

  await fs.mkdir(path.join(tempDir, 'src', 'pages'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, 'src', 'pages', 'index.astro'),
    `---
title: "Astro Site"
---
<html lang="en">
  <head>
    <title>{title}</title>
  </head>
  <body>
    <h1>Welcome to Astro</h1>
  </body>
</html>`
  )
}

async function simulateWindsurfEnvironment(tempDir) {
  await fs.mkdir(path.join(tempDir, '.windsurf'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, '.windsurf', 'settings.json'),
    JSON.stringify(
      {
        'windsurf.ai.enabled': true,
        'windsurf.chat.model': 'claude-3-sonnet',
      },
      null,
      2
    )
  )
}

async function setupEnterpriseNodejsProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'enterprise-api',
        version: '1.0.0',
        scripts: {
          start: 'node dist/server.js',
          dev: 'nodemon src/server.ts',
          build: 'tsc',
          test: 'jest',
        },
        dependencies: {
          express: '^4.18.0',
          helmet: '^7.0.0',
          cors: '^2.8.5',
          dotenv: '^16.0.0',
          winston: '^3.8.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/express': '^4.17.0',
          '@types/node': '^20.0.0',
          nodemon: '^3.0.0',
          jest: '^29.0.0',
        },
      },
      null,
      2
    )
  )

  await fs.writeFile(
    path.join(tempDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
      },
      null,
      2
    )
  )

  await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, 'src', 'server.ts'),
    `import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
  )
}

async function simulateVSCodeCopilotEnvironment(tempDir) {
  await fs.mkdir(path.join(tempDir, '.vscode'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, '.vscode', 'settings.json'),
    JSON.stringify(
      {
        'github.copilot.enable': {
          '*': true,
          yaml: false,
          plaintext: false,
        },
        'editor.formatOnSave': true,
        'editor.codeActionsOnSave': {
          'source.organizeImports': true,
        },
      },
      null,
      2
    )
  )

  await fs.writeFile(
    path.join(tempDir, '.vscode', 'extensions.json'),
    JSON.stringify(
      {
        recommendations: ['github.copilot', 'github.copilot-chat', 'ms-vscode.vscode-typescript-next'],
      },
      null,
      2
    )
  )
}

async function setupFastAPIProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'requirements.txt'),
    `fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
sqlalchemy==2.0.23
alembic==1.13.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6`
  )

  await fs.writeFile(
    path.join(tempDir, 'pyproject.toml'),
    `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "fastapi-enterprise"
version = "0.1.0"
description = "Enterprise FastAPI Application"
dependencies = [
    "fastapi>=0.104.1",
    "uvicorn[standard]>=0.24.0",
    "pydantic>=2.5.0"
]`
  )

  await fs.mkdir(path.join(tempDir, 'app'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, 'app', 'main.py'),
    `from fastapi import FastAPI, Depends
from pydantic import BaseModel

app = FastAPI(title="Enterprise API", version="1.0.0")

class Item(BaseModel):
    name: str
    description: str = None
    price: float
    tax: float = None

@app.get("/")
async def root():
    return {"message": "Enterprise FastAPI"}

@app.post("/items/", response_model=Item)
async def create_item(item: Item):
    return item`
  )

  await fs.writeFile(path.join(tempDir, 'app', '__init__.py'), '')
}

async function simulateJetBrainsEnvironment(tempDir) {
  await fs.mkdir(path.join(tempDir, '.idea'), { recursive: true })

  await fs.writeFile(
    path.join(tempDir, '.idea', 'modules.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectModuleManager">
    <modules>
      <module fileurl="file://$PROJECT_DIR$/.idea/fastapi-project.iml" filepath="$PROJECT_DIR$/.idea/fastapi-project.iml" />
    </modules>
  </component>
</project>`
  )

  await fs.writeFile(
    path.join(tempDir, '.idea', 'vcs.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="VcsDirectoryMappings">
    <mapping directory="$PROJECT_DIR$" vcs="Git" />
  </component>
</project>`
  )

  await fs.writeFile(
    path.join(tempDir, '.idea', 'fastapi-project.iml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<module type="PYTHON_MODULE" version="4">
  <component name="NewModuleRootManager">
    <content url="file://$MODULE_DIR$" />
    <orderEntry type="inheritedJdk" />
    <orderEntry type="sourceFolder" forTests="false" />
  </component>
</module>`
  )
}

async function setupMixedTeamProject(tempDir) {
  // Create evidence of multiple IDE usage
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'team-project',
        scripts: { dev: 'next dev', build: 'next build' },
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
      },
      null,
      2
    )
  )

  // VS Code user
  await fs.mkdir(path.join(tempDir, '.vscode'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, '.vscode', 'settings.json'),
    JSON.stringify(
      {
        'editor.tabSize': 2,
        'editor.insertSpaces': true,
      },
      null,
      2
    )
  )

  // Cursor user
  await fs.mkdir(path.join(tempDir, '.cursor'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, '.cursor', 'settings.json'),
    JSON.stringify(
      {
        'cursor.chat.enabled': true,
      },
      null,
      2
    )
  )

  // Claude Code user would be detected by running environment, not files

  // Prettier config shows team agreed on consistent formatting
  await fs.writeFile(
    path.join(tempDir, '.prettierrc'),
    JSON.stringify(
      {
        semi: true,
        trailingComma: 'es5',
        singleQuote: true,
        printWidth: 80,
        tabWidth: 2,
      },
      null,
      2
    )
  )
}

async function setupAmbiguousIDEProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'ambiguous-project',
        dependencies: { react: '^18.0.0' },
      },
      null,
      2
    )
  )

  // Both VS Code and Cursor files present
  await fs.mkdir(path.join(tempDir, '.vscode'), { recursive: true })
  await fs.mkdir(path.join(tempDir, '.cursor'), { recursive: true })

  // But one is more recent/active (simulate real usage)
  const now = new Date()
  const oldTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

  await fs.writeFile(path.join(tempDir, '.vscode', 'settings.json'), '{"editor.tabSize": 2}')
  await fs.writeFile(path.join(tempDir, '.cursor', 'settings.json'), '{"cursor.chat.enabled": true}')

  // Make cursor files newer (more actively used)
  await fs.utimes(path.join(tempDir, '.vscode', 'settings.json'), oldTime, oldTime)
  await fs.utimes(path.join(tempDir, '.cursor', 'settings.json'), now, now)
}

async function setupPlainVSCodeProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'vscode-only-project',
        dependencies: { express: '^4.18.0' },
      },
      null,
      2
    )
  )

  await fs.mkdir(path.join(tempDir, '.vscode'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, '.vscode', 'settings.json'),
    JSON.stringify(
      {
        'editor.formatOnSave': true,
        'editor.tabSize': 2,
        // Notably NO Copilot settings
      },
      null,
      2
    )
  )

  // Extensions file without Copilot
  await fs.writeFile(
    path.join(tempDir, '.vscode', 'extensions.json'),
    JSON.stringify(
      {
        recommendations: [
          'ms-vscode.vscode-typescript-next',
          'esbenp.prettier-vscode',
          // No Copilot extensions
        ],
      },
      null,
      2
    )
  )
}

async function setupAstroStarlightProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'docs-site',
        type: 'module',
        scripts: {
          dev: 'astro dev',
          build: 'astro build',
        },
        dependencies: {
          astro: '^4.0.0',
          '@astrojs/starlight': '^0.15.0',
        },
      },
      null,
      2
    )
  )

  await fs.writeFile(
    path.join(tempDir, 'astro.config.mjs'),
    `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      sidebar: [
        {
          label: 'Guides',
          items: [{ label: 'Example Guide', link: '/guides/example/' }],
        }
      ]
    })
  ]
});`
  )

  await fs.mkdir(path.join(tempDir, 'src', 'content', 'docs', 'guides'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, 'src', 'content', 'docs', 'guides', 'example.md'),
    `---
title: Example Guide
description: A guide in my new Starlight docs site.
---
This is documentation content.`
  )
}

async function setupPlainReactProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'react-app',
        scripts: {
          start: 'react-scripts start',
          build: 'react-scripts build',
        },
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
          'react-scripts': '^5.0.0',
          // Notably NO Next.js
        },
      },
      null,
      2
    )
  )

  await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, 'src', 'App.js'),
    `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>React App</h1>
    </div>
  );
}

export default App;`
  )

  await fs.writeFile(
    path.join(tempDir, 'public', 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
  )
}

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli-new.js')

  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout,
        stderr,
      })
    })

    // Timeout for tests
    setTimeout(() => {
      child.kill('SIGTERM')
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTest timeout (60s)',
      })
    }, 60000)
  })
}
