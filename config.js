require('dotenv').config()

module.exports = {
  jwt: process.env.JWT || '999888666AAABBBCCCDDDEEE',
  apiUrl: process.env.API_URL || 'http://localhost:9501',
  enviroment: process.env.API_ENVIRONMENT || 'dev',
  apiPort: process.env.API_PORT || 3001,
  database: {
    client: process.env.DB_TYPE || 'mssql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'api',
      password: process.env.DB_PASSWORD || 'hPM9U8xplEPO',
      database: process.env.DB_NAME || 'SGG',
      connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 60000,
      requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT) || 60000,
      pool: {
        idleTimeoutMillis: 60000,
        max: 100
      }
    }
  },
  memoise: {
    enabled: Boolean(Number(process.env.MEMOISE_ENABLED || 0))
  }
}
