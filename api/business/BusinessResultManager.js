// import newrelic from 'newrelic'
import uuid from 'uuid'

import { _getContentTypeFromExtension } from '../helpers/file'

const _ = require('lodash')
const fs = require('fs')
const osTmpdir = require('os-tmpdir')()
const path = require('path')

function BusinessResultManager () {
  // Return a new instance of this object when use require(...)();
  if (!(this instanceof BusinessResultManager)) {
    return new BusinessResultManager()
  }

  var main = function BusinessResult () {
    // Return a new instance of this object when use require(...)();
    if (!(this instanceof BusinessResult)) {
      return new BusinessResult()
    }
    this.error = false
    this.data = []
    this.message = ''
    this.errorObject = {}
    this.modelName = ''

    this.ValidationError = function (origin, modelName, message, data) {
      this.error = true
      this.message = message
      this.origin = origin
      this.modelName = modelName
      this.data = data
      return this
    }

    this.Warning = function (origin, modelName, message, err) {
      this.status = 200
      this.error = true
      this.errorObject = err
      this.message = message
      this.origin = origin
      this.modelName = modelName
      return this
    }

    this.Unauthorized = function (origin, modelName, message) {
      this.status = 401
      this.message = message || 'Sem autorização.'
      this.error = true
      this.errorObject = {}
      return this
    }

    this.Forbidden = function (origin, modelName, message) {
      this.status = 403
      this.message = message || 'Acesso negado.'
      this.error = true
      this.errorObject = {}
      return this
    }

    this.Error = function (origin, modelName, message, err, data = []) {
      if (err) {
        console.log(origin + ' - ' + message, err)
      }
      this.data = data
      this.error = true
      this.message = message
      this.errorObject = {}
      if (!_.isUndefined(err) && err.name !== 'RequestError') {
        if (!_.isUndefined(err.number)) {
          this.errorNumber = err.number
        }
        if (!_.isUndefined(err.message)) {
          this.errorMessage = err.message
        }
        this.errorObject = err
      }
      this.origin = origin
      this.modelName = modelName

      if (err) {
        err.message = this.modelName + '/' + this.origin + ': ' + err.message
        // newrelic.noticeError(err)
      } else {
        // newrelic.noticeError(this.modelName + '/' + this.origin + ': ' + this.message)
      }
      return this
    }

    this.Success = function (origin, modelName, message, result) {
      return {
        ...this, // need this to keep access to clearApi
        ...result,
        data: result ? result.data || [] : [],
        error: false,
        message: message,
        origin: origin,
        modelName: modelName,
        status: 200
      }
    }

    this.StreamFile = function (origin, modelName, extension, file) {
      this.fileName = `${uuid()}.${extension}`
      this.fileLocation = path.join(osTmpdir, this.fileName)
      this.contentType = _getContentTypeFromExtension(extension)
      this.error = false
      this.status = 200
      fs.writeFileSync(this.fileLocation, file, 'binary')
      return this
    }

    this.ClearApi = function () {
      delete this.origin
      delete this.modelName
      delete this.status
      delete this.OperationPassword
      delete this.operationPassword
      delete this.password
      delete this.Password

      if (_.isArray(this.data)) {
        this.data = _.map(this.data, function (entry) {
          return _.omit(entry, ['password', 'Password', 'OperationPassword', 'operationPassword'])
        })
      } else if (_.isObject(this.data)) {
        this.data = _.omit(this.data, ['password', 'Password', 'OperationPassword', 'operationPassword'])
      }

      return this
    }

    this.ClearSocket = function () {
      if (this.error === false) delete this.message
      delete this.errorObject
      delete this.origin
      delete this.modelName

      return this
    }
  }
  return main
}

module.exports = BusinessResultManager
