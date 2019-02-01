import { AnyIterable, AnyIterator, Pred, MonitorEffect } from '../../public/constants'
import { Type } from '../util'

export const NoValue: unique symbol = Symbol('NO_VALUE')
export type NoValue = typeof NoValue

export function getIterator<T>(iterable: Iterable<T>): Iterator<T> {
  return iterable[Symbol.iterator]()
}

export function getAsyncIterator<T>(iterable: AsyncIterable<T>): AsyncIterator<T> {
  return iterable[Symbol.asyncIterator]()
}

export function getAnyIterator<T>(iterable: AnyIterable<T>): AnyIterator<T> {
  if ((iterable as any)[Symbol.asyncIterator]) {
    return (iterable as any)[Symbol.asyncIterator]()
  }
  return (iterable as any)[Symbol.iterator]()
}

export function getRandomFloat(min = 0.0, max = 1.0) {
  const r = Math.random()
  return r * (max - min) + min
}

export function getRandomInt(min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const minR = Math.ceil(min)
  const maxR = Math.floor(max)
  const r = Math.random()
  return Math.floor(r * (max - min)) + min
}

export function checkPureIterable<E>(it: Iterable<E>): Iterable<E> {
  if (!Type.isIterable(it)) throw new Error('not iterable')
  if (Type.isIterator(it)) throw new Error('should not have iterator methods')
  return it
}

export function checkPureAsyncIterable(it: any) {
  if (!Type.isAsyncIterable(it)) throw new Error('not async iterable')
  if (Type.isIterator(it)) throw new Error('should not have iterator methods')
  return it
}

export function checkPureAnyIterable(it: any) {
  if (!Type.isIterable(it) && !Type.isAsyncIterable(it)) {
    throw new Error('not iterable or async iterable')
  }
  if (Type.isIterator(it)) throw new Error('should not have iterator methods')
  return it
}

export function optPred<E>(value: E, index: number, pred?: Pred<E>): boolean {
  return pred !== undefined && pred(value, index)
}

export const defaultMonitorEffect: MonitorEffect<any> = (v, i, t) =>
  console.log(`${t || ''}[${i}]: ${v}`)
