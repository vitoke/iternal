import {
  checkPureAnyIterable,
  checkPureAsyncIterable,
  getAnyIterator,
  getAsyncIterator,
  NoValue,
  _NO_VALUE
} from '../../private/iternal-common'
import { error, Type } from '../../private/util'
import {
  AnyIterable,
  AnyIterator,
  CollectFun,
  Effect,
  Errors,
  MapFun,
  Pred,
  ReduceFun,
  Folder,
  Fold
} from '../constants'
import { Iter } from '../iternal-sync'
import { Opt, Option } from 'better-option'

const toIterator = <X>(iterable: AnyIterable<X>): AnyIterator<X> => {
  checkPureAnyIterable(iterable)
  return getAnyIterator(iterable)
}

/**
 * Enrichment class allowing for manipulation of asynchronous iteratables.
 * @typeparam T the element type.
 */
export class AsyncIter<T> implements AsyncIterable<T> {
  /**
   * Returns an empty AsyncIter instance.
   * @typeparam E The type of elements the Iter instance can emit.
   */
  static readonly empty: AsyncIter<any> = AsyncIter.fromIterable<any>([])

  /**
   * Returns an AsyncIter instance yielding the given elements.
   * @typeparam E The type of elements the Iter instance can emit.
   * @param elems the source elements
   */
  static readonly of = <E>(...elems: [E, ...E[]]): AsyncIter<E> => AsyncIter.fromIterable(elems)

  /**
   * Returns an AsyncIter emitting items from an iterator
   * @typeparam E The type of elements the Iterator emits.
   * @param createIterator a function creating a new Iterator
   */
  static fromIterator<E>(f: () => AnyIterator<E>): AsyncIter<E> {
    if (!Type.isIterator(f())) {
      throw error(Errors.NotAnIterator, 'argument is not an iterator')
    }

    return new AsyncIter({
      [Symbol.asyncIterator]: () => f() as AsyncIterator<E>
    })
  }

  /**
   * Returns an AsyncIter emitting items from an iterable
   * @typeparam E The type of elements the Iteratable emits.
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
   * Returns an AsyncIter generating an infinite sequence of elements using a generation function
   * @typeparam E The type of elements the Iter emits.
   * @param init A promise resolving to the initial value to emit.
   * @param next Function the returns a promise resolving to the next value to emit based on the current value.
   */
  static readonly sequence = <E>(
    init: Promise<E>,
    next: (current: E) => Promise<E>
  ): AsyncIter<E> =>
    AsyncIter.fromIterator(async function*() {
      let value = await init
      while (true) {
        yield value
        value = await next(value)
      }
    })

  /**
   * Returns an AsyncIter generating an infinite sequence of elements using an unfolding function
   * @typeparam S the internal 'state' of the unfolding function
   * @typeparam E the type of elements the Iter emits.
   * @param init The initial internal 'state' of the unfolding function
   * @param next A function taking the current state, and returning the element to emit and the next state as a tuple.
   */
  static readonly unfold = <S, E>(init: Promise<S>, next: (currentState: S) => Promise<[E, S]>) =>
    AsyncIter.fromIterator(async function*() {
      let state = await init
      while (true) {
        const [elem, newState] = await next(state)
        state = newState
        yield elem
      }
    })

  /**
   * Returns an AsyncIter emitting a single element the is created lazily when the item is requested.
   * @typeparm E the type of the element that is created
   * @param create A function that creates a promise that resolves to the element to be emitted
   */
  static readonly fromLazy = <E>(create: () => Promise<E>): AsyncIter<E> =>
    AsyncIter.fromIterator(async function*() {
      yield await create()
    })

  /**
   * Returns an AsyncIter that emits the values from each Iterable in the given Iterable.
   * @typeparam E the element type that the iterables of the given iterable emit.
   * @param iterable the source async iterable of iterables
   */
  static readonly flatten = <E>(iterable: AsyncIterable<AnyIterable<E>>): AsyncIter<E> =>
    AsyncIter.fromIterable(iterable).flatMap(v => v)

  static readonly delay = (ms: number = 1000) =>
    AsyncIter.fromIterator(async function*() {
      await new Promise(resolve => setTimeout(resolve, ms))
      yield
    })

  private constructor(private readonly iterable: AsyncIterable<T>) {
    if (iterable instanceof AsyncIter) {
      throw error(Errors.InternalError, 'unnecessary asynciter nesting')
    }
    if (!Type.isAsyncIterable(iterable)) {
      throw error(Errors.NotAsyncIterable, 'argument is not async iterable')
    }
  }

  private create = <R>(f: (_: AsyncIterable<T>) => AsyncIterator<R>): AsyncIter<R> =>
    new AsyncIter({
      [Symbol.asyncIterator]: () => f(this.iterable)
    });

  /**
   * AsyncIterable interface: When called, returns an AsyncIterator of type T
   */
  [Symbol.asyncIterator] = (): AsyncIterator<T> => getAsyncIterator(this.iterable)

  /**
   * Applies the given effect function to each element of the AsyncIter, with its index.
   * @param effect a function taking an element of the Iter and optionally its index and performs some side-effect.
   */
  forEach = async (effect?: Effect<T>): Promise<void> => {
    let index = 0
    for await (const elem of this) {
      if (effect !== undefined) effect(elem, index++)
    }
  }

  /**
   * Returns an AsyncIter where the given mapFun is applied to each yielded element, with its index.
   * @typeparam R the result type of the given mapFun
   * @param mapFun a function taking an element of this Iter, and optionally its index, and returning a new element of type R
   */
  map = <R>(mapFun: MapFun<T, R>): AsyncIter<R> =>
    this.create(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) yield mapFun(elem, index++)
    })

  /**
   * Returns an AsyncIter of only those elements for which the given pred predicate returns true
   * @param pred a predicate for an element, optionally with its index
   */
  filter = (pred: Pred<T>): AsyncIter<T> =>
    this.create(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) {
        if (pred(elem, index++)) yield elem
      }
    })

  /**
   * Returns an AsyncIter of only those elements for which the given pred predicate returns false
   * @param pred a predicate for an element, optionally with its index
   */
  filterNot = (pred: Pred<T>): AsyncIter<T> => this.filter((v, i) => !pred(v, i))

  /**
   * Returns an AsyncIter that emits all values from the iterables resulting from applying the given flatMapFun to each element in this Iter.
   * @typeparam R the elements of the Iterables resulting from flatMapFun
   * @param flatMapFun a function taking an element from this Iter and returning an iterable with elements of type R
   */
  flatMap = <R>(flatMapFun: (elem: T, index?: number) => AnyIterable<R>): AsyncIter<R> =>
    this.create(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) yield* flatMapFun(elem, index++)
    })

  /**
   * Returns an AsyncIter with the result of applying the given collectFun to each element of this Iter, unless the result is the special SKIP_VALUE symbol, in that case the element is skipped.
   * This function is a combination of map and filter.
   * @typeparam R the resulting elements of the collectFun function
   * @param collectFun a function taking an element of this Iter, optionally with its index, and returning either a new element of type R, or SKIP_VALUE if the value should be skipped
   */
  collect = <R>(collectFun: CollectFun<T, R>): AsyncIter<R> =>
    this.create(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) {
        const value = collectFun(elem, index++)
        if (value !== Option.none) yield value
      }
    })

  /**
   * Returns an AsyncIter yielding the values of this AsyncIter, followed by the values in each of the iterables supplied as arguments.
   * @param otherIterables a non-empty list of iterables of the same type
   */
  concat = (...otherIterables: [AnyIterable<T>, ...AnyIterable<T>[]]): AsyncIter<T> =>
    this.create(async function*(iterable) {
      yield* iterable
      for (const otherIterable of otherIterables) yield* otherIterable
    })

  /**
   * Returns an AsyncIter yielding the given elements after the elements of this Iter have been yielded
   * @param elems a non-empty list of elements that should be appended
   * @returns an Iter yielding the given elements after the elements of this Iter have been yielded
   */
  append = (...elems: [T, ...T[]]): AsyncIter<T> => this.concat(elems)

  /**
   * Returns an AsyncIter yielding the given elements before the elements of this Iter are yielded
   * @param elems a non-empty list of elements that should be prepended
   */
  prepend = (...elems: [T, ...T[]]): AsyncIter<T> => AsyncIter.of(...elems).concat(this)

  private internalFirst = async (): Promise<T | NoValue> => {
    for await (const elem of this) return elem
    return _NO_VALUE
  }

  /**
   * Skips the first given amount of elements of this AsyncIter, then emits all following elements, if present.
   * @param amount the amount of elements to skip
   */
  drop = (amount: number): AsyncIter<T> =>
    this.create(async function*(iterable) {
      let toDrop = amount
      const iterator = (getAsyncIterator(iterable) as any) as AsyncIterable<T>

      for await (const elem of iterator) {
        if (toDrop-- <= 0) {
          yield elem
          yield* iterator
          return
        }
      }
    })

  /**
   * Emits the first given amount of elements of this AsyncIter if present, then ends.
   * @param amount the amount of elements to emit
   */
  take = (amount: number): AsyncIter<T> =>
    this.create(async function*(iterable) {
      let toTake = amount

      for await (const elem of iterable) {
        if (toTake-- <= 0) return
        yield elem
      }
    })

  /**
   * Emits the items of this AsyncIter starting at the from index, and then emitting the specified amount of items, if present.
   * @param from the index at which to start emitting values
   * @param amount the amount of items to emit
   */
  slice = (from: number, amount: number): AsyncIter<T> => this.drop(from).take(amount)

  /**
   * Emits the items of this AsyncIter as long as the given pred predicate holds, then ends.
   * @param pred a predicate taking an element and its index
   */
  takeWhile = (pred: Pred<T>): AsyncIter<T> =>
    this.create(async function*(iterable) {
      let index = 0

      for await (const elem of iterable) {
        if (pred(elem, index++)) yield elem
        else return
      }
    })

  /**
   * Skips items of this AsyncIter as long as the given pred predicate holds, then emits all following elements, if present.
   * @param pred a predicate taking an element and its index
   */
  dropWhile = (pred: Pred<T>): AsyncIter<T> =>
    this.create(async function*(iterable) {
      const iterator = (getAsyncIterator(iterable) as any) as Iterable<T>
      let index = 0

      for await (const elem of iterator) {
        if (!pred(elem, index++)) {
          yield elem
          return yield* iterator
        }
      }
    })

  /**
   * Returns a promise resolving to the result of applying the given op reducer function to each element of this Iter, calculating some result value.
   * @typeparam R the result type of the reducer
   * @param init the initial value of the reducer, returned if this AsyncIter is empty
   * @param op the reduction function taking the current reducer value and the next element of this Iter
   */
  fold = <R>(folder: Folder<T, R>): Promise<R> => Fold.foldAsyncIterable(this, folder)

  foldOr = async <R, O>(otherwise: O, folder: Folder<T, Opt<R>>): Promise<R | O> =>
    Option.getOr(otherwise, await this.fold(folder))

  foldOrThrow = async <R>(folder: Folder<T, Opt<R>>): Promise<R> =>
    Option.getOrThrow(await this.fold(folder))

  /**
   * Returns an AsyncIter that emits the result of applying the given op function to the last emitted value and the next element of this Iter
   * @param op the reducer function taking the last emitted value and the next element of this AsyncIter, and returning a new value to emit
   */
  foldIter = <R>(folder: Folder<T, R>): AsyncIter<R> =>
    this.create(async function*(iterable) {
      let result = folder.init

      for await (const elem of iterable) {
        result = folder.combine(result, elem)
        yield result
      }
    })

  private internalReduce = async (op: ReduceFun<T, T>): Promise<T | NoValue> => {
    let result: T | NoValue = _NO_VALUE

    for await (const elem of this) {
      if (result === _NO_VALUE) result = elem
      else result = op(result, elem)
    }

    return result
  }

  /**
   * Returns a promise resolving to the result of applying the reducer function to each element of this AsyncIter, or returns the otherwise value if this Iter is empty.
   * @typeparam O the type of the otherwise value
   * @param op the reducer function taking the current reducer value and the next element of this AsyncIter, and returning a new value
   * @param otherwise the value to return if this AsyncIter is empty
   */
  reduceOrValue = async <O>(op: ReduceFun<T, T>, otherwise: O): Promise<T | O> => {
    const result = await this.internalReduce(op)
    if (result === _NO_VALUE) return otherwise
    return result
  }

  reduceOpt = (op: ReduceFun<T, T>): Promise<Opt<T>> => this.reduceOrValue(op, Option.none)

  /**
   * Returns an AsyncIter emitting the result from applying the given zipFun to the next element of this AsyncIter and each next element of the given iterables.
   * If any of the iterables is done, the resulting AsyncIter als ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be emitted
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zipWith = <O, R>(
    zipFun: (t: T, o: O, ...others: any[]) => Opt<R>,
    other1Iterable: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<R> =>
    this.create(async function*(iterable) {
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
        if (Option.hasValue(zipOpt)) yield zipOpt
      }
    })

  /**
   * Returns an AsyncIter containing tuples of each next element of this AsyncIter and the provided iterables.
   * If any of the iterables is done, the resulting AsyncIter will end.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zip = <O>(
    otherIterable1: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<[T, O, ...any[]]> => {
    const toTuple = (t: T, o: O, ...other: any[]): [T, O, ...any[]] => [t, o, ...other]
    return this.zipWith(toTuple, otherIterable1, ...otherIterables)
  }

  /**
   * Returns an AsyncIter emitting tuples of the elements of this AsyncIter as first elements, and their indices as second element.
   */
  zipWithIndex = (): AsyncIter<[T, number]> => this.map((e, i): [T, number] => [e, i])

  /**
   * Returns an AsyncIter emitting the result from applying the given zipFun to the next element of this AsyncIter and each next element of the given iterables.
   * If any of the iterables is done, the element will be undefined. If all iterables are done, the resulting AsyncIter ends.
   * Note that the type of the first iterable is taken into account, however the other iterable elements will be cast to any.
   * @typeparam O the type of the iterable elements of the first given iterable
   * @typeparam R the result of applying the zipFun function to the next elements of all given iterables
   * @param zipFun a function taking one element from this and the given iterables, and returns a resulting element that will be emitted, accepting undefined for each non-present value
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zipAllWith = <O, R>(
    zipFun: (t?: T, o?: O, ...other: any[]) => Opt<R>,
    other1Iterable: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<R> =>
    this.create(async function*(iterable) {
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
        if (Option.hasValue(zipOpt)) yield zipOpt
      }
    })

  /**
   * Returns an AsyncIter containing tuples of each next element of this AsyncIter and the provided iterables.
   * If any of the iterables is done, the resulting values will be undefined. If all iterables are done, the resulting Iter ends.
   * Note that the type of the first iterable is taken into account, the other iterable elements will be case to any.
   * @typeparam O the type of the Iter elements of the first given iterable
   * @param otherIterable1 the first iterable to zip
   * @param otherIterables the other iterables to zip
   */
  zipAll = <O>(
    otherIterable1: AnyIterable<O>,
    ...otherIterables: AnyIterable<any>[]
  ): AsyncIter<[T?, O?, ...any[]]> => {
    const toTuple = (t?: T, o?: O, ...other: any[]): [T?, O?, ...any[]] => [t, o, ...other]

    return this.zipAllWith(toTuple, otherIterable1, ...otherIterables)
  }

  /**
   * Returns an AsyncIter that repeatedly emits one value of this Iter and then one value from each given iterable, as long as none of the iterables is done.
   * @param otherIterables a non-empty list of iterables to interleave with.
   */
  interleave = (...otherIterables: [AnyIterable<T>, ...AnyIterable<T>[]]): AsyncIter<T> =>
    AsyncIter.flatten(this.zip(...otherIterables))

  /**
   * Returns a promise resolving to a string starting with the given start element, then each element of this Iter separated by the given sep element, and ending with the end element.
   * @param sep the seperator string
   * @param start the start string
   * @param end the end string
   */
  join = async (sep = '', start = '', end = ''): Promise<string> => {
    let result = start
    let sepThis = await this.map(String).intersperse(sep)
    for await (const elem of sepThis) {
      result = result.concat(elem)
    }
    return result.concat(end)
  }

  /**
   * Repeats the current AsyncIter times amount of times, or indefinately if times is undefined.
   * @times the amount of times to repeat this Iter
   */
  repeat = (times?: number): AsyncIter<T> => {
    if (times !== undefined) {
      if (times <= 0 || this === _EMPTY) return AsyncIter.empty
      if (times === 1) return this
    }

    return this.create(async function*(iterable) {
      const iterator = getAsyncIterator(iterable)
      const { value, done } = await iterator.next()

      if (done) return

      yield value
      yield* (iterator as any) as AsyncIterable<T>

      if (times === undefined) while (true) yield* iterable

      while (--times > 0) yield* iterable
    })
  }

  /**
   * Returns an AsyncIter that emits each distinct value of this Iter at most once.
   */
  distinct = (): AsyncIter<T> =>
    this.create(async function*(iterable) {
      const set = new Set()

      for await (const elem of iterable) {
        if (!set.has(elem)) {
          set.add(elem)
          yield elem
        }
      }
    })

  /**
   * Returns an AsyncIter that emits arrays of the given size of values from this AsyncIter, each shifted that the given step
   * Note: the last window may be smaller than the given size.
   * @size the window size
   * @step the amount of elements to shift the next window
   */
  sliding = (size: number, step: number = size): AsyncIter<T[]> => {
    if (size <= 0 || step <= 0) return AsyncIter.empty

    return this.create(async function*(iterable) {
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
   * Returns an AsyncIter that emits only each given nth value of this AsyncIter.
   * @nth the amount of elements to skip every in between emissions.
   */
  sample = (nth: number): AsyncIter<T> => AsyncIter.flatten(this.sliding(1, nth))

  /**
   * Allows side-effects at any point in the chain, but does not modify the AsyncIter, it just returns the same Iter instance.
   * @param effect the side-effect to perform for each emitted element
   */
  monitor = (effect: Effect<T>): AsyncIter<T> => {
    this.forEach(effect)
    return this
  }

  /**
   * Returns an AsyncIter where all elements satisfying given pred are replaced by the iterable returned by the createSubstIterable function with the element to replace.
   * @param pred a predicate for an element of this AsyncIter and its index
   * @param createSubstIterable a function that given an element returns an iterable of which the elements will replace the given element
   */
  substituteWhere = (
    pred: Pred<T>,
    createSubstIterable: (e: T) => AnyIterable<T> = () => AsyncIter.empty
  ): AsyncIter<T> =>
    this.create(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) {
        const subst = createSubstIterable(elem)
        checkPureAsyncIterable(subst)
        if (pred(elem, index++)) yield* subst
        else yield elem
      }
    })

  /**
   * Returns an AsyncIter where all elments that equal the given elem are replaced by the iterable returned by the substIterable function with the element to replace.
   * @param elem the element to replace
   * @param substIterable an iterable of which the elements will replace the given element
   */
  substituteElem = (elem: T, substIterable: AnyIterable<T> = AsyncIter.empty): AsyncIter<T> =>
    this.substituteWhere(e => e === elem, () => substIterable)

  /**
   * Returns an AsyncIter that emits arrays of values of this AsyncIter each time a value is encountered that satisfied the given pred predicate
   * @param pred a predicate for an element of this AsyncIter and its index
   */
  splitWhere = (pred: Pred<T>): AsyncIter<T[]> =>
    this.create(async function*(iterable) {
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

  /**
   * Returns an AsyncIter that emits arrays of values of this AsyncIter each time a value that equals given elem is encountered
   * @param pred a predicate for an element of this AsyncIter and its index
   */
  splitOnElem = (elem: T): AsyncIter<T[]> => this.splitWhere(e => e === elem)

  /**
   * Returns an AsyncIter that emits the elements of this AsyncIter with the given interIter elements as a sepatator
   * @param interIter an iterator of elements that is used as a separator
   */
  intersperse = (interIter: AnyIterable<T>): AsyncIter<T> =>
    this.create(async function*(iterable) {
      let sepIter: AnyIterable<T> = Iter.empty

      for await (const elem of iterable) {
        yield* sepIter
        sepIter = interIter

        yield elem
      }
    })

  /**
   * Returns an AsyncIter that starts with the startIter elements, then emits all elements of this AsyncIter with the sepIter elements
   * as separators, and ends with the endIter elements.
   * @param startIter the start elements
   * @param sepIter the separator elements
   * @param endIter the end elements
   */
  mkGroup = (
    startIter: AnyIterable<T> = AsyncIter.empty,
    sepIter: AnyIterable<T> = AsyncIter.empty,
    endIter: AnyIterable<T> = AsyncIter.empty
  ): AsyncIter<T> => AsyncIter.fromIterable(startIter).concat(this.intersperse(sepIter), endIter)

  /**
   * Returns a fixed tag string to void unnecessary evaluation of iterable items.
   */
  toString = (): string => `[AsyncIter]`
}

const _EMPTY: AsyncIter<any> = AsyncIter.fromIterable<any>([])
