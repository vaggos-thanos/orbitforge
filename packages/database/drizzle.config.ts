export default {
  dialect: 'sqlite',
  driver: 'node-sqlite',
  schema: './src/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: '/var/lib/orbitforge/web/orbitforge.db',
  },
} as const
