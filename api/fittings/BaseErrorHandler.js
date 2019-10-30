import context from '../helpers/context.js'
import _ from 'lodash'
import isGenerator from '../helpers/isGenerator.js'
import co from 'co'
import { ClearApi } from '../modules/Result'
const appContext = context

export default function create (fittingDef) {
  return async function BaseErrorHandler (context, next) {
    if (!_.isError(context.error)) {
      return next()
    }

    const err = context.error
    let functionFound = false
    const { swagger, method } = context.request

    try {
      if (_.startsWith(err.code, 'MODULE_NOT_FOUND')) {
        const endpoint = swagger.operation.pathObject['x-swagger-router-controller'].replace('Controller', '')
        const bodyMethods = ['POST', 'PUT', 'PATCH']
        let functionName = swagger.operation.definition.operationId
        let result = void (0)

        if (!functionName) {
          switch (method) {
          case 'GET':
            functionName = 'get'
            break
          case 'POST':
            functionName = 'create'
            break
          case 'PUT':
            functionName = 'update'
            break
          case 'DELETE':
            functionName = 'delete'
            break
          case 'PATCH':
            functionName = 'patch'
            break
          }
        }

        if (_.isObject(appContext.Controllers[endpoint]) && _.isFunction(appContext.Controllers[endpoint][functionName])) {
          functionFound = true
          let controller = appContext.Controllers[endpoint]
          result = (isGenerator(controller[functionName]))
            ? await co(controller[functionName](context.request, context.response))
            : await controller[functionName](context.request, context.response)
        } else if (_.isObject(appContext.Business[endpoint]) && _.isFunction(appContext.Business[endpoint][functionName])) {
          const params = _.mapValues(context.request.swagger.params, param => param.value)

          const parameters = (bodyMethods.indexOf(method) > -1)
            ? { ...context.request.body, ...params, ...context.request.auth }
            : { ...context.request.query, ...params, ...context.request.auth }

          functionFound = true

          result = (isGenerator(appContext.Business[endpoint][functionName]))
            ? await co(appContext.Business[endpoint][functionName](parameters))
            : await appContext.Business[endpoint][functionName](parameters)
        }

        if (result) {
          if (result.status) {
            context.response.statusCode = result.status
          } else if (!result.error) {
            context.response.statusCode = 200
          } else {
            context.response.statusCode = 400
          }
          /*
          if (_.isFunction(result.ClearApi)) {
            context.response.json(result.ClearApi())
          } else {
            context.response.json(result)
          }
          */
          context.response.json(ClearApi(result))
        }
      }
    } catch (e) {
      console.log(context.request.url)
      context.response.json(appContext.Business.BusinessResult().Error('BaseErrorHandler', swagger.apiPath, e.message, e))
    }

    if (!functionFound) {
      console.log(context.request.url)
      context.response.json(appContext.Business.BusinessResult().Error('BaseErrorHandler', swagger.apiPath, err.message, err))
    }
  }
}
