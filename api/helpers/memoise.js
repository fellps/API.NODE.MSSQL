import * as config from '../../config'
import uuid from 'uuid'

const Keyv = require('keyv')
const redis = require('redis')

const redisConn = (config.memoise.enabled && config.redis.enabled) ? redis.createClient({ url: config.redis.uri }) : void (0)

const memoiseDisabled = function () {
  return {
    clear: async () => {},
    flush: async () => {},
    get: async () => {},
    set: async () => {}
  }
}

const memoise = function (namespace) {
  const _uuid = config.database.connection.database + (namespace || uuid())
  const map = new Keyv(
    (config.redis.enabled ? config.redis.uri : void (0)),
    { namespace: _uuid }
  )
  return {
    clear: async () => map.clear(),
    flush: async () => {
      if (redisConn) {
        return new Promise(function (resolve, reject) {
          redisConn.FLUSHALL(function (err, res) {
            if (err) return reject(err)
            resolve(res)
          })
        })
      }
      return map.clear()
    },
    get: async key => {
      const res = await map.get(key)
      if (res) return JSON.parse(res)
    },
    set: async (key, entrie, ttl) => {
      return map.set(key, JSON.stringify(entrie), ttl)
    }
  }
}

export default config.memoise.enabled ? memoise : memoiseDisabled
