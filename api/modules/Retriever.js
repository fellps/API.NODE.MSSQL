var _ = require('lodash')

/**
* Get values from one object based on the columns specification of the destination object
* the specifications must looks like the example bellow
* columns : {
*   id: { type: 'integer', identity: true, unique: true },
*   number: { type: 'string', size: '15', unique: true },
*   name: { type: 'string', size: '250' },
*   sex: { type: 'string', size: '1', nullable: true, defaultValue: 'M' },
*   birthdate: { type: 'date' }
* }
*/
function dotToObject (obj, is, value) {
  if (typeof is === 'string') {
    return dotToObject(obj, is.split('.'), value)
  } else if (is.length === 1) {
    obj[is[0]] = value
    return obj[is[0]]
  } else if (is.length === 0) {
    return obj
  } else {
    obj[is[0]] = {}
    return dotToObject(obj[is[0]], is.slice(1), value)
  }
}

export default {
  getValues: function (parameters, specifications, objectName, mode) {
    var result = {}
    var identityColumn = _.findKey(specifications, { identity: true })
    if (!_.isUndefined(parameters.id) && _.isUndefined(parameters[identityColumn])) {
      parameters[identityColumn] = parameters.id
    }

    mode = mode || 'All'

    if (!_.isUndefined(objectName) && !_.isUndefined(parameters[objectName])) {
      if (_.isObject(parameters[objectName])) {
        parameters = parameters[objectName]
      }
    }

    var uniqueAlternative = {}
    _.map(parameters, function (data, key) {
      if (!_.isUndefined(specifications[key])) {
        if (mode === 'UniqueOnly') {
          // if (specifications[key].identity == false) {
          uniqueAlternative[key] = parameters[key]
          if (!_.isUndefined(parameters[key]) && specifications[key].unique) {
            result[key] = parameters[key]
          }
          // }
        } else {
          if ((_.isUndefined(parameters[key]) || _.isNull(parameters[key])) && !_.isUndefined(specifications[key].defaultValue) && mode !== 'OnlyFilled') {
            result[key] = specifications[key].defaultValue
          } else {
            result[key] = parameters[key]
          }
        }
      }
    })
    var uniqueExcluded = ['CreatedAt', 'DeletedAt', 'UpdatedAt', 'IsDeleted']
    _.map(specifications, function (data, key) {
      if (_.isUndefined(result[key]) && !_.isUndefined(specifications[key].defaultValue) && mode !== 'OnlyFilled') {
        result[key] = specifications[key].defaultValue
      }
      if (_.isEmpty(uniqueAlternative) && uniqueExcluded.indexOf(key) === -1) {
        uniqueAlternative[key] = parameters[key]
      }
    })
    if (mode === 'UniqueOnly' && _.isEmpty(result)) {
      result = { values: uniqueAlternative, uniqueFound: false }
    } else {
      var uniqueFound = false
      if (mode === 'UniqueOnly') {
        uniqueFound = true
      }
      result = { values: result, uniqueFound: uniqueFound }
    }

    return result
  },

  getUniqueValues: function (parameters, specifications, objectName) {
    return this.getValues(parameters, specifications, objectName, 'UniqueOnly')
  },

  fillObject: function (specifications, values, ignoreUndefined = false) {
    var valuesAsObjects = []
    _.map(values, function (data, key) {
      if (_.isObject(data) && key.indexOf('_') === -1) {
        valuesAsObjects.push(key)
      } else {
        values[key.toLowerCase()] = data
      }
    })

    var mergeNedded = false
    if (valuesAsObjects.length > 0) {
      mergeNedded = true
    }

    var resultObject = {}
    _.map(specifications, function (data, parameterKey) {
      var value = values[parameterKey.toLowerCase()]
      var fieldName = data
      if (_.isObject(data)) {
        fieldName = data.field
        if (_.isUndefined(value) && !_.isUndefined(data.alternative)) {
          value = values[data.alternative]
        }
        if ((_.isUndefined(value) || _.isNull(value)) && !_.isUndefined(data.defaultValue)) {
          value = data.defaultValue
        } else {
          if (!_.isUndefined(data.concatenateSeparator) && _.isArray(data.values)) {
            var valueArray = []
            for (var x = 0; x < data.values.length; x++) {
              valueArray[x] = values[data.values[x]]
            }

            value = valueArray.join(data.concatenateSeparator)
          } else if (!_.isUndefined(data.convert) && data.convert === 'JsonString' && !_.isEmpty(value)) {
            try {
              value = JSON.parse(value)
            } catch (err) {
              throw new Error('Erro no comando JSON Parse! Erro de conversão do parâmetro: ' + parameterKey)
            }
          }
        }
      }
      if (!_.isUndefined(value) || !ignoreUndefined) {
        if (fieldName.indexOf('.') > -1) {
          var convertObj = {}
          dotToObject(convertObj, fieldName, value)
          resultObject = _.merge(resultObject, convertObj)
        } else {
          resultObject[fieldName] = value
        }
      }
    })

    if (mergeNedded) {
      resultObject = _.merge(values, resultObject)
    }
    return resultObject
  }
}
