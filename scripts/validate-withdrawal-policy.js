// Scans each plugin's schema.prisma + schema.user.prisma for models referencing
// User.id and verifies that the plugin's withdrawal-policy.ts declares every
// such model. Also validates the core (prisma/schema.base.prisma).
// Exits with non-zero status on any undeclared reference.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const PLUGINS_DIR = path.join(ROOT, 'src', 'plugins')
const CORE_SCHEMA = path.join(ROOT, 'prisma', 'schema.base.prisma')
const CORE_POLICY = path.join(ROOT, 'src', 'lib', 'core-withdrawal-policy.ts')

// Parse Prisma schema text; return an array of model names that reference User.
//
// A model "references User" if its body contains any of:
//   1. An explicit Prisma relation field typed `User`, `User?`, or `User[]`:
//        someField  User  @relation(...)
//        someField  User? @relation(...)
//        someField  User[] @relation(...)  (back-relation, unusual on the FK side)
//   2. A bare scalar FK named `userId`:
//        userId  Int      -- present in PendingOrder which has no @relation decorator
//        userId  Int?
//
// This is a pragmatic regex-based parser; it matches all conventions used across
// this codebase. An AST-level parser would be overkill for these consistent schemas.
function parseModelsWithUserRefs(text) {
  const modelRegex = /model\s+(\w+)\s*{([^}]*)}/gs
  const results = []
  let match
  while ((match = modelRegex.exec(text)) !== null) {
    const name = match[1]
    const body = match[2]

    // Rule 1: explicit relation field — field type is User, User?, or User[]
    // Matches: `  user  User @relation(...)`, `  author  User? @relation(...)`, etc.
    const hasRelationField = /\bUser[?[]?\s*@relation\b/.test(body) || /\bUser\[\]/.test(body)

    // Rule 2: bare FK scalar named userId (with or without ?)
    // Matches: `  userId  Int`, `  userId  Int?`
    const hasBareUserId = /\buserId\s+Int\b/.test(body)

    if (hasRelationField || hasBareUserId) {
      results.push({ name })
    }
  }
  return results
}

function evalPolicyFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const m = content.match(/export\s+default\s+/)
  if (!m) {
    console.error(`[withdrawal-validator] ${filePath}: no 'export default' found`)
    process.exit(1)
  }
  const arrayStr = content.slice(m.index + m[0].length).trim()
  try {
    return (new Function('return ' + arrayStr))()
  } catch (e) {
    console.error(`[withdrawal-validator] Failed to parse ${filePath}: ${e.message}`)
    process.exit(1)
  }
}

function validateSource(label, schemaText, policyEntries) {
  const declaredModels = new Set(policyEntries.map(e => e.model))
  const missing = []
  for (const { name } of parseModelsWithUserRefs(schemaText)) {
    if (name === 'User') continue  // User itself is the referenced model, not a referencer
    if (!declaredModels.has(name)) missing.push(name)
  }
  return missing
}

function main() {
  const errors = []

  // --- Core ---
  const coreSchemaText = fs.readFileSync(CORE_SCHEMA, 'utf-8')
  const corePolicy = evalPolicyFile(CORE_POLICY)
  const coreMissing = validateSource('core', coreSchemaText, corePolicy)
  for (const m of coreMissing) {
    errors.push(`core: model '${m}' references User but is not declared in src/lib/core-withdrawal-policy.ts`)
  }

  // --- Plugins ---
  const plugins = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => e.name)

  for (const folder of plugins) {
    const policyPath = path.join(PLUGINS_DIR, folder, 'withdrawal-policy.ts')
    if (!fs.existsSync(policyPath)) {
      errors.push(`${folder}: missing withdrawal-policy.ts`)
      continue
    }
    const policy = evalPolicyFile(policyPath)
    let combined = ''
    const schemaPath = path.join(PLUGINS_DIR, folder, 'schema.prisma')
    const userSchemaPath = path.join(PLUGINS_DIR, folder, 'schema.user.prisma')
    if (fs.existsSync(schemaPath)) combined += fs.readFileSync(schemaPath, 'utf-8') + '\n'
    if (fs.existsSync(userSchemaPath)) combined += fs.readFileSync(userSchemaPath, 'utf-8') + '\n'
    if (!combined.trim()) continue

    const missing = validateSource(folder, combined, policy)
    for (const m of missing) {
      errors.push(`${folder}: model '${m}' references User but is not declared in src/plugins/${folder}/withdrawal-policy.ts`)
    }
  }

  if (errors.length > 0) {
    console.error('')
    console.error('[withdrawal-validator] Build failed — undeclared User references:')
    for (const e of errors) console.error('  ✗ ' + e)
    console.error('')
    console.error('Every model that has a User relation must declare a withdrawal policy.')
    console.error('See docs/superpowers/specs/2026-04-23-user-withdrawal-design.md §2.')
    process.exit(1)
  }

  const totalSourceCount = plugins.length + 1  // +1 for core
  console.log(`[withdrawal-validator] ✓ Checked ${totalSourceCount} source(s); all User references declared`)
}

main()
