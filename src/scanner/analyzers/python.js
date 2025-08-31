/**
 * python.js
 *
 * Analyzer for Python code to detect naming conventions,
 * patterns, and commonly used libraries or frameworks.
 */

/**
 * Analyzes Python code to detect naming conventions and patterns
 * @param {string} content - Python code content
 * @param {string} filePath - Path to the file
 * @returns {Object} Analysis results
 */
export async function analyzePython(content, filePath) {
  const analysis = {
    variables: [],
    functions: [],
    classes: [],
    patterns: [],
  }

  try {
    // Parse function definitions
    const functionPattern = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    let match
    while ((match = functionPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.functions.push(match[1])
      }
    }

    // Parse class definitions
    const classPattern = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    while ((match = classPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.classes.push(match[1])
      }
    }

    // Variable assignments (simplified approach)
    const variablePattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm
    while ((match = variablePattern.exec(content)) !== null) {
      if (match[1] && !['if', 'for', 'while', 'def', 'class'].includes(match[1])) {
        analysis.variables.push(match[1])
      }
    }

    // Detect imports and patterns
    detectPythonFrameworks(content, analysis)
    detectPythonLibraries(content, analysis)
    detectPythonPatterns(content, analysis)

    // Deduplicate
    analysis.variables = [...new Set(analysis.variables)]
    analysis.functions = [...new Set(analysis.functions)]
    analysis.classes = [...new Set(analysis.classes)]
    analysis.patterns = [...new Set(analysis.patterns)]

    return analysis
  } catch (error) {
    console.error(`Error analyzing Python file: ${filePath}`)
    console.error(error.message)
    return analysis
  }
}

/**
 * Detects Python frameworks from imports
 * @param {string} content - Python code content
 * @param {Object} analysis - Analysis results to update
 */
function detectPythonFrameworks(content, analysis) {
  // Check for Django patterns
  if (
    content.includes('import django') ||
    content.includes('from django') ||
    content.includes('urls.py') ||
    content.includes('models.py') ||
    content.includes('views.py')
  ) {
    analysis.patterns.push('Django')
  }

  // Check for Flask patterns
  if (content.includes('from flask import') || content.includes('Flask(__name__)')) {
    analysis.patterns.push('Flask')
  }

  // Check for FastAPI patterns
  if (content.includes('from fastapi import') || content.includes('FastAPI(')) {
    analysis.patterns.push('FastAPI')
  }

  // Check for Pyramid patterns
  if (content.includes('from pyramid.') || content.includes('config.add_route')) {
    analysis.patterns.push('Pyramid')
  }

  // Check for SQLAlchemy patterns
  if (content.includes('import sqlalchemy') || content.includes('from sqlalchemy')) {
    analysis.patterns.push('SQLAlchemy')
  }
}

/**
 * Detects Python libraries from imports
 * @param {string} content - Python code content
 * @param {Object} analysis - Analysis results to update
 */
function detectPythonLibraries(content, analysis) {
  // Common data science libraries
  if (content.includes('import pandas') || content.includes('from pandas')) {
    analysis.patterns.push('Pandas')
  }

  if (content.includes('import numpy') || content.includes('from numpy')) {
    analysis.patterns.push('NumPy')
  }

  if (content.includes('import matplotlib') || content.includes('from matplotlib')) {
    analysis.patterns.push('Matplotlib')
  }

  if (content.includes('import tensorflow') || content.includes('from tensorflow')) {
    analysis.patterns.push('TensorFlow')
  }

  if (content.includes('import torch') || content.includes('from torch')) {
    analysis.patterns.push('PyTorch')
  }

  if (content.includes('import sklearn') || content.includes('from sklearn')) {
    analysis.patterns.push('Scikit-learn')
  }

  // Web libraries
  if (content.includes('import requests') || content.includes('from requests')) {
    analysis.patterns.push('Requests')
  }

  if (content.includes('import aiohttp') || content.includes('from aiohttp')) {
    analysis.patterns.push('AIOHTTP')
  }

  // Testing libraries
  if (content.includes('import pytest') || content.includes('from pytest')) {
    analysis.patterns.push('Pytest')
  }

  if (content.includes('import unittest') || content.includes('from unittest')) {
    analysis.patterns.push('Unittest')
  }
}

/**
 * Detects Python coding patterns
 * @param {string} content - Python code content
 * @param {Object} analysis - Analysis results to update
 */
function detectPythonPatterns(content, analysis) {
  // Detect Python version via features
  if (content.includes('async def') || content.includes('await ')) {
    analysis.patterns.push('Async/Await (Python 3.5+)')
  }

  if (content.includes('f"') || content.includes("f'")) {
    analysis.patterns.push('F-strings (Python 3.6+)')
  }

  if (content.includes(': ') && content.includes(' -> ')) {
    analysis.patterns.push('Type Hints (Python 3.5+)')
  }

  // OOP patterns
  if (content.includes('class') && content.includes('__init__')) {
    analysis.patterns.push('Object-Oriented Programming')
  }

  // Functional patterns
  let functionalCount = 0
  if (content.includes('lambda ')) {
    functionalCount++
  }
  if (content.includes('map(')) {
    functionalCount++
  }
  if (content.includes('filter(')) {
    functionalCount++
  }
  if (content.includes('reduce(')) {
    functionalCount++
  }
  if (
    content.includes('list comprehension') ||
    (content.includes('[') && content.includes('for') && content.includes('in') && content.includes(']'))
  ) {
    functionalCount++
  }

  if (functionalCount >= 2) {
    analysis.patterns.push('Functional Programming')
  }

  // Decorator usage
  if (content.includes('@')) {
    analysis.patterns.push('Decorators')
  }

  // Context managers
  if (content.includes('with ') && content.includes('as ')) {
    analysis.patterns.push('Context Managers')
  }

  // Data classes (Python 3.7+)
  if (content.includes('@dataclass') || content.includes('from dataclasses import dataclass')) {
    analysis.patterns.push('Data Classes (Python 3.7+)')
  }
}
