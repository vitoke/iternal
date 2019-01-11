import {
  checkPureIterable,
  getIterator,
  NoValue,
  optPred,
  random,
  randomInt
} from '../../private/iternal-common'
import { error } from '../../private/util'
import {
  CollectFun,
  Effect,
  Errors,
  Indexed,
  MapFun,
  MonitorEffect,
  NonEmpty,
  OptLazy,
  optToValue,
  Pred
} from '../constants'
import { Folder, MonoFun } from '../iternal-fold/types'

const toIterator = <T>(iterable: Iterable<T>): Iterator<T> =>
  getIterator(checkPureIterable(iterable))

/**
 * Enrichment class allowing for manipulation of synchronous iteratables.
 * @typeparam T the element type.
 */
export class Iter<T> implements Iterable<T> {
  /**
   * Returns an empty Iter instance.
   * @example
   * ```typescript
   * Iter.empty
   * result: ()
   * ```
   */
  static readonly empty: Iter<any> = Iter.fromIterable<any>([])

  /**
   * Returns an Iter instance yielding the given elements.
   * @typeparam E The type of elements the Iter instance can yield.
   * @param elems the source elements
   * @example
   * ```typescript
   * Iter.of(1, 3, 5)
   * result: (1, 3, 5)
   * ```
   */
  static of<E>(...elems: NonEmpty<E>): Iter<E> {
    return Iter.fromIterable(elems)
  }

  /**
   * Returns an Iter yielding the array entries from array.entries()
   * @typeparam E The array element type
   * @param arr the source array
   */
  static arrayEntries<E>(arr: E[]): Iter<[number, E]> {
    return Iter.fromIterator(() => arr.entries())
  }

  /**
   * Returns an Iter yielding the map entries from map.entries()
   * @typeparam K the map key type
   * @typeparam V the map value type
   * @param map the source map
   */
  static mapEntries<K, V>(map: Map<K, V>): Iter<[K, V]> {
    return Iter.fromIterator(() => map.entries())
  }

  /**
   * Returns an Iter yielding the map keys from map.keys()
   * @typeparam K the map key type
   * @param map the source map
   */
  static mapKeys<K>(map: Map<K, any>): Iter<K> {
    return Iter.fromIterator(() => map.keys())
  }

  /**
   * Returns an Iter yielding the map keys from map.keys()
   * @typeparam V the map value type
   * @param map the source map
   */
  static mapValues<V>(map: Map<any, V>): Iter<V> {
    return Iter.fromIterator(() => map.values())
  }

  /**
   * Returns an Iter yielding the object entries as tuples of type [string, any]
   * @param obj the source object
   */
  static objectEntries<V>(obj: { [key: string]: V }): Iter<[string, V]> {
    return Iter.objectKeys(obj).map((p: string): [string, V] => [p, obj[p]])
  }

  /**
   * Returns an Iter yielding the object keys as strings
   * @param obj the source object
   */
  static objectKeys(obj: {}): Iter<string> {
    return Iter.fromIterator(function*() {
      for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) yield prop
      }
    })
  }

  /**
   * Returns an Iter yielding the object values
   * @param obj the source object
   */
  static objectValues<V>(obj: { [key: string]: V }): Iter<V> {
    return Iter.objectKeys(obj).map(p => obj[p])
  }

  /**
   * Returns an Iter yielding items from an iterator
   * @typeparam E The type of elements the Iterator yields.
   * @param createIterator a function creating a new iterator
   */
  static fromIterator<E>(createIterator: () => Iterator<E>) {
    return new Iter({
      [Symbol.iterator]: () => createIterator()
    })
  }

  /**
   * Returns an Iter yielding items from an iterable
   * @typeparam E The type of elements the Iteratable yields.
   * @param iterable the source iterable
   */
  static fromIterable<E>(iterable: Iterable<E>): Iter<E> {
    if (iterable instanceof Iter) return iterable
    return new Iter(iterable)
  }

  /**
   * Returns an Iter yielding a potentially infinite sequence of elements using a generation function
   * @typeparam E The type of elements the Iter yields.
   * @param init The initial value to yield.
   * @param next Function the returns the optional next value to yield based on the current value and its index.
   * @example
   * ```typescript
   * Iter.generate(2, v => v * v)
   * result: (2, 4, 16, 256, ...)
   * ```
   */
  static generate<E>(init: E, next: (current: E, index: number) => E | undefined): Iter<E> {
    return Iter.fromIterator(function*() {
      let value = init
      let index = 0
      while (true) {
        yield value
        const result = next(value, index++)
        if (result === undefined) return
        value = result
      }
    })
  }
  /**
   * Returns an Iter yielding a potentially infinite sequence of elements using an unfolding function
   * @typeparam S the internal 'state' of the unfolding function
   * @typeparam E the type of elements the Iter yields.
   * @param init The initial internal 'state' of the unfolding function
   * @param next A function taking the current state, and returning an optional tuple containing the element to yield and the next state.
   * @example
   * ```typescript
   * Iter.unfold(1, s => ['a'.repeat(s), s * 2])
   * result: ('a', 'aa', 'aaaa', 'aaaaaaaa', ...)
   * ```
   */
  static unfold<S, E>(
    init: S,
    next: (currentState: S, index: number) => [E, S] | undefined
  ): Iter<E> {
    return Iter.fromIterator(function*() {
      let state = init
      let index = 0
      while (true) {
        const result = next(state, index++)
        if (result === undefined) return
        const [elem, newState] = result
        state = newState
        yield elem
      }
    })
  }

  /**
   * Returns an Iter yielding a single element the is created lazily when the item is requested.
   * @typeparm E the type of the element that is created
   * @param create A function that lazily creates an element to yield
   * @example
   * ```typescript
   * Iter.fromLazy(Math.random)
   * result: (0.243442)
   * ```
   */
  static fromLazy<E>(create: () => E): Iter<E> {
    return Iter.fromIterator(function*() {
      yield create()
    })
  }

  /**
   * Returns an Iter yielding all natural numbers starting from 0.
   * @example
   * ```typescript
   * Iter.nats
   * result: (0, 1, 2, 3, ...)
   * ```
   */
  static readonly nats = Iter.generate(0, v => v + 1)

  /**
   * Returns an Iter yielding values in a range from the from value, until the until value if specified, increasing by step.
   * @param from the start value of the range
   * @param until (optional) the end value of the range
   * @param step the step size
   * @example
   * ```typescript
   * Iter.range(10, 50, 10)
   * result: (10, 20, 30, 40)
   * ```
   * @example
   * ```typescript
   * Iter.range(50, 0, -10)
   * result: (50, 40, 30, 20, 10)
   * ```
   * @example
   * ```typescript
   * Iter.range(0, undefined, 3)
   * result: (0, 3, 6, 9, ...)
   * ```
   */
  static range(from: number, until?: number, step = 1): Iter<number> {
    const iter = Iter.generate(from, v => v + step)
    if (until === undefined) return iter
    if (step >= 0) return iter.takeWhile(v => v < until)
    return iter.takeWhile(v => v > until)
  }

  /**
   * Returns an Iter yielding infinite unique Symbols.
   * @example
   * ```typescript
   * const [X_AXIS, Y_AXIS, Z_AXIS] = Iter.symbols
   * ```
   */
  static readonly symbols = Iter.fromLazy(Symbol).repeat()

  /**
   * Returns an Iter yielding a random floating point number between min and max
   * @param min the minimum value
   * @param max the maximum value
   * @example
   * ```typescript
   * Iter.random()
   * result: (0.5234)
   * ```
   * @example
   * ```typescript
   * Iter.random(10, 20).repeat()
   * result: (17.3541, 12.1324, 18.4243, ...)
   * ```
   */
  static random(min = 0.0, max = 1.0): Iter<number> {
    return Iter.fromLazy(() => random(min, max))
  }
  /**
   * Returns an Iter yielding a random integer between min and max
   * @param min the minimum value
   * @param max the maximum value
   * @example
   * ```typescript
   * Iter.randomInt()
   * result: (535984)
   * ```
   * @example
   * ```typescript
   * Iter.randomInt(0, 10).repeat()
   * result: (8, 2, 5, 3, 5, 1, 7, ...)
   * ```
   */
  static randomInt(min = Number.MIN_VALUE, max = Number.MAX_VALUE): Iter<number> {
    return Iter.fromLazy(() => randomInt(min, max))
  }

  /**
   * Returns an Iter that yields the values from the source input in reversed order
   * @typeparam E the element type of the source
   * @param input a source string or array of elements
   * @example
   * ```typescript
   * Iter.indexedReversed('abc')
   * result: ('c', 'b', 'a')
   * ```
   */
  static indexedReversed<E>(input: Indexed<E>): Iter<E> {
    if (input.length === 0) return Iter.empty

    return Iter.fromIterator(function*() {
      let index = 0
      let last = input.length - 1
      while (index < input.length) yield input[last - index++]
    })
  }

  /**
   * Returns an Iter that yields the values from the source input of length N from index 0 to N-1, and then from N-2 downto 1.
   * @typeparam E the element type of the source
   * @param input a source string or array of elements
   * @example
   * ```typescript
   * Iter.indexedBounce('abc')
   * result: ('a', 'b', 'c', 'b' )
   * ```
   */
  static indexedBounce<E>(input: Indexed<E>) {
    if (input.length === 0) return Iter.empty

    return Iter.fromIterable(input).concat(
      Iter.fromIterator(function*() {
        let index = 1
        let last = input.length - 1
        while (index < input.length - 1) yield input[last - index++]
      })
    )
  }

  /**
   * Returns an Iter that yields the values from each nested Iterable in the given Iterable.
   * @typeparam E the element type that the iterables of the given iterable yield.
   * @param iterable the source iterable of iterables
   * @example
   * ```typescript
   * Iter.flatten(Iter.of(Iter.of(1, 3)), Iter.of(Iter.of (2, 4)))
   * result: (1, 3, 2, 4)
   * ```
   */
  static flatten<E>(iterable: Iterable<Iterable<E>>): Iter<E> {
    if (iterable === Iter.empty) return Iter.empty

    return Iter.fromIterable(iterable).flatMap(v => v)
  }

  private constructor(private readonly iterable: Iterable<T>) {
    if (iterable instanceof Iter) {
      throw error(Errors.InternalError, 'unnecessary nesting')
    }
    checkPureIterable(iterable)
  }

  private get isEmptyInstance() {
    return this === Iter.empty
  }

  /**
   * Returns an Iter instance yielding the values resulting from the iterator output of the `createIterator` function receiving this iterable as an argument.
   * @typeparam R the result iterator element type
   * @param createIterator a function receiving the current iterable and returning an iterator of new elements
   * @example
   * ```typescript
   * Iter.of(1, 2, 3, 4)
   *   .applyCustomOperation(function*(iterable) {
   *     for { const elem of iterable } {
   *       if (Math.random() > 0.5) yield `foo${elem}`
   *     }
   *   })
   *   .join(',')
   * result (example): 'foo2,foo3'
   * ```
   */
  applyCustomOperation<R>(createIterator: (iterable: Iterable<T>) => Iterator<R>): Iter<R> {
    return Iter.fromIterator(() => createIterator(this))
  }

  private monitorEffect?: MonitorEffect<T>;

  /**
   * Iterable interface: When called, returns an Iterator of type T
   */
  [Symbol.iterator](): Iterator<T> {
    const iterator = getIterator(this.iterable)
    const effect = this.monitorEffect

    if (effect === undefined) return iterator
    let index = 0

    return {
      next: (...args: any[]) => {
        const nextResult = iterator.next(...args)
        if (!nextResult.done) effect(nextResult.value, index++)
        return nextResult
      }
    }
  }

  /**
   * Applies the values of the current Iter to the given `folder` and returns the result.
   * @typeparam R the result type of the folder
   * @param folder the folder to apply
   * @example
   * ```typescript
   * Iter.of(1, 3, 5).fold(Fold.sum)
   * result: 9
   * ```
   */
  fold<R>(folder: Folder<T, R>): R {
    let result = folder.createInitState()
    let index = 0

    for (const e of this) {
      result = folder.nextState(result, e, index++)

      if (optPred(result, index, folder.escape)) {
        return folder.stateToResult(result)
      }
    }
    return folder.stateToResult(result)
  }

  /**
   * Returns an Iter yielding each result of applying the folder to the next element in this Iter.
   * @typeparam R the result type of the folder
   * @param folder the folder to apply
   * @example
   * ```typescript
   * Iter.of(1, 3, 4).foldIter(Fold.sum)
   * result: (1, 4, 8)
   * ```
   */
  foldIter<R>(folder: Folder<T, R>): Iter<R> {
    return this.applyCustomOperation(function*(iterable) {
      let result = folder.createInitState()
      let index = 0

      for (const e of iterable) {
        result = folder.nextState(result, e, index++)
        yield folder.stateToResult(result)
        if (optPred(result, index, folder.escape)) return
      }
    })
  }

  /**
   * Applies the given effect function to each element of the Iter, with its index.
   * Note: eagerly gets all values from the iterable.
   * @param effect a function taking an element of the Iter and optionally its index and performs some side-effect.
   */
  forEach(effect?: Effect<T>): void {
    if (effect === undefined) {
      for (const elem of this);
      return
    }

    let index = 0
    for (const elem of this) effect(elem, index++)
  }

  /**
   * Returns an Iter where the given mapFun is applied to each yielded element, with its index.
   * @typeparam R the result type of the given mapFun
   * @param mapFun a function taking an element of this Iter, and optionally its index, and returning a new element of type R
   * @example
   * ```typescript
   * Iter.of(1, 3, 5).map((value, index) => value + index)
   * result: (1, 5, 8)
   * ```
   */
  map<R>(mapFun: MapFun<T, R>): Iter<R> {
    if (this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
      let index = 0
      for (const elem of iterable) yield mapFun(elem, index++)
    })
  }

  /**
   * Returns an Iter of only those elements for which the given pred predicate returns true
   * @param pred a predicate for an element, optionally with its index
   * @example
   * ```typescript
   * Iter.of(1, 3, 5, 7).filter((v, i) => isEven(v + i))
   * result: (3, 7)
   * ```
   */
  filter(pred: Pred<T>): Iter<T> {
    return this.filterNot((v, i) => !pred(v, i))
  }

  /**
   * Returns an Iter of only those elements for which the given pred predicate returns false
   * @param pred a predicate for an element, optionally with its index
   * @example
   * ```typescript
   * Iter.nats.filterNot(isEven)
   * result: (1, 3, 5, 7, ...)
   * ```
   */
  filterNot(pred: Pred<T>): Iter<T> {
    return this.patchWhere(pred, 1)
  }

  /**
   * Returns an Iter that yields all values from the iterables resulting from applying the given flatMapFun to each element in this Iter.
   * @typeparam R the elements of the Iterables resulting from flatMapFun
   * @param flatMapFun a function taking an element from this Iter and returning an iterable with elements of type R
   * @example
   * ```typescript
   * Iter.nats.flatMap(e => Iter.of(e).repeat(e))
   * result: (1, 2, 2, 3, 3, 3, ...)
   * ```
   */
  flatMap<R>(flatMapFun: (elem: T, index: number) => Iterable<R>): Iter<R> {
    if (this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
      let index = 0
      for (const elem of iterable) {
        yield* checkPureIterable(flatMapFun(elem, index++))
      }
    })
  }
  /**
   * Returns an Iter with the result of applying the given collectFun to each element of this Iter, unless the result is undefined, in that case the element is skipped.
   * This function is a combination of map and filter.
   * @typeparam R the resulting elements of the collectFun function
   * @param collectFun a function taking an element of this Iter, optionally with its index, and returning either a new element of type R, or undefined if the value should be skipped
   * @example
   * ```typescript
   * Iter.of(1, 2, 5, 0).collect(v => isEven(v) ? 'a'.repeat(v) : undefined)
   * result: ('aa', '')
   * ```
   */
  collect<R>(collectFun: CollectFun<T, R>): Iter<R> {
    return this.map(collectFun).filter(v => v !== undefined) as Iter<R>
  }

  /**
   * Returns an Iter yielding the values of this Iter, followed by the values in each of the iterables supplied as arguments.
   * @param otherIterables a non-empty list of iterables of the same type
   * @example
   * ```typescript
   * Iter.of(2, 4).concat([5, 3], Iter.nats)
   * result: (2, 4, 5, 3, 1, 2, 3, ...)
   * ```
   */
  concat(...otherIterables: NonEmpty<Iterable<T>>): Iter<T> {
    return Iter.of<Iterable<T>>(this, ...otherIterables)
      .filter(it => it !== Iter.empty)
      .flatMap(it => checkPureIterable(it))
  }

  /**
   * Returns an Iter yielding the given elements after the elements of this Iter have been yielded
   * @param elems a non-empty list of elements that should be appended
   * @example
   * ```typescript
   * Iter.of(1, 3, 5).append(6, 7)
   * result: (1, 3, 5, 6, 7)
   * ```
   */
  append(...elems: NonEmpty<T>): Iter<T> {
    return this.concat(elems)
  }

  /**
   * Returns an Iter yielding the given elements before the elements of this Iter are yielded
   * @param elems a non-empty list of elements that should be prepended
   * @example
   * ```typescript
   * Iter.of(1, 3, 5).prepend(6, 7)
   * result: (6, 7, 1, 3, 5)
   * ```
   */
  prepend(...elems: NonEmpty<T>): Iter<T> {
    return Iter.fromIterable(elems).concat(this)
  }

  /**
   * Returns an Iter that skips the first given amount of elements of this Iter, then yields all following elements, if present.
   * @param amount the amount of elements to skip
   * @example
   * ```typescript
   * Iter.nats.drop(3)
   * result: (3, 4, 5, 6, ...)
   * ```
   */
  drop(amount: number): Iter<T> {
    return this.patchAt(0, amount)
  }

  /**
   * Returns an Iter that yields the first given amount of elements of this Iter if present, then ends.
   * @param amount the amount of elements to yield
   * @example
   * ```typescript
   * Iter.nats.take(4)
   * result: (0, 1, 2, 3)
   * ```
   */
  take(amount: number): Iter<T> {
    if (amount <= 0 || this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
      let toTake = amount

      for (const elem of iterable) {
        if (toTake-- <= 0) return
        yield elem
      }
    })
  }

  /**
   * Returns an Iter that yields the items of this Iter starting at the from index, and then yields the specified amount of items, if present.
   * @param from the index at which to start yielding values
   * @param amount the maximum amount of items to yield
   * @example
   * ```typescript
   * Iter.nats.slice(3, 4)
   * result: (3, 4, 5, 6)
   * ```
   */
  slice(from: number, amount: number) {
    return this.drop(from).take(amount)
  }

  /**
   * Returns an Iter that yields the items of this Iter as long as the given pred predicate holds, then ends.
   * @param pred a predicate taking an element and its index
   * @example
   * ```typescript
   * Iter.nats.takeWhile(v => v < 5)
   * result: (0, 1, 2, 3, 4)
   * ```
   */
  takeWhile(pred: Pred<T>) {
    if (this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
      let index = 0
      for (const elem of iterable) {
        if (pred(elem, index++)) yield elem
        else return
      }
    })
  }

  /**
   * Returns an Iter that skips items of this Iter as long as the given pred predicate holds, then yields all following elements, if present.
   * @param pred a predicate taking an element and its index
   * @example
   * ```typescript
   * Iter.nats.dropWhile(v => v < 5)
   * result: (5, 6, 7, 8, ...)
   * ```
   */
  dropWhile(pred: Pred<T>): Iter<T> {
    if (this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
      const iterator = (getIterator(iterable) as any) as Iterable<T>
      let index = 0

      for (const elem of iterator) {
        if (!pred(elem, index++)) {
          yield elem
          return yield* iterator
        }
      }
    })
  }

  /**
   * Returns the result of applying the reducer function to each element of this Iter, or returns the otherwise value if this Iter is empty.
   * @param op the reducer function taking the current reducer value and the next element of this Iter, and returning a new value
   * @param otherwise specifies how to deal with the potential case that this Iter is empty. There are three cases:
   *    - not specified / undefined: If this Iter is empty, this function will throw an error
   *    - (value: T): If this Iter is empty, it will return the given value instead
   *    - (f: () => T): If this Iter is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * Iter.range(0, 5).reduce((res, value) => res + value)
   * result: 6
   * ```
   */
  reduce(op: MonoFun<T>, otherwise?: OptLazy<T>): T {
    let result: T | NoValue = NoValue

    let index = 0
    for (const elem of this) {
      if (result === NoValue) result = elem
      else result = op(result, elem, index++)
    }
    if (result === NoValue) {
      if (otherwise === undefined) throw Error('no value')
      return optToValue(otherwise)
    }

    return result
  }

  /**
   * Returns an Iter yielding the result from applying the given zipFun to the next element of this Iter and each next element of the given iterables.
   * If any of the iterables is done, the resulting Iter also ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be yielded
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * Iter.nats.zipWith((a, b) => a + b, [5, 2, 3])
   * result: (5, 3, 5)
   * ```
   */
  zipWith<O, R, T>(
    zipFun: (t: T, o: O, ...others: any[]) => R,
    other1Iterable: Iterable<O>,
    ...otherIterables: Iterable<any>[]
  ): Iter<R> {
    if (
      this.isEmptyInstance ||
      other1Iterable === Iter.empty ||
      otherIterables.some(i => i === Iter.empty)
    ) {
      return Iter.empty
    }

    return this.applyCustomOperation(function*(iterable) {
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
        yield zipFun(...(values as [T, O, ...any[]]))
      }
    })
  }

  /**
   * Returns an Iter yielding tuples of each next element of this Iter and the provided iterables.
   * If any of the iterables is done, the resulting Iter will end.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * Iter.nats.zip([5, 2, 3])
   * result: ([0, 5], [1, 2], [3, 3])
   * ```
   */
  zip<O>(other1Iterable: Iterable<O>, ...otherIterables: Iterable<any>[]): Iter<[T, O, ...any[]]> {
    const toTuple = (...args: [T, O, ...any[]]): [T, O, ...any[]] => args

    return this.zipWith(toTuple, other1Iterable, ...otherIterables)
  }

  /**
   * Returns an Iter yielding tuples of the elements of this Iter as first elements, and their indices as second element.
   * @example
   * ```typescript
   * Iter.of('a').repeat(3).zipWithIndex()
   * result: (['a', 0], ['a', 1], ['a', 2])
   * ```
   */
  zipWithIndex(): Iter<[T, number]> {
    return this.map((e, i): [T, number] => [e, i])
  }

  /**
   * Returns an Iter yielding the result from applying the given zipFun to the next element of this Iter and each next element of the given iterables.
   * If any of the iterables is done, the element will be undefined. If all iterables are done, the resulting Iter ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be yielded, accepting undefined for each non-present value
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * Iter.range(0, 10, 3).zipAllWith((a, b) => [b, a], [5, 7])
   * result: ([5, 0], [7, 10], [undefined, 3])
   * ```
   */
  zipAllWith<O, R>(
    zipFun: (t?: T, o?: O, ...others: any[]) => R,
    other1Iterable: Iterable<O>,
    ...otherIterables: Iterable<any>[]
  ): Iter<R> {
    return this.applyCustomOperation(function*(iterable) {
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
        yield zipOpt
      }
    })
  }

  /**
   * Returns an Iter containing tuples of each next element of this Iter and the provided iterables.
   * If any of the iterables is done, the resulting values will be undefined. If all iterables are done, the resulting Iter ends.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * Iter.of(1, 5, 6).zipAll('ac')
   * result: ([1, 'a'], [5, 'c'], [6, undefined])
   * ```
   */
  zipAll<O>(
    other1Iterable: Iterable<O>,
    ...otherIterables: Iterable<any>[]
  ): Iter<[T?, O?, ...any[]]> {
    const toTuple = (...args: [T?, O?, ...any[]]) => args

    return this.zipAllWith(toTuple, other1Iterable, ...otherIterables)
  }

  /**
   * Returns an Iter with the indices of the this Iter at which the element satisfies the given `pred` predicate.
   * @param pred a predicate for an element of this Iter and its index
   * @example
   * ```typescript
   * Iter.of(1, 2, 5, 6, 4, 3).indicesWhere(isEven)
   * result: (1, 3, 4)
   * ```
   */
  indicesWhere(pred: Pred<T>): Iter<number> {
    return this.collect((e, i) => (pred(e, i) ? i : undefined))
  }

  /**
   * Returns an Iter with the indices of the this Iter where the element equals the given `elem` value.
   * @param elem the element to compare to
   * @example
   * ```typescript
   * Iter.fromIterable('ababba').indicesOf('a')
   * result: (0, 2, 5)
   * ```
   */
  indicesOf(elem: T): Iter<number> {
    return this.indicesWhere(e => e === elem)
  }

  /**
   * Returns an Iter that repeatedly yields one value of this Iter and then one value from each given iterable, as long as none of the iterables is done.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * Iter.fromIterable('abcba').interleave('QWQ').join()
   * result: 'aQbWcQ'
   * ```
   */
  interleave(...otherIterables: NonEmpty<Iterable<T>>): Iter<T> {
    return Iter.flatten(this.zip(...otherIterables))
  }

  /**
   * Returns an Iter that repeatedly yields one value of this Iter and then one value from each given iterable, for each iterable as long as it still yields values.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * Iter.fromIterable('abcba').interleave('QWQ').join()
   * result: 'aQbWcQba'
   * ```
   */
  interleaveAll(...otherIterables: NonEmpty<Iterable<T>>): Iter<T> {
    return Iter.flatten<T | undefined>(this.zipAll(...otherIterables)).patchElem(
      undefined,
      1
    ) as Iter<T>
  }

  /**
   * Returns an Iter that indefinitely yields one value of this Iter and then one value from each given iterable, starting back at the start of each iterable if it is exhausted.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * Iter.fromIterable('abc').interleave('QW').take(10).join()
   * result: 'aQbWcQaWbQ'
   * ```
   */
  interleaveRound(...otherIterables: NonEmpty<Iterable<T>>): Iter<T> {
    const its = otherIterables.map(it => Iter.fromIterable(it).repeat()) as NonEmpty<Iter<T>>

    return Iter.flatten(this.repeat().zip(...its))
  }

  /**
   * Returns a string starting with the given start string, then each element of this Iter separated by the given sep string, and ending with the end string.
   * @param sep the seperator string
   * @param start the start string
   * @param end the end string
   * @example
   * ```typescript
   * Iter.of(1, 5, 6).join('<', '|, '>')
   * result: '<1|5|6>'
   * ```
   */
  join(sep = '', start = '', end = ''): string {
    const sepThis = this.map(String).intersperse(sep)
    return start.concat(...sepThis, end)
  }

  /**
   * Repeats the current Iter the given `times` amount of times, or indefinately if `times` is undefined.
   * @param times the amount of times to repeat this Iter
   * @example
   * ```typescript
   * Iter.of(1, 3).repeat(3)
   * result: (1, 3, 1, 3, 1, 3)
   * ```
   * @example
   * ```typescript
   * Iter.of(1, 3).repeat()
   * result: (1, 3, 1, 3, 1, ...)
   * ```
   */
  repeat(times?: number): Iter<T> {
    if (times !== undefined) {
      if (times <= 0 || this.isEmptyInstance) return Iter.empty
      if (times === 1) return this
    }

    return this.applyCustomOperation(function*(iterable) {
      const iterator = getIterator(iterable)
      const { value, done } = iterator.next()

      if (done) return

      yield value
      yield* (iterator as any) as Iterable<T>

      while (times === undefined || --times > 0) yield* iterable
    })
  }

  /**
   * Returns an Iter that yields each distinct value of this Iter at most once.
   * @example
   * ```typescript
   * Iter.of(1, 5, 1, 3, 2, 5, 1).distinct()
   * result: (1, 5, 3, 2)
   * ```
   */
  distinct(): Iter<T> {
    return this.distinctBy(v => v)
  }

  /**
   * Returns an Iter that applies the given `keyFun` to each element, and will yield only elements for which `keyFun`
   * returns a key that was not calculated before.
   * @typeparam K the type of key that the key function returns
   * @param keyFun a function that, given an element and its index, returns a calculated key
   * @example
   * ```typescript
   * Iter.of('bar', 'foo', 'test', 'same').distinctBy(v => v.length)
   * result: ('bar', 'test')
   * ```
   */
  distinctBy<K>(keyFun: (value: T, index: number) => K): Iter<T> {
    if (this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
      const set = new Set<K>()

      let index = 0
      for (const elem of iterable) {
        const key = keyFun(elem, index)
        if (!set.has(key)) {
          set.add(key)
          yield elem
        }
      }
    })
  }

  /**
   * Returns an Iter that yields those elements that satify the given `pred` predicate.
   * @param pred a function that take the current element, and the optional previous element and returns a boolean
   * indicating its filter status
   */
  filterWithPrevious(pred: (current: T, previous?: T) => boolean): Iter<T> {
    if (this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
      let last: T | undefined = undefined

      for (const elem of iterable) {
        if (pred(elem, last)) yield elem
        last = elem
      }
    })
  }

  /**
   * Returns an Iter that yields elements from this Iter, only when the element is different from the previous value.
   * @example
   * ```typescript
   * Iter.of(1, 3, 3, 2, 5, 5, 2, 3).filterChanged()
   * result: (1, 3, 2, 5, 2, 3)
   * ```
   */
  filterChanged(): Iter<T> {
    return this.filterWithPrevious((current, last) => current !== last)
  }

  /**
   * Returns an Iter that yields arrays of the given size of values from this Iter, each shifted that the given step
   * Note: the last window may be smaller than the given size.
   * @param size the window size
   * @param step the amount of elements to shift the next window
   * @example
   * ```typescript
   * Iter.nats.sliding(3)
   * result: ([0, 1, 2], [3, 4, 5], [6, 7, 8], ...)
   * ```
   * @example
   * ```typescript
   * Iter.nats.sliding(3, 1)
   * result: ([0, 1, 2], [1, 2, 3], [2, 3, 4], ...)
   * ```
   */
  sliding(size: number, step = size): Iter<T[]> {
    if (size <= 0 || step <= 0 || this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
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
   * Returns an Iter that yields only each given `nth` value of this Iter.
   * @param nth the amount of elements to skip every in between emissions.
   * @example
   * ```typescript
   * Iter.nats.sample(10)
   * result: (0, 10, 20, 30, ...)
   * ```
   */
  sample(nth: number): Iter<T> {
    return this.patchWhere((_, i) => i % nth === 0, nth, e => Iter.of(e))
  }

  /**
   * Allows side-effects at any point in the chain, but does not modify the Iter, it just returns the same Iter instance.
   * @param tag a tag that can be used when performing the side-effect
   * @param effect the side-effect to perform for each yielded element
   * @returns this exact instance
   */
  monitor(
    tag: string = '',
    effect: MonitorEffect<T> = (v, i, t) => console.log(`${t || ''}[${i}]: ${v}`)
  ): Iter<T> {
    if (this.isEmptyInstance) return this

    const currentEffect = this.monitorEffect

    if (currentEffect === undefined) {
      this.monitorEffect = (v, i) => effect(v, i, tag)
    } else {
      this.monitorEffect = (v, i) => {
        currentEffect(v, i, tag)
        effect(v, i, tag)
      }
    }

    return this
  }

  /**
   * Returns an Iter that yields arrays of values of this Iter each time a value is encountered that satisfied the given pred predicate
   * @param pred a predicate for an element of this Iter and its index
   * @example
   * ```typescript
   * Iter.range(4).splitWhere(isPrime)
   * result: ([4], [6], [8, 9, 10], [12], ...)
   * ```
   */
  splitWhere(pred: Pred<T>): Iter<T[]> {
    if (this.isEmptyInstance) return Iter.empty

    return this.applyCustomOperation(function*(iterable) {
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
  }
  /**
   * Returns an Iter that yields arrays of values of this Iter each time a value that equals given elem is encountered
   * @param elem the element on which a new split should be made
   * @example
   * ```typescript
   * Iter.fromIterable('a test  foo').splitOnElem(' ')
   * result: (['a'], ['t', 'e', 's', 't'], [], ['f', 'o', 'o'])
   * ```
   */
  splitOnElem(elem: T): Iter<T[]> {
    return this.splitWhere(e => e === elem)
  }

  /**
   * Returns an Iter that yields the elements of this Iter with the given interIter elements as a sepatator
   * @param interIter an iterator of elements that is used as a separator
   * @example
   * ```typescript
   * Iter.fromIterable('abc').intersperse('|').join()
   * result: 'a|b|c'
   * ```
   */
  intersperse(interIter: Iterable<T>): Iter<T> {
    return this.patchWhere((_, i) => i > 0, 0, () => interIter)
  }

  /**
   * Returns an Iter that starts with the startIter elements, then yields all elements of this Iter with the sepIter elements
   * as separators, and ends with the endIter elements.
   * @param startIter the start elements
   * @param sepIter the separator elements
   * @param endIter the end elements
   * @example
   * ```typescript
   * Iter.of(1, 3, 4).mkGroup([10], [100], [90, 80])
   * result: (10, 1, 100, 3, 100, 4, 90, 80)
   * ```
   */
  mkGroup(
    startIter: Iterable<T> = Iter.empty,
    sepIter: Iterable<T> = Iter.empty,
    endIter: Iterable<T> = Iter.empty
  ): Iter<T> {
    return Iter.fromIterable(startIter).concat(this.intersperse(sepIter), endIter)
  }

  /**
   * Returns an Iter where for each element of this Iter that satisfies `pred`, the given `amount` of elements is skipped,
   * and the optional `insert` function is called to generate an iterable based on the matching element and its index, after
   * which that iterable is yielded.
   * @param pred a predicate for an element of this Iter and its index
   * @param remove the number of elements to skip when a matching element is found
   * @param insert an optional function taking the matching element and its index, and returning an iterable to yield
   * @param amount the optional amount of times to perform the patch
   * @example
   * ```typescript
   * Iter.of(0, 1, 5, 2).patchWhere(isEven, 1, () => [10, 11])
   * result: (10, 11, 1, 5, 10, 11)
   * ```
   * @example
   * ```typescript
   * Iter.of(0, 1, 5, 2).patchWhere(isEven, 0, () => [10, 11])
   * result: (10, 11, 0, 1, 5, 10, 11, 2)
   * ```
   * @example
   * ```typescript
   * Iter.of(0, 1, 5, 2).patchWhere(isEven, 2)
   * result: (5)
   * ```
   * @example
   * ```typescript
   * Iter.of(0, 1, 5, 2).patchWhere(isEven, 1, undefined, 1)
   * result: (1, 5, 2)
   * ```
   */
  patchWhere(
    pred: Pred<T>,
    remove: number,
    insert?: (elem: T, index: number) => Iterable<T>,
    amount?: number
  ): Iter<T> {
    if (this.isEmptyInstance || (amount !== undefined && amount <= 0)) {
      return this
    }

    return this.applyCustomOperation(function*(iterable) {
      let i = 0
      let skip = 0
      let remain = amount === undefined ? 1 : amount

      for (const elem of iterable) {
        if (amount === undefined) remain = 1

        if (skip > 0) skip--
        else {
          if (remain > 0 && pred(elem, i)) {
            remain--

            if (insert !== undefined) {
              const insertIterable = insert(elem, i)
              yield* checkPureIterable(insertIterable)
            }
            skip = remove
          }

          if (skip <= 0) yield elem
          else skip--
        }
        i++
      }
    })
  }

  /**
   * Returns an Iter where at the given `index`, the given `amount` of elements is skipped,
   * and the optional `insert` function is called to generate an iterable based on the matching element and its index, after
   * which that iterable is yielded.
   * @param index the index at which to patch
   * @param remove the number of elements to skip when a matching element is found
   * @param insert an optional function taking the matching element and its index, and returning an iterable to yield
   * @example
   * ```typescript
   * Iter.fromIterable('abc').patchAt(1, 1, () => 'QW').join
   * result: ('aQWc')
   * ```
   */
  patchAt(index: number, remove: number, insert?: (elem?: T) => Iterable<T>): Iter<T> {
    if (this.isEmptyInstance) {
      if (insert === undefined) return Iter.empty
      return Iter.fromIterable(insert())
    }

    return this.applyCustomOperation(function*(iterable) {
      let i = 0
      let skip = 0

      function* ins(elem?: T) {
        if (insert !== undefined) {
          const insertIterable = insert(elem)
          yield* checkPureIterable(insertIterable)
        }
      }

      if (index < 0) {
        yield* ins()
        skip = remove
      }
      for (const elem of iterable) {
        if (i === index) {
          yield* ins(elem)
          skip = remove
        }
        if (skip > 0) skip--
        else yield elem
        i++
      }
      if (index >= i) {
        yield* ins()
      }
    })
  }

  /**
   * Returns an Iter where for each element of this Iter that equals the given `elem`, the given `amount` of elements is skipped,
   * and the optional `insert` iterable is yielded.
   * @param elem the element to patch
   * @param remove the number of elements to skip when a matching element is found
   * @param insert an optional function taking the matching element and its index, and returning an iterable to yield
   * @param amount an optional amount of elements to patch
   * @example
   * ```typescript
   * Iter.fromIterable('abcba').patchElem('b', 1, '--').join()
   * result: 'a--c--a'
   * ```
   */
  patchElem(elem: T, remove: number, insert?: Iterable<T>, amount?: number): Iter<T> {
    return this.patchWhere(
      e => e === elem,
      remove,
      insert === undefined ? undefined : () => insert,
      amount
    )
  }

  /**
   * Returns a fixed tag string to void unnecessary evaluation of iterable items.
   */
  toString(): String {
    return `[Iter]`
  }

  /**
   * Returns an array with all the values in this Iter
   */
  toArray(): T[] {
    return [...this]
  }

  /**
   * Returns a Set with all the unique values in this Iter
   */
  toSet(): Set<T> {
    return new Set(this)
  }
}
