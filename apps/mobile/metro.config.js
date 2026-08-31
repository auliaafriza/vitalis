const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Metro configuration for an npm-workspaces monorepo.
 *
 * Two changes are required and both are easy to get wrong:
 *   1. watchFolders must include the repo root, or edits to @vitalis/core
 *      never trigger a reload.
 *   2. nodeModulesPaths must list the app's own node_modules *first*, so a
 *      hoisted duplicate of React can never be resolved twice — the classic
 *      "Invalid hook call" in a React Native monorepo.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// NOTE: do NOT set `disableHierarchicalLookup`. npm nests a package inside
// node_modules/<pkg>/node_modules whenever versions conflict (expo bundles its
// own expo-modules-core this way), and disabling hierarchical lookup makes
// Metro unable to find it. That flag is for pnpm-style layouts, not npm.

module.exports = config;
