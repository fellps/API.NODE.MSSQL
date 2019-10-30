import BaseBusiness from './BaseBusiness'
import Result from '../modules/Result'
import context from '../helpers/context'

const base = new BaseBusiness('Users')
const UsersBusiness = {
  ...base,

  login: async function (params) {
    const { Models } = context

    const result = await Models.Users()
      .join('Persons')
      .where('Users.Login', params.Login)
      .find()

    return Result.Success.SuccessOnLogin(result)
  }
}

export default UsersBusiness
