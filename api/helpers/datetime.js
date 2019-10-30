import moment from 'moment'

export const mountISODateTime = (date, time, addFiftyNineSeconds = false) => {
  var dateFormateed = ''
  if (date && time) {
    const newTime = time.slice(0, 5)
    const maxSecond = (date, time) => `${date} ${time}:59.999`
    const minSecond = (date, time) => `${date} ${time}:00.000`

    if (time.length === 12)
      // example time: 19:38:20.000
      dateFormateed = addFiftyNineSeconds ? maxSecond(date, newTime) : minSecond(date, newTime)
    else if (time.length === 8)
      // example time: 19:38:20 - new condiction add seconds
      dateFormateed = addFiftyNineSeconds ? maxSecond(date, newTime) : minSecond(date, newTime)
    else
      // example time: '19:38'
      dateFormateed = addFiftyNineSeconds ? maxSecond(date, time) : minSecond(date, time)
  } else
    dateFormateed = void (0)

  return dateFormateed
}
// Hoje tem 8 caracteres 07:23:39.000
export const now = () => moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')
export const transformDate = (date) => {
  const result = moment(date).tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')
  if (result === 'Invalid date') return void (0)
  return result
}
export const getDaysBeforeNow = (numberOfDays) => moment().tz('America/Sao_Paulo').subtract(numberOfDays, 'day').format('YYYY-MM-DD')
export const dateFormatDDMMYYYY = (date) => moment(date).format('DD/MM/YYYY')
export const hourFormatHHmmFromDateUTC = (date) => moment.utc(date).format('HH:mm')
export const nowTimeSubtractOneHour = () => moment().subtract(1, 'hour').tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss.SSS')
