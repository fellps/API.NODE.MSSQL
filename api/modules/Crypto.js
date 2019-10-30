var crypto = require('crypto')
const bcrypt = require('bcrypt')

export function Encrypt (data, key, iv) {
  var cipher = crypto.createCipheriv('AES-256-CBC', key, iv)
  cipher.setEncoding('base64')
  cipher.write(new Buffer(data).toString('hex'))
  cipher.end()
  return cipher.read()
}

export function Encrypt2 (data, key, iv) {
  var cipher = crypto.createCipheriv('AES-256-CBC', key, iv)
  cipher.setEncoding('base64')
  cipher.write(new Buffer(data))
  cipher.end()
  return cipher.read()
}

export function Decrypt (data, key, iv) {
  data = data.split(' ').join('+')

  var decryptor = crypto.createDecipheriv('AES-256-CBC', key, iv)
  var dec = decryptor.update(data, 'base64', 'utf8')
  dec += decryptor.final('utf8')
  return dec
}

export function hex2a (hexx) {
  var hex = hexx.toString() // force conversion
  var str = ''
  for (var i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }
  return str
}

export function a2hex (ascii) {
  var arr1 = []
  for (var n = 0, l = ascii.length; n < l; n++) {
    var hex = Number(ascii.charCodeAt(n)).toString(16)
    arr1.push(hex)
  }
  return arr1.join('')
}

export async function bcryptEncrypt (data, saltRounds = 10) {
  const hashedData = await bcrypt.hash(data, saltRounds)

  return hashedData
}

export async function bcryptCompare (data, hash) {
  return bcrypt.compare(data, hash)
}

export function JsonDecrypt (data, key, iv) {
  data = data.split(' ').join('+')

  var decryptor = crypto.createDecipheriv('AES-256-CBC', key, iv)
  var dec = decryptor.update(data, 'base64', 'utf8')
  dec += decryptor.final('utf8')

  var result = ''
  try {
    result = JSON.parse(dec)
  } catch (e) {
    try {
      result = JSON.parse(dec + '"}]')
    } catch (e1) {
      try {
        result = JSON.parse(dec + '}]')
      } catch (e2) {
        try {
          result = JSON.parse(dec + ']')
        } catch (e3) {
          result = JSON.parse(dec + 'null}]')
        }
      }
    }
  }

  return result
}
