var ValidationBase = require('./ValidationBase')
var UsersMinimalValidation = new ValidationBase()

/**
 * UsersMinimalValidation rules
 */
UsersMinimalValidation.addRules({
  Login: { Rule: 'isEmpty', Message: 'O nome do usuário é obrigatório!' },
  Password: { Rule: 'isEmpty', Message: 'A senha é obrigatória!' },
  Persons: {
    Number: { Rule: 'isEmpty', Message: 'O CPF é obrigatório!' },
    Name: { Rule: 'isEmpty', Message: 'O Nome é obrigatório!' },
    Sex: { Rule: 'isEmpty', Message: 'O Sexo é obrigatório!' }
  }
})
module.exports = UsersMinimalValidation
