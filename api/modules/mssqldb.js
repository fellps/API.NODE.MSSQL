import config from '../../config'

import sql from 'mssql'

const mssqlConfig = {
  server: config.database.connection.host, // You can use 'localhost\\instance' to connect to named instance
  database: config.database.connection.database,
  user: config.database.connection.user,
  password: config.database.connection.password,
  connectionTimeout: config.database.connection.connectionTimeout,
  requestTimeout: config.database.connection.requestTimeout,
  pool: {
    max: 100,
    min: 10,
    idleTimeoutMillis: 3000
  },
  options: {
    appName: 'mssqldb-sgg'
  }
}

const mssqlPoolPromise = new sql.ConnectionPool(mssqlConfig)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL')
    return pool
  })
  .catch(err => {
    return console.log('Database Connection Failed! Bad Config: ', err)
  })

export {
  sql,
  mssqlPoolPromise
}
