var Lodash = require('lodash')
var ValidationBase = require('./ValidationBase')

module.exports = function (state) {
  // Map CUSTOM Validations
  var result = {
    UsersMinimal: require('./UsersMinimalValidation.js')
  }

  // Map Validations Based on ModelsList
  Lodash.each(require('../models/modelsList'), function (key) {
    if (!result[key]) {
      result[key] = (new ValidationBase()).addModelRules(key)
    }
  })

  return result
}
