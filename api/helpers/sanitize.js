import _ from 'lodash'

const sanitizer = (val, addQuotes = true) => {
  return _.isArray(val) ? _.map(val, (item) => sanitizer(item, false)) : addQuotes ? `'${val.toString().replace(/'/g, "''")}'` : `${val.toString().replace(/'/g, "''")}`
}

export default sanitizer
