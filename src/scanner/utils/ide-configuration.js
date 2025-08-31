/**
 * IDE Configuration Module
 * -----------------------
 * @deprecated Use ../shared/ide-configuration.js instead
 * This file is kept for backward compatibility only
 */

// Re-export from the centralized configuration
export {
  detectIDEs,
  detectSpecificJetBrainsIDEs,
  ensureRuleDirectory,
  getIDEConfigById,
  getIDEConfigPaths,
  getIDEOptionsForCLI,
  IDE_CONFIGURATIONS,
} from '../../shared/ide-configuration.js'
