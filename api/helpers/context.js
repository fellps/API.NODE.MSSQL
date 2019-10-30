import * as Models from '../models'
import * as Business from '../business'
import * as Controllers from '../controllers'
import validations from '../validations'
import * as Config from '../../config'

const Validations = validations()

export { Validations }
export default {
  Business,
  Config,
  Controllers,
  Models,
  Validations
}
