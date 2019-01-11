import { Fold } from '../fold'
import { Pred, OptLazy, optToValue, Dict, UniqueDict, Histogram } from '../../constants'
import { NoValue } from '../../../private/iternal-common'
import { Folder, MonoFolder } from '../types'

const throwFoldError = () => {
  throw Error('fold error')
}

function addToDict<K, V>(dict: Dict<K, V>, key: K, value: V) {
  const entries = dict.get(key)
  if (entries === undefined) dict.set(key, [value])
  else entries.push(value)
  return dict
}

function addToUniqueDict<K, V>(dict: UniqueDict<K, V>, key: K, value: V) {
  const entrySet = dict.get(key)
  if (entrySet === undefined) dict.set(key, new Set().add(value))
  else entrySet.add(value)
  return dict
}

/**
 * A utility class containing funcions to create new Folders, and commonly usable Folders
 */
export class Folds {
  /**
   * Returns a folder that takes all elements of any type, converts them to a string, and concatenates them.
   * @example
   * ```typescript
   * Iter.of(1, 3, 5).fold(Fold.stringAppend)
   * result: '123'
   * ```
   */
  static stringAppend: Folder<any, string> = Fold.create('', (state, elem) =>
    state.concat(String(elem))
  )

  /**
   * Returns a folder that takes all elements of any type, converts them to a string, and concatenates them in reverse order.
   * @example
   * ```typescript
   * Iter.of(1, 3, 5).fold(Fold.stringPrepend)
   * result: '321'
   * ```
   */
  static stringPrepend: Folder<any, string> = Fold.create('', (state, elem) =>
    String(elem).concat(state)
  )

  /**
   * Returns a folder that outputs the the amount of elements processed
   * @example
   * ```typescript
   * Iter.of(1, 3, 5).fold(Fold.count)
   * result: 3
   * ```
   */
  static count: Folder<any, number> = Fold.create(0, (_, __, index) => index + 1)

  /**
   * Returns a folder that takes tuple elements of [string, V] and returns an object with those keys and values.
   * Note: mutates the target object
   * @typeparam V the value type
   * @param target a target object to add the properties to
   * @example
   * ```typescript
   * Iter.of(['foo', 1], ['bar', true]).fold(Fold.toObject())
   * result: { foo: 1, bar: true}
   * ```
   */
  static toObject<V>(target?: {}): Folder<[string, V], { [key: string]: V }> {
    return Fold.create<[string, V], { [key: string]: V }>(
      () => target || {},
      (obj, [name, value]) => {
        obj[name] = value
        return obj
      }
    )
  }

  /**
   * Returns a folder that outputs the first element it encounters that satisfies `pred`.
   * If no value is found, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param pred a predicate over elements E
   * @param otherwise specifies how to deal with the potential case that this Iter is empty. There are three cases:
   *    - not specified / undefined: If this Iter is empty, this function will throw an error
   *    - (value: T): If this Iter is empty, it will return the given value instead
   *    - (f: () => T): If this Iter is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Iter.nats.find(v => v > 10)
   * result: 11
   * ```
   */
  static find<E>(pred: Pred<E>, otherwise: OptLazy<E> = throwFoldError): Folder<E, E> {
    return Fold.createGen<E, E | NoValue, E>(
      NoValue,
      (found, value, index) => {
        if (found !== NoValue) return found
        if (pred(value, index)) return value
        return NoValue
      },
      state => (state === NoValue ? optToValue(otherwise) : state),
      state => state !== NoValue
    )
  }

  /**
   * Returns a folder that outputs the last element it encounters that satisfies `pred`.
   * If no value is found, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param pred a predicate over elements E
   * @param otherwise specifies how to deal with the potential case that this Iter is empty. There are three cases:
   *    - not specified / undefined: If this Iter is empty, this function will throw an error
   *    - (value: T): If this Iter is empty, it will return the given value instead
   *    - (f: () => T): If this Iter is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Iter.of(1, 4, 2, 9, 3, 8).findLast(v => v < 8)
   * result: 3
   * ```
   */
  static findLast<E>(pred: Pred<E>, otherwise: OptLazy<E> = throwFoldError): Folder<E, E> {
    return Fold.createGen<E, E | NoValue, E>(
      NoValue,
      (found, value, index) => (pred(value, index) ? value : found),
      state => (state === NoValue ? optToValue(otherwise) : state)
    )
  }

  /**
   * Returns a folder that returns the first element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that this Iter is empty. There are three cases:
   *    - not specified / undefined: If this Iter is empty, this function will throw an error
   *    - (value: T): If this Iter is empty, it will return the given value instead
   *    - (f: () => T): If this Iter is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Iter.fromIterable('abc').fold(Fold.first())
   * result: 'a'
   * ```
   */
  static first<E>(otherwise: OptLazy<E> = throwFoldError): Folder<E, E> {
    return Folds.find(() => true, otherwise)
  }

  /**
   * Returns a folder that returns the last element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that this Iter is empty. There are three cases:
   *    - not specified / undefined: If this Iter is empty, this function will throw an error
   *    - (value: T): If this Iter is empty, it will return the given value instead
   *    - (f: () => T): If this Iter is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Iter.fromIterable('abc').fold(Fold.last())
   * result: 'c'
   * ```
   */
  static last<E>(otherwise: OptLazy<E> = throwFoldError): Folder<E, E> {
    return Folds.findLast(() => true, otherwise)
  }

  /**
   * Returns a folder that returns the element received at position `index`.
   * If no such value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that this Iter is empty. There are three cases:
   *    - not specified / undefined: If this Iter is empty, this function will throw an error
   *    - (value: T): If this Iter is empty, it will return the given value instead
   *    - (f: () => T): If this Iter is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Iter.fromIterable('abcdef').fold(Fold.elemAt(3))
   * result: 'd'
   * ```
   */
  static elemAt<E>(index: number, otherwise: OptLazy<E> = throwFoldError): Folder<E, E> {
    return Folds.find((_, i) => i === index, otherwise)
  }

  /**
   * Returns a folder that returns true if any received element satisfies given `pred` predicate.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * Iter.of(1, 3, 5, 7).fold(Fold.some(isEven))
   * result: false
   * ```
   */
  static some<E>(pred: Pred<E>): Folder<E, boolean> {
    return Fold.create(false, (state, value, index) => state || pred(value, index), state => state)
  }

  /**
   * Returns a folder that returns true if all received element satisfies given `pred` predicate.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * Iter.of(1, 3, 5, 7).fold(Fold.every(isOdd))
   * result: true
   * ```
   */
  static every<E>(pred: Pred<E>): Folder<E, boolean> {
    return Fold.create(true, (state, value, index) => state && pred(value, index), state => !state)
  }

  /**
   * Returns a folder that returns true any received element equals given `elem`.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * Iter.of(1, 3, 4, 7).fold(Fold.contains(3))
   * result: true
   * ```
   */
  static contains<E>(elem: E): Folder<E, boolean> {
    return Folds.some(e => e === elem)
  }

  /**
   * Returns a folder that returns true if all received booleans are true
   * @example
   * ```typescript
   * Iter.of(true, false).fold(Fold.and)
   * result: false
   * ```
   */
  static and: MonoFolder<boolean> = Folds.every(v => v)

  /**
   * Returns a folder that returns true if any received booleans is true
   * @example
   * ```typescript
   * Iter.of(true, false).fold(Fold.or)
   * result: true
   * ```
   */
  static or: MonoFolder<boolean> = Folds.some(v => v)

  /**
   * Returns a folder that returns true if any value is received
   * @example
   * ```typescript
   * Iter.of(1, 2).fold(Fold.hasValue)
   * result: true
   * ```
   */
  static hasValue: Folder<any, boolean> = Folds.some(() => true)

  /**
   * Returns a folder that returns true if no value is received
   * @example
   * ```typescript
   * Iter.of(1, 2).fold(Fold.noValue)
   * result: false
   * ```
   */
  static noValue: Folder<any, boolean> = Folds.every(() => false)

  /**
   * Returns a folder that creates an array from the received elements.
   * Note: modifies the provided `target` array by pushing elements to the end
   * @typeparam E the element type
   * @param target the target array to push elements to
   * @example
   * ```typescript
   * Iter.of(1, 3, 5, 7).fold(Fold.toArray())
   * result: [1, 3, 5, 7]
   * ```
   */
  static toArray<E>(target?: E[]): Folder<E, E[]> {
    return Fold.create(
      () => target || [],
      (arr, elem) => {
        arr.push(elem)
        return arr
      }
    )
  }

  /**
   * Returns a folder that creates a Map from the received tuples of type [K, V].
   * Note: modifies the `target` Map
   * @typeparam K the map key type
   * @typeparam V the map value type
   * @param target the target Map
   * @example
   * ```typescript
   * Iter.of(['a', 1], ['b', 5]).fold(Fold.toMap())
   * result: Map(a -> 1, b -> 5)
   * ```
   */
  static toMap<K, V>(target?: Map<K, V>): Folder<[K, V], Map<K, V>> {
    return Fold.create(() => target || new Map(), (map, [key, value]) => map.set(key, value))
  }

  /**
   * Returns a folder that creates a Set from the received elements.
   * Note: modifies the `target` Set
   * @typeparam E the element type
   * @param target the target Set
   * @example
   * ```typescript
   * Iter.of(1, 3, 5, 3, 1).fold(Fold.toSet())
   * result: Set(1, 3, 5)
   * ```
   */
  static toSet<E>(target?: Set<E>): Folder<E, Set<E>> {
    return Fold.create(() => target || new Set(), (set, value) => set.add(value))
  }

  /**
   * Returns a folder that creates a Dictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam K the dictionary key type
   * @typeparam V the dictionary value type
   * @param keyFun a function that takes an element V and returns its key K
   * @example
   * ```typescript
   * Iter.of('foo', 'test', 'bar').fold(Fold.groupBy(v => v.length))
   * result: Map(3 -> ['foo', 'bar'], 4 -> ['test'])
   * ```
   */
  static groupBy<K, V>(keyFun: (value: V, index: number) => K): Folder<V, Dict<K, V>> {
    return Fold.create(
      () => Dict(),
      (dict, value, index) => addToDict(dict, keyFun(value, index), value)
    )
  }

  /**
   * Returns a folder that creates a UniqueDictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam K the dictionary key type
   * @typeparam V the dictionary value type
   * @param keyFun a function that takes an element V and returns its key K
   * @example
   * ```typescript
   * Iter.of('foo', 'test', 'foo').fold(Fold.groupBy(v => v.length))
   * result: Map(3 -> Set('foo'), 4 -> Set('test'))
   * ```
   */
  static groupByUnique<K, V>(keyFun: (value: V, index: number) => K): Folder<V, UniqueDict<K, V>> {
    return Fold.create(
      () => UniqueDict(),
      (dict, value, index) => addToUniqueDict(dict, keyFun(value, index), value)
    )
  }

  /**
   * Returns a folder that creates a histogram of the received elements.
   * That is, it creates a Map with the elements as keys and the amount of occurrances as values.
   * @typeparam E the element type
   * @example
   * ```typescript
   * Iter.fromIterable('adcbcd').fold(Fold.histogram())
   * result: Map('a' -> 1, 'd' -> 2, 'c' -> 2, 'b' -> 1)
   * ```
   */
  static histogram<E>(): Folder<E, Histogram<E>> {
    return Fold.create(
      () => Histogram(),
      (dict, value) => {
        const count = dict.get(value) || 0
        dict.set(value, count + 1)
        return dict
      }
    )
  }

  /**
   * Returns a folder that returns a Map with amount of occurances as keys, and the unique set of elements with that amount of occurrance as values
   * @typeparam E the element type
   * @example
   * ```typescript
   * Iter.fromIterable('adcbcd').fold(Fold.elementsByFreq())
   * result: Map(1 -> Set('a', 'b'), 2 -> Set('d', 'c'))
   * ```
   */
  static elementsByFreq<E>(): Folder<E, UniqueDict<number, E>> {
    return Folds.histogram().mapResult(dict => {
      const result = UniqueDict<number, E>()
      for (const key of dict.keys()) addToUniqueDict(result, dict.get(key), key)
      return result
    })
  }

  /**
   * Returns a folder that creates a tuple of element arrays based on the given `pred`.
   * The first array are the elements that satisfy `pred`, and the second array contains those that don't.
   * @typeparam E the element type
   * @param pred a predicate over elements E
   * @example
   * ```typescript
   * Iter.of(1, 2, 3, 4, 5).fold(Fold.partition(isEven))
   * result: [[2, 4], [1, 3, 5]]
   * ```
   */
  static partition<E>(pred: Pred<E>): Folder<E, [E[], E[]]> {
    return Folds.groupBy(pred).mapResult(
      (map): [E[], E[]] => [map.get(true) || [], map.get(false) || []]
    )
  }

  /**
   * Returns a folder that outputs the sum of all received numbers
   * @example
   * ```typescript
   * Iter.of(1, 2, 5).fold(Fold.sum)
   * result: 8
   * ```
   */
  static sum: MonoFolder<number> = Fold.createMono(0, (state, num) => state + num)

  /**
   * Returns a folder that outputs the product of all received numbers
   * @example
   * ```typescript
   * Iter.of(1, 2, 5).fold(Fold.product)
   * result: 10
   * ```
   */
  static product: MonoFolder<number> = Fold.createMono(
    1,
    (state, num) => state * num,
    state => state === 0
  )

  /**
   * Returns a folder that outputs the average of all received numbers
   * @example
   * ```typescript
   * Iter.of(1, 4, 4).fold(Fold.average)
   * result: 3
   * ```
   */
  static average: MonoFolder<number> = Fold.createMono(
    0,
    (avg, value, index) => avg + (value - avg) / (index + 1)
  )
}
