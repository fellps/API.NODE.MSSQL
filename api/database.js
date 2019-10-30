import { mssqlPoolPromise } from './modules/mssqldb'

//const log = require('./modules/LogManager')()

let Knex = void (0)
let ModelManager = void (0)

try {
  // Setting database connection to the database query builder (Knex)
  Knex = require('knex')({ client: 'mssql' })

  Knex.raw2 = Knex.raw

  Knex.raw = async query => {
    const mssqlPool = await mssqlPoolPromise
    const queryResult = await mssqlPool.request().query([query])
    return queryResult.recordset
  }

  ModelManager = require('./modules/ModelManager')(Knex)
} catch (err) {
  console.log(err)
  //log.Error('Database - Ocorreu um erro no serviço!', err)
}

export {
  Knex,
  ModelManager
}
