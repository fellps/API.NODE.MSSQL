var Config = require('../config')
var fs = require('fs')
var Handlebars = require('handlebars')
var schemaReader = require('mssql-schema-reader')

var dbConfig = schemaReader.createConfig(Config.database.connection.user, Config.database.connection.password, Config.database.connection.host, Config.database.connection.database)
var settings = {
  projectFolder: '../',
  templates: [
    { file: 'modelsList.tt', destination: 'api/models/modelsList.js' },
    { file: 'index.tt', destination: 'api/models/index.js' },
    { file: 'model.tt', destination: 'api/models/' }
  ]
}

schemaReader.schema.fromServer(dbConfig, function (err, result) {
  if (err) { console.info('Problem fetching info from server: ' + err.message) }

  var tables = result.owners[0].tables

  // Removing undesirable tables
  var newTables = []
  for (var d = 0; d < tables.length; d++) {
    if (tables[d].name !== 'sysdiagrams') {
      newTables.push(tables[d])
    }
  }
  tables = newTables

  // Adding some settings to columns of mapped table
  for (var x = 0; x < tables.length; x++) {
    var table = tables[x]
    var uniqueColumns = []
    if (table.indicies.length > 0) {
      for (var w = 0; w < table.indicies.length; w++) {
        if (table.indicies[w].isUnique) {
          for (var z = 0; z < table.indicies[w].columns.length; z++) {
            uniqueColumns.push(table.indicies[w].columns[z].name)
          }
        }
      }
    }
    for (var y = 0; y < table.columns.length; y++) {
      if (table.columns[y].name === 'CreatedAt' || table.columns[y].name === 'DeletedAt' || table.columns[y].name === 'UpdatedAt' || table.columns[y].name === 'IsDeleted') {
        tables[x].columns[y].isInternal = true
      }
      if (table.columns[y].name === 'Password') {
        tables[x].columns[y].destinationType = 'password'
      } else if (table.columns[y].nativeType === 'int') {
        tables[x].columns[y].destinationType = 'integer'
      } else if (table.columns[y].nativeType === 'bit') {
        tables[x].columns[y].destinationType = 'boolean'
      } else if (table.columns[y].nativeType === 'decimal') {
        tables[x].columns[y].destinationType = 'money'
      } else if (table.columns[y].nativeType === 'varchar') {
        tables[x].columns[y].destinationType = 'string'
      } else if (table.columns[y].nativeType === 'datetime' || table.columns[y].nativeType === 'date') {
        tables[x].columns[y].destinationType = table.columns[y].nativeType
        tables[x].columns[y].isDate = true
      } else {
        tables[x].columns[y].destinationType = tables[x].columns[y].nativeType
      }

      if (uniqueColumns.indexOf(table.columns[y].name) > -1 || tables[x].columns[y].isPrimaryKey) {
        if (tables[x].columns[y].isPrimaryKey) {
          tables[x].primaryKeyColumn = tables[x].columns[y]
        }
        tables[x].columns[y].isUnique = true
      }
    }
  }

  for (var p = 0; p < settings.templates.length; p++) {
    (function (templateSettings) {
      fs.readFile(settings.templates[p].file, 'utf8', function (err, source) {
        if (err) return console.error(err)

        var destination = settings.projectFolder + templateSettings.destination

        var destinationFolder = ''
        var singleFile = false

        if (destination.substr(-3) === '.js') {
          singleFile = true
        } else {
          destinationFolder = destination
        }
        var template = Handlebars.compile(source)

        var parameters = {}
        var result = ''
        if (singleFile) {
          parameters = { 'tables': tables }
          result = template(parameters)
          if (!fs.existsSync(destination)) {
            fs.writeFileSync(destination, result)

            console.info(destination + ' - Gerado com sucesso!')
          }
        } else {
          for (var x = 0; x < tables.length; x++) {
            if (tables[x].name !== 'sysdiagrams') {
              parameters = { 'table': tables[x] }
              result = template(parameters)
              var destinationFile = destinationFolder + tables[x].name + '.js'

              if (!fs.existsSync(destinationFolder)) {
                fs.mkdirSync(destinationFolder)
              }

              if (!fs.existsSync(destinationFile)) {
                fs.writeFileSync(destinationFile, result)

                console.info(destinationFile + ' - Gerado com sucesso!')
              }
            }
          }
        }
      })
    })(settings.templates[p])
  }
})
