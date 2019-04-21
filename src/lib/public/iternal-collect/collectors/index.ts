/**
 * @module iternal
 */

import { NoValue } from '../../../private/iternal-common'
import { Dict, Histogram, OptLazy, Pred, UniqueDict } from '../../constants'
import { Op } from '../collector'

export namespace ops {
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
  export const stringAppend: Op<any, string> = Op.create({
    init: '',
    next: (state, elem) => state.concat(String(elem))
  })

  /**
   * Returns a collector that takes all elements of any type, converts them to a string, and concatenates them in reverse order.
   * @example
   * ```typescript
   * iter([1, 2, 3]).collect(Collectors.stringPrepend)
   * result: '321'
   * ```
   */
  export const stringPrepend: Op<any, string> = Op.create({
    init: '',
    next: (state, elem) => String(elem).concat(state)
  })

  /**
   * Returns a collector that outputs the the amount of elements processed
   * @example
   * ```typescript
   * iter([1, 3, 5]).collect(Collectors.count)
   * result: 3
   * ```
   */
  export const count: Op<any, number> = Op.create({
    init: 0,
    next: (_, __, index) => index + 1
  })

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
  export function toObject<V>(target?: {}): Op<[string, V], { [key: string]: V }> {
    return Op.create<[string, V], { [key: string]: V }>({
      init: () => target || {},
      next: (obj, [name, value]) => {
        obj[name] = value
        return obj
      }
    })
  }

  /**
   * Returns a collector that outputs the first element it encounters that satisfies `pred`.
   * If no value is found, it tries to get an alternative value from `otherwise`
   * @typeparam Elem the input element type
   * @param pred a predicate over elements Elem
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter.nats.collect(Collectors.find(v => v > 10))
   * result: 11
   * ```
   */
  export function find<Elem>(
    pred: Pred<Elem>,
    otherwise: OptLazy<Elem> = throwCollectError
  ): Op<Elem, Elem> {
    return Op.createState<Elem, Elem | NoValue, Elem>({
      init: NoValue,
      next: (found, value, index) => {
        if (found !== NoValue) return found
        if (pred(value, index)) return value
        return NoValue
      },
      stateToResult: state => (state === NoValue ? OptLazy.toValue(otherwise) : state),
      escape: state => state !== NoValue
    })
  }

  /**
   * Returns a collector that outputs the last element it encounters that satisfies `pred`.
   * If no value is found, it tries to get an alternative value from `otherwise`
   * @typeparam Elem the input element type
   * @param pred a predicate over elements Elem
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter([1, 4, 2, 9, 3, 8]).collect(Collectors.findLast(v => v < 8))
   * result: 3
   * ```
   */
  export function findLast<Elem>(
    pred: Pred<Elem>,
    otherwise: OptLazy<Elem> = throwCollectError
  ): Op<Elem, Elem> {
    return chooseOpt<Elem>((_, next, index) => pred(next, index)).mapResult(result => {
      if (result === NoValue) return OptLazy.toValue(otherwise)
      return result
    })
  }

  /**
   * Returns a collector that returns the first element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam Elem the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter('abc').collect(Collectors.first())
   * result: 'a'
   * ```
   */
  export function first<Elem>(otherwise: OptLazy<Elem> = throwCollectError): Op<Elem, Elem> {
    return find(() => true, otherwise)
  }

  /**
   * Returns a collector that returns the last element it receives.
   * If no value is received, it tries to get an alternative value from `otherwise`
   * @typeparam Elem the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter('abc').collect(Collectors.last())
   * result: 'c'
   * ```
   */
  export function last<Elem>(otherwise: OptLazy<Elem> = throwCollectError): Op<Elem, Elem> {
    return findLast(() => true, otherwise)
  }

  /**
   * Returns a collector that returns the element received at position `index`.
   * If no such value is received, it tries to get an alternative value from `otherwise`
   * @typeparam Elem the input element type
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter('abcdef').collect(Collectors.elemAt(3))
   * result: 'd'
   * ```
   */
  export function elemAt<Elem>(
    index: number,
    otherwise: OptLazy<Elem> = throwCollectError
  ): Op<Elem, Elem> {
    return find((_, i) => i === index, otherwise)
  }

  /**
   * Returns a collector that returns true if any received element satisfies given `pred` predicate.
   * @typeparam Elem the input element type
   * @example
   * ```typescript
   * iter([1, 3, 5, 7]).collect(Collectors.some(isEven))
   * result: false
   * ```
   */
  export function some<Elem>(pred: Pred<Elem>): Op<Elem, boolean> {
    return Op.create<Elem, boolean>({
      init: false,
      next: (state, value, index) => state || pred(value, index),
      escape: state => state
    })
  }

  /**
   * Returns a collector that returns true if all received element satisfies given `pred` predicate.
   * @typeparam Elem the input element type
   * @example
   * ```typescript
   * iter([1, 3, 5, 7]).collect(Collectors.every(isOdd))
   * result: true
   * ```
   */
  export function every<Elem>(pred: Pred<Elem>): Op<Elem, boolean> {
    return Op.create<Elem, boolean>({
      init: true,
      next: (state, value, index) => state && pred(value, index),
      escape: state => !state
    })
  }

  /**
   * Returns a collector that returns true if any received element equals given `elem`.
   * @typeparam Elem the input element type
   * @example
   * ```typescript
   * iter([1, 3, 4, 7]).collect(Collectors.contains(3))
   * result: true
   * ```
   */
  export function contains<Elem>(elem: Elem): Op<Elem, boolean> {
    return some(e => e === elem)
  }

  /**
   * Returns a collector that returns true if any of the received elements is contained the given `elems`.
   * @typeparam Elem the input element type
   * @example
   * ```typescript
   * iter([1, 3, 4, 7]).collect(Collectors.containsAny(3, 20, 10))
   * result: true
   * ```
   */
  export function containsAny<Elem>(...elems: Elem[]): Op<Elem, boolean> {
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
  export const and: Op<boolean> = every(v => v)

  /**
   * Returns a collector that returns true if any received booleans is true
   * @example
   * ```typescript
   * iter([true, false]).collect(Collectors.or)
   * result: true
   * ```
   */
  export const or: Op<boolean> = some(v => v)

  /**
   * Returns a collector that returns true if any value is received
   * @example
   * ```typescript
   * iter([1, 2]).collect(Collectors.hasValue)
   * result: true
   * ```
   */
  export const hasValue: Op<any, boolean> = some(() => true)

  /**
   * Returns a collector that returns true if no value is received
   * @example
   * ```typescript
   * iter([1, 2]).collect(Collectors.noValue)
   * result: false
   * ```
   */
  export const noValue: Op<any, boolean> = every(() => false)

  /**
   * Returns a collector that created a potentially reversed array from the input elements.
   * @typeparam Elem the element type
   * @param reversed if true will prepend elements to the target instead of append
   * @param target an optional existing array to which the elements will be added
   */
  export function toArray<Elem>(reversed: boolean = false, target?: Elem[]): Op<Elem, Elem[]> {
    return Op.create({
      init: () => target || [],
      next: (arr, elem) => {
        if (reversed) arr.unshift(elem)
        else arr.push(elem)
        return arr
      }
    })
  }

  /**
   * Returns a collector that creates a Map from the received tuples of type [K, V].
   * Note: modifies the `target` Map
   * @typeparam Key the map key type
   * @typeparam Value the map value type
   * @param target the target Map
   * @example
   * ```typescript
   * iter([['a', 1], ['b', 5]]).collect(Collectors.toMap())
   * result: Map(a -> 1, b -> 5)
   * ```
   */
  export function toMap<Key, Value>(target?: Map<Key, Value>): Op<[Key, Value], Map<Key, Value>> {
    return Op.create({
      init: () => target || new Map(),
      next: (map, [key, value]) => map.set(key, value)
    })
  }

  /**
   * Returns a collector that creates a Set from the received elements.
   * Note: modifies the `target` Set
   * @typeparam Elem the element type
   * @param target the target Set
   * @example
   * ```typescript
   * iter([1, 3, 5, 3, 1]).collect(Collectors.toSet())
   * result: Set(1, 3, 5)
   * ```
   */
  export function toSet<Elem>(target?: Set<Elem>): Op<Elem, Set<Elem>> {
    return Op.create({
      init: () => target || new Set(),
      next: (set, value) => set.add(value)
    })
  }

  /**
   * Returns a collector that creates a Dictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam Key the dictionary key type
   * @typeparam Value the dictionary value type
   * @param keyFun a function that takes an element V and returns its key K
   * @example
   * ```typescript
   * iter(['foo', 'test', 'bar']).collect(Collectors.groupBy(v => v.length))
   * result: Map(3 -> ['foo', 'bar'], 4 -> ['test'])
   * ```
   */
  export function groupBy<Key, Value>(
    keyFun: (value: Value, index: number) => Key
  ): Op<Value, Dict<Key, Value>> {
    return groupByGen(keyFun, toArray())
  }

  /**
   * Returns a collector that groups incoming value by given `keyFun`, and uses the `buildSeqOp` to create sequences of those values.
   * @typeparam Key the dictionary key type
   * @typeparam Value the dictionary value type
   * @typeparam S the result sequence type
   * @param keyFun a function that takes an element V and returns its key K
   * @param buildSeqOp a collector that builds a structure from given elements Value
   * @example
   * ```typescript
   * iter(['foo', 'test', 'bar']).collect(Collectors.groupByGen(v => v.length, Collectors.toSet()))
   * result: Map(3 -> Set(['foo', 'bar']), 4 -> Set(['test']))
   * ```
   */
  export function groupByGen<Key, Value, S>(
    keyFun: (value: Value, index: number) => Key,
    buildSeqOp: Op<Value, S>
  ): Op<Value, Map<Key, S>> {
    return Op.createState({
      init: () => new Map<Key, { length: number; state: any }>(),
      next: (map, value, index) => {
        const key = keyFun(value, index)
        let entry = map.get(key)
        if (entry === undefined) {
          entry = {
            length: 0,
            state: buildSeqOp.createInitState()
          }
          map.set(key, entry)
        }
        entry.state = buildSeqOp.nextState(entry.state, value, entry.length)
        entry.length++
        return map
      },
      stateToResult: map => {
        for (const [key, { state, length }] of map) {
          map.set(key, buildSeqOp.stateToResult(state, length) as any)
        }
        return map as any
      }
    })
  }

  /**
   * Returns a collector that creates a UniqueDictionary using the given `keyFun` to generate keys for received elements.
   * @typeparam Key the dictionary key type
   * @typeparam Value the dictionary value type
   * @param keyFun a function that takes an element Value and returns its key Key
   * @example
   * ```typescript
   * iter(['foo', 'test', 'foo']).collect(Collectors.groupBy(v => v.length))
   * result: Map(3 -> Set('foo'), 4 -> Set('test'))
   * ```
   */
  export function groupByUnique<Key, Value>(
    keyFun: (value: Value, index: number) => Key
  ): Op<Value, UniqueDict<Key, Value>> {
    return groupByGen(keyFun, toSet())
  }

  /**
   * Returns a collector that creates a histogram of the received elements.
   * That is, it creates a Map with the elements as keys and the amount of occurrances as values.
   * @typeparam Elem the element type
   * @param sortBy if undefined will return the histogram in value order, if value is 'TOP' it will order the histogram
   *               from highest to lowest, otherwise it will order the histogram from lowest to highest frequency.
   * @param amount if `sortBy` is specified, this parameter limits the amount of results
   * @example
   * ```typescript
   * iter('adcbcd').collect(Collectors.histogram())
   * result: Map('a' -> 1, 'd' -> 2, 'c' -> 2, 'b' -> 1)
   * ```
   */
  export function histogram<Elem>(
    sortBy?: 'TOP' | 'BOTTOM',
    amount?: number
  ): Op<Elem, Histogram<Elem>> {
    if (amount !== undefined && amount <= 0) {
      return Op.fixed(Histogram.create())
    }

    const collector = Op.create<Elem, Histogram<Elem>>({
      init: () => Histogram.create(),
      next: Histogram.add
    })

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
   * @typeparam Elem the element type
   * @example
   * ```typescript
   * iter('adcbcd').collect(Collectors.elementsByFreq())
   * result: Map(1 -> Set('a', 'b'), 2 -> Set('d', 'c'))
   * ```
   */
  export function elementsByFreq<Elem>(): Op<Elem, UniqueDict<number, Elem>> {
    return histogram<Elem>().mapResult(dict => {
      const result = UniqueDict.create<number, Elem>()
      for (const key of dict.keys()) {
        UniqueDict.add(result, dict.get(key), key)
      }
      return result
    })
  }

  /**
   * Returns a collector that creates a tuple of element arrays based on the given `pred`.
   * The first array are the elements that satisfy `pred`, and the second array contains those that don't.
   * @typeparam Elem the element type
   * @param pred a predicate over elements Elem
   * @example
   * ```typescript
   * iter([1, 2, 3, 4, 5]).collect(Collectors.partition(isEven))
   * result: [[2, 4], [1, 3, 5]]
   * ```
   */
  export function partition<Elem>(pred: Pred<Elem>): Op<Elem, [Elem[], Elem[]]> {
    return partitionGen(pred, toArray())
  }

  /**
   * Returns a collector that creates a tuple of structures build with `buildSeqOp` based on the given `pred`.
   * The first structure contains the elements that satisfy `pred`, and the second structure contains those that don't.
   * @typeparam Elem the element type
   * @param pred a predicate over elements Elem
   * @param buildSeqOp a collector that builds a structure from given elements Elem
   * @example
   * ```typescript
   * iter([1, 2, 3, 4, 5]).collect(Collectors.partitionGen(isEven, Collectors.toSet()))
   * result: [Set([2, 4]), Set([1, 3, 5])]
   * ```
   */
  export function partitionGen<Elem, S>(
    pred: Pred<Elem>,
    buildSeqOp: Op<Elem, S>
  ): Op<Elem, [S, S]> {
    const empty = () => buildSeqOp.stateToResult(buildSeqOp.createInitState(), 0)

    return groupByGen(pred, buildSeqOp).mapResult(
      (map): [S, S] => [map.get(true) || empty(), map.get(false) || empty()]
    )
  }

  /**
   * Returns a collector that creates a tuple of element arrays where the first array contains the elements upto the given 'index', and the second array contains the other elements.
   * @typeparam Elem the element type
   * @param index the index at which to start the second array
   * @example
   * ```typescript
   * iter([1, 2, 3, 4, 5]).collect(Collectors.splitAt(3))
   * result: [[1, 2, 3], [4, 5]]
   * ```
   */
  export function splitAt<Elem>(index: number): Op<Elem, [Elem[], Elem[]]> {
    return splitAtGen(index, toArray())
  }

  /**
   * Returns a collector that creates a tuple of structures build by `buildSeqOp` where the first structure contains the elements upto the given 'index', and the second structure contains the other elements.
   * @typeparam Elem the element type
   * @param index the index at which to start the second array
   * @example
   * ```typescript
   * iter([1, 2, 3, 4, 5]).collect(Collectors.splitAtGen(3, Collectors.toSet()))
   * result: [Set([1, 2, 3]), Set([4, 5])]
   * ```
   */
  export function splitAtGen<Elem, S>(index: number, buildSeqOp: Op<Elem, S>): Op<Elem, [S, S]> {
    return partitionGen((_, i) => i < index, buildSeqOp)
  }

  /**
   * Returns a collector that outputs the sum of all received numbers
   * @example
   * ```typescript
   * iter([1, 2, 5]).collect(Collectors.sum)
   * result: 8
   * ```
   */
  export const sum: Op<number> = Op.create({
    init: 0,
    next: (state, num) => state + num
  })

  /**
   * Returns a collector that outputs the product of all received numbers
   * @example
   * ```typescript
   * iter([1, 2, 5]).collect(Collectors.product)
   * result: 10
   * ```
   */
  export const product: Op<number> = Op.create({
    init: 1,
    next: (state, num) => state * num,
    escape: state => state === 0
  })

  /**
   * Returns a collector that outputs the average of all received numbers
   * @example
   * ```typescript
   * iter([1, 4, 4]).collect(Collectors.average)
   * result: 3
   * ```
   */
  export const average: Op<number> = Op.create({
    init: 0,
    next: (avg, value, index) => avg + (value - avg) / (index + 1)
  })

  /**
   * Returns a collector that takes the first element of the iterable, and then uses the result of the `choice` function to decide
   * whether to keep the currently chosen value, or the new element.
   * @typeparam Elem the element type
   * @param choice a function taking two elements, and returning false to keep the first, and true to keep the second element
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter(['abCd', 'plCf', 'bcae']).collect(Collectors.choose((chosen, next) => next[2] === chosen[2]))
   * result: 'plc'
   * ```
   */
  export function choose<Elem>(
    choice: (chosen: Elem, next: Elem, index: number) => boolean,
    otherwise: OptLazy<Elem> = throwCollectError
  ): Op<Elem> {
    return chooseOpt<Elem>(
      (chosen, next, index) => chosen === NoValue || choice(chosen, next, index)
    ).mapResult(result => {
      if (result === NoValue) return OptLazy.toValue(otherwise)
      return result
    })
  }

  function chooseOpt<Elem>(
    choice: (chosen: Elem | NoValue, next: Elem, index: number) => boolean
  ): Op<Elem, Elem | NoValue> {
    return Op.createState<Elem, Elem | NoValue, Elem | NoValue>({
      init: NoValue,
      next: (state, elem, index) => (choice(state, elem, index) ? elem : state),
      stateToResult: state => state
    })
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
  export function min(otherwise: OptLazy<number> = throwCollectError): Op<number> {
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
  export function max(otherwise: OptLazy<number> = throwCollectError): Op<number> {
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
  export const range: Op<number, [number, number]> = Op.combine(min(), max())

  /**
   * Returns a collector that performs the `toNumber` function on each element, and returns the element for which the result
   * of `toNumber` returned the minimum value.
   * @typeparam Elem the element type
   * @param toNumber a function taking an element an returning a number to compare
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter(['aa', 'a', 'aaa']).collect(Collectors.minBy(w => w.length))
   * result: 'a'
   * ```
   */
  export function minBy<Elem>(
    toNumber: (value: Elem) => number,
    otherwise: OptLazy<Elem> = throwCollectError
  ): Op<Elem> {
    return Op.createState<Elem, undefined | { minElem: Elem; minNumber: number }, Elem>({
      init: undefined,
      next: (state, elem) => {
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
      stateToResult: state => (state === undefined ? OptLazy.toValue(otherwise) : state.minElem)
    })
  }

  /**
   * Returns a collector that performs the `toNumber` function on each element, and returns the element for which the result
   * of `toNumber` returned the maximum value.
   * @typeparam Elem the element type
   * @param toNumber a function taking an element an returning a number to compare
   * @param otherwise specifies how to deal with the potential case that the Iterable is empty. There are three cases:
   *    - not specified / undefined: If the Iterable is empty, this function will throw an error
   *    - (value: Elem): If the Iterable is empty, it will return the given value instead
   *    - (f: () => Elem): If the Iterable is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * iter(['aa', 'a', 'aaa']).collect(Collectors.maxBy(w => w.length))
   * result: 'aaa'
   * ```
   */
  export function maxBy<Elem>(
    toNumber: (value: Elem) => number,
    otherwise: OptLazy<Elem> = throwCollectError
  ): Op<Elem> {
    const negativeToNumber = (v: Elem) => -toNumber(v)
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
  export function rangeBy<Elem>(toNumber: (value: Elem) => number): Op<Elem, [Elem, Elem]> {
    return Op.combine(minBy(toNumber), maxBy(toNumber))
  }
}
