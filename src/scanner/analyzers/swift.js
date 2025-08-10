/**
 * swift.js
 *
 * Analyzer for Swift code to detect naming conventions,
 * patterns, and commonly used Swift frameworks/libraries.
 */

/**
 * Analyzes Swift code to detect naming conventions and patterns
 * @param {string} content - Swift code content
 * @param {string} filePath - Path to the file
 * @returns {Object} Analysis results
 */
export async function analyzeSwift(content, filePath) {
  const analysis = {
    variables: [],
    functions: [],
    classes: [],
    structs: [],
    protocols: [],
    patterns: [],
  }

  try {
    // Parse function definitions
    const functionPattern = /func\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
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

    // Parse struct definitions
    const structPattern = /struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    while ((match = structPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.structs.push(match[1])
      }
    }

    // Parse protocol definitions
    const protocolPattern = /protocol\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    while ((match = protocolPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.protocols.push(match[1])
      }
    }

    // Parse variable/property definitions (simplified)
    const varPattern = /(?:var|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    while ((match = varPattern.exec(content)) !== null) {
      if (match[1]) {
        analysis.variables.push(match[1])
      }
    }

    // Detect Swift patterns and frameworks
    detectSwiftPatterns(content, analysis)
    detectSwiftFrameworks(content, analysis)

    // Deduplicate
    analysis.variables = [...new Set(analysis.variables)]
    analysis.functions = [...new Set(analysis.functions)]
    analysis.classes = [...new Set(analysis.classes)]
    analysis.structs = [...new Set(analysis.structs)]
    analysis.protocols = [...new Set(analysis.protocols)]
    analysis.patterns = [...new Set(analysis.patterns)]

    return analysis
  } catch (error) {
    console.error(`Error analyzing Swift file: ${filePath}`)
    console.error(error.message)
    return analysis
  }
}

/**
 * Detects Swift coding patterns
 * @param {string} content - Swift code content
 * @param {Object} analysis - Analysis results to update
 */
function detectSwiftPatterns(content, analysis) {
  // Detect Swift UI patterns
  if (content.includes('import SwiftUI')) {
    analysis.patterns.push('SwiftUI')

    // SwiftUI specific patterns
    if (content.includes('NavigationStack')) {
      analysis.patterns.push('SwiftUI NavigationStack')
    }

    if (content.includes('NavigationView')) {
      analysis.patterns.push('SwiftUI NavigationView')
    }

    if (content.includes('View') && content.includes('body')) {
      analysis.patterns.push('SwiftUI View Protocol')
    }

    // SwiftUI Property Wrappers
    if (content.includes('@State')) {
      analysis.patterns.push('SwiftUI @State')
    }
    if (content.includes('@Binding')) {
      analysis.patterns.push('SwiftUI @Binding')
    }
    if (content.includes('@ObservedObject')) {
      analysis.patterns.push('SwiftUI @ObservedObject')
    }
    if (content.includes('@EnvironmentObject')) {
      analysis.patterns.push('SwiftUI @EnvironmentObject')
    }
    if (content.includes('@StateObject')) {
      analysis.patterns.push('SwiftUI @StateObject')
    }
  }

  // Detect Combine patterns
  if (content.includes('import Combine')) {
    analysis.patterns.push('Combine')

    if (content.includes('Publisher') || content.includes('Subscriber')) {
      analysis.patterns.push('Combine Publisher/Subscriber')
    }

    if (content.includes('sink(')) {
      analysis.patterns.push('Combine sink')
    }
  }

  // Detect Concurrency patterns
  if (content.includes('async') || content.includes('await')) {
    analysis.patterns.push('Swift Concurrency')
  }

  if (content.includes('Task {')) {
    analysis.patterns.push('Swift Async Task')
  }

  // Detect Swift Data
  if (content.includes('import SwiftData')) {
    analysis.patterns.push('SwiftData')

    if (content.includes('@Model')) {
      analysis.patterns.push('SwiftData @Model')
    }
  }

  // Detect Swift syntax features
  if (content.includes('guard let') || content.includes('guard var')) {
    analysis.patterns.push('Guard Statement')
  }

  if (content.includes('if let') || content.includes('if var')) {
    analysis.patterns.push('Optional Binding')
  }

  if (content.match(/\?\./)) {
    analysis.patterns.push('Optional Chaining')
  }

  if (content.includes('extension ')) {
    analysis.patterns.push('Extensions')
  }

  if (content.includes('enum ')) {
    analysis.patterns.push('Enumerations')
  }

  // Detect protocol-oriented programming
  if (
    content.match(/protocol [\s\S]*?extension.*?implements/i) ||
    (content.includes('protocol') && content.includes('extension'))
  ) {
    analysis.patterns.push('Protocol-Oriented Programming')
  }

  // Detect generics
  if (content.includes('<') && content.includes('>') && content.includes('where ')) {
    analysis.patterns.push('Generic Constraints')
  } else if (content.match(/<[^>]+>/)) {
    analysis.patterns.push('Generics')
  }

  // Detect closures
  if (content.includes('{') && content.includes('in ')) {
    analysis.patterns.push('Closures')
  }

  // Detect result builders
  if (content.includes('@resultBuilder') || content.includes('some View')) {
    analysis.patterns.push('Result Builders')
  }
}

/**
 * Detects Swift frameworks from imports
 * @param {string} content - Swift code content
 * @param {Object} analysis - Analysis results to update
 */
function detectSwiftFrameworks(content, analysis) {
  // UIKit and related
  if (content.includes('import UIKit')) {
    analysis.patterns.push('UIKit')

    if (content.includes('UIViewController')) {
      analysis.patterns.push('UIViewController')
    }

    if (content.includes('UITableView')) {
      analysis.patterns.push('UITableView')
    }

    if (content.includes('UICollectionView')) {
      analysis.patterns.push('UICollectionView')
    }
  }

  // Foundation
  if (content.includes('import Foundation')) {
    analysis.patterns.push('Foundation')
  }

  // Core Data
  if (content.includes('import CoreData')) {
    analysis.patterns.push('CoreData')

    if (content.includes('NSManagedObject')) {
      analysis.patterns.push('NSManagedObject')
    }
  }

  // Other common frameworks
  const frameworkMap = {
    CoreLocation: 'CoreLocation',
    MapKit: 'MapKit',
    CoreBluetooth: 'CoreBluetooth',
    AVFoundation: 'AVFoundation',
    CoreML: 'CoreML',
    CloudKit: 'CloudKit',
    ARKit: 'ARKit',
    HealthKit: 'HealthKit',
    StoreKit: 'StoreKit',
    SpriteKit: 'SpriteKit',
    SceneKit: 'SceneKit',
    WebKit: 'WebKit',
  }

  for (const [framework, pattern] of Object.entries(frameworkMap)) {
    if (content.includes(`import ${framework}`)) {
      analysis.patterns.push(pattern)
    }
  }

  // Third-party frameworks
  if (content.includes('import Alamofire')) {
    analysis.patterns.push('Alamofire')
  }

  if (content.includes('import SnapKit')) {
    analysis.patterns.push('SnapKit')
  }

  if (content.includes('import Kingfisher')) {
    analysis.patterns.push('Kingfisher')
  }

  if (content.includes('import RxSwift')) {
    analysis.patterns.push('RxSwift')
  }
}
