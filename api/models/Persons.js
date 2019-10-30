import { ModelManager } from '../database'

var Persons = ModelManager.Model({
  tableName: 'Persons',
  columns: {
    IdPerson: { type: 'integer', identity: true, unique: true, nullable: false },
    BirthDate: { type: 'date', nullable: true },
    Email: { type: 'string', size: '150', nullable: true },
    Name: { type: 'string', size: '250', nullable: true },
    Number: { type: 'string', unique: true, size: '20', nullable: false },
    PhoneCountryCode: { type: 'string', size: '3', nullable: true },
    PhoneAreaCode: { type: 'string', size: '5', nullable: true },
    PhoneNumber: { type: 'string', size: '15', nullable: true },
    Sex: { type: 'char', size: '1', nullable: true },
    CanReceivePayments: { type: 'boolean', nullable: false },
    CreatedAt: { type: 'datetime', nullable: false },
    UpdatedAt: { type: 'datetime', nullable: true },
    DeletedAt: { type: 'datetime', nullable: true },
    IsDeleted: { type: 'boolean', nullable: false },
  }
})

export default Persons
