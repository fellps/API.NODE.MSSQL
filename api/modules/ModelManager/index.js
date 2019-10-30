var _ = require('lodash')
/**
 * ModelManager constructor.
 */
function ModelManager (Knex) {
  // Return a new instance of this object when use require(...)()
  if (!(this instanceof ModelManager)) {
    return new ModelManager(Knex)
  }

  var modelManager = {}
  modelManager.Models = {}
  modelManager.AddModel = function (model) {
    if (_.isUndefined(modelManager.Models[model.tableName])) {
      modelManager.Models[model.tableName] = model
    }
  }

  modelManager.references = []
  modelManager.AddReference = function (table, field, referenceTable, referenceField) {
    if (_.isUndefined(referenceField)) {
      referenceField = field
    }

    var exists = _.find(this.references, { table: table, field: field })
    if (_.isUndefined(exists)) {
      this.references.push({
        table: table,
        field: field,
        referenceTable: referenceTable,
        referenceField: referenceField
      })
    }
  }

  modelManager.Model = require('./ModelBase')
  modelManager.knex = Knex
  modelManager.modelManager = modelManager
  return modelManager

}
module.exports = ModelManager
