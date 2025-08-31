/**
 * javascript.js
 *
 * Analyzer for JavaScript code to detect naming conventions,
 * patterns, and commonly used libraries or frameworks.
 */

import * as acorn from 'acorn'

/**
 * Analyzes JavaScript code to detect naming conventions and patterns
 * @param {string} content - JavaScript code content
 * @param {string} filePath - Path to the file
 * @returns {Object} Analysis results
 */
export async function analyzeJavaScript(content, filePath) {
  const analysis = {
    variables: [],
    functions: [],
    classes: [],
    components: [],
    patterns: [],
  }

  try {
    // Parse the JavaScript file to AST
    const ast = acorn.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    })

    // Visit each node in the AST
    visitNodes(ast, {
      VariableDeclarator(node) {
        if (node.id?.name) {
          analysis.variables.push(node.id.name)
        }

        // Detect React components (capital-named variables with JSX)
        if (
          node.id?.name &&
          node.id.name[0] === node.id.name[0].toUpperCase() &&
          node.init &&
          (isReactFunctionComponent(node.init) || isReactClassComponent(node))
        ) {
          analysis.components.push(node.id.name)
          analysis.patterns.push('React Component')
        }
      },
      FunctionDeclaration(node) {
        if (node.id?.name) {
          analysis.functions.push(node.id.name)

          // Detect React components (capital-named functions)
          if (node.id.name[0] === node.id.name[0].toUpperCase() && isReactFunctionComponent(node)) {
            analysis.components.push(node.id.name)
            analysis.patterns.push('React Component')
          }
        }
      },
      ClassDeclaration(node) {
        if (node.id?.name) {
          analysis.classes.push(node.id.name)

          // Detect React class components
          if (isReactClassComponent(node)) {
            analysis.components.push(node.id.name)
            analysis.patterns.push('React Class Component')
          }
        }
      },
      ImportDeclaration(node) {
        // Detect import patterns
        if (node.source?.value) {
          const importPath = node.source.value

          // Check for common libraries/frameworks
          if (importPath === 'react') {
            analysis.patterns.push('React')
          } else if (importPath === 'react-dom') {
            analysis.patterns.push('React DOM')
          } else if (importPath === 'react-router' || importPath === 'react-router-dom') {
            analysis.patterns.push('React Router')
          } else if (importPath === 'redux' || importPath === '@reduxjs/toolkit') {
            analysis.patterns.push('Redux')
          } else if (importPath.startsWith('next')) {
            analysis.patterns.push('Next.js')
          } else if (importPath.startsWith('@nestjs')) {
            analysis.patterns.push('NestJS')
          } else if (importPath === 'express') {
            analysis.patterns.push('Express')
          } else if (importPath.startsWith('@angular')) {
            analysis.patterns.push('Angular')
          } else if (importPath === 'vue') {
            analysis.patterns.push('Vue.js')
          }
        }
      },
      ObjectExpression(node) {
        // Detect use of object methods and property types
        let objectMethodCount = 0
        let objectPropertyCount = 0

        for (const prop of node.properties) {
          if (prop.type === 'Property') {
            objectPropertyCount++
          } else if (prop.type === 'ObjectMethod' || (prop.value && prop.value.type === 'FunctionExpression')) {
            objectMethodCount++
          }
        }

        // If object has several methods, it might be a module pattern
        if (objectMethodCount > 3 && objectPropertyCount > 0) {
          analysis.patterns.push('Module Pattern')
        }
      },
      ArrowFunctionExpression(node) {
        // Look for higher-order functions and functional patterns
        if (node.body && node.body.type === 'ArrowFunctionExpression') {
          analysis.patterns.push('Higher-order Function')
        }

        // Detect React components (JSX returns)
        if (isReactFunctionComponent(node)) {
          analysis.patterns.push('Arrow Function Component')
        }
      },
    })

    // Deduplicate patterns
    analysis.patterns = [...new Set(analysis.patterns)]

    // Deduplicate names
    analysis.variables = [...new Set(analysis.variables)]
    analysis.functions = [...new Set(analysis.functions)]
    analysis.classes = [...new Set(analysis.classes)]
    analysis.components = [...new Set(analysis.components)]

    return analysis
  } catch (error) {
    // If there's a parsing error, return an empty analysis
    console.error(`Error analyzing JavaScript file: ${filePath}`)
    console.error(error.message)
    return analysis
  }
}

/**
 * Visits each node in the Abstract Syntax Tree
 * @param {Object} ast - The AST to visit
 * @param {Object} visitors - Object with visitor functions
 */
function visitNodes(ast, visitors) {
  function visit(node) {
    if (!node) {
      return
    }

    // Call appropriate visitor if exists
    if (node.type && visitors[node.type]) {
      visitors[node.type](node)
    }

    // Recursively visit children
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach((child) => {
            if (child && typeof child === 'object') {
              visit(child)
            }
          })
        } else {
          visit(node[key])
        }
      }
    }
  }

  visit(ast)
}

/**
 * Checks if a node is likely a React function component
 * @param {Object} node - AST node to check
 * @returns {boolean} True if likely a React component
 */
function isReactFunctionComponent(node) {
  return isJSXReturningFunction(node)
}

/**
 * Checks if a node is likely a React class component
 * @param {Object} node - AST node to check
 * @returns {boolean} True if likely a React class component
 */
function isReactClassComponent(node) {
  // Check for class extends React.Component or Component
  if (node.superClass) {
    if (node.superClass.name === 'Component') {
      return true
    }

    if (
      node.superClass.object &&
      node.superClass.object.name === 'React' &&
      node.superClass.property &&
      node.superClass.property.name === 'Component'
    ) {
      return true
    }
  }

  // Or check for render() method that returns JSX
  if (node.body?.body) {
    const renderMethod = node.body.body.find((n) => n.type === 'MethodDefinition' && n.key && n.key.name === 'render')

    if (renderMethod) {
      return true
    }
  }

  return false
}

/**
 * Checks if a function returns JSX
 * @param {Object} node - AST node to check
 * @returns {boolean} True if the function returns JSX
 */
function isJSXReturningFunction(node) {
  if (!node) {
    return false
  }

  // Check if return statement contains JSX
  if (node.body) {
    if (node.body.type === 'JSXElement' || node.body.type === 'JSXFragment') {
      return true
    }

    if (node.body.body) {
      const returnStatement = node.body.body.find((n) => n.type === 'ReturnStatement')
      if (returnStatement?.argument) {
        return returnStatement.argument.type === 'JSXElement' || returnStatement.argument.type === 'JSXFragment'
      }
    }
  }

  return false
}
