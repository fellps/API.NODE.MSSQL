export default function (obj) {
  return obj && obj.constructor && obj.constructor.name === 'GeneratorFunction'
}  