const sqliteWarningOption = '--disable-warning=ExperimentalWarning'
const existingNodeOptions = process.env.NODE_OPTIONS?.trim()

process.env.NODE_OPTIONS = existingNodeOptions
  ? `${existingNodeOptions} ${sqliteWarningOption}`
  : sqliteWarningOption

await import('../node_modules/vitest/vitest.mjs')
