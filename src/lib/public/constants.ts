export const Errors = {
  NotAnIterator: 'NotAnIterator',
  NotIterable: 'NotIterable',
  InternalError: 'InternalError',
  NotAsyncIterable: 'NotAsyncIterable',
  NonEmptyExpected: 'NonEmptyExpected'
}

/**
 * A non-empty array, consisting of at least one element.
 * @typeparam E the array element type
 */
export type NonEmpty<E> = [E, ...E[]]

/**
 * Returns true if the input array `arr` is not empty.
 */
export function isNonEmpty<T>(arr: T[]): arr is NonEmpty<T> {
  return arr.length > 0
}

/**
 * A function with 0 arguments that returns a value.
 * @typeparam T the value type
 */
export type Lazy<T> = () => T

/**
 * An optionally lazy value of type T, can be directly a value T, or a function of arity 0 that returns a value of type T
 * @typeparam T the value type
 */
export type OptLazy<T> = Lazy<T> | T

export const optToLazy = <T>(optLazy: OptLazy<T>): Lazy<T> => {
  if (typeof optLazy === 'function') return optLazy as Lazy<T>
  return () => optLazy
}
export const optToValue = <T>(optLazy: OptLazy<T>): T => optToLazy(optLazy)()

/**
 * Any function that takes an element of type E and its index, and returns a result of type R
 * @typeparam E the element type
 * @typeparam R the result type
 */
export type IterFun<E, R> = (elem: E, index: number) => R

/**
 * A function taking an element of type E and its index, and returns a boolean.
 */
export type Pred<E> = IterFun<E, boolean>

/**
 * A function that takes an element of type E and its index, and performs some side effect.
 */
export type Effect<E> = IterFun<E, void>

/**
 * A function that takes an element of type A and its index, and returns an element of type B.
 */
export type MapFun<A, B> = IterFun<A, B>

/**
 * A functio that takes an element of type A and its index, and returns an element of type B or undefined.
 */
export type CollectFun<A, B> = IterFun<A, B | undefined>

/**
 * A function that takes a current state of type S, an element of type E and its index, and returns a new state of type S.
 * @typeparam E the element type
 * @typeparam S the state type
 */
export type FoldFun<E, S> = (state: S, elem: E, index: number) => S

export type AnyIterable<E> = Iterable<E> | AsyncIterable<E>
export type AnyIterator<E> = Iterator<E> | AsyncIterator<E>

export type Indexed<E> = Iterable<E> & { [key: number]: E; length: number }

/**
 * A type used by the .monitor() function to allow lazy side effects.
 * @typeparam E the element type
 */
export type MonitorEffect<E> = (value: E, index: number, tag?: string) => void

export type Dict<K, V> = Map<K, V[]>
export const Dict = <K, V>(): Dict<K, V> => new Map()

/**
 * A Dictionary with unique values per key, represented as a map of keys K to Sets of values V
 * @typeparam K the key type
 * @typeparam V the value type
 */
export type UniqueDict<K, V> = Map<K, Set<V>>
export const UniqueDict = <K, V>(): UniqueDict<K, V> => new Map()

/**
 * A Map with, for each key, the amount of occurrances of the key as its value
 */
export type Histogram<K> = Map<K, number>
export const Histogram = <K>(): Histogram<K> => new Map()
