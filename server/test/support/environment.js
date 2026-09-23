import path from 'node:path'
import dotenv from 'dotenv'

// Do not inherit .env.local: its Redis endpoint may be a development/shared DB.
export function configureTestEnvironment(env = process.env) {
  const required = [
    'TEST_DB_HOST', 'TEST_DB_PORT', 'TEST_DB_USER', 'TEST_DB_PASSWORD',
    'TEST_REDIS_HOST', 'TEST_REDIS_PORT', 'TEST_REDIS_PASSWORD',
  ]
  const missing = required.filter((key) => !env[key]?.trim())
  if (env.TEST_ALLOW_RESET !== 'aura_test' || missing.length) {
    throw new Error(
      `Unsafe test environment: set TEST_ALLOW_RESET=aura_test and all TEST_DB_*/TEST_REDIS_* settings in server/.env.test.local. Missing: ${missing.join(', ') || 'reset consent'}. See server/test/README.md.`
    )
  }
  for (const key of ['TEST_DB_PORT', 'TEST_REDIS_PORT']) {
    const port = Number(env[key])
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid ${key}: expected a TCP port`)
    }
  }
  // Explicit test settings override shell-level business settings, not vice versa.
  Object.assign(env, {
    NODE_ENV: 'test',
    DB_HOST: env.TEST_DB_HOST,
    DB_PORT: env.TEST_DB_PORT,
    DB_NAME: 'aura_test',
    DB_USER: env.TEST_DB_USER,
    DB_PASSWORD: env.TEST_DB_PASSWORD,
    REDIS_ENABLED: 'true',
    REDIS_HOST: env.TEST_REDIS_HOST,
    REDIS_PORT: env.TEST_REDIS_PORT,
    REDIS_PASSWORD: env.TEST_REDIS_PASSWORD,
    JWT_SECRET: 'aura-isolated-integration-tests-only',
  })
}

export function loadTestEnvironment() {
  dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env.test.local'), quiet: true })
  configureTestEnvironment()
}
