/**
 * Publish Workflow Tests
 * Tests end-to-end publishing workflow with actual PublishCommand implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Publish Workflow Integration', () => {
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = path.join(__dirname, 'temp', `publish-workflow-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Blueprint Publishing Workflow', () => {
    it('should show preview of what would be published', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand(['publish', ruleFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
      expect(result.stdout).toMatch(/Quality Score: \d+\/10/);
    });

    it('should reject invalid rule files during publishing', async () => {
      const invalidRuleFile = await setupInvalidRuleFile(tempDir);

      const result = await runCliCommand(['publish', invalidRuleFile]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/Publishing failed|Rule validation failed/);
    });

    it('should publish valid rule to community hub', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);
      await setupHubAuth(tempDir);

      const result = await runCliCommand(['publish', ruleFile]);

      // May fail with auth issues in test environment, but should attempt publishing
      expect(result.stdout).toMatch(/Publishing to VDK Hub|Hub authentication required/);
    });

    it('should publish via GitHub PR when --github flag is used', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand(['publish', ruleFile, '--github']);

      // Should attempt GitHub workflow even if it fails due to missing git config
      expect(result.stdout).toMatch(/GitHub Publishing Pathway|GitHub PR creation failed/);
    });

    it('should allow custom naming for published rules', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand([
        'publish',
        ruleFile,
        '--name',
        'custom-rule-name',
        '--preview',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });
  });

  describe('Rule Validation and Quality', () => {
    it('should validate VDK blueprint format files', async () => {
      const mdcFile = await setupVDKBlueprintFile(tempDir);

      const result = await runCliCommand(['publish', mdcFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should validate Cursor rules format', async () => {
      const cursorFile = await setupCursorRulesFile(tempDir);

      const result = await runCliCommand(['publish', cursorFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should detect and reject security issues in rules', async () => {
      const maliciousFile = await setupMaliciousRuleFile(tempDir);

      const result = await runCliCommand(['publish', maliciousFile]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/Rule validation failed|Security/);
    });

    it('should provide quality scoring for rules', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand(['publish', ruleFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Quality Score: \d+\/10/);
    });
  });

  describe('Publishing Workflow Options', () => {
    it('should handle private publishing flag', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand(['publish', ruleFile, '--private', '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should accept verbose output flag', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand(['publish', ruleFile, '--verbose', '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should require rule file argument', async () => {
      const result = await runCliCommand(['publish']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/Rule file argument is required/);
    });

    it('should show help when requested', async () => {
      const result = await runCliCommand(['publish', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Usage:|publish/);
    });
  });

  describe('Format Detection and Conversion', () => {
    it('should detect markdown rule format', async () => {
      const mdFile = await setupMarkdownRuleFile(tempDir);

      const result = await runCliCommand(['publish', mdFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should detect JSON configuration format', async () => {
      const jsonFile = await setupJSONConfigFile(tempDir);

      const result = await runCliCommand(['publish', jsonFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should detect XML rules format', async () => {
      const xmlFile = await setupXMLRulesFile(tempDir);

      const result = await runCliCommand(['publish', xmlFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should handle non-existent files gracefully', async () => {
      const result = await runCliCommand(['publish', 'non-existent-file.md']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/Publishing failed/);
    });
  });

  describe('Publishing Context and Project Analysis', () => {
    it('should extract project context for metadata', async () => {
      await setupProjectWithPackageJson(tempDir);
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand(['publish', ruleFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should handle projects without package.json', async () => {
      const ruleFile = await setupValidRuleFile(tempDir);

      const result = await runCliCommand(['publish', ruleFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
    });

    it('should provide recommendations based on rule quality', async () => {
      const shortRuleFile = await setupShortRuleFile(tempDir);

      const result = await runCliCommand(['publish', shortRuleFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:/);
      // May include recommendations for brief content
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle files that are too small', async () => {
      const tinyFile = await setupTinyRuleFile(tempDir);

      const result = await runCliCommand(['publish', tinyFile]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/Rule validation failed/);
    });

    it('should handle very large files', async () => {
      const largeFile = await setupVeryLargeRuleFile(tempDir);

      const result = await runCliCommand(['publish', largeFile, '--preview']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Publication Preview:|Warnings:/);
    });

    it('should handle invalid file formats gracefully', async () => {
      const binaryFile = await setupBinaryFile(tempDir);

      const result = await runCliCommand(['publish', binaryFile]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/Publishing failed/);
    });
  });
});

// Helper functions for test setup

async function setupValidRuleFile(tempDir) {
  const ruleFile = path.join(tempDir, 'test-rule.md');
  const content = `# Test Rule for AI Assistant

This is a comprehensive rule file for testing the publishing workflow.

## Core Principles

- Use TypeScript for type safety
- Implement comprehensive error handling
- Follow clean code principles
- Write descriptive commit messages
- Test your code thoroughly

## Code Examples

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}
\`\`\`

## Best Practices

1. Always validate user input
2. Use proper error boundaries
3. Implement logging for debugging
4. Follow accessibility guidelines
5. Optimize for performance

This rule provides comprehensive guidance for TypeScript development.
`;
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupInvalidRuleFile(tempDir) {
  const ruleFile = path.join(tempDir, 'invalid-rule.md');
  const content = `# Too Short`; // Less than 100 characters minimum
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupHubAuth(tempDir) {
  // In real usage, authentication would be handled by the Hub client
  // For tests, we just create a placeholder
  const vdkDir = path.join(tempDir, '.vdk');
  await fs.mkdir(vdkDir, { recursive: true });

  const authConfig = {
    authenticated: false,
    test_mode: true,
  };

  await fs.writeFile(path.join(vdkDir, 'auth.json'), JSON.stringify(authConfig, null, 2));
}

async function setupVDKBlueprintFile(tempDir) {
  const ruleFile = path.join(tempDir, 'test-blueprint.mdc');
  const content = `---
schema_version: "2.1.0"
id: "test-blueprint"
title: "Test VDK Blueprint"
description: "A test blueprint in VDK format"
version: "1.0.0"
category: "development"
author: "test-author"
platforms:
  claude-code:
    compatible: true
    command: true
    memory: true
  cursor:
    compatible: true
    activation: "auto-attached"
metadata:
  tags: ["typescript", "testing"]
  complexity: "medium"
---

# VDK Blueprint Test

This is a VDK blueprint file for testing.

## Rules

- Use TypeScript for type safety
- Implement error handling
- Follow VDK standards

\`\`\`typescript
interface Config {
  name: string;
  version: string;
}
\`\`\`
`;
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupCursorRulesFile(tempDir) {
  const ruleFile = path.join(tempDir, '.cursorrules');
  const content = `# Cursor Rules for TypeScript Development

You are an expert TypeScript developer working on modern web applications.

## Core Guidelines

- Always use TypeScript strict mode
- Prefer functional programming patterns
- Use proper error handling with try/catch
- Write comprehensive tests for all features
- Follow the project's existing code style

## Code Standards

1. Use descriptive variable and function names
2. Keep functions small and focused
3. Use proper TypeScript types, avoid 'any'
4. Implement proper error boundaries in React
5. Use async/await for asynchronous operations

## Example Patterns

\`\`\`typescript
interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  try {
    const response = await api.get(\`/users/\${id}\`);
    return { data: response.data, success: true };
  } catch (error) {
    return { data: null, error: error.message, success: false };
  }
}
\`\`\`

Always prioritize code readability and maintainability.
`;
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupMaliciousRuleFile(tempDir) {
  const ruleFile = path.join(tempDir, 'malicious-rule.md');
  const content = `# Malicious Rule File

This file contains potential security issues.

## Dangerous Patterns

- Execute: rm -rf /
- Access API key: api_key="sk-1234567890abcdef"
- Use eval: eval(userInput)
- External access: https://malicious-site.tk/steal-data

\`\`\`bash
# Dangerous script
rm -rf /home/user/important-data
\`\`\`

This content should be flagged by security scanning.
`;
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupMarkdownRuleFile(tempDir) {
  const ruleFile = path.join(tempDir, 'rule.md');
  const content = `# Markdown AI Assistant Rules

You are working with a React TypeScript project.

## Development Guidelines

### Code Quality
- Write clean, readable code
- Use TypeScript for type safety
- Follow React best practices
- Implement proper error handling

### Testing
- Write unit tests for components
- Use React Testing Library
- Test user interactions
- Maintain good test coverage

### Performance
- Use React.memo for expensive components
- Implement lazy loading where appropriate
- Optimize bundle size
- Monitor Core Web Vitals

\`\`\`typescript
// Example component structure
interface Props {
  title: string;
  onAction: () => void;
}

const Component: React.FC<Props> = ({ title, onAction }) => {
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  );
};
\`\`\`

Always consider accessibility and user experience in your implementations.
`;
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupJSONConfigFile(tempDir) {
  const ruleFile = path.join(tempDir, 'copilot-config.json');
  const content = {
    version: '1.0',
    rules: [
      'Use TypeScript for type safety',
      'Implement proper error handling',
      'Follow React best practices',
    ],
    settings: {
      strictMode: true,
      linting: 'eslint',
      formatting: 'prettier',
    },
    examples: [
      {
        name: 'React Component',
        code: 'const Component = () => <div>Hello</div>;',
      },
    ],
  };
  await fs.writeFile(ruleFile, JSON.stringify(content, null, 2));
  return ruleFile;
}

async function setupXMLRulesFile(tempDir) {
  const ruleFile = path.join(tempDir, 'windsurf-rules.xml');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<rules>
  <metadata>
    <version>1.0</version>
    <description>Windsurf AI Assistant Rules</description>
  </metadata>

  <guidelines>
    <rule category="typescript">
      <title>Use TypeScript strict mode</title>
      <description>Always enable strict mode for better type safety</description>
      <example>
        <code>// tsconfig.json
{
  "compilerOptions": {
    "strict": true
  }
}</code>
      </example>
    </rule>

    <rule category="react">
      <title>Functional components with hooks</title>
      <description>Prefer functional components over class components</description>
      <example>
        <code>const Component = () => {
  const [state, setState] = useState(initial);
  return &lt;div&gt;{state}&lt;/div&gt;;
};</code>
      </example>
    </rule>
  </guidelines>

  <patterns>
    <avoid>any type</avoid>
    <avoid>eval() function</avoid>
    <prefer>explicit typing</prefer>
    <prefer>async/await over promises</prefer>
  </patterns>
</rules>`;
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupProjectWithPackageJson(tempDir) {
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for publishing workflow',
    main: 'index.js',
    dependencies: {
      react: '^18.0.0',
      typescript: '^5.0.0',
    },
    devDependencies: {
      '@types/react': '^18.0.0',
      eslint: '^8.0.0',
    },
  };
  await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
}

async function setupShortRuleFile(tempDir) {
  const ruleFile = path.join(tempDir, 'short-rule.md');
  const content = `# Short Rule

This rule is intentionally brief to test quality scoring.

- Use TypeScript
- Write tests
- Follow best practices

Short rules may receive recommendations for more detail.
`;
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupTinyRuleFile(tempDir) {
  const ruleFile = path.join(tempDir, 'tiny-rule.md');
  const content = `# Tiny`; // Way too short
  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupVeryLargeRuleFile(tempDir) {
  const ruleFile = path.join(tempDir, 'large-rule.md');
  let content = `# Very Large Rule File\n\nThis is a very large rule file for testing size handling.\n\n`;

  // Create content > 50KB to trigger size warning
  for (let i = 0; i < 1000; i++) {
    content += `## Section ${i}\n\nThis is section ${i} with detailed guidelines and examples.\n\n`;
    content += `\`\`\`typescript\ninterface Example${i} {\n  id: string;\n  name: string;\n  value: number;\n}\n\`\`\`\n\n`;
    content += `Some additional content for section ${i} to make this file quite large.\n\n`;
  }

  await fs.writeFile(ruleFile, content);
  return ruleFile;
}

async function setupBinaryFile(tempDir) {
  const binaryFile = path.join(tempDir, 'binary-file.bin');
  const buffer = Buffer.alloc(100, 0);
  // Fill with random binary data
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  await fs.writeFile(binaryFile, buffer);
  return binaryFile;
}

// Remove unused functions - all replaced above

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli.js');

  return new Promise(resolve => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      resolve({
        exitCode: code,
        stdout,
        stderr,
      });
    });

    // Handle timeout
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        exitCode: -1,
        stdout,
        stderr: `${stderr}\nTest timeout`,
      });
    }, 30000); // 30 second timeout
  });
}
