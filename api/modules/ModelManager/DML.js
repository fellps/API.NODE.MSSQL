import memoise from '../../helpers/memoise'

import sha1 from 'sha1'

import { mssqlPoolPromise } from '../../modules/mssqldb'
import config from '../../../config.js'

import _ from 'lodash'

const moment = require('moment-timezone')

/**
 * DmlBase constructor.
 */
const DML = function () {
  let memoiseMode = 0
  let benchmark = config.benchmark
  let request = { path: '' }
  let memoiseData = memoise('DML')
  const instance = {
    execute: async (query) => {
      const querySha = sha1(query)

      if (memoiseMode) {
        const resultMemoise = await memoiseData.get(querySha)
        if (resultMemoise) return resultMemoise
      }

      const startDate = new Date()
      const displayBenchmark = benchmark === 2 || (benchmark === 1 && request)

      let fullpath = ''

      if (request && request.path) {
        if (request.internalPath) {
          fullpath = ` - ${request.path} - ${request.internalPath.Event}.${request.internalPath.Method}`
        } else {
          fullpath = ` - ${request.path}`
        }
      }

      let memoryUsage = parseFloat(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)

      if (displayBenchmark) {
        console.log(`${moment(startDate).tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')}${fullpath} - DB Start - ${querySha} - ${memoryUsage} MB`)
      }
      const mssqlPool = await mssqlPoolPromise
      const queryResult = await mssqlPool.request().query([query])
      const totalTime = new Date() - startDate
      memoryUsage = parseFloat(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
      if ((!displayBenchmark && totalTime > 30000)) {
        console.log(`${moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')}${fullpath} - DB End - ${querySha} - ${totalTime}ms - ${memoryUsage} MB`)
        console.log('---------------------------------------------------------------------------------------------------------------------')
        console.log(query)
        console.log('---------------------------------------------------------------------------------------------------------------------')
      } else if (displayBenchmark) {
        console.log(`${moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')}${fullpath} - DB End - ${querySha} - ${totalTime}ms - ${memoryUsage} MB`)
      }
      return instance.setResults(queryResult.recordset)
    },
    setRequest: prequest => {
      request = prequest
      return instance
    },
    memoiseMode: ttl => {
      memoiseMode = ttl
      return instance
    },
    setResults: (queryResults) => {
      if (!queryResults) return { totalRecords: 0, data: [] }
      let totalRecords = queryResults.length
      _.each(queryResults, function (record) {
        if (!_.isUndefined(record['_TotalRecords'])) {
          totalRecords = record['_TotalRecords']
          delete record['_TotalRecords']
        }
        if (!_.isUndefined(record['_dummy'])) {
          delete record['_dummy']
        }
      })
      if (_.isUndefined(totalRecords)) totalRecords = queryResults.length

      var result = {
        totalRecords: totalRecords,
        data: queryResults,
        toArray: function () {
          var result = []
          if (this.data.length > 0) {
            var firstProperty = Object.keys(this.data[0])[0]
            result = _.map(this.data, firstProperty)
          }
          return result
        },
        unwrap: function () {
          return this.data
        }
      }
      return result
    }
  }

  return instance
}
export default DML
