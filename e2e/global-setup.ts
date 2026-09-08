import { Client } from 'pg'
import { postgres } from './e2e.config'

// zgloszenia z poprzedniego uruchomienia psulyby asercje na liscie
export default async function globalSetup() {
  const client = new Client({ ...postgres })
  await client.connect()

  try {
    await client.query('delete from tickets')
  } finally {
    await client.end()
  }
}
