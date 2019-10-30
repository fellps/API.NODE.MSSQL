import context from '../helpers/context.js'
import Retriever from '../modules/Retriever'
import * as Crypto from '../modules/Crypto'
var _ = require('lodash')
var Co = require('co')
var MD5 = require('md5')
var Moment = require('moment-timezone')

class BaseBusiness {
  constructor (modelName) {
    this.parentMethod = void (0)
    this.referencesColumns = []
    this.modelName = modelName

    /**
     * Persist one register of model type of current business.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @param {string} [mode] Persistance mode (create, update or patch)
     * @param {bool} [cascadeSave] Enable/disable cascade save of reations (Parent and Child References)
     * @return {array} An array with the inserted/updated register of current model.
     */
    this.persist = async function persist (params, mode, cascadeSave) {
      let parameters = this.normalizeParameters(params)
      if (!_.isUndefined(parameters[this.modelName])) {
        parameters = parameters[this.modelName]
      }

      cascadeSave = cascadeSave || false

      var Business = context.Business
      var Models = context.Models
      var parentMethod = this.parentMethod
      var model = Models[this.modelName]()

      var objectSet = Retriever.getValues(parameters, model.columns, this.modelName).values

      if (_.has(model.columns, 'IdProducer') && _.has(parameters, '_LoggedUser')) {
        if (_.has(parameters._LoggedUser, 'IdProducer')) {
          objectSet.IdProducer = parameters._LoggedUser.IdProducer
        }
      }

      if (objectSet.CreatedAt != null) delete objectSet.CreatedAt
      if (objectSet.UpdatedAt != null) delete objectSet.UpdatedAt
      if (objectSet.DeletedAt != null) delete objectSet.DeletedAt
      if (objectSet.IsDeleted != null) objectSet.IsDeleted = 0

      // Removing identity column for inserts
      if (mode === 'update' || mode === 'patch') {
        objectSet.UpdatedAt = Moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')
      } else {
        if (_.isEmpty(objectSet[model.idAttribute])) delete objectSet[model.idAttribute]

        objectSet.CreatedAt = Moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')
        objectSet.IsDeleted = 0
      }
      // @TODO: Esta conversão de data tem que ser corrigda no GetValues.
      // @TODO: Esta conversão de data tem que ser corrigda no GetValues.
      // @TODO: Esta conversão de data tem que ser corrigda no GetValues.
      if (this.modelName === 'CashierClosings' && objectSet.Date) {
        objectSet.Date = Moment(objectSet.Date).tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')
      } else if (this.modelName === 'CashierPartialClosings' && objectSet.Date) {
        objectSet.Date = Moment(objectSet.Date).tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')
      }
      // @TODO: Esta conversão de data tem que ser corrigda no GetValues.
      // @TODO: Esta conversão de data tem que ser corrigda no GetValues.
      // @TODO: Esta conversão de data tem que ser corrigda no GetValues.

      if (!objectSet.IsDeleted) objectSet.DeletedAt = null

      // Criptografy for password fields
      if (objectSet.Password) objectSet.Password = await Crypto.bcryptEncrypt(MD5(objectSet.Password))

      if ((mode === 'update' || mode === 'patch') && !objectSet[model.idAttribute]) {
        return Business.BusinessResult().ValidationError('persist', this.modelName, 'Erro na validação dos dados!', { id: 'Os campos de identificação são obrigatórios!' })
      }

      var validationResult = context.Validations[this.modelName].validate(objectSet)
      if (!validationResult.isValid) {
        return Business.BusinessResult().ValidationError('persist', this.modelName, 'Erro na validação dos dados!', validationResult.errors)
      }

      var references = this.mountReferencesSave(parameters, cascadeSave)
      return Promise.all(references).then((referencesValues) => {
        // Setting reference values
        for (var x = 0; x < referencesValues.length; x++) {
          if (referencesValues[x].error) {
            return referencesValues[x]
          }

          var parameterName = this.referencesColumns[x]
          if (_.isUndefined(objectSet[parameterName]) && !_.isUndefined(referencesValues[x].data[0]) && !_.isUndefined(referencesValues[x].data[0][parameterName])) {
            objectSet[parameterName] = referencesValues[x].data[0][parameterName]
          }
        }

        var model = new Models[this.modelName]()
        var id = void (0)

        validationResult = undefined

        if (mode === 'update' || mode === 'patch') {
          id = objectSet[model.idAttribute]
          model.where(model.idAttribute, id)
          delete objectSet[model.idAttribute]
          validationResult = model.validate(objectSet)
        } else {
          validationResult = model.validateModel(objectSet)
        }

        if (!validationResult.isValid) {
          return Business.BusinessResult().ValidationError('persist', this.modelName, 'Erro na validação dos dados!', validationResult.errors)
        }

        // Save cascade child
        var fnChildReferences = (result) => {
          var dependents = []

          if (result.data.length === 0) {
            if (mode === 'update' || mode === 'patch') {
              result.data = [parameters]
            } else {
              return Business.BusinessResult().Warning('persist', this.modelName, 'Nenhum registro encontrado!')
            }
          }
          if (cascadeSave) {
            var tModel = Models[this.modelName]()
            if (_.isUndefined(id) && result.data.length > 0) {
              id = result.data[0][tModel.idAttribute]
            }
            _.map(parameters, (data, key) => {
              if (_.isUndefined(tModel.columns[key]) && _.isObject(data)) {
                if (!_.isUndefined(Models[key])) {
                  var pModel = Models[key]()
                  var found = _.filter(pModel.columns, { referenceTable: this.modelName })
                  if (!_.isEmpty(found) && !_.isUndefined(id)) {
                    var dependentsParameters = data
                    dependentsParameters[tModel.idAttribute] = id

                    if (parentMethod === 'save') {
                      dependents.push(Co(Business[pModel.tableName].save(dependentsParameters, cascadeSave)))
                    } else if (parentMethod === 'getOrCreate') {
                      dependents.push(Co(Business[pModel.tableName].getOrCreate(dependentsParameters, cascadeSave)))
                    } else {
                      dependents.push(Co(Business[pModel.tableName].create(dependentsParameters)))
                    }
                  }
                }
              }
            })
          }
          return Promise.all(dependents).then((dependentsResults) => {
            for (var x = 0; x < dependentsResults.length; x++) {
              if (!_.isUndefined(dependentsResults[x].modelName)) {
                result.data[0][dependentsResults[x].modelName] = dependentsResults[x].data[0]
              }
            }
            for (var y = 0; y < result.data.length; y++) {
              if (result.data[y].Password) delete result.data[y].Password
            }

            var message = 'registro inserido com sucesso!'
            if (mode === 'update' || mode === 'patch') {
              message = 'registro atualizado com sucesso!'
            }
            return Business.BusinessResult().Success('persist', this.modelName, result.totalRecords + ' ' + message, result)
          }).catch((err) => {
            return Business.BusinessResult().Error('persist', this.modelName, 'Ocorreu um erro na persistência do registro!', err)
          })
        }

        var method = (mode === 'update' || mode === 'patch') ? 'update' : 'insert'
        return model
          .save(method)
          .then(fnChildReferences)
          .catch((err) => {
            return Business.BusinessResult().Error('persist', this.modelName, 'Ocorreu um erro na persistência do registro!', err)
          })
      }).catch((err) => {
        return Business.BusinessResult().Error('persist', this.modelName, 'Ocorreu um erro na persistência do registro!', err)
      })
    }

    /**
     * This method is a helper to save or return references.
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @param {bool} [cascadeSave] Enable/disable cascade save of reations (Parent and Child References)
     * @return {array} An array with the inserted/updated reference of current model.
     */
    this.mountReferencesSave = function mountReferencesSave (parameters, cascadeSave) {
      // Get References values
      var references = []
      var Business = context.Business
      var model = context.Models[this.modelName]()

      _.map(model.columns, (data, key) => {
        if (!_.isUndefined(data.referenceTable)) {
          if ((this.parentMethod === 'save' || _.isUndefined(parameters[key])) && data.referenceTable !== this.modelName) {
            var referenceParameters = parameters[data.referenceTable]

            if (!_.isUndefined(referenceParameters)) {
              if (this.parentMethod === 'save') {
                references.push(Co(Business[data.referenceTable].save(referenceParameters, cascadeSave)))
              } else if (this.parentMethod === 'getOrCreate') {
                references.push(Co(Business[data.referenceTable].getOrCreate(referenceParameters, cascadeSave)))
              } else {
                references.push(Co(Business[data.referenceTable].getUnique(referenceParameters)))
              }
              this.referencesColumns.push(key)
            }
          }
        }
      })
      return references
    }

    /**
     * Execute persist method defined for insert only.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @param {bool} [cascadeSave] Enable/disable cascade save of reations (Parent and Child References)
     * @return {array} An array with the inserted register of current model.
     */
    this.create = async function create (parameters, cascadeSave) {
      var result = await this.persist(parameters, 'create', cascadeSave)
      return result
    }

    /**
     * Execute persist method defined for update only.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @param {bool} [cascadeSave] Enable/disable cascade save of reations (Parent and Child References)
     * @return {array} An array with the updated register of current model.
     */
    this.update = async function update (parameters, cascadeSave) {
      var result = await this.persist(parameters, 'update', cascadeSave)
      return result
    }

    /**
     * Execute persist method defined for update parcial data only.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @param {bool} [cascadeSave] Enable/disable cascade save of reations (Parent and Child References)
     * @return {array} An array with the updated register of current model.
     */
    this.patch = async function patch (parameters, cascadeSave) {
      var result = await this.persist(parameters, 'patch', cascadeSave)
      return result
    }

    /**
     * Default get function used to retrieve data of model type related with current business.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @return {array} An array with the query result of current model.
     */
    this._get = async function (params) {
      const parameters = this.normalizeParameters(params)
      var Business = context.Business

      try {
        const pagination = parameters._page && parameters._pageSize ? { _page: parameters._page, _pageSize: parameters._pageSize } : void (0)

        var objectSet = Retriever.getValues(parameters, context.Models[this.modelName]().columns, this.modelName, 'OnlyFilled').values
        // Criptografy for password fields
        if (objectSet.Password) delete objectSet.Password
        if (context.Models[this.modelName]().columns['IsDeleted']) {
          if (typeof objectSet.IsDeleted === 'undefined') {
            objectSet.IsDeleted = 0
          }
        }
        var query = new context.Models[this.modelName](objectSet)
        if (pagination) {
          query.paginate(pagination._page, pagination._pageSize)
        }
        if (parameters._order) {
          query.orderBy(parameters._order)
        } else if (context.Models[this.modelName]().columns) {
          if (context.Models[this.modelName]().columns['Order']) {
            query.orderBy('Order')
          } else if (context.Models[this.modelName]().columns['Name']) {
            query.orderBy('Name')
          } else if (context.Models[this.modelName]().columns['Code']) {
            query.orderBy('Code')
          }
        }
        var result = await query.find()

        if (result.totalRecords === 0) {
          return Business.BusinessResult().Warning('get', this.modelName, 'Nenhum registro encontrado!')
        } else {
          for (var x = 0; x < result.data.length; x++) {
            if (result.data[x].Password) delete result.data[x].Password
          }
          return Business.BusinessResult().Success('get', this.modelName, result.totalRecords + ' registro(s) encontrado(s)!', result)
        }
      } catch (err) {
        return Business.BusinessResult().Error('get', this.modelName, 'Erro na requisição tente novamente mais tarde ou entre em contato com administrador!')
      }
    }

    /**
     * Initial specified get calls the default _get function. This method can be overwrited.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @return {array} An array with the query result of current model.
     */
    this.get = async function get (parameters) {
      return this._get(parameters)
    }

    /**
     * Retrieve only one register of model settedon instantiated business.
     * Parameter Id of the current model is required and must come through query params.
     * @memberof BaseBusiness
     * @param {any} [Id] Identity column of current model. This param name must look like the model. Ex: IdPerson, IdUser etc
     * @return {array} An array with one register of current model.
     */
    this._getById = async function (parameters) {
      const Models = context.Models
      const Business = context.Business
      const tModel = Models[this.modelName]()

      parameters[tModel.idAttribute] = parameters.id || parameters[tModel.idAttribute]

      if (!parameters[tModel.idAttribute]) return Business.BusinessResult().Error('getById', this.modelName, 'O id é obrigatório!')

      return this.get(parameters)
    }

    /**
     * Initial specified getById calls the default _getById function. This method can be overwrited.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @return {array} An array with the query result of current model.
     */
    this.getById = async function getById (parameters) {
      return this._getById(parameters)
    }

    /**
     * Retrieve one record based to unique fields (Some models has unique columns like Code or Number, but this can receive the Identity too).
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects
     * @return {array} An array with the query result of current model.
     */
    this.getUnique = async function getUnique (parameters) {
      var Business = context.Business
      if (_.isEmpty(parameters)) {
        return Business.BusinessResult().Warning('getUnique', this.modelName, 'Parâmetros inválidos!')
      }

      var result = await this._get(parameters)
      if (result.data.length === 1) {
        return result
      } else if (result.data.length > 1) {
        return Business.BusinessResult().Warning('getUnique', this.modelName, 'Mais de um registro encontrado especifique melhor a pesquisa!')
      } else {
        return Business.BusinessResult().Warning('getUnique', this.modelName, 'Nenhum registro encontrado!')
      }
      //  return await Co(this.get(parameters))
      //     .then((result) => {
      //         if (result.data.length == 1) {
      //             return result
      //         } else if (result.data.length > 1) {
      //             return Business.BusinessResult().Warning('getUnique', this.modelName, 'Mais de um registro encontrado especifique melhor a pesquisa!')
      //         } else {
      //             return Business.BusinessResult().Warning('getUnique', this.modelName, 'Nenhum registro encontrado!')
      //         }
      //     });
    }

    /**
     * Saves (Update or Insert) one register of model type of current business.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects. If identity column is specified execute an update otherwise an insert
     * @param {bool} [cascadeSave] Enable/disable cascade save of reations (Parent and Child References)
     * @return {array} An array with the inserted/updated register of current model.
     */
    this.save = async function save (parameters, cascadeSave) {
      var Business = context.Business
      var Models = context.Models

      var model = Models[this.modelName]()

      cascadeSave = cascadeSave || false
      if (!this.parentMethod) this.parentMethod = 'save'

      var that = this
      var getParameters = this.normalizeParameters(parameters)

      if (getParameters.CreatedAt != null) delete getParameters.CreatedAt
      if (getParameters.UpdatedAt != null) delete getParameters.UpdatedAt
      if (getParameters.DeletedAt != null) delete getParameters.DeletedAt
      if (getParameters.IsDeleted != null) delete getParameters.IsDeleted

      var retriever = Retriever.getUniqueValues(getParameters, model.columns, this.modelName)

      var getObjectSet = retriever.values
      var hasIdentity = false
      if (!_.isUndefined(getObjectSet[model.idAttribute])) {
        _.map(getObjectSet, (data, key) => {
          if (key !== model.idAttribute) {
            delete getObjectSet[key]
          }
        })
        hasIdentity = true
      }
      var references = []
      if (!retriever.uniqueFound) {
        references = this.mountReferencesSave(parameters, cascadeSave)
      }

      return Promise.all(references).then((referencesValues) => {
        // Setting reference values
        for (var x = 0; x < referencesValues.length; x++) {
          if (referencesValues[x].error) {
            return referencesValues[x]
          }

          var parameterName = that.referencesColumns[x]
          if (_.isUndefined(getObjectSet[parameterName]) && !_.isUndefined(referencesValues[x].data[0]) && !_.isUndefined(referencesValues[x].data[0][parameterName])) {
            getObjectSet[parameterName] = referencesValues[x].data[0][parameterName]
            parameters[parameterName] = getObjectSet[parameterName]
          }
        }
        return Co(that.getUnique(getObjectSet))
          .then((result) => {
            if (result.error && _.isEmpty(result.data) && !hasIdentity) {
              return Co(that.create(parameters, cascadeSave))
            } else {
              if (that.parentMethod === 'save' && hasIdentity) {
                return Co(that.update(parameters, cascadeSave))
              } else {
                return result
              }
            }
          })
      }).catch((err) => {
        return Business.BusinessResult().Error('save', this.modelName, 'Ocorreu um erro na persistência do registro!', err)
      })
    }

    /**
     * Normalize data based on model
     */
    this.normalizeParameters = function normalizeParameters (parameters) {
      const { Models } = context
      const model = Models[this.modelName]()
      const { columns } = model
      const newParameters = _.map(parameters, (val, key) => {
        const column = columns[key]
        if (column && val) {
          switch (column.type) {
            case 'integer':
              return { [key]: `${val}`.replace(/\D/g, '') }
            case 'string':
              return { [key]: `${val}` }
            case 'boolean':
              return { [key]: Boolean(val) }
            default:
              return { [key]: val }
          }
        }
      }).reduce(_.merge)
      return {
        ...parameters,
        ...newParameters
      }
    }

    /**
     * Get or create an register of model type of current business.
     * The parameters must be equivalent to model type (see model columns).
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects. If identity column is specified execute an update otherwise an insert
     * @param {bool} [cascadeSave] Enable/disable cascade save of reations (Parent and Child References)
     * @return {array} An array with the found or inserted register of current model.
     */
    this.getOrCreate = async function getOrCreate (params, cascadeSave) {
      const parameters = this.normalizeParameters(params)
      cascadeSave = cascadeSave || false
      if (!this.parentMethod) this.parentMethod = 'getOrCreate'

      return this.save(parameters, cascadeSave)
    }

    /**
     * Delete register on database.
     * The identity parameter is required for delete
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects. If identity column is specified execute an update otherwise an insert
     * @return {undefined}
     */
    this.delete = async function remove (parameters) {
      var Business = context.Business

      var objectSet = Retriever.getValues(parameters, context.Models[this.modelName]().columns, this.modelName).values

      // Check parameters has the identity column
      if (!objectSet[context.Models[this.modelName]().idAttribute]) {
        return Business.BusinessResult().Warning('delete', this.modelName, 'Parametros incorretos!')
      }

      var queryParameters = {}
      queryParameters[context.Models[this.modelName]().idAttribute] = objectSet[context.Models[this.modelName]().idAttribute]

      var query = new context.Models[this.modelName]()
      return query
        .softDelete(queryParameters)
        .then((result) => {
          if (!result) {
            return Business.BusinessResult().Warning('delete', this.modelName, 'Nenhum registro encontrado!')
          } else {
            return Business.BusinessResult().Success('delete', this.modelName, 'Registro removido com sucesso!', result)
          }
        })
        .catch((err) => {
          return Business.BusinessResult().Error('delete', this.modelName, 'Ocorreu um erro na remoção do registro!', err)
        })
    }

    /**
     * Custom create method to be overwrited. Initial return is an warning with message Not Implemented
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects. If identity column is specified execute an update otherwise an insert
     * @return {array} An array with the inserted register of current model.
     */
    this.customCreate = async function customCreate (parameters) {
      return context.Business.BusinessResult().Warning('customCreate', this.modelName, 'Not Implemented!')
    }

    /**
     * Custom retrieve method to be overwrited. Initial return is an warning with message Not Implemented
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects. If identity column is specified execute an update otherwise an insert
     * @return {array} An array with the found register of current model.
     */
    this.customRetrieve = async function customRetrieve (parameters) {
      return context.Business.BusinessResult().Warning('customRetrieve ', this.modelName, 'Not Implemented!')
    }

    /**
     * Custom retrieve method to be overwrited. Initial return is an warning with message Not Implemented
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects. If identity column is specified execute an update otherwise an insert
     * @return {array} An array with the updated register of current model.
     */
    this.customUpdate = async function customUpdate (parameters) {
      return context.Business.BusinessResult().Warning('customUpdate', this.modelName, 'Not Implemented!')
    }

    /**
     * Cusstom delete method to be overwrited. Initial return is an warning with message Not Implemented
     * The identity parameter is required for delete
     * @memberof BaseBusiness
     * @param {ModelColumnsObject} [parameters] Model column objects. If identity column is specified execute an update otherwise an insert
     * @return {undefined}
     */
    this.customDelete = async function customDelete (parameters) {
      return context.Business.BusinessResult().Warning('customDelete', this.modelName, 'Not Implemented!')
    }
  }
}

export default BaseBusiness
