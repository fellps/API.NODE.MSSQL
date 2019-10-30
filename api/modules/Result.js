// import newrelic from 'newrelic'
import Stacktrace from 'stack-trace'
import Messages from './Messages'
import Moment from 'moment-timezone'
import _ from 'lodash'

import { _getContentTypeFromExtension } from '../helpers/file.js'
import uuid from 'uuid'
const fs = require('fs')
const osTmpdir = require('os-tmpdir')()
const path = require('path')

const PrintLog = (type, message, error) => {
  if (process.env.ENVIRONMENT !== 'test') {
    const file = (Stacktrace.get().length > 2) ? Stacktrace.get()[3].getFileName() : Stacktrace.get()[2].getFileName()
    const method = (Stacktrace.get().length > 2) ? Stacktrace.get()[3].getFunctionName() : Stacktrace.get()[2].getFunctionName()
    const lineNumber = (Stacktrace.get().length > 2) ? Stacktrace.get()[3].getLineNumber() : Stacktrace.get()[2].getLineNumber()
    const resultMessage = `${Moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')} - ${type} - ${file}(${lineNumber}) - ${method}: ${message}`
    if (error) {
      console.error(resultMessage)
      console.error('---------------------------------------------------------')
      console.error(error)
      console.error('---------------------------------------------------------')
    } else {
      console.info(message)
    }
  }
}

export const ClearApi = (object) => {
  let result = {...object}
  delete result.origin
  delete result.modelName
  delete result.status
  delete result.password
  delete result.Password

  if (_.isArray(result.data)) {
    result.data = _.map(result.data, function (entry) {
      return _.omit(entry, ['password', 'Password'])
    })
  } else if (_.isObject(result.data)) {
    result.data = _.omit(result.data, ['password', 'Password'])
  }

  return result
}

export const ClearSocket = (object) => {
  let result = {...object}
  if (result.error === false) delete result.message
  delete result.errorObject
  delete result.origin
  delete result.modelName

  return result
}

const basicResult = {
  error: false,
  errorCode: void (0),
  message: '',
  status: 200
}

const _debug = (message) => {
  PrintLog('Debug', message)
}

const _error = (code, errorObject, data = []) => {
  const result = {
    ...basicResult,
    error: true,
    data,
    errorCode: code,
    errorMessage: code,
    message: Messages[code] || 'Server Problem',
    status: 400
  }

  if (errorObject) {
    PrintLog('Error', result.message, errorObject)
    errorObject.message = result.message
    if (errorObject.alternativeMessage) {
      result.message = errorObject.alternativeMessage
    }
    // newrelic.noticeError(errorObject)
  } else {
    // newrelic.noticeError(result.message)
  }

  return result
}

const _forbidden = (code) => {
  const result = {
    ...basicResult,
    error: true,
    errorCode: code,
    message: Messages[code] || 'Acesso Negado',
    status: 403
  }
  PrintLog('Forbidden', result.message)
  return result
}

const _info = (message) => {
  PrintLog('Info', message)
}

const _success = (code, resultData = {}) => {
  const result = {
    ...basicResult,
    ...resultData,
    message: Messages[code] || 'Server Problem'
  }
  return result
}

const _streamFile = (origin, modelName, extension, file) => {
  const result = {
    ...basicResult,
    fileName: `${uuid()}.${extension}`,
    fileLocation: path.join(osTmpdir, this.fileName),
    contentType: _getContentTypeFromExtension(extension)
  }
  fs.writeFileSync(result.fileLocation, file, 'binary')
  return result
}

const _unauthorized = (code) => {
  const result = {
    ...basicResult,
    error: true,
    errorCode: code,
    message: Messages[code] || 'Sem Autorização',
    status: 401
  }
  PrintLog('Unauthorized', result.message)
  return result
}

const _warning = (code, resultData) => {
  const result = {
    ...basicResult,
    ...resultData,
    error: true,
    errorCode: code,
    message: Messages[code] || 'Server Problem'
  }
  return result
}

const mapMessages = (fn) => {
  return _.mapValues(Messages, (o, key) => (data, data2) => fn(key, data, data2))
}

const Result = {
  Error: mapMessages(_error),
  Success: mapMessages(_success),
  Warning: mapMessages(_warning),
  Unauthorized: mapMessages(_unauthorized),
  Forbidden: mapMessages(_forbidden),
  Debug: _debug,
  Info: _info,
  StreamFile: _streamFile
}

export default Result
