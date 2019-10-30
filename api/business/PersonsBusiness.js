import BaseBusiness from './BaseBusiness'

const base = new BaseBusiness('Persons')
const PersonsBusiness = {
  ...base
}

export default PersonsBusiness
