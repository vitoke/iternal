export class Type {
  static isFunction = (f: any) => typeof f === 'function'

  static isObject = (o: any) => typeof o === 'object'

  static isArray = (a: any) => Array.isArray(a)

  static isMap = (a: any) => a instanceof Map

  static isSet = (a: any) => a instanceof Set

  static isPureObject = (o: object) => Type.isObject(o) && o.constructor.name === 'Object'

  static isPrimitive = (a: any) => !Type.isObject(a) && !Type.isFunction(a)

  static isIterable = (o: any) => Symbol.iterator in Object(o)

  static isIterator = (o: any) => Type.isFunction(o.next)

  static isAsyncIterable = (o: any) => Symbol.asyncIterator in Object(o)
}

export const error = (name: string, msg?: string): Error => {
  const result = Error(msg)
  result.name = name
  return result
}
