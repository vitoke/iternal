/**
 * @module iternal
 */

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

export namespace NonEmpty {
  /**
   * Returns true if the input array `arr` is not empty.
   */
  export function isNonEmpty<T>(arr: T[]): arr is NonEmpty<T> {
    return arr.length > 0
  }
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

export namespace OptLazy {
  /**
   * Returns an always lazy value of type `Lazy<T>` from an optionally lazy value of type `OptLazy<T>`
   * @typeparam T the value type
   * @param optLazy the optionally lazy input
   */
  export function toLazy<T>(optLazy: OptLazy<T>): Lazy<T> {
    if (typeof optLazy === 'function') return optLazy as Lazy<T>
    return () => optLazy
  }

  /**
   * Returns the value of an optionally lazy value of type `OptLazy<T>`
   * @typeparam T the value type
   * @param optLazy the optionally lazy input
   */
  export function toValue<T>(optLazy: OptLazy<T>): T {
    return toLazy(optLazy)()
  }
}

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
 * A function that takes a current state of type S, an element of type E and its index, and returns a new state of type S.
 * @typeparam E the element type
 * @typeparam S the state type
 */
export type ReduceFun<E, S = E> = (state: S, elem: E, index: number) => S

/**
 * An Iterable or AsyncIterable of element type E
 */
export type AnyIterable<E> = Iterable<E> | AsyncIterable<E>

/**
 * An Iterator or AsyncIterator of element type E
 */
export type AnyIterator<E> = Iterator<E> | AsyncIterator<E>

/**
 * Any type that is both iterable and indexable by number, and has a defined length
 */
export type Indexed<E> = Iterable<E> & { [key: number]: E; length: number }

/**
 * A type used by the .monitor() function to allow lazy side effects.
 * @typeparam E the element type
 */
export type MonitorEffect<E> = (value: E, index: number, tag?: string) => void

/**
 * A Map with keys K and each key having multiple values of type V.
 * @typeparam K the key type
 * @typeparam V the value type
 */
export type Dict<K, V> = Map<K, V[]>

export namespace Dict {
  export function create<K, V>(): Dict<K, V> {
    return new Map()
  }

  export function add<K, V>(dict: Dict<K, V>, key: K, value: V): Dict<K, V> {
    const entries = dict.get(key)
    if (entries === undefined) dict.set(key, [value])
    else entries.push(value)
    return dict
  }
}

/**
 * A Dictionary with unique values per key, represented as a map of keys K to Sets of values V
 * @typeparam K the key type
 * @typeparam V the value type
 */
export type UniqueDict<K, V> = Map<K, Set<V>>

export namespace UniqueDict {
  export function create<K, V>(): UniqueDict<K, V> {
    return new Map()
  }

  export function add<K, V>(dict: UniqueDict<K, V>, key: K, value: V): UniqueDict<K, V> {
    const entrySet = dict.get(key)
    if (entrySet === undefined) dict.set(key, new Set().add(value))
    else entrySet.add(value)
    return dict
  }
}

/**
 * A Map with, for each key, the amount of occurrances of the key as its value
 */
export type Histogram<K> = Map<K, number>

export namespace Histogram {
  export function create<K>(): Histogram<K> {
    return new Map()
  }

  export function add<K>(hist: Histogram<K>, value: K): Histogram<K> {
    const count = hist.get(value) || 0
    hist.set(value, count + 1)
    return hist
  }
}
