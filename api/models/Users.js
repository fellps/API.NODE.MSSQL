import { ModelManager } from '../database'

var Users = ModelManager.Model({
  tableName: 'Users',
  columns: {
    IdUser: { type: 'integer', identity: true, unique: true, nullable: false },
    IdPerson: { type: 'integer', referenceTable: 'Persons', nullable: false },
    Login: { type: 'string', unique: true, size: '150', nullable: false },
    Password: { type: 'password', size: '100', nullable: false },
    CreatedAt: { type: 'datetime', nullable: false },
    UpdatedAt: { type: 'datetime', nullable: true },
    DeletedAt: { type: 'datetime', nullable: true },
    IsDeleted: { type: 'boolean', nullable: false },
  }
})

export default Users
