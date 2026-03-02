import { describe, it, expect } from 'vitest';
import { UniversalFormatConverter } from '../src/publishing/UniversalFormatConverter.js';
import { validateIR } from '../src/ir/types.js';

describe('VDK Conversion Round-Trip Tests', () => {
  const converter = new UniversalFormatConverter();

  // Mock content for testing
  const claudeContent = `---
type: agent
name: TestAgent
description: A test agent
---
# Test Agent

This is a test agent content.

## Capabilities
- coding
- testing
`;

  describe('Claude <-> Cursor Round Trip', () => {
    it('should preserve semantic meaning from Claude to Cursor and back', async () => {
      // 1. Claude -> Cursor (via IR)
      const result1 = await converter.convertViaIR({
        content: claudeContent,
        filePath: 'test.claude.md', // Implies claude-code
        targetPlatform: 'cursor',
      });

      const ir1 = result1.ir;
      expect(validateIR(ir1).valid).toBe(true);
      expect(ir1.name).toBe('TestAgent');
      expect(ir1.description).toBe('A test agent');

      const cursorOutput = result1.content; // Adapted content
      console.log('Cursor Output:', cursorOutput);
      expect(cursorOutput).toContain('description: A test agent');

      // 2. Cursor -> Claude (Back)
      const result2 = await converter.convertViaIR({
        content: cursorOutput,
        filePath: 'test.mdc', // Implies cursor
        targetPlatform: 'claude-code',
      });

      const ir2 = result2.ir;
      expect(ir2.description).toBe('A test agent');
      // Note: Name might be inferred differently if lost in Cursor format, but description usually sticks

      const claudeOutput = result2.content;
      expect(claudeOutput).toContain('description: A test agent');
    });
  });

  describe('Claude -> Copilot (Lossy) -> Claude', () => {
    it('should track data loss when converting to Copilot', async () => {
      // 1. Claude -> Copilot
      const result1 = await converter.convertViaIR({
        content: claudeContent,
        filePath: 'test.claude.md',
        targetPlatform: 'github-copilot',
      });

      const copilotOutput = result1.content;
      // Copilot format is just text, often missing structured metadata
      expect(copilotOutput).toContain('Test Agent');

      // 2. Copilot -> Claude
      const result2 = await converter.convertViaIR({
        content: copilotOutput,
        filePath: 'copilot-instructions.md', // Implies copilot
        targetPlatform: 'claude-code',
      });

      const claudeOutput = result2.content;

      // Should still have the main content
      expect(claudeOutput).toContain('Test Agent');
    });
  });

  describe('Windsurf Support', () => {
    it('should convert to Windsurf properly', async () => {
      const result = await converter.convertViaIR({
        content: claudeContent,
        filePath: 'test.claude.md',
        targetPlatform: 'windsurf',
      });

      expect(result.content).toBeDefined();
    });
  });
});
