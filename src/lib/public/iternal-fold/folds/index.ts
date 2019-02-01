/**
 * @module iternal
 */

import { NoValue } from '../../../private/iternal-common'
import { OptLazy, Pred, Dict, UniqueDict, Histogram } from '../../constants'
import { Collector, StateCollector, MonoCollector } from '../gen-folder'

export namespace Collectors {
  function throwCollectError(): never {
    throw Error('collect error')
  }

  /**
   * Returns a collector that takes all elements of any type, converts them to a string, and concatenates them.
   * @example
   * ```typescript
   * iter([1, 2, 3]).collect(Collectors.stringAppend)
   * result: '123'
   * ```
   */
  export const stringAppend: Collector<any, string> = Collector.create('', (state, elem) =>
    state.concat(String(elem))
  )

  /**
   * Returns a collector that takes all elements of any type, converts them to a string, and concatenates them in reverse order.
   * @example
   * ```typescript
   * iter([1, 2, 3]).collect(Collectors.stringPrepend)
   * result: '321'
   * ```
   */
  export const stringPrepend: Collector<any, string> = Collector.create('', (state, elem) =>
    String(elem).concat(state)
  )

  /**
   * Returns a collector that outputs the the amount of elements processed
   * @example
   * ```typescript
   * iter([1, 3, 5]).collect(Collectors.count)
   * result: 3
   * ```
   */
  export const count: Collector<any, number> = Collector.create(0, (_, __, index) => index + 1)

  /**
   * Returns a collector that takes tuple elements of [string, V] and returns an object with those keys and values.
   * Note: mutates the target object
   * @typeparam V the value type
   * @param target a target object to add the properties to
   * @example
   * ```typescript
   * iter([['foo', 1], ['bar', true]]).collect(Collectors.toObject())
   * result: { foo: 1, bar: true}
   * ```
   */
  export function toObject<V>(target?: {}): Collector<[string, V], { [key: string]: V }> {
    return Collector.create<[string, V], { [key: string]: V }>(
      () => target || {},
      (obj, [name, value]) => {
        obj[name] = value
        return obj
      }
    )
  }

  /**
   * Returns a collector that outputs the first element it encounters that satisfies `pred`.
   * If no value is found, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param pred a predicate over elements E
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter.nats.collect(Collectors.find(v => v > 10))
   * result: 11
   * ```
   */
  export function find<E>(
    pred: Pred<E>,
    otherwise: OptLazy<E> = throwCollectError
  ): Collector<E, E> {
    return StateCollector.create<E, E | NoValue, E>(
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
   * Returns a collector that outputs the last element it encounters that satisfies `pred`.
   * If no value is found, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param pred a predicate over elements E
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter([1, 4, 2, 9, 3, 8]).collect(Collectors.findLast(v => v < 8))
   * result: 3
   * ```
   */
  export function findLast<E>(
    pred: Pred<E>,
    otherwise: OptLazy<E> = throwCollectError
  ): Collector<E, E> {
    return StateCollector.create<E, E | NoValue, E>(
      NoValue,
      (found, value, index) => (pred(value, index) ? value : found),
      state => (state === NoValue ? OptLazy.toValue(otherwise) : state)
    )
  }

  /**
   * Returns a collector that returns the first element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter('abc').collect(Collectors.first())
   * result: 'a'
   * ```
   */
  export function first<E>(otherwise: OptLazy<E> = throwCollectError): Collector<E, E> {
    return find(() => true, otherwise)
  }

  // export function take<E>(amount: number): Collector<E, E> {
  //   return find((_, index) => index <= amount)
  // }

  // export function drop<E>(amount: number): Collector<E, E> {
  //   return find((_, index) => index >= amount)
  // }

  // export function takeWhile<E>(pred: Pred<E>): Collector<E, E> {
  //   return findLast((_, index) => index >= amount)
  // }

  /**
   * Returns a collector that returns the last element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter('abc').collect(Collectors.last())
   * result: 'c'
   * ```
   */
  export function last<E>(otherwise: OptLazy<E> = throwCollectError): Collector<E, E> {
    return findLast(() => true, otherwise)
  }

  /**
   * Returns a collector that returns the element received at position `index`.
   * If no such value is received, it tries to get an alternative value from `otherwise`
   * @typeparam E the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter('abcdef').collect(Collectors.elemAt(3))
   * result: 'd'
   * ```
   */
  export function elemAt<E>(
    index: number,
    otherwise: OptLazy<E> = throwCollectError
  ): Collector<E, E> {
    return find((_, i) => i === index, otherwise)
  }

  /**
   * Returns a collector that returns true if any received element satisfies given `pred` predicate.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * iter([1, 3, 5, 7]).collect(Collectors.some(isEven))
   * result: false
   * ```
   */
  export function some<E>(pred: Pred<E>): Collector<E, boolean> {
    return Collector.create(
      false,
      (state, value, index) => state || pred(value, index),
      state => state
    )
  }

  /**
   * Returns a collector that returns true if all received element satisfies given `pred` predicate.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * iter([1, 3, 5, 7]).collect(Collectors.every(isOdd))
   * result: true
   * ```
   */
  export function every<E>(pred: Pred<E>): Collector<E, boolean> {
    return Collector.create(
      true,
      (state, value, index) => state && pred(value, index),
      state => !state
    )
  }

  /**
   * Returns a collector that returns true if any received element equals given `elem`.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * iter([1, 3, 4, 7]).collect(Collectors.contains(3))
   * result: true
   * ```
   */
  export function contains<E>(elem: E): Collector<E, boolean> {
    return some(e => e === elem)
  }

  /**
   * Returns a collector that returns true if any of the received elements is contained the given `elems`.
   * @typeparam E the input element type
   * @example
   * ```typescript
   * iter([1, 3, 4, 7]).collect(Collectors.containsAny(3, 20, 10))
   * result: true
   * ```
   */
  export function containsAny<E>(...elems: E[]): Collector<E, boolean> {
    const set = new Set(elems)
    return some(e => set.has(e))
  }

  /**
   * Returns a collector that returns true if all received booleans are true
   * @example
   * ```typescript
   * iter([true, false]).collect(Collectors.and)
   * result: false
   * ```
   */
  export const and: MonoCollector<boolean> = every(v => v)

  /**
   * Returns a collector that returns true if any received booleans is true
   * @example
   * ```typescript
   * iter([true, false]).collect(Collectors.or)
   * result: true
   * ```
   */
  export const or: MonoCollector<boolean> = some(v => v)

  /**
   * Returns a collector that returns true if any value is received
   * @example
   * ```typescript
   * iter([1, 2]).collect(Collectors.hasValue)
   * result: true
   * ```
   */
  export const hasValue: Collector<any, boolean> = some(() => true)

  /**
   * Returns a collector that returns true if no value is received
   * @example
   * ```typescript
   * iter([1, 2]).collect(Collectors.noValue)
   * result: false
   * ```
   */
  export const noValue: Collector<any, boolean> = every(() => false)

  /**
   * Returns a collector that creates an array from the received elements.
   * Note: modifies the provided `target` array by pushing elements to the end
   * @typeparam E the element type
   * @param target the target array to push elements to
   * @example
   * ```typescript
   * iter.of(1, 3, 5, 7).collect(Collectors.toArray())
   * result: [1, 3, 5, 7]
   * ```
   */
  export function toArray<E>(target?: E[]): Collector<E, E[]> {
    return Collector.create(
      () => target || [],
      (arr, elem) => {
        arr.push(elem)
        return arr
      }
    )
  }

  /**
   * Returns a collector that creates a Map from the received tuples of type [K, V].
   * Note: modifies the `target` Map
   * @typeparam K the map key type
   * @typeparam V the map value type
   * @param target the target Map
   * @example
   * ```typescript
   * iter([['a', 1], ['b', 5]]).collect(Collectors.toMap())
   * result: Map(a -> 1, b -> 5)
   * ```
   */
  export function toMap<K, V>(target?: Map<K, V>): Collector<[K, V], Map<K, V>> {
    return Collector.create(() => target || new Map(), (map, [key, value]) => map.set(key, value))
  }

  /**
   * Returns a collector that creates a Set from the received elements.
   * Note: modifies the `target` Set
   * @typeparam E the element type
   * @param target the target Set
   * @example
   * ```typescript
   * iter([1, 3, 5, 3, 1]).collect(Collectors.toSet())
   * result: Set(1, 3, 5)
   * ```
   */
  export function toSet<E>(target?: Set<E>): Collector<E, Set<E>> {
    return Collector.create(() => target || new Set(), (set, value) => set.add(value))
  }

  /**
   * Returns a collector that creates a Dictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam K the dictionary key type
   * @typeparam V the dictionary value type
   * @param keyFun a function that takes an element V and returns its key K
   * @example
   * ```typescript
   * iter(['foo', 'test', 'bar']).collect(Collectors.groupBy(v => v.length))
   * result: Map(3 -> ['foo', 'bar'], 4 -> ['test'])
   * ```
   */
  export function groupBy<K, V>(keyFun: (value: V, index: number) => K): Collector<V, Dict<K, V>> {
    return Collector.create(
      () => Dict.create(),
      (dict, value, index) => Dict.add(dict, keyFun(value, index), value)
    )
  }

  /**
   * Returns a collector that creates a UniqueDictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam K the dictionary key type
   * @typeparam V the dictionary value type
   * @param keyFun a function that takes an element V and returns its key K
   * @example
   * ```typescript
   * iter(['foo', 'test', 'foo']).collect(Collectors.groupBy(v => v.length))
   * result: Map(3 -> Set('foo'), 4 -> Set('test'))
   * ```
   */
  export function groupByUnique<K, V>(
    keyFun: (value: V, index: number) => K
  ): Collector<V, UniqueDict<K, V>> {
    return Collector.create(
      () => UniqueDict.create(),
      (dict, value, index) => UniqueDict.add(dict, keyFun(value, index), value)
    )
  }

  /**
   * Returns a collector that creates a histogram of the received elements.
   * That is, it creates a Map with the elements as keys and the amount of occurrances as values.
   * @typeparam E the element type
   * @param sortBy if undefined will return the histogram in value order, if value is 'TOP' it will order the histogram
   *               from highest to lowest, otherwise it will order the histogram from lowest to highest frequency.
   * @param amount if `sortBy` is specified, this parameter limits the amount of results
   * @example
   * ```typescript
   * iter('adcbcd').collect(Collectors.histogram())
   * result: Map('a' -> 1, 'd' -> 2, 'c' -> 2, 'b' -> 1)
   * ```
   */
  export function histogram<E>(
    sortBy?: 'TOP' | 'BOTTOM',
    amount?: number
  ): Collector<E, Histogram<E>> {
    if (amount !== undefined && amount <= 0) {
      return Collector.fixed(Histogram.create())
    }

    const collector = Collector.create<E, Histogram<E>>(() => Histogram.create(), Histogram.add)

    if (sortBy === undefined) return collector

    return collector.mapResult(hist => {
      const histArray = [...hist.entries()]
      const comp: (a: number, b: number) => number =
        sortBy === 'TOP' ? (a, b) => b - a : (a, b) => a - b
      const sortFun = (a: [any, number], b: [any, number]) => comp(a[1], b[1])
      histArray.sort(sortFun)
      return new Map(histArray.slice(0, amount))
    })
  }

  /**
   * Returns a collector that returns a Map with amount of occurances as keys, and the unique set of elements with that amount of occurrance as values
   * @typeparam E the element type
   * @example
   * ```typescript
   * iter('adcbcd').collect(Collectors.elementsByFreq())
   * result: Map(1 -> Set('a', 'b'), 2 -> Set('d', 'c'))
   * ```
   */
  export function elementsByFreq<E>(): Collector<E, UniqueDict<number, E>> {
    return histogram<E>().mapResult(dict => {
      const result = UniqueDict.create<number, E>()
      for (const key of dict.keys()) {
        UniqueDict.add(result, dict.get(key), key)
      }
      return result
    })
  }

  /**
   * Returns a collector that creates a tuple of element arrays based on the given `pred`.
   * The first array are the elements that satisfy `pred`, and the second array contains those that don't.
   * @typeparam E the element type
   * @param pred a predicate over elements E
   * @example
   * ```typescript
   * iter([1, 2, 3, 4, 5]).collect(Collectors.partition(isEven))
   * result: [[2, 4], [1, 3, 5]]
   * ```
   */
  export function partition<E>(pred: Pred<E>): Collector<E, [E[], E[]]> {
    return groupBy(pred).mapResult((map): [E[], E[]] => [map.get(true) || [], map.get(false) || []])
  }

  /**
   * Returns a collector that outputs the sum of all received numbers
   * @example
   * ```typescript
   * iter([1, 2, 5]).collect(Collectors.sum)
   * result: 8
   * ```
   */
  export const sum: MonoCollector<number> = MonoCollector.create(0, (state, num) => state + num)

  /**
   * Returns a collector that outputs the product of all received numbers
   * @example
   * ```typescript
   * iter([1, 2, 5]).collect(Collectors.product)
   * result: 10
   * ```
   */
  export const product: MonoCollector<number> = MonoCollector.create(
    1,
    (state, num) => state * num,
    state => state === 0
  )

  /**
   * Returns a collector that outputs the average of all received numbers
   * @example
   * ```typescript
   * iter([1, 4, 4]).collect(Collectors.average)
   * result: 3
   * ```
   */
  export const average: MonoCollector<number> = MonoCollector.create(
    0,
    (avg, value, index) => avg + (value - avg) / (index + 1)
  )

  /**
   * Returns a collector that takes the first element of the iterable, and then uses the result of the `choice` function to decide
   * whether to keep the currently chosen value, or the new element.
   * @param choice a function taking two elements, and returning false to keep the first, and true to keep the second element
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter(['abCd', 'plCf', 'bcae']).collect(Collectors.choose((chosen, next) => next[2] === chosen[2]))
   * result: 'plc'
   * ```
   */
  export function choose<E>(
    choice: (chosen: E, next: E) => boolean,
    otherwise: OptLazy<E> = throwCollectError
  ) {
    return StateCollector.create<E, NoValue | E, E>(
      NoValue,
      (state, elem) => (state === NoValue || choice(state, elem) ? elem : state),
      state => (state === NoValue ? OptLazy.toValue(otherwise) : state)
    )
  }

  /**
   * Returns a collector that outputs the minimum of all received numbers
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: number): If the Iterable is empty, it will return the given value instead
   *    - (f: () => number): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter([3, 1, 4]).collect(Collectors.min())
   * result: 1
   * ```
   */
  export function min(otherwise: OptLazy<number> = throwCollectError): MonoCollector<number> {
    return choose((chosen, next) => next < chosen, otherwise)
  }

  /**
   * Returns a collector that outputs the maximum of all received numbers
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: number): If the Iterable is empty, it will return the given value instead
   *    - (f: () => number): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter([3, 1, 4]).collect(Collectors.max())
   * result: 4
   * ```
   */
  export function max(otherwise: OptLazy<number> = throwCollectError): MonoCollector<number> {
    return choose((chosen, next) => next > chosen, otherwise)
  }

  /**
   * Returns a collector that outputs a tuple containing the minimum and maximum value of the inputs.
   * @note throws if an empty input is received.
   * @example
   * ```typescript
   * iter([4, 1, 3]).collect(Collectors.range)
   * result: [1, 4]
   * ```
   */
  export const range: Collector<number, [number, number]> = Collector.combine(min(), max())

  /**
   * Returns a collector that performs the `toNumber` function on each element, and returns the element for which the result
   * of `toNumber` returned the minimum value.
   * @param toNumber a function taking an element an returning a number to compare
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter(['aa', 'a', 'aaa']).collect(Collectors.minBy(w => w.length))
   * result: 'a'
   * ```
   */
  export function minBy<E>(
    toNumber: (value: E) => number,
    otherwise: OptLazy<E> = throwCollectError
  ): MonoCollector<E> {
    return StateCollector.create<E, undefined | { minElem: E; minNumber: number }, E>(
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
      state => (state === undefined ? OptLazy.toValue(otherwise) : state.minElem)
    )
  }

  /**
   * Returns a collector that performs the `toNumber` function on each element, and returns the element for which the result
   * of `toNumber` returned the maximum value.
   * @param toNumber a function taking an element an returning a number to compare
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: E): If the Iterable is empty, it will return the given value instead
   *    - (f: () => E): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter(['aa', 'a', 'aaa']).collect(Collectors.maxBy(w => w.length))
   * result: 'aaa'
   * ```
   */
  export function maxBy<E>(
    toNumber: (value: E) => number,
    otherwise: OptLazy<E> = throwCollectError
  ): MonoCollector<E> {
    const negativeToNumber = (v: E) => -toNumber(v)
    return minBy(negativeToNumber, otherwise)
  }

  /**
   * Returns a collector that performs the `toNumber` function on each element, and returns a tuple of the elements for which
   * the function returned the minumum and maximum values.
   * @note throws an error when the input is empty
   * @param toNumber a function taking an element an returning a number to compare
   * @example
   * ```typescript
   * iter(['aa', 'a', 'aaa']).collect(Collectors.rangeBy(w => w.length))
   * result: ['a', 'aaa']
   * ```
   */
  export function rangeBy<E>(toNumber: (value: E) => number): Collector<E, [E, E]> {
    return Collector.combine(minBy(toNumber), maxBy(toNumber))
  }
}
