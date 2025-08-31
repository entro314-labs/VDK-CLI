/**
 * typescript.js
 *
 * Analyzer for TypeScript code to detect naming conventions,
 * patterns, interfaces, types, and commonly used libraries or frameworks.
 */

import { TypeScriptParser } from '../utils/typescript-parser.js'
import { analyzeJavaScript } from './javascript.js'

/**
 * Analyzes TypeScript code to detect naming conventions and patterns
 * @param {string} content - TypeScript code content
 * @param {string} filePath - Path to the file
 * @returns {Object} Analysis results
 */
export async function analyzeTypeScript(content, filePath) {
  try {
    // First check if this is definitely a TypeScript file
    const isTypeScriptFile = TypeScriptParser.isTypeScriptFile(filePath)

    if (!isTypeScriptFile) {
      // If it's not a TypeScript file, just use the JavaScript analyzer
      return await analyzeJavaScript(content, filePath)
    }

    // For TypeScript files, use regex-based parsing instead of AST parsing
    // This avoids the issue with acorn parser not understanding TypeScript syntax
    const jsAnalysis = {
      variables: [],
      functions: [],
      classes: [],
      components: [],
      patterns: [],
    }

    // Use regex patterns to extract TypeScript constructs safely
    try {
      // Extract variable declarations
      const varPattern = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
      let match
      while ((match = varPattern.exec(content)) !== null) {
        if (match[1]) {
          jsAnalysis.variables.push(match[1])
        }
      }

      // Extract function declarations
      const funcPattern =
        /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*:\s*[^=]*\s*=>))/g
      while ((match = funcPattern.exec(content)) !== null) {
        const funcName = match[1] || match[2]
        if (funcName) {
          jsAnalysis.functions.push(funcName)
        }
      }

      // Extract class declarations
      const classPattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
      while ((match = classPattern.exec(content)) !== null) {
        if (match[1]) {
          jsAnalysis.classes.push(match[1])
        }
      }

      // Extract React components (functional components)
      const componentPattern = /(?:const|let|var|function)\s+([A-Z][a-zA-Z0-9_$]*)/g
      while ((match = componentPattern.exec(content)) !== null) {
        if (match[1] && (content.includes('JSX.Element') || content.includes('React.FC') || content.includes('</'))) {
          jsAnalysis.components.push(match[1])
        }
      }

      // Detect common patterns
      if (content.includes('useState') || content.includes('useEffect')) {
        jsAnalysis.patterns.push('React Hooks')
      }
      if (content.includes('async/await') || content.includes('async ')) {
        jsAnalysis.patterns.push('Async/Await')
      }
    } catch (regexError) {
      // If regex parsing fails, just continue with empty analysis
      console.warn(`Warning: Regex parsing failed for ${filePath}: ${regexError.message}`)
    }

    // Extend with TypeScript-specific analysis
    const tsAnalysis = {
      ...jsAnalysis,
      interfaces: [],
      types: [],
      // Additional TypeScript patterns
      patterns: [...(jsAnalysis.patterns || [])],
    }

    // Simple regex-based detection for TypeScript features
    // This is a simplified approach - a proper TS parser would be better
    // but would increase complexity significantly

    // Detect interfaces
    const interfacePattern = /interface\s+([A-Za-z0-9_]+)/g
    let match
    while ((match = interfacePattern.exec(content)) !== null) {
      if (match[1]) {
        tsAnalysis.interfaces.push(match[1])
      }
    }

    // Detect type aliases
    const typePattern = /type\s+([A-Za-z0-9_]+)/g
    while ((match = typePattern.exec(content)) !== null) {
      if (match[1]) {
        tsAnalysis.types.push(match[1])
      }
    }

    // Detect decorators (Angular patterns)
    if (content.includes('@Component') || content.includes('@NgModule') || content.includes('@Injectable')) {
      tsAnalysis.patterns.push('Angular Decorators')
    }

    // Detect NestJS patterns
    if (content.includes('@Controller') || content.includes('@Injectable') || content.includes('@Module')) {
      tsAnalysis.patterns.push('NestJS Decorators')
    }

    // Detect TypeORM patterns
    if (content.includes('@Entity') || content.includes('@Column') || content.includes('@Repository')) {
      tsAnalysis.patterns.push('TypeORM')
    }

    // Detect functional patterns
    const genericPattern = /<[^>]+>/g
    const genericMatches = content.match(genericPattern) || []
    if (genericMatches.length > 5) {
      tsAnalysis.patterns.push('Heavy Generic Usage')
    }

    // Check for type guards
    if (content.includes(' is ') && content.includes('function') && content.includes(': boolean')) {
      tsAnalysis.patterns.push('Type Guards')
    }

    // Look for utility types
    if (
      content.includes('Partial<') ||
      content.includes('Readonly<') ||
      content.includes('Record<') ||
      content.includes('Pick<') ||
      content.includes('Omit<')
    ) {
      tsAnalysis.patterns.push('Utility Types')
    }

    // Look for React with TypeScript patterns
    if (
      (content.includes('React.FC') || content.includes('FC<') || content.includes(': React.FC')) &&
      (content.includes('interface') || content.includes('type'))
    ) {
      tsAnalysis.patterns.push('React with TypeScript')
    }

    // Check for mapped types
    if (content.includes('keyof') || content.includes('in keyof')) {
      tsAnalysis.patterns.push('Mapped Types')
    }

    // Deduplicate patterns and names
    tsAnalysis.patterns = [...new Set(tsAnalysis.patterns)]
    tsAnalysis.interfaces = [...new Set(tsAnalysis.interfaces)]
    tsAnalysis.types = [...new Set(tsAnalysis.types)]

    return tsAnalysis
  } catch (error) {
    console.error(`Error analyzing TypeScript file: ${filePath}`)
    console.error(error.message)
    return {
      variables: [],
      functions: [],
      classes: [],
      components: [],
      interfaces: [],
      types: [],
      patterns: [],
    }
  }
}
