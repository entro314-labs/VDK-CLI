/**
 * typescript.js
 *
 * Analyzer for TypeScript code to detect naming conventions,
 * patterns, interfaces, types, and commonly used libraries or frameworks.
 *
 * REFACTORED: Now uses proper AST parsing instead of regex fallback
 */

import * as acorn from 'acorn'
import { TypeScriptParser } from '../utils/typescript-parser.js'
import { analyzeJavaScript } from './javascript.js'

/**
 * Strip TypeScript type annotations to make content parseable by Acorn
 * @param {string} content - TypeScript content
 * @returns {string} Content with type annotations removed
 */
function stripTypeScriptAnnotations(content) {
  let stripped = content

  // Remove type annotations from variable declarations
  stripped = stripped.replace(/:\s*[A-Za-z_][A-Za-z0-9_<>[\]|&.,\s]*(?=\s*[=;,)])/g, '')

  // Remove function return type annotations
  stripped = stripped.replace(/\):\s*[A-Za-z_][A-Za-z0-9_<>[\]|&.,\s]*(?=\s*[{=>])/g, ')')

  // Remove interface declarations (but keep the identifier for analysis)
  stripped = stripped.replace(/interface\s+([A-Za-z_][A-Za-z0-9_]*)\s*{[^}]*}/g, 'const $1 = {}')

  // Remove type declarations (but keep the identifier for analysis)
  stripped = stripped.replace(/type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^;]+;/g, 'const $1 = {}')

  // Remove enum declarations (but keep the identifier for analysis)
  stripped = stripped.replace(/enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*{[^}]*}/g, 'const $1 = {}')

  // Remove type parameters from class/function declarations
  stripped = stripped.replace(/<[^>]*>/g, '')

  // Remove decorators
  stripped = stripped.replace(/@[A-Za-z_][A-Za-z0-9_]*\([^)]*\)\s*/g, '')
  stripped = stripped.replace(/@[A-Za-z_][A-Za-z0-9_]*\s+/g, '')

  // Remove 'as' type assertions
  stripped = stripped.replace(/\s+as\s+[A-Za-z_][A-Za-z0-9_<>[\]|&.,\s]*/g, '')

  // Remove 'is' type predicates from function parameters
  stripped = stripped.replace(/:\s*\w+\s+is\s+[A-Za-z_][A-Za-z0-9_<>[\]|&.,\s]*/g, '')

  // Remove accessibility modifiers
  stripped = stripped.replace(/\b(private|protected|public|readonly)\s+/g, '')

  // Remove optional chaining operators that might confuse the parser
  stripped = stripped.replace(/\?\./g, '.')

  // Remove nullish coalescing that might not be supported in older Acorn
  stripped = stripped.replace(/\?\?/g, '||')

  return stripped
}

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

    // Extract TypeScript-specific constructs before stripping annotations
    const tsSpecificAnalysis = extractTypeScriptConstructs(content)

    // Strip TypeScript annotations to make it parseable by Acorn
    const strippedContent = stripTypeScriptAnnotations(content)

    // Use JavaScript analyzer on stripped content for AST-based analysis
    let jsAnalysis
    try {
      jsAnalysis = await analyzeJavaScript(strippedContent, filePath)
    } catch (astError) {
      // If AST parsing fails, fall back to regex-based analysis
      console.warn(`AST parsing failed for ${filePath}, using regex fallback: ${astError.message}`)
      jsAnalysis = performRegexAnalysis(content)
    }

    // Combine JavaScript analysis with TypeScript-specific analysis
    const tsAnalysis = {
      ...jsAnalysis,
      interfaces: tsSpecificAnalysis.interfaces || [],
      types: tsSpecificAnalysis.types || [],
      enums: tsSpecificAnalysis.enums || [],
      decorators: tsSpecificAnalysis.decorators || [],
      patterns: [...(jsAnalysis.patterns || []), ...(tsSpecificAnalysis.patterns || [])],
    }

    // Deduplicate all arrays
    tsAnalysis.patterns = [...new Set(tsAnalysis.patterns)]
    tsAnalysis.interfaces = [...new Set(tsAnalysis.interfaces)]
    tsAnalysis.types = [...new Set(tsAnalysis.types)]
    tsAnalysis.enums = [...new Set(tsAnalysis.enums)]
    tsAnalysis.decorators = [...new Set(tsAnalysis.decorators)]

    return tsAnalysis
  } catch (error) {
    console.error(`Error analyzing TypeScript file: ${filePath}`)
    console.error(error.message)
    // Return empty analysis on complete failure
    return {
      variables: [],
      functions: [],
      classes: [],
      components: [],
      interfaces: [],
      types: [],
      enums: [],
      decorators: [],
      patterns: [],
    }
  }
}

/**
 * Extract TypeScript-specific constructs using regex patterns
 * @param {string} content - TypeScript content
 * @returns {Object} TypeScript-specific analysis
 */
function extractTypeScriptConstructs(content) {
  const analysis = {
    interfaces: [],
    types: [],
    enums: [],
    decorators: [],
    patterns: [],
  }

  try {
    // Extract interfaces
    const interfacePattern = /interface\s+([A-Za-z_][A-Za-z0-9_]*)/g
    let match
    while ((match = interfacePattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.interfaces.push(match[1])
      }
    }

    // Extract type aliases
    const typePattern = /type\s+([A-Za-z_][A-Za-z0-9_]*)/g
    while ((match = typePattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.types.push(match[1])
      }
    }

    // Extract enums
    const enumPattern = /enum\s+([A-Za-z_][A-Za-z0-9_]*)/g
    while ((match = enumPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.enums.push(match[1])
      }
    }

    // Extract decorators
    const decoratorPattern = /@([A-Za-z_][A-Za-z0-9_]*)/g
    while ((match = decoratorPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.decorators.push(match[1])
      }
    }

    // Detect framework patterns based on decorators
    if (content.includes('@Component') || content.includes('@NgModule') || content.includes('@Injectable')) {
      analysis.patterns.push('Angular Decorators')
    }

    if (content.includes('@Controller') || content.includes('@Injectable') || content.includes('@Module')) {
      analysis.patterns.push('NestJS Decorators')
    }

    if (content.includes('@Entity') || content.includes('@Column') || content.includes('@Repository')) {
      analysis.patterns.push('TypeORM')
    }

    // Detect advanced TypeScript patterns
    const genericPattern = /<[^>]+>/g
    const genericMatches = content.match(genericPattern) || []
    if (genericMatches.length > 5) {
      analysis.patterns.push('Heavy Generic Usage')
    }

    if (content.includes(' is ') && content.includes('function') && content.includes(': boolean')) {
      analysis.patterns.push('Type Guards')
    }

    if (
      content.includes('Partial<') ||
      content.includes('Readonly<') ||
      content.includes('Record<') ||
      content.includes('Pick<') ||
      content.includes('Omit<')
    ) {
      analysis.patterns.push('Utility Types')
    }

    if (
      (content.includes('React.FC') || content.includes('FC<') || content.includes(': React.FC')) &&
      (content.includes('interface') || content.includes('type'))
    ) {
      analysis.patterns.push('React with TypeScript')
    }

    if (content.includes('keyof') || content.includes('in keyof')) {
      analysis.patterns.push('Mapped Types')
    }

    if (content.includes('abstract class') || content.includes('abstract ')) {
      analysis.patterns.push('Abstract Classes')
    }

    if (content.includes('readonly ') || content.includes('Readonly<')) {
      analysis.patterns.push('Readonly Properties')
    }
  } catch (error) {
    console.warn(`Error extracting TypeScript constructs: ${error.message}`)
  }

  return analysis
}

/**
 * Fallback regex-based analysis when AST parsing fails
 * @param {string} content - TypeScript content
 * @returns {Object} Basic analysis using regex patterns
 */
function performRegexAnalysis(content) {
  const analysis = {
    variables: [],
    functions: [],
    classes: [],
    components: [],
    patterns: [],
  }

  try {
    // Extract variable declarations
    const varPattern = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
    let match
    while ((match = varPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.variables.push(match[1])
      }
    }

    // Extract function declarations
    const funcPattern =
      /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>))/g
    while ((match = funcPattern.exec(content)) !== null) {
      const funcName = match[1] || match[2]
      if (funcName) {
        analysis.functions.push(funcName)
      }
    }

    // Extract class declarations
    const classPattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
    while ((match = classPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.classes.push(match[1])
      }
    }

    // Extract React components
    const componentPattern = /(?:const|let|var|function)\s+([A-Z][a-zA-Z0-9_$]*)/g
    while ((match = componentPattern.exec(content)) !== null) {
      if (match[1] && (content.includes('JSX.Element') || content.includes('React.FC') || content.includes('</'))) {
        analysis.components.push(match[1])
      }
    }

    // Detect common patterns
    if (content.includes('useState') || content.includes('useEffect')) {
      analysis.patterns.push('React Hooks')
    }
    if (content.includes('async ') || content.includes('await ')) {
      analysis.patterns.push('Async/Await')
    }
  } catch (error) {
    console.warn(`Regex analysis failed: ${error.message}`)
  }

  return analysis
}
