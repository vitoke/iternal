import {
  checkPureIterable,
  getIterator,
  NoValue,
  random,
  randomInt,
  _NO_VALUE
} from '../../private/iternal-common'
import { error } from '../../private/util'
import {
  CollectFun,
  Effect,
  Errors,
  Indexed,
  MapFun,
  Pred,
  Folder,
  ReduceFun,
  Fold
} from '../constants'
import { Opt, Option } from 'better-option'

const toIterator = <T>(iterable: Iterable<T>) => {
  checkPureIterable(iterable)
  return getIterator(iterable)
}

/**
 * Enrichment class allowing for manipulation of synchronous iteratables.
 * @typeparam T the element type.
 */
export class Iter<T> implements Iterable<T> {
  /**
   * Returns an empty Iter instance.
   * @typeparam E The type of elements the Iter instance can emit.
   */
  static readonly empty: Iter<any> = Iter.fromIterable<any>([])

  /**
   * Returns an Iter instance yielding the given elements.
   * @typeparam E The type of elements the Iter instance can emit.
   * @param elems the source elements
   */
  static readonly of = <E>(...elems: [E, ...E[]]): Iter<E> => Iter.fromIterable(elems)

  /**
   * Returns an Iter emitting the array entries from array.entries()
   * @typeparam E The array element type
   * @param arr the source array
   */
  static readonly arrayEntries = <E>(arr: E[]): Iter<[number, E]> =>
    Iter.fromIterator(() => arr.entries())

  /**
   * Returns an Iter emitting the map entries from map.entries()
   * @typeparam K the map key type
   * @typeparam V the map value type
   * @param map the source map
   */
  static readonly mapEntries = <K, V>(map: Map<K, V>): Iter<[K, V]> =>
    Iter.fromIterator(() => map.entries())

  /**
   * Returns an Iter emitting the map keys from map.keys()
   * @typeparam K the map key type
   * @param map the source map
   */
  static readonly mapKeys = <K>(map: Map<K, any>): Iter<K> => Iter.fromIterator(() => map.keys())

  /**
   * Returns an Iter emitting the map keys from map.keys()
   * @typeparam V the map value type
   * @param map the source map
   */
  static readonly mapValues = <V>(map: Map<any, V>): Iter<V> =>
    Iter.fromIterator(() => map.values())

  /**
   * Returns an Iter emitting the object entries as tuples of type [string, any]
   * @param obj the source object
   */
  static readonly objectEntries = <V>(obj: { [key: string]: V }): Iter<[string, V]> =>
    Iter.objectKeys(obj).map((p: string): [string, V] => [p, obj[p]])

  /**
   * Returns an Iter emitting the object keys as strings
   * @param obj the source object
   */
  static readonly objectKeys = (obj: {}): Iter<string> =>
    Iter.fromIterator(function*() {
      for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) yield prop
      }
    })

  /**
   * Returns an Iter emitting the object values
   * @param obj the source object
   */
  static readonly objectValues = <V>(obj: { [key: string]: V }): Iter<V> =>
    Iter.objectKeys(obj).map(p => obj[p])

  /**
   * Returns an Iter emitting items from an iterator
   * @typeparam E The type of elements the Iterator emits.
   * @param createIterator a function creating a new Iterator
   */
  static readonly fromIterator = <E>(createIterator: () => Iterator<E>) =>
    new Iter({
      [Symbol.iterator]: () => createIterator()
    })

  /**
   * Returns an Iter emitting items from an iterable
   * @typeparam E The type of elements the Iteratable emits.
   * @param iterable the source iterable
   */
  static fromIterable<E>(iterable: Iterable<E>): Iter<E> {
    if (iterable instanceof Iter) return iterable
    return new Iter(iterable)
  }

  /**
   * Returns an Iter generating an infinite sequence of elements using a generation function
   * @typeparam E The type of elements the Iter emits.
   * @param init The initial value to emit.
   * @param next Function the returns the next value to emit based on the current value.
   */
  static readonly sequence = <E>(init: E, next: (current: E) => Opt<E>): Iter<E> =>
    Iter.fromIterator(function*() {
      let value = init
      while (true) {
        yield value
        const result = next(value)
        if (result === Option.none) return
        value = result
      }
    })

  /**
   * Returns an Iter generating an infinite sequence of elements using an unfolding function
   * @typeparam S the internal 'state' of the unfolding function
   * @typeparam E the type of elements the Iter emits.
   * @param init The initial internal 'state' of the unfolding function
   * @param next A function taking the current state, and returning the element to emit and the next state as a tuple.
   */
  static readonly unfold = <S, E>(init: S, next: (currentState: S) => Opt<[E, S]>) =>
    Iter.fromIterator(function*() {
      let state = init
      while (true) {
        const result = next(state)
        if (result === Option.none) return
        const [elem, newState] = result
        state = newState
        yield elem
      }
    })

  /**
   * Returns an Iter emitting a single element the is created lazily when the item is requested.
   * @typeparm E the type of the element that is created
   * @param create A function that lazily creates an element to be emitted
   */
  static readonly fromLazy = <E>(create: () => E): Iter<E> =>
    Iter.fromIterator(function*() {
      yield create()
    })

  /**
   * Returns an Iter emitting all natural numbers starting from 0 or the given from value.
   * @param from optionally specifies a starting value for the sequence.
   */
  static readonly nats = (from = 0) => Iter.sequence(from, v => v + 1)

  /**
   * Returns an Iter emitting values in a range from the from value, until the until value if specified, increasing by step.
   * @param from the start value of the range
   * @param until (optional) the end value of the range
   * @param step the step size
   */
  static range(from: number, until?: number, step = 1): Iter<number> {
    const iter = Iter.sequence(from, v => v + step)
    if (until === undefined) return iter
    if (step >= 0) return iter.takeWhile(v => v < until)
    return iter.takeWhile(v => v > until)
  }

  /**
   * Returns an Iter emitting unique Symbols.
   */
  static readonly symbols = (): Iter<symbol> => Iter.fromLazy(Symbol).repeat()

  /**
   * Returns an Iter emitting random floating point numbers between min and max
   * @param min the minimum value
   * @param max the maximum value
   */
  static readonly random = (min = 0.0, max = 1.0): Iter<number> =>
    Iter.fromLazy(() => random(min, max)).repeat()

  /**
   * Returns an Iter emitting random integers between min and max
   * @param min the minimum value
   * @param max the maximum value
   */
  static readonly randomInt = (min = Number.MIN_VALUE, max = Number.MAX_VALUE): Iter<number> =>
    Iter.fromLazy(() => randomInt(min, max)).repeat()

  /**
   * Returns an Iter that emits the values from the source input in reversed order
   * @typeparam E the element type of the source
   * @param input a source string or array of elements
   */
  static readonly indexedReversed = <E>(input: Indexed<E>) =>
    Iter.fromIterator(function*() {
      let index = 0
      let last = input.length - 1
      while (index < input.length) yield input[last - index++]
    })

  /**
   * Returns an Iter that emits the values from the source input of length N from index 0 to N-1, and then from N downto 1.
   * @typeparam E the element type of the source
   * @param input a source string or array of elements
   */
  static readonly indexedBounce = <E>(input: Indexed<E>) =>
    Iter.fromIterable(input).concat(
      Iter.fromIterator(function*() {
        let index = 1
        let last = input.length - 1
        while (index < input.length - 1) yield input[last - index++]
      })
    )

  /**
   * Returns an Iter that emits the values from each Iterable in the given Iterable.
   * @typeparam E the element type that the iterables of the given iterable emit.
   * @param iterable the source iterable of iterables
   */
  static readonly flatten = <E>(iterable: Iterable<Iterable<E>>): Iter<E> =>
    Iter.fromIterable(iterable).flatMap((v: Iterable<E>) => v)

  private constructor(private readonly iterable: Iterable<T>) {
    if (iterable instanceof Iter) {
      throw error(Errors.InternalError, 'unnecessary nesting')
    }
    checkPureIterable(iterable)
    this.iterable = iterable
  }

  private create = <R>(f: (_: Iterable<T>) => Iterator<R>): Iter<R> =>
    new Iter({
      [Symbol.iterator]: () => f(this.iterable)
    });

  /**
   * Iterable interface: When called, returns an Iterator of type T
   */
  [Symbol.iterator] = (): Iterator<T> => this.iterable[Symbol.iterator]()

  /**
   * Applies the given effect function to each element of the Iter, with its index.
   * @param effect a function taking an element of the Iter and optionally its index and performs some side-effect.
   */
  forEach = (effect?: Effect<T>): void => {
    let index = 0
    for (const elem of this) if (effect !== undefined) effect(elem, index++)
  }

  /**
   * Returns an Iter where the given mapFun is applied to each yielded element, with its index.
   * @typeparam R the result type of the given mapFun
   * @param mapFun a function taking an element of this Iter, and optionally its index, and returning a new element of type R
   */
  map = <R>(mapFun: MapFun<T, R>): Iter<R> =>
    this.create(function*(iterable) {
      let index = 0
      for (const elem of iterable) yield mapFun(elem, index++)
    })

  /**
   * Returns an Iter of only those elements for which the given pred predicate returns true
   * @param pred a predicate for an element, optionally with its index
   */
  filter = (pred: Pred<T>): Iter<T> =>
    this.create(function*(iterable) {
      let index = 0
      for (const elem of iterable) {
        if (pred(elem, index++)) yield elem
      }
    })

  /**
   * Returns an Iter of only those elements for which the given pred predicate returns false
   * @param pred a predicate for an element, optionally with its index
   */
  filterNot = (pred: Pred<T>): Iter<T> => this.filter((v, i) => !pred(v, i))

  /**
   * Returns an Iter that emits all values from the iterables resulting from applying the given flatMapFun to each element in this Iter.
   * @typeparam R the elements of the Iterables resulting from flatMapFun
   * @param flatMapFun a function taking an element from this Iter and returning an iterable with elements of type R
   */
  flatMap = <R>(flatMapFun: (elem: T, index: number) => Iterable<R>): Iter<R> =>
    this.create(function*(iterable) {
      let index = 0
      for (const elem of iterable) yield* flatMapFun(elem, index++)
    })

  /**
   * Returns an Iter with the result of applying the given collectFun to each element of this Iter, unless the result is the special SKIP_VALUE symbol, in that case the element is skipped.
   * This function is a combination of map and filter.
   * @typeparam R the resulting elements of the collectFun function
   * @param collectFun a function taking an element of this Iter, optionally with its index, and returning either a new element of type R, or SKIP_VALUE if the value should be skipped
   */
  collect = <R>(collectFun: CollectFun<T, R>) =>
    this.create(function*(iterable) {
      let index = 0
      for (const elem of iterable) {
        const value = collectFun(elem, index++)
        if (value !== Option.none) yield value
      }
    })

  /**
   * Returns an Iter yielding the values of this Iter, followed by the values in each of the iterables supplied as arguments.
   * @param otherIterables a non-empty list of iterables of the same type
   */
  concat = (...otherIterables: [Iterable<T>, ...Iterable<T>[]]): Iter<T> =>
    this.create(function*(iterable) {
      yield* iterable
      for (const otherIterable of otherIterables) yield* otherIterable
    })

  /**
   * Returns an Iter yielding the given elements after the elements of this Iter have been yielded
   * @param elems a non-empty list of elements that should be appended
   * @returns an Iter yielding the given elements after the elements of this Iter have been yielded
   */
  append = (...elems: [T, ...T[]]): Iter<T> => this.concat(elems)

  /**
   * Returns an Iter yielding the given elements before the elements of this Iter are yielded
   * @param elems a non-empty list of elements that should be prepended
   */
  prepend = (...elems: [T, ...T[]]): Iter<T> => Iter.fromIterable(elems).concat(this)

  /**
   * Skips the first given amount of elements of this Iter, then emits all following elements, if present.
   * @param amount the amount of elements to skip
   */
  drop = (amount: number): Iter<T> =>
    this.create(function*(iterable) {
      let toDrop = amount
      const iterator = (getIterator(iterable) as any) as Iterable<T>

      for (const elem of iterator) {
        if (toDrop-- <= 0) {
          yield elem
          yield* iterator
          return
        }
      }
    })

  /**
   * Emits the first given amount of elements of this Iter if present, then ends.
   * @param amount the amount of elements to emit
   */
  take = (amount: number) =>
    this.create(function*(iterable) {
      let toTake = amount

      for (const elem of iterable) {
        if (toTake-- <= 0) return
        yield elem
      }
    })

  /**
   * Emits the items of this Iter starting at the from index, and then emitting the specified amount of items, if present.
   * @param from the index at which to start emitting values
   * @param amount the amount of items to emit
   */
  slice = (from: number, amount: number) => this.drop(from).take(amount)

  /**
   * Emits the items of this Iter as long as the given pred predicate holds, then ends.
   * @param pred a predicate taking an element and its index
   */
  takeWhile = (pred: Pred<T>) =>
    this.create(function*(iterable) {
      let index = 0
      for (const elem of iterable) {
        if (pred(elem, index++)) yield elem
        else return
      }
    })

  /**
   * Skips items of this Iter as long as the given pred predicate holds, then emits all following elements, if present.
   * @param pred a predicate taking an element and its index
   */
  dropWhile = (pred: Pred<T>): Iter<T> =>
    this.create(function*(iterable) {
      const iterator = (getIterator(iterable) as any) as Iterable<T>
      let index = 0

      for (const elem of iterator) {
        if (!pred(elem, index++)) {
          yield elem
          return yield* iterator
        }
      }
    })

  /**
   * Returns the result of applying the given op reducer function to each element of this Iter, calculating some result value.
   * @typeparam R the result type of the reducer
   * @param init the initial value of the reducer, returned if this Iter is empty
   * @param op the reduction function taking the current reducer value and the next element of this Iter
   */
  fold = <R>(folder: Folder<T, R>): R => Fold.foldIterable(this, folder)

  foldOr = <R, O>(otherwise: O, folder: Folder<T, Opt<R>>): R | O =>
    Option.getOr(otherwise, this.fold(folder))

  /**
   * Returns an Iter that emits the result of applying the given op function to the last emitted value and the next element of this Iter
   * @param folder the reducer function taking the last emitted value and the next element of this Iter, and returning a new value to emit
   */
  foldIter = <R>(folder: Folder<T, R>): Iter<R> =>
    this.create(function*(iterable) {
      let result: R = folder.init

      for (const elem of iterable) {
        result = folder.combine(result, elem)
        yield result
      }
    })

  private internalReduce = (op: ReduceFun<T, T>): T | NoValue => {
    let result: T | NoValue = _NO_VALUE

    for (const elem of this) {
      if (result === _NO_VALUE) result = elem
      else result = op(result, elem)
    }

    return result
  }

  /**
   * Returns the result of applying the reducer function to each element of this Iter, or returns the otherwise value if this Iter is empty.
   * @typeparam O the type of the otherwise value
   * @param op the reducer function taking the current reducer value and the next element of this Iter, and returning a new value
   * @param otherwise the value to return if this Iter is empty
   */
  reduceOrValue<O>(op: ReduceFun<T, T>, otherwise: O): T | O {
    const result = this.internalReduce(op)
    if (result === _NO_VALUE) return otherwise
    return result
  }

  reduceOpt = (op: ReduceFun<T, T>): Opt<T> => this.reduceOrValue(op, Option.none)

  /**
   * Returns an Iter emitting the result from applying the given zipFun to the next element of this Iter and each next element of the given iterables.
   * If any of the iterables is done, the resulting Iter als ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be emitted
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zipWith = <O, R>(
    zipFun: (t: T, o: O, ...others: any[]) => Opt<R>,
    other1Iterable: Iterable<O>,
    ...otherIterables: Iterable<any>[]
  ): Iter<R> =>
    this.create(function*(iterable) {
      const iterators = [
        toIterator(iterable),
        toIterator(other1Iterable),
        ...otherIterables.map(toIterator)
      ]

      while (true) {
        const values = []
        for (const iterator of iterators) {
          const { value, done } = iterator.next()
          if (done) return
          values.push(value)
        }
        const zipOpt = zipFun(...(values as [T, O, ...any[]]))
        if (Option.hasValue(zipOpt)) yield zipOpt
      }
    })

  /**
   * Returns an Iter containing tuples of each next element of this Iter and the provided iterables.
   * If any of the iterables is done, the resulting Iter will end.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zip = <O>(
    other1Iterable: Iterable<O>,
    ...otherIterables: Iterable<any>[]
  ): Iter<[T, O, ...any[]]> => {
    const toTuple = (t: T, o: O, ...args: any[]): [T, O, ...any[]] => [t, o, ...args]

    return this.zipWith(toTuple, other1Iterable, ...otherIterables)
  }

  /**
   * Returns an Iter emitting tuples of the elements of this Iter as first elements, and their indices as second element.
   */
  zipWithIndex = (): Iter<[T, number]> => this.map((e, i): [T, number] => [e, i])

  /**
   * Returns an Iter emitting the result from applying the given zipFun to the next element of this Iter and each next element of the given iterables.
   * If any of the iterables is done, the element will be undefined. If all iterables are done, the resulting Iter ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be emitted, accepting undefined for each non-present value
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zipAllWith = <O, R>(
    zipFun: (t?: T, o?: O, ...others: any[]) => Opt<R>,
    other1Iterable: Iterable<O>,
    ...otherIterables: Iterable<any>[]
  ): Iter<R> =>
    this.create(function*(iterable) {
      const iterators = [
        toIterator(iterable),
        toIterator(other1Iterable),
        ...otherIterables.map(toIterator)
      ]

      while (true) {
        const results = iterators.map(it => it.next())
        if (results.every(r => r.done)) return
        const values = results.map(r => (r.done ? undefined : r.value))
        const zipOpt = zipFun(...values)
        if (Option.hasValue(zipOpt)) yield zipOpt
      }
    })

  /**
   * Returns an Iter containing tuples of each next element of this Iter and the provided iterables.
   * If any of the iterables is done, the resulting values will be undefined. If all iterables are done, the resulting Iter ends.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zipAll = <O>(
    other1Iterable: Iterable<O>,
    ...otherIterables: Iterable<any>[]
  ): Iter<[T?, O?, ...any[]]> => {
    const toTuple = (t?: T, o?: O, ...other: any[]): [T?, O?, ...any[]] => [t, o, ...other]

    return this.zipAllWith(toTuple, other1Iterable, ...otherIterables)
  }

  /**
   * Returns an Iter that repeatedly emits one value of this Iter and then one value from each given iterable, as long as none of the iterables is done.
   * @param otherIterables a non-empty list of iterables to interleave with.
   */
  interleave = (...otherIterables: [Iterable<T>, ...Iterable<T>[]]): Iter<T> =>
    Iter.flatten(this.zip(...otherIterables))

  /**
   * Returns a string starting with the given start element, then each element of this Iter separated by the given sep element, and ending with the end element.
   * @param sep the seperator string
   * @param start the start string
   * @param end the end string
   */
  join = (sep = '', start = '', end = ''): string => {
    const sepThis = this.map(String).intersperse(sep)
    return start.concat(...sepThis, end)
  }

  /**
   * Repeats the current Iter times amount of times, or indefinately if times is undefined.
   * @times the amount of times to repeat this Iter
   */
  repeat = (times?: number): Iter<T> => {
    if (times !== undefined) {
      if (times <= 0 || this === Iter.empty) return Iter.empty
      if (times === 1) return this
    }

    return this.create(function*(iterable) {
      const iterator = getIterator(iterable)
      const { value, done } = iterator.next()

      if (done) return

      yield value
      yield* (iterator as any) as Iterable<T>

      if (times === undefined) while (true) yield* iterable

      while (--times > 0) yield* iterable
    })
  }

  /**
   * Returns an Iter that emits each distinct value of this Iter at most once.
   */
  distinct = () =>
    this.create(function*(iterable) {
      const set = new Set()

      for (const elem of iterable) {
        if (!set.has(elem)) {
          set.add(elem)
          yield elem
        }
      }
    })

  /**
   * Returns an Iter that emits arrays of the given size of values from this Iter, each shifted that the given step
   * Note: the last window may be smaller than the given size.
   * @size the window size
   * @step the amount of elements to shift the next window
   */
  sliding = (size: number, step = size): Iter<T[]> => {
    if (size <= 0 || step <= 0) return Iter.empty

    return this.create(function*(iterable) {
      let bucket: T[] = []

      let toSkip = 0

      for (const elem of iterable) {
        if (toSkip <= 0) bucket.push(elem)
        toSkip--

        if (bucket.length >= size) {
          yield bucket
          bucket = bucket.slice(step)
          toSkip = step - size
        }
      }

      if (bucket.length > 0 && bucket.length > size - step) yield bucket
    })
  }

  /**
   * Returns an Iter that emits only each given nth value of this Iter.
   * @nth the amount of elements to skip every in between emissions.
   */
  sample = (nth: number): Iter<T> => Iter.flatten(this.sliding(1, nth))

  /**
   * Allows side-effects at any point in the chain, but does not modify the Iter, it just returns the same Iter instance.
   * @param effect the side-effect to perform for each emitted element
   */
  monitor = (effect: Effect<T>): Iter<T> => {
    this.forEach(effect)
    return this
  }

  /**
   * Returns an Iter where all elments satisfying given pred are replaced by the iterable returned by the createSubstIterable function with the element to replace.
   * @param pred a predicate for an element of this Iter and its index
   * @param createSubstIterable a function that given an element returns an iterable of which the elements will replace the given element
   */
  substituteWhere = (
    pred: Pred<T>,
    createSubstIterable: (e: T) => Iterable<T> = () => Iter.empty
  ) =>
    this.create(function*(iterable) {
      let index = 0

      for (const elem of iterable) {
        const subst = createSubstIterable(elem)
        checkPureIterable(subst)
        if (pred(elem, index++)) yield* subst
        else yield elem
      }
    })

  /**
   * Returns an Iter where all elments that equal the given elem are replaced by the iterable returned by the substIterable function with the element to replace.
   * @param elem the element to replace
   * @param substIterable an iterable of which the elements will replace the given element
   */
  substituteElem = (elem: T, substIterable: Iterable<T> = Iter.empty) =>
    this.substituteWhere(e => e === elem, () => substIterable)

  /**
   * Returns an Iter that emits arrays of values of this Iter each time a value is encountered that satisfied the given pred predicate
   * @param pred a predicate for an element of this Iter and its index
   */
  splitWhere = (pred: Pred<T>): Iter<T[]> =>
    this.create(function*(iterable) {
      let bucket: T[] = []
      let newBucket = false
      let index = 0

      for (const elem of iterable) {
        if (pred(elem, index++)) {
          yield bucket
          bucket = []
          newBucket = true
        } else {
          bucket.push(elem)
          newBucket = false
        }
      }

      if (newBucket || bucket.length > 0) yield bucket
    })

  /**
   * Returns an Iter that emits arrays of values of this Iter each time a value that equals given elem is encountered
   * @param pred a predicate for an element of this Iter and its index
   */
  splitOnElem = (elem: T) => this.splitWhere(e => e === elem)

  /**
   * Returns an Iter that emits the elements of this Iter with the given interIter elements as a sepatator
   * @param interIter an iterator of elements that is used as a separator
   */
  intersperse = (interIter: Iterable<T>) =>
    this.create(function*(iterable) {
      let sepIter: Iterable<T> = Iter.empty

      for (const elem of iterable) {
        yield* sepIter
        sepIter = interIter

        yield elem
      }
    })

  /**
   * Returns an Iter that starts with the startIter elements, then emits all elements of this Iter with the sepIter elements
   * as separators, and ends with the endIter elements.
   * @param startIter the start elements
   * @param sepIter the separator elements
   * @param endIter the end elements
   */
  mkGroup = (
    startIter: Iterable<T> = Iter.empty,
    sepIter: Iterable<T> = Iter.empty,
    endIter: Iterable<T> = Iter.empty
  ): Iter<T> => Iter.fromIterable(startIter).concat(this.intersperse(sepIter), endIter)

  /**
   * Returns a fixed tag string to void unnecessary evaluation of iterable items.
   */
  toString = () => `[Iter]`

  /**
   * Returns an array with all the values in this Iter
   */
  toArray = () => [...this]

  /**
   * Returns a Set with all the unique values in this Iter
   */
  toSet = () => new Set(this)
}
