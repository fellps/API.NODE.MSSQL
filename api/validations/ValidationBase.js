import * as Models from '../models'

var _ = require('lodash')
var Validator = require('validator')

/**
 * Validation Base constructor.
 */
function ValidationBase () {
  var main = this
  main.rules = {}

  main.addRules = function (ruleObject) {
    main.rules = _.merge(main.rules, ruleObject)
  }

  main.validateField = function (rule, value) {
    var isValid = false

    var ruleName = rule.Rule

    var negate = false
    if (rule.Rule.substr(0, 3) === 'not') {
      ruleName = rule.Rule.substr(3, 1).toLowerCase() + rule.Rule.substr(4)
      negate = true
    }

    if (ruleName === 'isUndefined') {
      isValid = !_.isUndefined(value)
    } else if (ruleName === 'isEmpty') {
      isValid = !_.isEmpty(value) || _.isFinite(value) // isFinite checks if its of type Number and isnt NaN or Ininity
    } else {
      if (_.isUndefined(value)) {
        isValid = (!negate)
      } else if (!_.isUndefined(Validator[ruleName]) && _.isString(value)) {
        isValid = !Validator[ruleName](value)
      }
    }

    isValid = (negate) ? !isValid : isValid
    return isValid
  }

  main.validateObject = function (ruleObject, valueObject) {
    var errors = {}

    _.map(valueObject, function (data, key) {
      if (_.isObject(data)) {
        var validationResult = { isValid: true }
        if (!_.isUndefined(main.model)) {
          var Validations = require('./index.js')()
          if (!_.isUndefined(Validations[key])) {
            validationResult = Validations[key].validate(data)
          }
        } else if (_.isObject(main.rules[key])) {
          validationResult = main.validateObject(main.rules[key], data)
        } else {
          validationResult = main.validateObject(main.rules, data)
        }
        if (validationResult.isValid) {
          var isValid = validationResult.isValid
        } else {
          errors[key] = validationResult.errors
        }
      } else {
        if (!_.isUndefined(ruleObject[key])) {
          isValid = main.validateField(ruleObject[key], data)
          if (!isValid) {
            errors[key] = ruleObject[key].Message
          }
        }
      }
    })

    if (_.isEmpty(errors)) {
      return { isValid: true }
    } else {
      return { isValid: false, errors: errors }
    }
  }

  main.validate = function (parameters) {
    try {
      return main.validateObject(main.rules, parameters)
    } catch (err) {
      return { valid: false, validationErros: err }
    }
  }

  main.validateModel = function (parameters) {
    var result = {}
    if (!_.isUndefined(this.model)) {
      _.map(this.model.columns, function (data, key) {
        if (!data.identity) {
          result[key] = parameters[key]
        }
      })
    }

    if (_.isEmpty(result)) {
      result = parameters
    }
    return main.validate(result)
  }

  main.addModelRules = function (modelName) {
    if (!_.isUndefined(modelName) && !_.isUndefined(Models[modelName])) {
      main.model = Models[modelName]()
      _.map(main.model.columns, function (data, key) {
        if (!_.isUndefined(data.nullable) && data.nullable === false) {
          var rule = {}
          var gender = (key.substr(-1, 1) === 'a') ? 'a' : 'o'

          if (!_.isUndefined(data.gender)) {
            gender = data.gender
          }
          var friendlyName = key
          if (!_.isUndefined(data.friendlyName)) {
            friendlyName = data.friendlyName
          }
          var ruleName = 'isUndefined'
          if (gender === 'o') {
            rule[key] = { Rule: ruleName, Message: 'O ' + friendlyName + ' é obrigatório!' }
          } else {
            rule[key] = { Rule: ruleName, Message: 'A ' + friendlyName + ' é obrigatória!' }
          }
          main.addRules(rule)
        }
      })
    }
    return main
  }
}

/**
* Module exports
*/
module.exports = ValidationBase
