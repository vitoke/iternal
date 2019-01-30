/**
 * @module iternal
 */

import { NoValue } from '../../../private/iternal-common'
import { Dict, Histogram, OptLazy, Pred, UniqueDict } from '../../constants'
import { Folder, FolderT, GenFolder, MonoFolder } from '../gen-folder'
import { combine } from '../../../private/iternal-shared'

export namespace Folds {
  function throwFoldError(): never {
    throw Error('fold error')
  }

  /**
   * Returns a folder that takes all elements of any type, converts them to a string, and concatenates them.
   * @example
   * ```typescript
   * Fold.fold([1, 2, 3], Folds.stringAppend)
   * result: '123'
   * ```
   */
  export const stringAppend: FolderT<any, string> = Folder.create(
    '',
    (state, elem) => state.concat(String(elem))
  )

  /**
   * Returns a folder that takes all elements of any type, converts them to a string, and concatenates them in reverse order.
   * @example
   * ```typescript
   * Fold.fold([1, 2, 3], Folds.stringPrepend)
   * result: '321'
   * ```
   */
  export const stringPrepend: FolderT<any, string> = Folder.create(
    '',
    (state, elem) => String(elem).concat(state)
  )

  /**
   * Returns a folder that outputs the the amount of elements processed
   * @example
   * ```typescript
   * Fold.fold([1, 3, 5], Folds.count)
   * result: 3
   * ```
   */
  export const count: FolderT<any, number> = Folder.create(
    0,
    (_, __, index) => index + 1
  )

  /**
   * Returns a folder that takes tuple elements of [string, V] and returns an object with those keys and values.
   * Note: mutates the target object
   * @typeparam V the value type
   * @param target a target object to add the properties to
   * @example
   * ```typescript
   * Fold.fold([['foo', 1], ['bar', true]], Folds.toObject())
   * result: { foo: 1, bar: true}
   * ```
   */
  export function toObject<V>(target?: {}): FolderT<
    [string, V],
    { [key: string]: V }
  > {
    return Folder.create<[string, V], { [key: string]: V }>(
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
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold(Iter.nats, Folds.find(v => v > 10))
   * result: 11
   * ```
   */
  export function find<E>(
    pred: Pred<E>,
    otherwise: OptLazy<E> = throwFoldError
  ): FolderT<E, E> {
    return GenFolder.create<E, E | NoValue, E>(
      NoValue,
      (found, value, index) => {
        if (found !== NoValue) return found
        if (pred(value, index)) return value
        return NoValue
      },
      state => (state === NoValue ? OptLazy.toValue(otherwise) : state),
      state => state !== NoValue
    )
  }

  /**
   * Returns a folder that outputs the last element it encounters that satisfies `pred`.
   * If no value is found, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param pred a predicate over elements E
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold([1, 4, 2, 9, 3, 8], Folds.findLast(v => v < 8))
   * result: 3
   * ```
   */
  export function findLast<E>(
    pred: Pred<E>,
    otherwise: OptLazy<E> = throwFoldError
  ): FolderT<E, E> {
    return GenFolder.create<E, E | NoValue, E>(
      NoValue,
      (found, value, index) => (pred(value, index) ? value : found),
      state => (state === NoValue ? OptLazy.toValue(otherwise) : state)
    )
  }

  /**
   * Returns a folder that returns the first element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold('abc', Folds.first())
   * result: 'a'
   * ```
   */
  export function first<E>(
    otherwise: OptLazy<E> = throwFoldError
  ): FolderT<E, E> {
    return find(() => true, otherwise)
  }

  export function take<E>(amount: number): FolderT<E, E> {
    return find((_, index) => index <= amount)
  }

  export function drop<E>(amount: number): FolderT<E, E> {
    return find((_, index) => index >= amount)
  }

  // export function takeWhile<E>(pred: Pred<E>): Folder<E, E> {
  //   return findLast((_, index) => index >= amount)
  // }

  /**
   * Returns a folder that returns the last element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold('abc', Folds.last())
   * result: 'c'
   * ```
   */
  export function last<E>(
    otherwise: OptLazy<E> = throwFoldError
  ): FolderT<E, E> {
    return findLast(() => true, otherwise)
  }

  /**
   * Returns a folder that returns the element received at position `index`.
   * If no such value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold('abcdef', Folds.elemAt(3))
   * result: 'd'
   * ```
   */
  export function elemAt<E>(
    index: number,
    otherwise: OptLazy<E> = throwFoldError
  ): FolderT<E, E> {
    return find((_, i) => i === index, otherwise)
  }

  /**
   * Returns a folder that returns true if any received element satisfies given `pred` predicate.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * Fold.fold([1, 3, 5, 7], Folds.some(isEven))
   * result: false
   * ```
   */
  export function some<E>(pred: Pred<E>): FolderT<E, boolean> {
    return Folder.create(
      false,
      (state, value, index) => state || pred(value, index),
      state => state
    )
  }

  /**
   * Returns a folder that returns true if all received element satisfies given `pred` predicate.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * Fold.fold([1, 3, 5, 7], Folds.every(isOdd))
   * result: true
   * ```
   */
  export function every<E>(pred: Pred<E>): FolderT<E, boolean> {
    return Folder.create(
      true,
      (state, value, index) => state && pred(value, index),
      state => !state
    )
  }

  /**
   * Returns a folder that returns true if any received element equals given `elem`.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * Fold.fold([1, 3, 4, 7], Folds.contains(3))
   * result: true
   * ```
   */
  export function contains<E>(elem: E): FolderT<E, boolean> {
    return some(e => e === elem)
  }

  /**
   * Returns a folder that returns true if any of the received elements is contained the given `elems`.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * Fold.fold([1, 3, 4, 7], Folds.containsAny(3, 20, 10))
   * result: true
   * ```
   */
  export function containsAny<E>(...elems: E[]): FolderT<E, boolean> {
    const set = new Set(elems)
    return some(e => set.has(e))
  }

  /**
   * Returns a folder that returns true if all received booleans are true
   * @example
   * ```typescript
   * Fold.fold([true, false], Folds.and)
   * result: false
   * ```
   */
  export const and: MonoFolder<boolean> = every(v => v)

  /**
   * Returns a folder that returns true if any received booleans is true
   * @example
   * ```typescript
   * Fold.fold([true, false], Folds.or)
   * result: true
   * ```
   */
  export const or: MonoFolder<boolean> = some(v => v)

  /**
   * Returns a folder that returns true if any value is received
   * @example
   * ```typescript
   * Fold.fold([1, 2], Folds.hasValue)
   * result: true
   * ```
   */
  export const hasValue: FolderT<any, boolean> = some(() => true)

  /**
   * Returns a folder that returns true if no value is received
   * @example
   * ```typescript
   * Fold.fold([1, 2], Folds.noValue)
   * result: false
   * ```
   */
  export const noValue: FolderT<any, boolean> = every(() => false)

  /**
   * Returns a folder that creates an array from the received elements.
   * Note: modifies the provided `target` array by pushing elements to the end
   * @typeparam E the element type
   * @param target the target array to push elements to
   * @example
   * ```typescript
   * Iter.fold(Iter.of(1, 3, 5, 7), Folds.toArray())
   * result: [1, 3, 5, 7]
   * ```
   */
  export function toArray<E>(target?: E[]): FolderT<E, E[]> {
    return Folder.create(
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
   * Fold.fold([['a', 1], ['b', 5]], Folds.toMap())
   * result: Map(a -> 1, b -> 5)
   * ```
   */
  export function toMap<K, V>(target?: Map<K, V>): FolderT<[K, V], Map<K, V>> {
    return Folder.create(
      () => target || new Map(),
      (map, [key, value]) => map.set(key, value)
    )
  }

  /**
   * Returns a folder that creates a Set from the received elements.
   * Note: modifies the `target` Set
   * @typeparam E the element type
   * @param target the target Set
   * @example
   * ```typescript
   * Fold.fold([1, 3, 5, 3, 1], Folds.toSet())
   * result: Set(1, 3, 5)
   * ```
   */
  export function toSet<E>(target?: Set<E>): FolderT<E, Set<E>> {
    return Folder.create(
      () => target || new Set(),
      (set, value) => set.add(value)
    )
  }

  /**
   * Returns a folder that creates a Dictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam K the dictionary key type
   * @typeparam V the dictionary value type
   * @param keyFun a function that takes an element V and returns its key K
   * @example
   * ```typescript
   * Fold.fold(['foo', 'test', 'bar'], Folds.groupBy(v => v.length))
   * result: Map(3 -> ['foo', 'bar'], 4 -> ['test'])
   * ```
   */
  export function groupBy<K, V>(
    keyFun: (value: V, index: number) => K
  ): FolderT<V, Dict<K, V>> {
    return Folder.create(
      () => Dict.create(),
      (dict, value, index) => Dict.add(dict, keyFun(value, index), value)
    )
  }

  /**
   * Returns a folder that creates a UniqueDictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam K the dictionary key type
   * @typeparam V the dictionary value type
   * @param keyFun a function that takes an element V and returns its key K
   * @example
   * ```typescript
   * Fold.fold(['foo', 'test', 'foo'], Folds.groupBy(v => v.length))
   * result: Map(3 -> Set('foo'), 4 -> Set('test'))
   * ```
   */
  export function groupByUnique<K, V>(
    keyFun: (value: V, index: number) => K
  ): FolderT<V, UniqueDict<K, V>> {
    return Folder.create(
      () => UniqueDict.create(),
      (dict, value, index) => UniqueDict.add(dict, keyFun(value, index), value)
    )
  }

  /**
   * Returns a folder that creates a histogram of the received elements.
   * That is, it creates a Map with the elements as keys and the amount of occurrances as values.
   * @typeparam E the element type
   * @param sortBy if undefined will return the histogram in value order, if value is 'TOP' it will order the histogram
   *               from highest to lowest, otherwise it will order the histogram from lowest to highest frequency.
   * @param amount if `sortBy` is specified, this parameter limits the amount of results
   * @example
   * ```typescript
   * Fold.fold('adcbcd', Folds.histogram())
   * result: Map('a' -> 1, 'd' -> 2, 'c' -> 2, 'b' -> 1)
   * ```
   */
  export function histogram<E>(
    sortBy?: 'TOP' | 'BOTTOM',
    amount?: number
  ): FolderT<E, Histogram<E>> {
    if (amount !== undefined && amount <= 0) {
      return Folder.fixed(Histogram.create())
    }

    const folder = Folder.create<E, Histogram<E>>(
      () => Histogram.create(),
      Histogram.add
    )

    if (sortBy === undefined) return folder

    return folder.mapResult(hist => {
      const histArray = [...hist.entries()]
      const comp: (a: number, b: number) => number =
        sortBy === 'TOP' ? (a, b) => b - a : (a, b) => a - b
      const sortFun = (a: [any, number], b: [any, number]) => comp(a[1], b[1])
      histArray.sort(sortFun)
      return new Map(histArray.slice(0, amount))
    })
  }

  /**
   * Returns a folder that returns a Map with amount of occurances as keys, and the unique set of elements with that amount of occurrance as values
   * @typeparam E the element type
   * @example
   * ```typescript
   * Fold.fold('adcbcd', Folds.elementsByFreq())
   * result: Map(1 -> Set('a', 'b'), 2 -> Set('d', 'c'))
   * ```
   */
  // export function elementsByFreq<E>(): Folder<E, IUniqueDict<number, E>> {
  //   return histogram().mapResult(
  //     (dict: Histogram<E>): IUniqueDict<nunber, E> => {
  //       const result: IUniqueDict<number, E> = UniqueDict.create<number, E>()
  //       for (const key of dict.keys()) {
  //         UniqueDict.add(result, dict.get(key), key)
  //       }
  //       return result
  //     }
  //   )
  // }

  /**
   * Returns a folder that creates a tuple of element arrays based on the given `pred`.
   * The first array are the elements that satisfy `pred`, and the second array contains those that don't.
   * @typeparam E the element type
   * @param pred a predicate over elements E
   * @example
   * ```typescript
   * Fold.fold([1, 2, 3, 4, 5], Folds.partition(isEven))
   * result: [[2, 4], [1, 3, 5]]
   * ```
   */
  export function partition<E>(pred: Pred<E>): FolderT<E, [E[], E[]]> {
    return groupBy(pred).mapResult(
      (map): [E[], E[]] => [map.get(true) || [], map.get(false) || []]
    )
  }

  /**
   * Returns a folder that outputs the sum of all received numbers
   * @example
   * ```typescript
   * Fold.fold([1, 2, 5], Folds.sum)
   * result: 8
   * ```
   */
  export const sum: MonoFolder<number> = MonoFolder.create(
    0,
    (state, num) => state + num
  )

  /**
   * Returns a folder that outputs the product of all received numbers
   * @example
   * ```typescript
   * Fold.fold([1, 2, 5], Folds.product)
   * result: 10
   * ```
   */
  export const product: MonoFolder<number> = MonoFolder.create(
    1,
    (state, num) => state * num,
    state => state === 0
  )

  /**
   * Returns a folder that outputs the average of all received numbers
   * @example
   * ```typescript
   * Fold.fold([1, 4, 4], Folds.average)
   * result: 3
   * ```
   */
  export const average: MonoFolder<number> = MonoFolder.create(
    0,
    (avg, value, index) => avg + (value - avg) / (index + 1)
  )

  /**
   * Returns a folder that takes the first element of the iterable, and then uses the result of the `choice` function to decide
   * whether to keep the currently chosen value, or the new element.
   * @param choice a function taking two elements, and returning false to keep the first, and true to keep the second element
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold(['abCd', 'plCf', 'bcae'], Folds.choose((chosen, next) => next[2] === chosen[2]))
   * result: 'plc'
   * ```
   */
  export function choose<E>(
    choice: (chosen: E, next: E) => boolean,
    otherwise: OptLazy<E> = throwFoldError
  ) {
    return GenFolder.create<E, NoValue | E, E>(
      NoValue,
      (state, elem) =>
        state === NoValue || choice(state, elem) ? elem : state,
      state => (state === NoValue ? OptLazy.toValue(otherwise) : state)
    )
  }

  /**
   * Returns a folder that outputs the minimum of all received numbers
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: number): If the Iterable is empty, it will return the given value instead
   *    - (f: () => number): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold([3, 1, 4], Folds.min())
   * result: 1
   * ```
   */
  export function min(
    otherwise: OptLazy<number> = throwFoldError
  ): MonoFolder<number> {
    return choose((chosen, next) => next < chosen, otherwise)
  }

  /**
   * Returns a folder that outputs the maximum of all received numbers
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: number): If the Iterable is empty, it will return the given value instead
   *    - (f: () => number): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold([3, 1, 4], Folds.max())
   * result: 4
   * ```
   */
  export function max(
    otherwise: OptLazy<number> = throwFoldError
  ): MonoFolder<number> {
    return choose((chosen, next) => next > chosen, otherwise)
  }

  /**
   * Returns a folder that outputs a tuple containing the minimum and maximum value of the inputs.
   * @note throws if an empty input is received.
   * @example
   * ```typescript
   * Fold.fold([4, 1, 3], Folds.range)
   * result: [1, 4]
   * ```
   */
  export const range: FolderT<number, [number, number]> = combine(min(), max())

  /**
   * Returns a folder that performs the `toNumber` function on each element, and returns the element for which the result
   * of `toNumber` returned the minimum value.
   * @param toNumber a function taking an element an returning a number to compare
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold(['aa', 'a', 'aaa'], Folds.minBy(w => w.length))
   * result: 'a'
   * ```
   */
  export function minBy<E>(
    toNumber: (value: E) => number,
    otherwise: OptLazy<E> = throwFoldError
  ): MonoFolder<E> {
    return GenFolder.create<
      E,
      undefined | { minElem: E; minNumber: number },
      E
    >(
      undefined,
      (state, elem) => {
        const elemNumber = toNumber(elem)

        if (state === undefined) {
          return { minElem: elem, minNumber: elemNumber }
        }

        if (elemNumber < state.minNumber) {
          state.minElem = elem
          state.minNumber = elemNumber
        }

        return state
      },
      state =>
        state === undefined ? OptLazy.toValue(otherwise) : state.minElem
    )
  }

  /**
   * Returns a folder that performs the `toNumber` function on each element, and returns the element for which the result
   * of `toNumber` returned the maximum value.
   * @param toNumber a function taking an element an returning a number to compare
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Fold.fold(['aa', 'a', 'aaa'], Folds.maxBy(w => w.length))
   * result: 'aaa'
   * ```
   */
  export function maxBy<E>(
    toNumber: (value: E) => number,
    otherwise: OptLazy<E> = throwFoldError
  ): MonoFolder<E> {
    const negativeToNumber = (v: E) => -toNumber(v)
    return minBy(negativeToNumber, otherwise)
  }

  /**
   * Returns a folder that performs the `toNumber` function on each element, and returns a tuple of the elements for which
   * the function returned the minumum and maximum values.
   * @note throws an error when the input is empty
   * @param toNumber a function taking an element an returning a number to compare
   * @example
   * ```typescript
   * Fold.fold(['aa', 'a', 'aaa'], Folds.rangeBy(w => w.length))
   * result: ['a', 'aaa']
   * ```
   */
  export function rangeBy<E>(
    toNumber: (value: E) => number
  ): FolderT<E, [E, E]> {
    return combine(minBy(toNumber), maxBy(toNumber))
  }
}
