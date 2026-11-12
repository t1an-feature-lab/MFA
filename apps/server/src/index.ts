import { serve } from '@hono/node-server'
import { app } from './app.js'
import { initializeDatabase } from './db.js'

await initializeDatabase()

serve({ fetch: app.fetch, port: 3100 }, ({ port }) => {
  console.log(`Server is running at http://localhost:${port}`)
})
