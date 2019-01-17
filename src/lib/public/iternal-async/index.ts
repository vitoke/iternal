/**
 * @module iternal
 */

import {
  checkPureAnyIterable,
  checkPureAsyncIterable,
  getAnyIterator,
  getAsyncIterator,
  NoValue,
  optPred
} from '../../private/iternal-common'
import { error, Type } from '../../private/util'
import {
  AnyIterable,
  AnyIterator,
  CollectFun,
  Effect,
  Errors,
  MapFun,
  MonitorEffect,
  NonEmpty,
  OptLazy,
  Pred
} from '../constants'
import { Folds } from '../iternal-fold/folds'
import { Folder, MonoFun } from '../iternal-fold/gen-folder'
import { Iter } from '../iternal-sync'

function toIterator<X>(iterable: AnyIterable<X>): AnyIterator<X> {
  return getAnyIterator(checkPureAnyIterable(iterable))
}

/**
 * Enrichment class allowing for manipulation of asynchronous iteratables.
 * @typeparam T the element type.
 */
export class AsyncIter<T> implements AsyncIterable<T> {
  /**
   * Returns an empty AsyncIter instance.
   * @example
   * ```typescript
   * AsyncIter.empty
   * result: ()
   * ```
   */
  static readonly empty: AsyncIter<any> = AsyncIter.fromIterable<any>([])

  /**
   * Returns an AsyncIter instance yielding the given elements.
   * @typeparam E The type of elements the Iter instance can yield.
   * @param elems the source elements
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 5)
   * result: (1, 3, 5)
   * ```
   */
  static of<E>(...elems: NonEmpty<E>): AsyncIter<E> {
    return AsyncIter.fromIterable(elems)
  }

  /**
   * Returns an AsyncIter yielding items from an iterator
   * @typeparam E The type of elements the Iterator yields.
   * @param createIterator a function creating a new iterator
   */
  static fromIterator<E>(createIterator: () => AnyIterator<E>): AsyncIter<E> {
    if (!Type.isIterator(createIterator())) {
      throw error(Errors.NotAnIterator, 'argument is not an iterator')
    }

    return new AsyncIter({
      [Symbol.asyncIterator]: () => createIterator() as AsyncIterator<E>
    })
  }

  /**
   * Returns an AsyncIter yielding items from an iterable
   * @typeparam E The type of elements the Iteratable yields.
   * @param iterable the source iterable
   */
  static fromIterable<E>(iterable: AnyIterable<E>): AsyncIter<E> {
    if (iterable instanceof AsyncIter) return iterable
    if (Type.isAsyncIterable(iterable)) {
      return new AsyncIter(iterable as AsyncIterable<E>)
    }
    if (!Type.isIterable(iterable)) {
      throw error(Errors.NotIterable, 'argument is not iterable')
    }
    return AsyncIter.fromIterator(() => getAnyIterator(iterable))
  }

  /**
   * Returns an AsyncIter yielding a potentially infinite sequence of elements using a generation function
   * @typeparam E The type of elements the Iter yields.
   * @param init A promise resolving to the initial value to yield.
   * @param next Function the returns a promise resolving to the next value to yield based on the current value.
   * @example
   * ```typescript
   * AsyncIter.generate(2, v => v * v)
   * result: (2, 4, 16, 256, ...)
   * ```
   */
  static generate<E>(
    init: Promise<E>,
    next: (current: E, index: number) => Promise<E | undefined>
  ): AsyncIter<E> {
    return AsyncIter.fromIterator(async function*() {
      let value = await init
      let index = 0
      while (true) {
        yield value
        const result = await next(value, index++)
        if (result === undefined) return
        value = result
      }
    })
  }
  /**
   * Returns an AsyncIter yielding a potentially infinite sequence of elements using an unfolding function
   * @typeparam S the internal 'state' of the unfolding function
   * @typeparam E the type of elements the Iter yields.
   * @param init The initial internal 'state' of the unfolding function
   * @param next A function taking the current state, and returning an optional tuple with the element to yield and the next state.
   * @example
   * ```typescript
   * AsyncIter.unfold(1, s => ['a'.repeat(s), s * 2])
   * result: ('a', 'aa', 'aaaa', 'aaaaaaaa', ...)
   * ```
   */
  static unfold<S, E>(
    init: Promise<S>,
    next: (currentState: S, index: number) => Promise<[E, S] | undefined>
  ) {
    return AsyncIter.fromIterator(async function*() {
      let state = await init
      let index = 0
      while (true) {
        const result = await next(state, index++)
        if (result === undefined) return
        const [elem, newState] = result
        state = newState
        yield elem
      }
    })
  }

  /**
   * Returns an AsyncIter yielding a single element the is created lazily when the item is requested.
   * @typeparm E the type of the element that is created
   * @param create A function that creates a promise that resolves to the element to yield
   * @example
   * ```typescript
   * AsyncIter.fromLazy(Math.random)
   * result: (0.243442)
   * ```
   */
  static fromLazy<E>(create: () => Promise<E>): AsyncIter<E> {
    return AsyncIter.fromIterator(async function*() {
      yield create()
    })
  }

  /**
   * Returns an AsyncIter that yields the values from each Iterable in the given Iterable.
   * @typeparam E the element type that the iterables of the given iterable yield.
   * @param iterable the source async iterable of iterables
   * @example
   * ```typescript
   * AsyncIter.flatten(AsyncIter.of(Iter.of(1, 3)), Iter.of(Iter.of (2, 4)))
   * result: (1, 3, 2, 4)
   * ```
   */
  static flatten<E>(iterable: AsyncIterable<AnyIterable<E>>): AsyncIter<E> {
    return AsyncIter.fromIterable(iterable).flatMap(v => v)
  }

  static fromPromise<E>(promise: Promise<E>): AsyncIter<E> {
    return AsyncIter.fromIterator<E>(async function*() {
      yield promise
    })
  }

  static fromSingleCallback<E extends any[]>(
    consume: (emit: (...v: E) => void) => void
  ): AsyncIter<E> {
    return AsyncIter.fromPromise(
      new Promise<E>(resolve => consume((...values: E) => resolve(values)))
    )
  }

  private constructor(private readonly iterable: AsyncIterable<T>) {
    if (iterable instanceof AsyncIter) {
      throw error(Errors.InternalError, 'unnecessary asynciter nesting')
    }
    if (!Type.isAsyncIterable(iterable)) {
      throw error(Errors.NotAsyncIterable, 'argument is not async iterable')
    }
    checkPureAsyncIterable(iterable)
  }

  private get isEmptyInstance() {
    return this === AsyncIter.empty
  }

  /**
   * Returns an AsyncIter instance yielding the values resulting from the iterator output of the `createIterator` function receiving this iterable as an argument.
   * @typeparam R the result iterator element type
   * @param createIterator a function receiving the current iterable and returning an iterator of new elements
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 3, 4)
   *   .applyCustomOperation(async function*(iterable) {
   *     for await { const elem of iterable } {
   *       if (Math.random() > 0.5) yield `foo${elem}`
   *     }
   *   })
   *   .join(',')
   * result (example): 'foo2,foo3'
   * ```
   */
  applyCustomOperation<R>(
    createIterator: (iterable: AsyncIterable<T>) => AsyncIterator<R>
  ): AsyncIter<R> {
    return AsyncIter.fromIterator(() => createIterator(this))
  }

  private monitorEffect?: MonitorEffect<T>;

  /**
   * AsyncIterable interface: When called, returns an AsyncIterator of type T
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    const iterator = getAsyncIterator(this.iterable)
    const effect = this.monitorEffect

    if (effect === undefined) return iterator
    let index = 0

    return {
      next: async (...args: any[]) => {
        const nextResult = await iterator.next(...args)
        if (!nextResult.done) effect(nextResult.value, index++)
        return nextResult
      }
    }
  }

  /**
   * Applies the values of the current AsyncIter to the given `folder` and returns the result.
   * @typeparam R the result type of the folder
   * @param folder the folder to apply
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 5).fold(Fold.sum)
   * result: 9
   * ```
   */
  async fold<R>(folder: Folder<T, R>): Promise<R> {
    let result = folder.createInitState()
    let index = 0
    if (optPred(result, index, folder.escape)) {
      return folder.stateToResult(result)
    }

    for await (const elem of this as AsyncIterable<T>) {
      result = folder.nextState(result, elem, index++)
      if (optPred(result, index, folder.escape)) {
        return folder.stateToResult(result)
      }
    }
    return folder.stateToResult(result)
  }

  /**
   * Returns an AsyncIter yielding each result of applying the folder to the next element in this AsyncIter.
   * @typeparam R the result type of the folder
   * @param folder the folder to apply
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 4).foldIter(Fold.sum)
   * result: (1, 4, 8)
   * ```
   */
  foldIter<R>(folder: Folder<T, R>): AsyncIter<R> {
    return this.applyCustomOperation(async function*(iterable) {
      let result = folder.createInitState()
      let index = 0
      if (optPred(result, index, folder.escape)) return

      for await (const e of iterable) {
        result = folder.nextState(result, e, index++)
        yield folder.stateToResult(result)
        if (optPred(result, index, folder.escape)) return
      }
    })
  }

  /**
   * Applies the given effect function to each element of the AsyncIter, with its index.
   * Note: eagerly gets all values from the iterable.
   * @param effect a function taking an element of the Iter and optionally its index and performs some side-effect.
   */
  async forEach(effect?: Effect<T>): Promise<void> {
    if (effect === undefined) {
      for await (const elem of this as AsyncIterable<T>);
      return
    }

    let index = 0
    for await (const elem of this as AsyncIterable<T>) effect(elem, index++)
  }

  /**
   * Returns an AsyncIter where the given mapFun is applied to each yielded element, with its index.
   * @typeparam R the result type of the given mapFun
   * @param mapFun a function taking an element of this Iter, and optionally its index, and returning a new element of type R
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 5).map((value, index) => value + index)
   * result: (1, 5, 8)
   * ```
   */
  map<R>(mapFun: MapFun<T, R>): AsyncIter<R> {
    if (this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) yield mapFun(elem, index++)
    })
  }

  /**
   * Returns an AsyncIter of only those elements for which the given pred predicate returns true
   * @param pred a predicate for an element, optionally with its index
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 5, 7).filter((v, i) => isEven(v + i))
   * result: (3, 7)
   * ```
   */
  filter(pred: Pred<T>): AsyncIter<T> {
    return this.filterNot((v, i) => !pred(v, i))
  }

  /**
   * Returns an AsyncIter of only those elements for which the given pred predicate returns false
   * @param pred a predicate for an element, optionally with its index
   * @example
   * ```typescript
   * AsyncIter.fromIterable(Iter.nats).filterNot(isEven)
   * result: (1, 3, 5, 7, ...)
   * ```
   */
  filterNot(pred: Pred<T>): AsyncIter<T> {
    return this.patchWhere(pred, 1)
  }

  /**
   * Returns an AsyncIter that yields all values from the iterables resulting from applying the given flatMapFun to each element in this AsyncIter.
   * @typeparam R the elements of the Iterables resulting from flatMapFun
   * @param flatMapFun a function taking an element from this Iter and returning an iterable with elements of type R
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 3).flatMap(e => Iter.of(e).repeat(e))
   * result: (1, 2, 2, 3, 3, 3)
   * ```
   */
  flatMap<R>(flatMapFun: (elem: T, index: number) => AnyIterable<R>): AsyncIter<R> {
    if (this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) {
        yield* flatMapFun(elem, index++)
      }
    })
  }

  /**
   * Returns an AsyncIter with the result of applying the given collectFun to each element of this Iter, unless the result is undefined, in that case the element is skipped.
   * This function is a combination of map and filter.
   * @typeparam R the resulting elements of the collectFun function
   * @param collectFun a function taking an element of this Iter, optionally with its index, and returning either a new element of type R, or undefined if the value should be skipped
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 5, 0).collect(v => isEven(v) ? 'a'.repeat(v) : undefined)
   * result: ('aa', '')
   * ```
   */
  collect<R>(collectFun: CollectFun<T, R>): AsyncIter<R> {
    return this.map(collectFun).filter(v => v !== undefined) as AsyncIter<R>
  }

  /**
   * Returns an AsyncIter yielding the values of this AsyncIter, followed by the values in each of the iterables supplied as arguments.
   * @param otherIterables a non-empty list of iterables of the same type
   * @example
   * ```typescript
   * AsyncIter.of(2, 4).concat([5, 3], Iter.nats)
   * result: (2, 4, 5, 3, 1, 2, 3, ...)
   * ```
   */
  concat(...otherIterables: NonEmpty<AnyIterable<T>>): AsyncIter<T> {
    return AsyncIter.of<AnyIterable<T>>(this, ...otherIterables)
      .filter(it => it !== AsyncIter.empty && it !== Iter.empty)
      .flatMap(it => checkPureAnyIterable(it))
  }

  /**
   * Returns an AsyncIter yielding the given elements after the elements of this Iter have been yielded
   * @param elems a non-empty list of elements that should be appended
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 5).append(6, 7)
   * result: (1, 3, 5, 6, 7)
   * ```
   */
  append(...elems: NonEmpty<T>): AsyncIter<T> {
    return this.concat(elems)
  }

  /**
   * Returns an AsyncIter yielding the given elements before the elements of this Iter are yielded
   * @param elems a non-empty list of elements that should be prepended
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 5).prepend(6, 7)
   * result: (6, 7, 1, 3, 5)
   * ```
   */
  prepend(...elems: NonEmpty<T>): AsyncIter<T> {
    return AsyncIter.fromIterable(elems).concat(this)
  }

  /**
   * Returns an AsyncIter that skips the first given amount of elements of this AsyncIter, then yields all following elements, if present.
   * @param amount the amount of elements to skip
   * @example
   * ```typescript
   * AsnycIter.of(1, 2, 3).drop(2)
   * result: (3)
   * ```
   */
  drop(amount: number): AsyncIter<T> {
    return this.patchAt(0, amount)
  }

  /**
   * Returns an AsyncIter that yields the first given amount of elements of this AsyncIter if present, then ends.
   * @param amount the amount of elements to yield
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 3).take(2)
   * result: (1, 2)
   * ```
   */
  take(amount: number): AsyncIter<T> {
    if (amount <= 0 || this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      let toTake = amount

      for await (const elem of iterable) {
        if (toTake-- <= 0) return
        yield elem
      }
    })
  }
  /**
   * Returns an AsyncIter that yields the items of this AsyncIter starting at the from index, and then yields the specified amount of items, if present.
   * @param from the index at which to start yielding values
   * @param amount the amount of items to yield
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 3, 4).slice(1, 2)
   * result: (2, 3)
   * ```
   */
  slice(from: number, amount: number): AsyncIter<T> {
    return this.drop(from).take(amount)
  }

  /**
   * Returns an AsyncIter that yields the items of this AsyncIter as long as the given pred predicate holds, then ends.
   * @param pred a predicate taking an element and its index
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 3).takeWhile(v => v <= 2)
   * result: (1, 2)
   * ```
   */
  takeWhile(pred: Pred<T>): AsyncIter<T> {
    return this.applyCustomOperation(async function*(iterable) {
      let index = 0

      for await (const elem of iterable) {
        if (pred(elem, index++)) yield elem
        else return
      }
    })
  }

  /**
   * Returns an AsyncIter that skips items of this AsyncIter as long as the given pred predicate holds, then yields all following elements, if present.
   * @param pred a predicate taking an element and its index
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 3).dropWhile(v => v < 2)
   * result: (2, 3)
   * ```
   */
  dropWhile(pred: Pred<T>): AsyncIter<T> {
    if (this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      const iterator = (getAsyncIterator(iterable) as any) as AsyncIterable<T>
      let index = 0

      for await (const elem of iterator) {
        if (!pred(elem, index++)) {
          yield elem
          return yield* iterator
        }
      }
    })
  }

  /**
   * Returns a promise resolving to the result of applying the reducer function to each element of this AsyncIter, or returns the otherwise value if this Iter is empty.
   * @param op the reducer function taking the current reducer value and the next element of this AsyncIter, and returning a new value
   * @param otherwise specifies how to deal with the potential case that this Iter is empty. There are three cases:
   *    - not specified / undefined: If this Iter is empty, this function will throw an error
   *    - (value: T): If this Iter is empty, it will return the given value instead
   *    - (f: () => T): If this Iter is empty, it will return the value resulting from executing `f()`
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 3).reduce((res, value) => res + value)
   * result: 6
   * ```
   */
  async reduce(op: MonoFun<T>, otherwise?: OptLazy<T>): Promise<T> {
    let result: T | NoValue = NoValue

    let index = 0
    for await (const elem of this as AsyncIterable<T>) {
      if (result === NoValue) result = elem
      else result = op(result, elem, index++)
    }
    if (result === NoValue) {
      if (otherwise === undefined) throw Error('no value')
      return OptLazy.toValue(otherwise)
    }

    return result
  }

  /**
   * Returns an AsyncIter yielding the result from applying the given zipFun to the next element of this AsyncIter and each next element of the given iterables.
   * If any of the iterables is done, the resulting AsyncIter als ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be yielded
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * AsyncIter.of(1, 2).zipWith((a, b) => a + b, [5, 2, 3])
   * result: (6, 4)
   * ```
   */
  zipWith<O, R>(
    zipFun: (t: T, o: O, ...others: any[]) => R,
    other1Iterable: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<R> {
    if (this.isEmptyInstance) return AsyncIter.empty
    if (
      [other1Iterable, ...otherIterables].some(it => it === Iter.empty || it === AsyncIter.empty)
    ) {
      return AsyncIter.empty
    }

    return this.applyCustomOperation(async function*(iterable) {
      const iterators = [
        toIterator(iterable),
        toIterator(other1Iterable),
        ...otherIterables.map(toIterator)
      ]

      while (true) {
        const results = await Promise.all(iterators.map(it => it.next()))
        if (results.some(r => r.done)) return
        const values = results.map(r => r.value)
        const zipOpt = zipFun(...(values as [T, O, ...any[]]))
        yield zipOpt
      }
    })
  }
  /**
   * Returns an AsyncIter yielding tuples of each next element of this AsyncIter and the provided iterables.
   * If any of the iterables is done, the resulting AsyncIter will end.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * AsyncIter.of(0, 5).zip(Iter.nats)
   * result: ([0, 0], [1, 5])
   * ```
   */
  zip<O>(
    otherIterable1: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<[T, O, ...any[]]> {
    const toTuple = (t: T, o: O, ...other: any[]): [T, O, ...any[]] => [t, o, ...other]
    return this.zipWith(toTuple, otherIterable1, ...otherIterables)
  }

  /**
   * Returns an AsyncIter yielding tuples of the elements of this AsyncIter as first elements, and their indices as second element.
   * @example
   * ```typescript
   * AsyncIter.of('a').repeat(3).zipWithIndex()
   * result: (['a', 0], ['a', 1], ['a', 2])
   * ```
   */
  zipWithIndex(): AsyncIter<[T, number]> {
    return this.map((e, i): [T, number] => [e, i])
  }

  /**
   * Returns an AsyncIter yielding the result from applying the given zipFun to the next element of this AsyncIter and each next element of the given iterables.
   * If any of the iterables is done, the element will be undefined. If all iterables are done, the resulting AsyncIter ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the iterable elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be yielded, accepting undefined for each non-present value
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * AssyncIter.of(1, 2, 3).zipAllWith((a, b) => [b, a], [5, 7])
   * result: ([5, 0], [7, 2], [undefined, 3])
   * ```
   */
  zipAllWith<O, R>(
    zipFun: (t?: T, o?: O, ...other: any[]) => R,
    other1Iterable: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<R> {
    return this.applyCustomOperation(async function*(iterable) {
      const iterators = [
        toIterator(iterable),
        toIterator(other1Iterable),
        ...otherIterables.map(toIterator)
      ]

      while (true) {
        const results = await Promise.all(iterators.map(it => it.next()))
        if (results.every(r => r.done)) return
        const values = results.map(r => (r.done ? undefined : r.value))
        const zipOpt = zipFun(...values)
        yield zipOpt
      }
    })
  }

  /**
   * Returns an AsyncIter containing tuples of each next element of this AsyncIter and the provided iterables.
   * If any of the iterables is done, the resulting values will be undefined. If all iterables are done, the resulting Iter ends.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   * @example
   * ```typescript
   * AsyncIter.of(1, 5, 6).zipAll('ac')
   * result: ([1, 'a'], [5, 'c'], [6, undefined])
   * ```
   */
  zipAll<O>(
    otherIterable1: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<[T?, O?, ...any[]]> {
    const toTuple = (t?: T, o?: O, ...other: any[]): [T?, O?, ...any[]] => [t, o, ...other]

    return this.zipAllWith(toTuple, otherIterable1, ...otherIterables)
  }

  /**
   * Returns an AsyncIter with the indices of the this AsyncIter at which the element satisfies the given `pred` predicate.
   * @param pred a predicate for an element of this Iter and its index
   * @example
   * ```typescript
   * AsyncIter.of(1, 2, 5, 6, 4, 3).indicesWhere(isEven)
   * result: (1, 3, 4)
   * ```
   */
  indicesWhere(pred: Pred<T>): AsyncIter<number> {
    return this.collect((e, i) => (pred(e, i) ? i : undefined))
  }

  /**
   * Returns an AsyncIter with the indices of the this AsyncIter where the element equals the given `elem` value.
   * @param elem the element to compare to
   * @example
   * ```typescript
   * AsyncIter.fromIterable('ababba').indicesOf('a')
   * result: (0, 2, 5)
   * ```
   */
  indicesOf(elem: T): AsyncIter<number> {
    return this.indicesWhere(e => e === elem)
  }

  /**
   * Returns an AsyncIter that repeatedly yields one value of this Iter and then one value from each given iterable, as long as none of the iterables is done.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * AsyncIter.fromIterable('abcba').interleave('QWQ').join()
   * result: 'aQbWcQ'
   * ```
   */
  interleave(...otherIterables: [AnyIterable<T>, ...AnyIterable<T>[]]): AsyncIter<T> {
    return AsyncIter.flatten(this.zip(...otherIterables))
  }

  /**
   * Returns an AsyncIter that repeatedly yields one value of this Iter and then one value from each given iterable, for each iterable as long as it still yields values.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * AsyncIter.fromIterable('abcba').interleave('QWQ').join()
   * result: 'aQbWcQba'
   * ```
   */
  interleaveAll(...otherIterables: NonEmpty<AnyIterable<T>>): AsyncIter<T> {
    return AsyncIter.flatten<T | undefined>(this.zipAll(...otherIterables)).patchElem(
      undefined,
      1
    ) as AsyncIter<T>
  }

  /**
   * Returns an AsyncIter that indefinitely yields one value of this Iter and then one value from each given iterable, starting back at the start of each iterable if it is exhausted.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * AsyncIter.fromIterable('abc').interleave('QW').take(10).join()
   * result: 'aQbWcQaWbQ'
   * ```
   */
  interleaveRound(...otherIterables: NonEmpty<AnyIterable<T>>): AsyncIter<T> {
    const its = otherIterables.map(it => AsyncIter.fromIterable(it).repeat()) as NonEmpty<
      AsyncIter<T>
    >

    return AsyncIter.flatten(this.repeat().zip(...its))
  }

  /**
   * Returns a promise resolving to a string starting with the given start element, then each element of this Iter separated by the given sep element, and ending with the end element.
   * @param sep the seperator string
   * @param start the start string
   * @param end the end string
   * @example
   * ```typescript
   * AsyncIter.of(1, 5, 6).join('<', '|, '>')
   * result: '<1|5|6>'
   * ```
   */
  async join(sep = '', start = '', end = ''): Promise<string> {
    const sepThis = await this.map(String)
      .intersperse(sep)
      .fold(Folds.stringAppend)
    return start.concat(sepThis, end)
  }

  /**
   * Repeats the current AsyncIter times amount of times, or indefinately if times is undefined.
   * @times the amount of times to repeat this Iter
   * @example
   * ```typescript
   * AsyncIter.of(1, 3).repeat(3)
   * result: (1, 3, 1, 3, 1, 3)
   * ```
   * @example
   * ```typescript
   * AsyncIter.of(1, 3).repeat()
   * result: (1, 3, 1, 3, 1, ...)
   * ```
   */
  repeat(times?: number): AsyncIter<T> {
    if (times !== undefined) {
      if (times <= 0 || this.isEmptyInstance) return AsyncIter.empty
      if (times === 1) return this
    }

    return this.applyCustomOperation(async function*(iterable) {
      const iterator = getAsyncIterator(iterable)
      const { value, done } = await iterator.next()

      if (done) return

      yield value
      yield* (iterator as any) as AsyncIterable<T>

      while (times === undefined || --times > 0) yield* iterable
    })
  }

  /**
   * Returns an AsyncIter that yields each distinct value of this Iter at most once.
   * @example
   * ```typescript
   * AsyncIter.of(1, 5, 1, 3, 2, 5, 1).distinct()
   * result: (1, 5, 3, 2)
   * ```
   */
  distinct(): AsyncIter<T> {
    return this.distinctBy(v => v)
  }

  /**
   * Returns an AsyncIter that applies the given `keyFun` to each element, and will yield only elements for which `keyFun`
   * returns a key that was not calculated before.
   * @typeparam K the type of key that the key function returns
   * @param keyFun a function that, given an element and its index, returns a calculated key
   * @example
   * ```typescript
   * AsyncIter.of('bar', 'foo', 'test', 'same').distinctBy(v => v.length)
   * result: ('bar', 'test')
   * ```
   */
  distinctBy<K>(keyFun: (value: T, index: number) => K): AsyncIter<T> {
    if (this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      const set = new Set<K>()

      let index = 0
      for await (const elem of iterable) {
        const key = keyFun(elem, index)
        if (!set.has(key)) {
          set.add(key)
          yield elem
        }
      }
    })
  }

  /**
   * Returns an AsyncIter that yields those elements that satify the given `pred` predicate.
   * @param pred a function that take the current element, and the optional previous element and returns a boolean
   * indicating its filter status
   */
  filterWithPrevious(pred: (current: T, previous?: T) => boolean): AsyncIter<T> {
    if (this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      let last: T | undefined = undefined

      for await (const elem of iterable) {
        if (pred(elem, last)) yield elem
        last = elem
      }
    })
  }

  /**
   * Returns an AsyncIter that yields elements from this Iter, only when the element is different from the previous value.
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 3, 2, 5, 5, 2, 3).filterChanged()
   * result: (1, 3, 2, 5, 2, 3)
   * ```
   */
  filterChanged(): AsyncIter<T> {
    return this.filterWithPrevious((current, last) => current !== last)
  }

  /**
   * Returns an AsyncIter that yields arrays of the given size of values from this AsyncIter, each shifted that the given step
   * Note: the last window may be smaller than the given size.
   * @param size the window size
   * @param step the amount of elements to shift the next window
   * @example
   * ```typescript
   * AsyncIter.fromIterable(Iter.nats).sliding(3)
   * result: ([0, 1, 2], [3, 4, 5], [6, 7, 8], ...)
   * ```
   * @example
   * ```typescript
   * AsyncIter.fromIterable(Iter.nats).sliding(3, 1)
   * result: ([0, 1, 2], [1, 2, 3], [2, 3, 4], ...)
   * ```
   */
  sliding(size: number, step = size): AsyncIter<T[]> {
    if (size <= 0 || step <= 0 || this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      let bucket: T[] = []

      let toSkip = 0

      for await (const elem of iterable) {
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
   * Returns an AsyncIter that yields only each given `nth` value of this AsyncIter.
   * @param nth the amount of elements to skip every in between emissions.
   * @example
   * ```typescript
   * AsyncIter.fromIterable(Iter.nats).sample(10)
   * result: (0, 10, 20, 30, ...)
   * ```
   */
  sample(nth: number): AsyncIter<T> {
    return this.patchWhere((_, i) => i % nth === 0, nth, e => Iter.of(e))
  }

  /**
   * Allows side-effects at any point in the chain, but does not modify the Iter, it just returns the same AsyncIter instance.
   * @param tag a tag that can be used when performing the side-effect
   * @param effect the side-effect to perform for each yielded element
   * @returns this exact instance
   * ```typescript
   * AsyncIter.nats.monitor("nats").take(3)
   * result:
   * > nats[0]: 0
   * > nats[1]: 1
   * > nats[2]: 2
   * ```
   */
  monitor(
    tag: string = '',
    effect: MonitorEffect<T> = (v, i, t) => console.log(`${t || ''}[${i}]: ${v}`)
  ): AsyncIter<T> {
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
   * Returns an AsyncIter that yields arrays of values of this AsyncIter each time a value is encountered that satisfied the given pred predicate
   * @param pred a predicate for an element of this AsyncIter and its index
   * @example
   * ```typescript
   * AsyncIter.of(4, 5, 6, 7, 8, 9, 10).splitWhere(isPrime)
   * result: ([4], [6], [8, 9, 10])
   * ```
   */
  splitWhere(pred: Pred<T>): AsyncIter<T[]> {
    if (this.isEmptyInstance) return AsyncIter.empty

    return this.applyCustomOperation(async function*(iterable) {
      let bucket: T[] = []
      let newBucket = false
      let index = 0

      for await (const elem of iterable) {
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
   * Returns an AsyncIter that yields arrays of values of this AsyncIter each time a value that equals given elem is encountered
   * @param elem the element on which a new split should be made
   * @example
   * ```typescript
   * AsyncIter.fromIterable('a test  foo').splitOnElem(' ')
   * result: (['a'], ['t', 'e', 's', 't'], [], ['f', 'o', 'o'])
   * ```
   */
  splitOnElem(elem: T): AsyncIter<T[]> {
    return this.splitWhere(e => e === elem)
  }

  /**
   * Returns an AsyncIter that yields the elements of this AsyncIter with the given interIter elements as a sepatator
   * @param interIter an iterator of elements that is used as a separator
   * @example
   * ```typescript
   * AsyncIter.fromIterable('abc').intersperse('|').join()
   * result: 'a|b|c'
   * ```
   */
  intersperse(interIter: AnyIterable<T>): AsyncIter<T> {
    return this.patchWhere((_, i) => i > 0, 0, () => interIter)
  }

  /**
   * Returns an AsyncIter that starts with the startIter elements, then yields all elements of this AsyncIter with the sepIter elements
   * as separators, and ends with the endIter elements.
   * @param startIter the start elements
   * @param sepIter the separator elements
   * @param endIter the end elements
   * @example
   * ```typescript
   * AsyncIter.of(1, 3, 4).mkGroup([10], [100], [90, 80])
   * result: (10, 1, 100, 3, 100, 4, 90, 80)
   * ```
   */
  mkGroup(
    startIter: AnyIterable<T> = AsyncIter.empty,
    sepIter: AnyIterable<T> = AsyncIter.empty,
    endIter: AnyIterable<T> = AsyncIter.empty
  ): AsyncIter<T> {
    return AsyncIter.fromIterable(startIter).concat(this.intersperse(sepIter), endIter)
  }

  /**
   * Returns an AsyncIter where for each element of this Iter that satisfies `pred`, the given `amount` of elements is skipped,
   * and the optional `insert` function is called to generate an iterable based on the matching element and its index, after
   * which that iterable is yielded.
   * @param pred a predicate for an element of this Iter and its index
   * @param remove the number of elements to skip when a matching element is found
   * @param insert an optional function taking the matching element and its index, and returning an iterable to yield
   * @param amount the optional amount of times to perform the patch
   * @example
   * ```typescript
   * AsyncIter.of(0, 1, 5, 2).patchWhere(isEven, 1, () => [10, 11])
   * result: (10, 11, 1, 5, 10, 11)
   * ```
   * @example
   * ```typescript
   * AsyncIter.of(0, 1, 5, 2).patchWhere(isEven, 0, () => [10, 11])
   * result: (10, 11, 0, 1, 5, 10, 11, 2)
   * ```
   * @example
   * ```typescript
   * AsyncIter.of(0, 1, 5, 2).patchWhere(isEven, 2)
   * result: (5)
   * ```
   * @example
   * ```typescript
   * AsyncIter.of(0, 1, 5, 2).patchWhere(isEven, 1, undefined, 1)
   * result: (1, 5, 2)
   * ```
   */
  patchWhere(
    pred: Pred<T>,
    remove: number,
    insert?: (elem: T, index: number) => AnyIterable<T>,
    amount?: number
  ): AsyncIter<T> {
    if (this.isEmptyInstance || (amount !== undefined && amount <= 0)) {
      return this
    }

    return this.applyCustomOperation(async function*(iterable) {
      let i = 0
      let skip = 0
      let remain = amount === undefined ? 1 : amount

      for await (const elem of iterable) {
        if (amount === undefined) remain = 1

        if (skip > 0) skip--
        else {
          if (remain > 0 && pred(elem, i)) {
            remain--

            if (insert !== undefined) {
              const insertIterable = insert(elem, i)
              yield* checkPureAnyIterable(insertIterable)
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
   * Returns an AsyncIter where at the given `index`, the given `amount` of elements is skipped,
   * and the optional `insert` function is called to generate an iterable based on the matching element and its index, after
   * which that iterable is yielded.
   * @param index the index at which to patch
   * @param remove the number of elements to skip when a matching element is found
   * @param insert an optional function taking the matching element and its index, and returning an iterable to yield
   * @example
   * ```typescript
   * AsyncIter.fromIterable('abc').patchAt(1, 1, () => 'QW').join()
   * result: 'aQWc'
   * ```
   */
  patchAt(index: number, remove: number, insert?: (elem?: T) => AnyIterable<T>): AsyncIter<T> {
    if (this.isEmptyInstance) {
      if (insert === undefined) return AsyncIter.empty
      return AsyncIter.fromIterable(insert())
    }

    return this.applyCustomOperation(async function*(iterable) {
      let i = 0
      let skip = 0

      async function* ins(elem?: T) {
        if (insert !== undefined) {
          const insertIterable = insert(elem)
          yield* checkPureAnyIterable(insertIterable)
        }
      }

      if (index < 0) {
        yield* ins()
        skip = remove
      }
      for await (const elem of iterable) {
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
   * Returns an AsyncIter where for each element of this Iter that equals the given `elem`, the given `amount` of elements is skipped,
   * and the optional `insert` iterable is yielded.
   * @param elem the element to patch
   * @param remove the number of elements to skip when a matching element is found
   * @param insert an optional function taking the matching element and its index, and returning an iterable to yield
   * @param amount an optional amount of elements to patch
   * @example
   * ```typescript
   * AsyncIter.fromIterable('abcba').patchElem('b', 1, '--').join()
   * result: ('a--c--a')
   * ```
   */
  patchElem(elem: T, remove: number, insert?: AnyIterable<T>, amount?: number): AsyncIter<T> {
    return this.patchWhere(
      e => e === elem,
      remove,
      insert === undefined ? undefined : () => insert,
      amount
    )
  }

  /**
   * Returns an AsyncIter that emits the same elements as this AsyncIter, however only after waiting the given `ms` milliseconds before yielding each element.
   * @param ms the amount of milliseconds to delay yielding an element
   */
  delay(ms: number) {
    return this.applyCustomOperation(async function*(iterable) {
      for await (const elem of iterable) {
        await new Promise(resolve => setTimeout(resolve, ms))
        yield elem
      }
    })
  }

  /**
   * Returns a fixed tag string to void unnecessary evaluation of iterable items.
   */
  toString = (): string => `[AsyncIter]`
}
