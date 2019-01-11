import { AnyIterable, AnyIterator, Pred } from '../../public/iternal'
import { Type } from '../util'

export const NoValue: unique symbol = Symbol('NO_VALUE')
export type NoValue = typeof NoValue

export const getIterator = <T>(iterable: Iterable<T>): Iterator<T> => iterable[Symbol.iterator]()

export const getAsyncIterator = <T>(iterable: AsyncIterable<T>): AsyncIterator<T> =>
  iterable[Symbol.asyncIterator]()

export const getAnyIterator = <T>(iterable: AnyIterable<T>): AnyIterator<T> => {
  if ((iterable as any)[Symbol.asyncIterator]) {
    return (iterable as any)[Symbol.asyncIterator]()
  }
  return (iterable as any)[Symbol.iterator]()
}

export const random = (min = 0.0, max = 1.0) => {
  const r = Math.random()
  return r * (max - min) + min
}

export const randomInt = (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const minR = Math.ceil(min)
  const maxR = Math.floor(max)
  const r = Math.random()
  return Math.floor(r * (max - min)) + min
}

export const checkPureIterable = <E>(it: Iterable<E>): Iterable<E> => {
  if (!Type.isIterable(it)) throw new Error('not iterable')
  if (Type.isIterator(it)) throw new Error('should not have iterator methods')
  return it
}

export const checkPureAsyncIterable = (it: any) => {
  if (!Type.isAsyncIterable(it)) throw new Error('not async iterable')
  if (Type.isIterator(it)) throw new Error('should not have iterator methods')
  return it
}

export const checkPureAnyIterable = (it: any) => {
  if (!Type.isIterable(it) && !Type.isAsyncIterable(it)) {
    throw new Error('not iterable or async iterable')
  }
  if (Type.isIterator(it)) throw new Error('should not have iterator methods')
  return it
}

export const optPred = <E>(value: E, index: number, pred?: Pred<E>): boolean =>
  pred !== undefined && pred(value, index)
