import sanitize from '../../helpers/sanitize'
import memoise from '../../helpers/memoise'
import { now } from '../../helpers/datetime'

import sha1 from 'sha1'
import _ from 'lodash'

import { mssqlPoolPromise } from '../../modules/mssqldb'
import config from '../../../config.js'

const moment = require('moment-timezone')

var Models = require('../../models')

/**
 * ModelBase constructor.
 */
export const ModelBase = function (attributes) {
  var knex = this.knex
  var modelManager = this.modelManager
  var memoiseData = memoise(attributes.tableName)

  var Model = function (parameters) {
    // Return a new instance of this object when use require(...)()
    if (!(this instanceof Model)) {
      return new Model(parameters)
    }

    // Initializing properties
    var main = this
    main.idAttribute = undefined
    main.tableName = undefined
    main.columns = undefined
    main.queryColumnNames = []
    main.knex = knex
    main.parameters = checkParameters(parameters)
    main.page = undefined
    main.pageSize = undefined
    main.totalPages = undefined
    main.totalRecords = undefined
    main.topOne = false
    main.parentReferences = {}
    main.childReferences = {}
    main.queryParameters = {
      selects: [],
      joins: [],
      wheres: [],
      orders: [],
      having: [],
      groups: [],
      limit: undefined,
      offset: undefined,
      lastJoin: undefined,
      selectDistinct: false,
      debugMode: false,
      memoiseMode: 0,
      benchmark: config.benchmark,
      request: { path: '' }
    }

    // Mapping atributes of object
    _.map(attributes, function (data, key) {
      main[key] = data
    })

    // Mapping table idAttribute name and relations
    _.map(main.columns, function (data, key) {
      data.identity = (_.isUndefined(data.identity)) ? false : data.identity
      data.nullable = (_.isUndefined(data.nullable)) ? false : data.nullable
      data.unique = (_.isUndefined(data.unique)) ? false : data.unique
      if (_.isUndefined(main.idAttribute) && !_.isUndefined(data.identity)) {
        main.idAttribute = key
      } else {
        if (!_.isUndefined(data.referenceTable)) {
          var referenceColumn = key
          if (!_.isUndefined(data.referenceColumn)) {
            referenceColumn = data.referenceColumn
          }

          main.parentReferences[data.referenceTable] = {
            field: key,
            parentTable: data.referenceTable,
            parentField: referenceColumn
          }

          modelManager.AddReference(main.tableName, key, data.referenceTable, referenceColumn)
        }
      }
    })

    function handleValue (value) {
      if (value === false) return 0
      if (value === true) return 1
      return value
    }

    function checkParameters (parameters) {
      if (_.isArray(parameters)) {
        parameters = _.map(parameters, params => {
          return _.mapValues(params, value => handleValue(value))
        })
      }

      if (_.isObject(parameters) && _.isArray(parameters) === false) {
        parameters = _.mapValues(parameters, value => handleValue(value))
      }
      // Get parameters from Model construction
      if (!_.isUndefined(main.parameters) && _.isArray(parameters) === false) {
        parameters = _.merge(main.parameters, parameters)
      }

      if (_.isUndefined(parameters)) {
        return parameters
      }

      // Convert string parameters or array parameters in object related to table id
      if (!_.isObject(parameters) || (_.isArray(parameters) && !_.isObject(parameters[0]))) {
        var newParameters = {}
        newParameters[main.idAttribute] = parameters
        parameters = newParameters
      }

      // Convert dot separated strings to objects
      /*
      Lodash.map(parameters, function (data, key) {
          if (key.indexOf('.') !== -1) {
              var reference = toReferences(key, data)
              Lodash.merge(parameters, reference)
              delete parameters[key]
          }
      });
      */

      main.parameters = _.merge(main.parameters, parameters)

      return parameters
    }

    // Split table name and table alias
    function getAlias (text) {
      if (_.isUndefined(text)) return undefined
      var objectName = text.split(' as ')
      objectName[1] = objectName[1] || objectName[0]
      return { name: objectName[0], alias: objectName[1] }
    }

    function setResults (queryResults) {
      main.totalRecords = main.topOne ? queryResults.length : undefined
      _.each(queryResults, function (record) {
        if (!_.isUndefined(record['_TotalRecords'])) {
          if (_.isUndefined(main.totalRecords)) main.totalRecords = record['_TotalRecords']
          delete record['_TotalRecords']
        }
        if (!_.isUndefined(record['_dummy'])) {
          delete record['_dummy']
        }
      })

      main.query = knex(main.tableName)
      // commented this because of code on getOrCreate on DeviceLocationBusiness
      // main.queryParameters = {
      //   selects: [],
      //   joins: [],
      //   wheres: [],
      //   orders: [],
      //   groups: [],
      //   having: [],
      //   limit: undefined,
      //   offset: undefined,
      //   lastJoin: undefined,
      //   selectDistinct: false,
      //   debugMode: false
      // }

      if (_.isUndefined(main.totalRecords)) main.totalRecords = queryResults.length

      if (!_.isUndefined(main.pageSize) && !_.isUndefined(main.totalRecords) && main.pageSize > 0) {
        main.totalPages = Math.ceil(main.totalRecords / main.pageSize)
      }

      var result = {
        page: main.page,
        pageSize: main.pageSize,
        totalPages: main.totalPages,
        totalRecords: main.totalRecords,
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

    main.selectDistinct = function (columnsArray) {
      main.queryParameters.selectDistinct = true
      return main.select(columnsArray)
    }

    // Set the columns of the result
    main.select = function (columns) {
      const columnsArray = _.isArray(columns) ? columns : [columns]
      _.each(columnsArray, function (item) {
        if (_.isEmpty(item.raw)) {
          if (!_.isObject(item)) {
            item = { field: item, aggregateFunction: undefined }
          }
          var itemArray = item.field.split('.')
          if (itemArray.length > 1) {
            var foundJoin = _.filter(main.queryParameters.joins, { joinAlias: itemArray[0] })
            if (itemArray[0] !== main.tableName && foundJoin.length === 0) {
              main.join(itemArray[0])
            }
          }
        }
        main.queryParameters.selects.push(item)
      })
      return main
    }

    // Add a Left Join tables parameters to the query
    main.leftJoin = function (joinParameters) {
      if (_.isObject(joinParameters)) {
        joinParameters.joinType = 'left'
        return main.join(joinParameters)
      } else if (_.isString(joinParameters) && arguments.length === 1) {
        joinParameters = { joinTable: joinParameters, joinType: 'left' }
        return main.join(joinParameters)
      } else {
        Array.prototype.unshift.call(arguments, 'left')
        return main.join.apply(this, arguments)
      }
    }

    /** join - Add Join tables parameters to the query
        Some examples:
            -- Passing Object
            modelManager.Models.Products.join({joinTable: 'Event', joinField: 'IdEvent', referenceTable: 'Products', referenceField: 'IdEvent' }) (Only the joinTable parameter are required the others a optional)
            modelManager.Models.Products.join({joinTable: 'Event', joinField: 'IdEvent' }) (Only the joinTable parameter are required the others a optional)

            -- Passing Arguments
            modelManager.Models.Products.join('Event', 'IdEvent', 'Products', 'IdEvent') (Only the joinTable parameter are required the others a optional)
            modelManager.Models.Products.join('Event', 'IdEvent', 'Products') (Only the joinTable parameter are required the others a optional)
            modelManager.Models.Products.join('Event', 'Products') (Only the joinTable parameter are required the others a optional)
            modelManager.Models.Products.join('Event')

    */
    main.join = function (joinParameters) {
      var joinTypes = ['inner', 'right', 'left', 'full outer']
      var joinType = void (0)
      if (!_.isObject(joinParameters)) {
        if (joinTypes.indexOf(arguments[0]) > -1) {
          joinType = Array.prototype.shift.call(arguments)
        }

        if (arguments.length === 4) {
          joinParameters = { joinTable: arguments[0], joinField: arguments[1], referenceTable: arguments[2], referenceField: arguments[3] }
        } else if (arguments.length === 3) {
          joinParameters = { joinTable: arguments[0], joinField: arguments[1], referenceTable: arguments[2] }
        } else if (arguments.length === 2) {
          joinParameters = { joinTable: arguments[0], referenceTable: arguments[1] }
        } else if (arguments.length === 1) {
          joinParameters = { joinTable: arguments[0] }
        }
      }

      var defaultParameters = {
        joinType: joinType || 'inner',
        joinModel: undefined,
        joinTable: joinParameters.joinRaw || undefined,
        joinAlias: undefined,
        joinField: undefined,
        referenceTable: undefined,
        referenceAlias: undefined,
        referenceField: undefined,
        onRaw: undefined,
        isRaw: joinParameters.isRaw || (joinParameters.onRaw !== undefined || joinParameters.joinRaw !== undefined)
      }

      joinParameters = _.assign(defaultParameters, joinParameters)

      // The table name is necessary to discover the join
      if (_.isEmpty(joinParameters.joinTable)) {
        throw new Error('Invalid join parameters!')
      }

      // Get table alias from the same field as table name
      if (_.isEmpty(joinParameters.joinAlias)) {
        var joinNameAlias = getAlias(joinParameters.joinTable)
        joinParameters.joinTable = joinNameAlias.name
        joinParameters.joinAlias = joinNameAlias.alias
      }

      // Check if joining model exists
      if (!joinParameters.isRaw && require('../../models/modelsList.js').indexOf(joinParameters.joinTable) === -1) {
        throw new Error('Model / Table ' + joinParameters.joinTable + ' doesn\'t exists!')
      }

      if (joinParameters.isRaw && _.isUndefined(joinParameters.joinModel)) {
        joinParameters.joinModel = 'Not necessary'
      }

      // Load model
      if (_.isUndefined(joinParameters.joinModel)) {
        joinParameters.joinModel = modelManager.Models[joinParameters.joinTable]
      }

      // Load model
      if (_.isUndefined(joinParameters.joinModel)) {
        joinParameters.joinModel = Models[joinParameters.joinTable]()
      }

      // Try to get join parameters from joinModel
      if (!joinParameters.isRaw) {
        var joinField = void (0)
        if (!_.isUndefined(joinParameters.joinField)) {
          joinField = joinParameters.joinModel.columns[joinParameters.joinField]
        }

        var referenceAlias = joinParameters.referenceAlias || joinParameters.referenceTable
        var findByAlias = _.find(main.queryParameters.joins, { joinAlias: referenceAlias })
        if (!_.isUndefined(findByAlias)) {
          joinParameters.referenceTable = findByAlias.joinTable
          joinParameters.referenceAlias = findByAlias.joinAlias
        }

        // Try to find the references with existing joins (from the last to the first)
        if (_.isUndefined(joinParameters.referenceTable) || _.isUndefined(joinField)) {
          var pos = main.queryParameters.joins.length
          while (pos > 0) {
            pos--

            var existingJoin = main.queryParameters.joins[pos]

            var findByReference = _.findKey(joinParameters.joinModel.columns, { referenceAlias: existingJoin.joinTable })
            if (_.isUndefined(findByReference)) {
              findByReference = _.findKey(joinParameters.joinModel.columns, { referenceTable: existingJoin.joinTable })
            }
            if (!_.isUndefined(findByReference)) {
              joinParameters.joinField = findByReference
              joinParameters.referenceTable = existingJoin.joinTable
              joinParameters.referenceAlias = existingJoin.joinAlias
              joinField = joinParameters.joinModel.columns[findByReference]
              break
            } else {
              findByReference = _.findKey(existingJoin.joinModel.columns, { referenceAlias: joinParameters.joinTable })
              if (_.isUndefined(findByReference)) {
                findByReference = _.findKey(existingJoin.joinModel.columns, { referenceTable: joinParameters.joinTable })
              }
              if (!_.isUndefined(findByReference)) {
                joinParameters.referenceTable = existingJoin.joinTable
                joinParameters.referenceAlias = existingJoin.joinAlias
                joinParameters.referenceField = findByReference
                if (!_.isUndefined(findByReference.referenceColumn)) {
                  joinParameters.joinField = findByReference.referenceColumn
                } else {
                  joinParameters.joinField = findByReference
                }
                joinField = existingJoin.joinModel.columns[joinParameters.joinField]
                break
              }
            }
          }
        }

        // Try to find the references with the main model
        if (_.isUndefined(joinParameters.referenceTable) && _.isUndefined(joinField)) {
          findByReference = _.findKey(joinParameters.joinModel.columns, { referenceTable: main.tableName })
          if (!_.isUndefined(findByReference)) {
            joinParameters.joinField = findByReference
            joinField = joinParameters.joinModel.columns[findByReference]
          } else {
            findByReference = _.findKey(main.columns, { referenceTable: joinParameters.joinTable })
            if (!_.isUndefined(findByReference)) {
              joinParameters.referenceTable = main.tableName
              joinParameters.referenceField = findByReference
              if (!_.isUndefined(findByReference.referenceColumn)) {
                joinParameters.joinField = findByReference.referenceColumn
              } else {
                joinParameters.joinField = findByReference
              }
              joinField = main.columns[joinParameters.joinField]
            }
          }
        }

        // try to find referenceTable from reference if not set yet
        if (_.isUndefined(joinParameters.referenceAlias) && _.isUndefined(joinParameters.referenceTable) && !_.isUndefined(joinField) && !_.isUndefined(joinField.referenceTable)) {
          joinParameters.referenceTable = joinField.referenceTable
          if (_.isUndefined(joinParameters.referenceField) && !_.isUndefined(joinField)) {
            if (!_.isUndefined(joinField.referenceColumn)) {
              joinParameters.referenceField = joinField.referenceColumn
            } else {
              joinParameters.referenceField = joinParameters.joinField
            }
          }
        }

        // Get table reference alias from the same field as table name
        if (_.isEmpty(joinParameters.referenceAlias) && !_.isEmpty(joinParameters.referenceTable)) {
          var referenceNameAlias = getAlias(joinParameters.referenceTable)
          joinParameters.referenceTable = referenceNameAlias.name
          joinParameters.referenceAlias = referenceNameAlias.alias
        }

        if (_.isEmpty(joinParameters.onRaw)) {
          // Check if reference model exists
          var referenceModel = void (0)
          if (require('../../models/modelsList.js').indexOf(joinParameters.referenceTable) === -1) {
            findByAlias = _.find(main.queryParameters.joins, { joinAlias: joinParameters.joinTable })
            if (!_.isUndefined(findByAlias)) {
              joinParameters.referenceTable = findByAlias.joinTable
              referenceModel = findByAlias.joinModel
            } else {
              throw new Error(`Table ${joinParameters.joinTable} did not find a match reference. Check if related table already exists in the query structure.`)
            }
          } else {
            referenceModel = modelManager.Models[joinParameters.referenceTable]
          }

          // If reference field still doesnt exists try to get this from reference model
          var referenceField = void (0)
          if (_.isUndefined(joinParameters.referenceField) && !_.isUndefined(referenceModel.columns[joinParameters.joinField])) {
            referenceField = referenceModel.columns[joinParameters.joinField]
            joinParameters.referenceField = joinParameters.joinField
          }

          // If fields is not defined try to find the relation
          if (_.isUndefined(joinField) && _.isUndefined(referenceField)) {
            findByReference = _.find(joinParameters.joinModel.columns, function (data, key) {
              if (data.referenceTable === joinParameters.referenceTable) {
                data.column = key
                return data
              }
            })
            if (!_.isUndefined(findByReference)) {
              joinParameters.joinField = findByReference.column
              if (!_.isUndefined(findByReference.referenceColumn)) {
                joinParameters.referenceField = findByReference.referenceColumn
              } else {
                joinParameters.referenceField = joinParameters.joinField
              }
            }
          }
        }
      }
      // Add join to query parameters
      main.queryParameters.joins.push(joinParameters)

      return main
    }

    // Add where based on an object
    main.whereObject = function (whereObject) {
      if (!_.isNil(whereObject['_page']) || !_.isNil(whereObject['_pageSize'])) {
        var page = whereObject['_page'] || 1
        var pageSize = whereObject['_pageSize'] || 20
        main.paginate(page, pageSize)

        delete whereObject['_page']
        delete whereObject['_pageSize']
      }
      _.map(whereObject, function (columns, tableName) {
        if (_.isObject(columns)) {
          _.map(columns, function (value, columnName) {
            if (_.isObject(value) && !_.isUndefined(value)) {
              main.whereObject(columns)
            } else if (!_.isUndefined(value)) {
              main.where(tableName + '.' + columnName, value)
            }
          })
        }
      })
      return main
    }

    // Add debugMode
    main.debugMode = function () {
      main.queryParameters.debugMode = true
      return main
    }

    main.memoiseMode = function (ttl) {
      main.queryParameters.memoiseMode = ttl
      return main
    }

    main.setRequest = function (request) {
      if (request) {
        main.queryParameters.request = request
      }
      return main
    }

    // Add where clause to querys
    main.where = function (whereParameters) {
      if (_.isObject(whereParameters) && whereParameters.raw) {
        main.queryParameters.wheres.push(whereParameters)
        return main
      }

      if (_.isFunction(whereParameters)) {
        // If is a function add the function to wheres
        main.queryParameters.wheres.push(whereParameters)
      } else {
        var operators = ['<', '<=', '>', '>=', '<>', '=', 'isNull', 'notIsNull', 'like', 'in', 'notIn']
        var operator = void (0)
        if (!_.isArray(whereParameters) && !_.isObject(whereParameters)) {
          if (operators.indexOf(arguments[1]) > -1) {
            operator = arguments[1]
          }

          if (_.isUndefined(operator) && arguments.length === 2) {
            whereParameters = {
              field: arguments[0],
              operator: _.isNull(arguments[1]) ? 'is' : '=',
              value: handleValue(arguments[1])
            }
          } else {
            var value = (!_.isUndefined(arguments[2])) ? arguments[2] : undefined
            whereParameters = {
              field: arguments[0],
              operator: operator,
              value: handleValue(value)
            }
          }
        }

        if (_.isUndefined(whereParameters.field) && _.isUndefined(whereParameters.operator)) {
          _.map(whereParameters, function (value, key) {
            var op = _.isNull(value) ? 'is' : (_.isArray(value) ? 'in' : '=')
            var assocModel = main
            if (key.indexOf('.') > -1) {
              var fieldTableName = key.split(key, '.')
              if (!_.isUndefined(modelManager.Models[fieldTableName[0]]) && fieldTableName[0] !== main.tableName) {
                assocModel = modelManager.Models[fieldTableName[0]]
              }
            }
            var invalid = false
            if (_.isUndefined(value)) {
              if (!_.isUndefined(assocModel.columns[key]) && assocModel.columns[key].nullable === true) {
                op = 'isNull'
              } else if (!_.isUndefined(assocModel.columns[key]) && (assocModel.columns[key].identity === true || !_.isUndefined(assocModel.columns[key].referenceTable))) {
                invalid = true
              }
            }

            if (!invalid) {
              whereParameters = { field: key, operator: op, value: handleValue(value) }
              main.queryParameters.wheres.push(whereParameters)
            }
          })
        } else {
          if (_.isArray(whereParameters.value) && _.isUndefined(operator)) {
            whereParameters.operator = 'in'
          }

          main.queryParameters.wheres.push(whereParameters)
        }
      }
      return main
    }

    // Add group clause to querys
    main.groupBy = function (groupByParameters) {
      if (_.isString(groupByParameters)) {
        this.queryParameters.groups.push(groupByParameters)
      } else if (_.isArray(groupByParameters)) {
        this.queryParameters.groups = _.union(this.queryParameters.groups, groupByParameters)
      }
      return main
    }

    // Limit the resuts
    main.limit = function (size) {
      main.queryParameters.limit = parseInt(size)
      return main
    }

    // Define an offset for the result
    main.offset = function (position) {
      main.queryParameters.offset = parseInt(position)
      return main
    }

    // Set page and pagelimit
    main.paginate = function (page, pageSize) {
      page = parseInt(page || 1)
      pageSize = parseInt(pageSize || 20)

      main.page = page
      main.pageSize = pageSize

      if (page === 1) {
        page = 0
      } else {
        page = (page * pageSize) - pageSize
      }

      main.limit(pageSize)
      main.offset(page)

      return main
    }

    // Define an order for the result
    main.orderBy = function (column, direction) {
      if (_.isObject(column) && column.raw) {
        main.queryParameters.orders.push({ raw: column.raw })
      } else {
        if (!direction) direction = 'asc'
        main.queryParameters.orders.push({ column: column, direction: direction })
      }
      return main
    }

    main.having = function (obj) {
      main.queryParameters.having.push(obj)
      return main
    }

    // Mount selects
    main.mountSelect = function () {
      if (_.isEmpty(main.queryParameters.selects)) {
        var hasJoins = (main.queryParameters.joins.length > 0)
        _.map(main.columns, function (data, key) {
          if (_.isUndefined(main.tableAlias)) main.tableAlias = main.tableName

          var columnAlias = (hasJoins) ? main.tableAlias + key : key
          main.queryColumnNames.push(columnAlias)
          main.queryParameters.selects.push({ field: main.tableAlias + '.' + key + ' as ' + columnAlias, aggregateFunction: undefined })
        })

        for (var x = 0; x < main.queryParameters.joins.length; x++) {
          var joinParameters = main.queryParameters.joins[x]
          var modelJoin = modelManager.Models[joinParameters.joinTable]

          if (modelJoin == null && joinParameters.isRaw) return void (0)

          _.map(modelJoin.columns, function (data, key) {
            if (_.isUndefined(data.referenceTable)) {
              var columnAlias = joinParameters.joinAlias + key
              main.queryColumnNames.push(columnAlias)
              main.queryParameters.selects.push({ field: joinParameters.joinAlias + '.' + key + ' as ' + columnAlias, aggregateFunction: undefined })
            }
          })
        }
      }

      if (!_.isUndefined(main.queryParameters.offset) && !main.topOne) {
        main.queryParameters.selects.push({ field: ' COUNT(*) OVER() as _TotalRecords' })
        main.queryColumnNames.push('_TotalRecords')
      }

      var selectRaw = ''

      _.map(main.queryParameters.selects, function (select) {
        if (!_.isEmpty(select.raw)) {
          selectRaw += select.raw + ','
        } else {
          var selectNameAlias = getAlias(select.field)
          // Replace dots to underscores of the alias if exists
          selectNameAlias.alias = selectNameAlias.alias.replace(/\./g, '')
          main.queryColumnNames.push(selectNameAlias.alias)
          if (!_.isUndefined(select.aggregateFunction)) {
            selectRaw += select.aggregateFunction + '(' + selectNameAlias.name + ') AS ' + selectNameAlias.alias + ','
          } else {
            selectRaw += select.field + ','
          }
        }
      })
      if (selectRaw.length > 0) {
        selectRaw = selectRaw.substring(0, selectRaw.length - 1)
        if (main.queryParameters.selectDistinct) {
          selectRaw = ' DISTINCT ' + selectRaw
        }
        main.query.column(main.knex.raw2(selectRaw))
      }
    }

    // Mount joins
    main.mountJoin = function () {
      _.each(main.queryParameters.joins, function (join) {
        if (_.isUndefined(join.onRaw)) {
          if (join.joinType === 'left') {
            main.query.leftJoin(join.joinTable + ' as ' + join.joinAlias, join.referenceAlias + '.' + join.referenceField, '=', join.joinAlias + '.' + join.joinField)
          } else {
            main.query.join(join.joinTable + ' as ' + join.joinAlias, join.joinAlias + '.' + join.joinField, '=', join.referenceAlias + '.' + join.referenceField)
          }
        } else {
          main.query.joinRaw(join.joinType + ' join ' + join.joinTable + ' as ' + join.joinAlias + ' on ' + join.onRaw)
        }
      })
    }

    // Mount where clauses
    main.mountWhere = function () {
      _.each(main.queryParameters.wheres, function (where) {
        if (_.isFunction(where)) {
          main.query.where(where)
        } else {
          if (where.raw) {
            main.query.whereRaw(where.raw)
          } else if (where.operator === 'notIsNull') {
            main.query.whereRaw(where.field + ' IS NOT NULL')
          } else if (where.operator === 'isNull') {
            main.query.whereRaw(where.field + ' IS NULL')
          } else if (where.operator === 'like') {
            main.query.whereRaw(`${where.field} LIKE '%${sanitize(where.value, false)}%'`)
          } else if (where.operator === 'in' || Array.isArray(where.values)) {
            main.query.whereIn(where.field, where.value)
          } else if (where.operator === 'notIn') {
            main.query.whereNotIn(where.field, where.value)
          } else {
            if (typeof where.value === 'number' && where.operator === '=') {
              where.value = where.value.toString()
            }
            if (where.value && where.value.length > 0 && (where.value.indexOf('%') === 0 || where.value.indexOf('%') === where.value.length - 1)) {
              main.query.whereRaw(`${where.field} LIKE '${sanitize(where.value, false)}'`)
            } else {
              main.query.where(where.field, where.operator, handleValue(where.value))
            }
          }
        }
      })
    }

    // Mount groupBy clauses
    main.mountGroupBy = function () {
      _.each(main.queryParameters.groups, function (group) {
        main.query.groupByRaw(group)
      })
    }

    // Mount order clauses
    main.mountOrder = function () {
      _.each(main.queryParameters.orders, function (order) {
        if (order.raw) {
          main.query.orderByRaw(order.raw)
        } else {
          main.query.orderBy(order.column, order.direction)
        }
      })
    }

    main.mountHaving = function () {
      _.each(main.queryParameters.having, function (having) {
        if (having.raw) {
          main.query.havingRaw(having.raw)
        }
      })
    }

    main.findOne = async function (parameters) {
      parameters = parameters || {}
      parameters._pageSize = 1
      main.topOne = true

      const response = await this.find(parameters)

      // TODO: Solve queryColumnNames for raw selects because column name is not in the queryColumnNames
      if (response.totalRecords === 0) {
        response.data.push(_.reduce(main.queryColumnNames, (agg, val) => ({ ...agg, [val]: void (0) }), {}))
      }
      response.data = (response.data.length > 0) ? response.data[0] : null
      return response
    }

    // Find records related to model on database
    main.find = async function (parameters) {
      var newParameters = true
      if (_.isEmpty(parameters)) {
        newParameters = false
      }

      parameters = checkParameters(parameters)

      if (!_.isUndefined(parameters) && (!_.isUndefined(parameters['_page']) || !_.isUndefined(parameters['_pageSize']))) {
        var page = parameters['_page'] || 1
        var pageSize = parameters['_pageSize'] || 20
        main.paginate(page, pageSize)

        if (!_.isUndefined(parameters['_page'])) delete parameters['_page']
        if (!_.isUndefined(parameters['_pageSize'])) delete parameters['_pageSize']
      }

      if (newParameters || (!_.isEmpty(parameters) && _.isEmpty(main.queryParameters.wheres))) {
        main.where(_.mapValues(parameters, value => handleValue(value)))
      }

      main.query = main.knex(main.tableName)

      if (!_.isUndefined(main.queryParameters.limit)) {
        main.query.limit(main.queryParameters.limit)
      }

      if (!_.isUndefined(main.queryParameters.offset)) {
        main.query.offset(main.queryParameters.offset)
      }

      if (_.isEmpty(main.queryParameters.orders)) {
        main.orderBy(main.tableName + '.' + main.idAttribute)
      }

      main.mountSelect()
      main.mountJoin()
      main.mountWhere()
      main.mountGroupBy()
      main.mountHaving()
      main.mountOrder()

      // query = main.query.toSQL()
      if (main.queryParameters.debugMode) {
        console.info('---------------------------------------')
        console.info(main.query.toString())
        console.info('---------------------------------------')
      }

      const queryInString = main.query.toString()
      const querySHA1 = sha1(queryInString)
      if (main.queryParameters.memoiseMode)
      {
        const resultMemoise = await memoiseData.get(querySHA1)

        if (resultMemoise) return setResults(resultMemoise)
      }

      try {
        const result = await main.execute(queryInString)
        if (main.queryParameters.memoiseMode) {
          memoiseData.set(querySHA1, result, main.queryParameters.memoiseMode)
        }
        return setResults(result)
      } catch (err) {
        console.info(err)
        console.info('---------------------------------------')
        console.info(main.query.toString())
        console.info('---------------------------------------')
        throw err
      }
    }

    main.execute = async function (query) {
      const ignoreMethods = []
      const ignorePaths = ['/Authenticate', '/Persons']

      const querySha = sha1(query)
      const queryLowerCase = query.toLowerCase()

      // Disabling update and delete without where
      if (_.includes(queryLowerCase, 'update ') || _.includes(queryLowerCase, 'delete ')) {
        if (_.includes(queryLowerCase, 'where ') === false) {
          throw new Error('CANNOT_UPDATE_OR_DELETE_WITHOUT_WHERE')
        }
      }

      const startDate = new Date()
      let displayBenchmark = (main.queryParameters.benchmark === 2 || (main.queryParameters.benchmark === 1 && main.queryParameters.request)) ? 1 : 0

      if (main.queryParameters.request) {
        if (_.find(ignorePaths, (d) => _.includes(main.queryParameters.request.path, d)) || (main.queryParameters.request.internalPath && _.includes(ignoreMethods, main.queryParameters.request.internalPath.Method))) {
          displayBenchmark = 0
        }
      }

      let fullpath = ` - ${main.tableName} - ${query.substring(0, 20)}`
      if (main.queryParameters.request && main.queryParameters.request.path) {
        if (main.queryParameters.request.internalPath) {
          fullpath = ` - ${main.queryParameters.request.path} - ${main.queryParameters.request.internalPath.Event}.${main.queryParameters.request.internalPath.Method}`
        } else if (main.queryParameters.request.path) {
          fullpath = ` - ${main.queryParameters.request.path}`
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
      return queryResult.recordset
    }
    // Save records on database
    main.save = async function (parameters, method) {
      // await memoiseData.clear()
      if (parameters === 'insert' || parameters === 'update') {
        method = parameters
        parameters = void (0)
      }

      parameters = checkParameters(parameters)

      main.query = knex(main.tableName)
      if (method !== 'insert') {
        if (!_.isUndefined(parameters[main.idAttribute])) {
          if (_.isEmpty(main.queryParameters.wheres)) {
            main.where(main.idAttribute, parameters[main.idAttribute])
          }
          delete parameters[main.idAttribute]
        }
      }
      if (_.isUndefined(method)) {
        method = 'insert'
        if (!_.isEmpty(main.queryParameters.wheres)) {
          method = 'update'
        }
      }
      main.query.returning('*')
      if (method === 'insert') {
        const insert = main.query.insert(parameters).toString()
        if (main.queryParameters.debugMode) {
          console.info(insert)
        }
        return setResults(await main.execute(insert))
      } else {
        main.mountWhere()
        const query = main.query.update(parameters).toString()
        if (main.queryParameters.debugMode) {
          console.info(query)
        }
        const result = await main.execute(query)
        if (main.queryParameters.debugMode) {
          console.info(query)
        }
        return setResults(result)
      }
    }

    // Mark as isDelete records on database
    main.softDelete = async function (parameters) {
      var newParameters = true
      if (_.isEmpty(parameters)) {
        newParameters = false
      }
      parameters = checkParameters(parameters)

      main.query = knex(main.tableName)
      if (newParameters || (!_.isEmpty(parameters) && _.isEmpty(main.queryParameters.wheres))) {
        main.where(parameters)
      }

      main.mountWhere()
      main.query.returning('*')
      const query = main.query.update({ IsDeleted: 1, DeletedAt: now() }).toString()

      if (main.queryParameters.debugMode) {
        console.info(query)
      }

      return setResults(await main.execute(query))
    }

    // Delete records on database
    main.delete = async function (parameters) {
      parameters = checkParameters(parameters)

      if (parameters.length === 0) throw Error('Trava de segurança! Delete acionado sem parâmetros')

      var query = knex(main.tableName)
      _.forEach(parameters, (value, key) => {
        const newvalue = handleValue(value)
        _.isArray(value) ? query.whereIn(key, newvalue) : query.where(key, newvalue)
      })

      const queryString = query.delete().toString()

      main.totalRecords = await main.execute(queryString)

      return setResults([])
    }

    // Delete records on database
    main.deleteAll = async function (parameters) {
      var newParameters = true
      if (_.isEmpty(parameters)) {
        newParameters = false
      }
      parameters = checkParameters(parameters)

      main.query = knex(main.tableName)
      if (newParameters || (!_.isEmpty(parameters) && _.isEmpty(main.queryParameters.wheres))) {
        main.where(parameters)
      }

      if (main.queryParameters.wheres.length === 0) throw Error('Trava de segurança! Delete acionado sem parâmetros')

      main.mountWhere()

      const queryString = main.query.delete().toString()

      if (main.queryParameters.debugMode) {
        console.info(queryString)
      }

      main.totalRecords = await main.execute(queryString)

      return setResults([])
    }

    // Validate filled parameters of the model
    main.validate = function (parameters) {
      parameters = checkParameters(parameters)
      var Validations = require('../../validations')()
      if (!_.isUndefined(Validations[main.tableName])) {
        return Validations[main.tableName].validate(parameters)
      } else {
        return { isValid: false }
      }
    }

    // Validate parameters with required of the model
    main.validateModel = function (parameters) {
      parameters = checkParameters(parameters)
      var Validations = require('../../validations')()
      if (!_.isUndefined(Validations[main.tableName])) {
        return Validations[main.tableName].validateModel(parameters)
      } else {
        return { isValid: false }
      }
    }

    modelManager.AddModel(main)
  }

  return Model
}

module.exports = ModelBase
