import context from '../helpers/context'

import { ClearApi } from '../modules/Result'

const _login = async (Business, req, res) => {
  const result = await Business({ ...req.body, ...req.auth, _Request: req })
  if (!result || result.error) {
    res.status(result.status || 400).json(ClearApi(result))
  } else {
    res.status(200).json(ClearApi(result))
  }
}

export async function login (req, res) {
  await _login(context.Business.Users.login, req, res)
}

