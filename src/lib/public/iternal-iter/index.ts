/**
 * @module iternal
 */

import {
  checkPureAnyIterable,
  checkPureAsyncIterable,
  checkPureIterable,
  defaultMonitorEffect,
  getAnyIterator,
  getAsyncIterator,
  getIterator,
  getRandomFloat,
  getRandomInt,
  NoValue,
  optPred
} from '../../private/iternal-common'
import { error, Type } from '../../private/util'
import {
  AnyIterable,
  AnyIterator,
  Effect,
  Errors,
  Indexed,
  MapFun,
  MonitorEffect,
  NonEmpty,
  OptLazy,
  Pred,
  ReduceFun
} from '../constants'
import { Op } from '../iternal-collect/collector'
import { ops as opsCollectors } from '../iternal-collect/collectors'

function toIterator<T>(iterable: Iterable<T>): Iterator<T> {
  return getIterator(checkPureIterable(iterable))
}

type ZipIters<CS extends [any, ...any[]]> = Iterable<any>[] & { [K in keyof CS]: Iterable<CS[K]> }

type OptList<CS extends [any, ...any[]]> = { [K in keyof CS]: CS[K] | undefined }

type ZipAnyIters<CS extends [any, ...any[]]> = AnyIterable<any>[] &
  { [K in keyof CS]: AnyIterable<CS[K]> }

type Unshift<List extends any[], Item> = ((first: Item, ...rest: List) => any) extends ((
  ...list: infer R
) => any)
  ? R
  : never

const DONE: IteratorResult<any> = { done: true } as any

/**
 * Enrichment class allowing for manipulation of synchronous iterables.
 * @typeparam T the element type.
 */
export class Iter<Elem> implements Iterable<Elem> {
  /**
   * Returns an Iter yielding items from an iterable
   * @typeparam E The type of elements the Iterable yields.
   * @param iterable the source iterable
   */
  static fromIterable<E>(iterable: Iterable<E>): Iter<E> {
    if (iterable instanceof Iter) return iterable
    return new Iter(iterable)
  }

  private constructor(private readonly iterable: Iterable<Elem>) {
    if (iterable instanceof Iter) {
      throw error(Errors.InternalError, 'unnecessary nesting')
    }
    checkPureIterable(iterable)
  }

  private get isEmptyInstance() {
    return this === iter.empty()
  }

  /**
   * Returns an Iter instance yielding the values resulting from the iterator output of the `createIterator` function receiving this iterable as an argument.
   * @typeparam R the result iterator element type
   * @param createIterator a function receiving the current iterable and returning an iterator of new elements
   * @example
   * ```typescript
   * iter.of(1, 2, 3, 4)
   *   .applyCustomOperation(function*(iterable) {
   *     for { const elem of iterable } {
   *       if (Math.random() > 0.5) yield `foo${elem}`
   *     }
   *   })
   *   .join(',')
   * result (example): 'foo2,foo3'
   * ```
   */
  applyCustomOperation<R>(createIterator: (iterable: Iterable<Elem>) => Iterator<R>): Iter<R> {
    return iter.fromIterator(() => createIterator(this))
  }

  private applyCustom<R>(createIterator: (iterator: Iterator<Elem>) => Iterator<R>): Iter<R> {
    return iter.fromIterator(() => createIterator(this[Symbol.iterator]()))
  }

  /**
   * Iterable interface: When called, returns an Iterator of type T
   */
  [Symbol.iterator](): Iterator<Elem> {
    return getIterator(this.iterable)
  }

  /**
   * Applies the values of the current Iter to the given `collector` and returns the result.
   * @typeparam R the result type of the collector
   * @param op the collector to apply
   * @example
   * ```typescript
   * iter.of(1, 3, 5).collect(Collectors.sum)
   * result: 9
   * ```
   */
  collect<Res>(op: Op<Elem, Res>): Res {
    let state = op.createInitState()
    let index = 0

    for (const e of this) {
      state = op.nextState(state, e, index++)

      if (op.escape && op.escape(state, index)) {
        return op.stateToResult(state, index)
      }
    }
    return op.stateToResult(state, index)
  }

  /**
   * Returns an Iter yielding each result of applying the collector to the next element in this Iter.
   * @typeparam R the result type of the collector
   * @param op the collector to apply
   * @example
   * ```typescript
   * iter.of(1, 3, 4).collectIter(Collectors.sum)
   * result: (1, 4, 8)
   * ```
   */
  collectIter<R>(op: Op<Elem, R>): Iter<R> {
    return this.applyCustom(iterator => {
      let state = op.createInitState()
      let index = 0
      let isDone = false

      return {
        next(): IteratorResult<R> {
          while (!isDone) {
            const { value, done } = iterator.next()

            isDone = done

            if (!isDone) {
              state = op.nextState(state, value, index++)

              isDone = optPred(state, index, op.escape)

              return {
                done: false,
                value: state
              }
            }
          }
          return DONE
        }
      }
    })
  }

  /**
   * Applies the given effect function to each element of the Iter, with its index.
   * Note: eagerly gets all values from the iterable.
   * @param effect a function taking an element of the Iter and optionally its index and performs some side-effect.
   */
  forEach(effect?: Effect<Elem>): void {
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
   * iter.of(1, 3, 5).map((value, index) => value + index)
   * result: (1, 4, 7)
   * ```
   */
  map<R>(mapFun: MapFun<Elem, R>): Iter<R> {
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      let isDone = false
      let index = 0

      return {
        next(): IteratorResult<R> {
          while (!isDone) {
            const { done, value } = iterator.next()

            isDone = done

            if (!isDone) {
              return {
                done: false,
                value: mapFun(value, index++)
              }
            }
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter of only those elements for which the given pred predicate returns true
   * @param pred a predicate for an element, optionally with its index
   * @example
   * ```typescript
   * iter.of(1, 3, 5, 7).filter((v, i) => isEven(v + i))
   * result: (3, 7)
   * ```
   */
  filter(pred: Pred<Elem>): Iter<Elem> {
    return this.filterNot((v, i) => !pred(v, i))
  }

  /**
   * Returns an Iter of only those elements for which the given pred predicate returns false
   * @param pred a predicate for an element, optionally with its index
   * @example
   * ```typescript
   * iter.nats.filterNot(isEven)
   * result: (1, 3, 5, 7, ...)
   * ```
   */
  filterNot(pred: Pred<Elem>): Iter<Elem> {
    return this.patchWhere(pred, 1)
  }

  /**
   * Returns an Iter that yields all values from the iterables resulting from applying the given flatMapFun to each element in this iter.
   * @typeparam R the elements of the Iterables resulting from flatMapFun
   * @param flatMapFun a function taking an element from this Iter and returning an iterable with elements of type R
   * @example
   * ```typescript
   * iter.nats.flatMap(e => iter.of(e).repeat(e))
   * result: (1, 2, 2, 3, 3, 3, ...)
   * ```
   */
  flatMap<R>(flatMapFun: (elem: Elem, index: number) => Iterable<R>): Iter<R> {
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      let isDone = false
      let current: Iterator<R>
      let isCurrentDone = true
      let index = 0

      return {
        next(): IteratorResult<R> {
          while (!isDone) {
            if (isCurrentDone) {
              const { value, done } = iterator.next()
              isDone = done

              if (isDone) return DONE
              current = getIterator(flatMapFun(value, index++))
            }

            const nextResult = current.next()
            isCurrentDone = nextResult.done

            if (!isCurrentDone) return nextResult
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter yielding the values of this Iter, followed by the values in each of the iterables supplied as arguments.
   * @param otherIterables a non-empty list of iterables of the same type
   * @example
   * ```typescript
   * iter.of(2, 4).concat([5, 3], iter.nats)
   * result: (2, 4, 5, 3, 1, 2, 3, ...)
   * ```
   */
  concat(...otherIterables: NonEmpty<Iterable<Elem>>): Iter<Elem> {
    return iter.of<Iterable<Elem>>(this, ...otherIterables).flatMap(it => checkPureIterable(it))
  }

  /**
   * Returns an Iter yielding the given elements after the elements of this Iter have been yielded
   * @param elems a non-empty list of elements that should be appended
   * @example
   * ```typescript
   * iter.of(1, 3, 5).append(6, 7)
   * result: (1, 3, 5, 6, 7)
   * ```
   */
  append(...elems: NonEmpty<Elem>): Iter<Elem> {
    return this.concat(elems)
  }

  /**
   * Returns an Iter yielding the given elements before the elements of this Iter are yielded
   * @param elems a non-empty list of elements that should be prepended
   * @example
   * ```typescript
   * iter.of(1, 3, 5).prepend(6, 7)
   * result: (6, 7, 1, 3, 5)
   * ```
   */
  prepend(...elems: NonEmpty<Elem>): Iter<Elem> {
    return iter(elems).concat(this)
  }

  /**
   * Returns an Iter that skips the first given amount of elements of this Iter, then yields all following elements, if present.
   * @param amount the amount of elements to skip
   * @example
   * ```typescript
   * iter.nats.drop(3)
   * result: (3, 4, 5, 6, ...)
   * ```
   */
  drop(amount: number): Iter<Elem> {
    return this.patchAt(0, amount)
  }

  /**
   * Returs an Iter that skips the last `amount` of elements of this Iter.
   * @param amount the amount of elements to skip
   * ```typescript
   * iter.range(0, 10).dropLast(5)
   * result: (0, 1, 2, 3, 4)
   * ```
   */
  dropLast(amount: number): Iter<Elem> {
    if (amount <= 0) return this
    if (this.isEmptyInstance) return this

    return this.applyCustom(iterator => {
      const buffer: IteratorResult<Elem>[] = []
      let isDone = false

      return {
        next(): IteratorResult<Elem> {
          while (!isDone) {
            const nextResult = iterator.next()

            isDone = nextResult.done

            if (!isDone) {
              buffer.push(nextResult)

              if (buffer.length > amount) {
                return buffer.shift()!
              }
            }
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter that yields the first given amount of elements of this Iter if present, then ends.
   * @param amount the amount of elements to yield
   * @example
   * ```typescript
   * iter.nats.take(4)
   * result: (0, 1, 2, 3)
   * ```
   */
  take(amount: number): Iter<Elem> {
    if (amount <= 0 || this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      let remain = amount

      return {
        next() {
          while (remain > 0) {
            const nextResult = iterator.next()

            remain = nextResult.done ? 0 : remain - 1

            if (remain >= 0) return nextResult
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returs an Iter that yields the last `amount` of elements of this Iter.
   * @param amount the amount of elements to yield
   * ```typescript
   * iter.range(0, 10).takeLast(3)
   * result: (7, 8, 9)
   * ```
   */
  takeLast(amount: number): Iter<Elem> {
    if (amount <= 0) return iter.empty()
    if (this.isEmptyInstance) return this

    return this.applyCustom(iterator => {
      let isDone = false
      const buffer: IteratorResult<Elem>[] = []

      return {
        next(): IteratorResult<Elem> {
          while (!isDone) {
            const nextResult = iterator.next()

            isDone = nextResult.done

            if (!isDone) {
              buffer.push(nextResult)
              if (buffer.length > amount) buffer.shift()
            }
          }

          if (buffer.length <= 0) return DONE

          return buffer.shift()!
        }
      }
    })
  }

  /**
   * Returns an Iter that yields the items of this Iter starting at the from index, and then yields the specified amount of items, if present.
   * @param from the index at which to start yielding values
   * @param amount the maximum amount of items to yield
   * @example
   * ```typescript
   * iter.nats.slice(3, 4)
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
   * iter.nats.takeWhile(v => v < 5)
   * result: (0, 1, 2, 3, 4)
   * ```
   */
  takeWhile(pred: Pred<Elem>): Iter<Elem> {
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      let isDone = false
      let index = 0

      return {
        next(): IteratorResult<Elem> {
          while (!isDone) {
            const nextResult = iterator.next()

            isDone = nextResult.done || !pred(nextResult.value, index++)

            if (!isDone) return nextResult
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter that skips items of this Iter as long as the given pred predicate holds, then yields all following elements, if present.
   * @param pred a predicate taking an element and its index
   * @example
   * ```typescript
   * iter.nats.dropWhile(v => v < 5)
   * result: (5, 6, 7, 8, ...)
   * ```
   */
  dropWhile(pred: Pred<Elem>): Iter<Elem> {
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      let index = 0
      let passThrough = false

      return {
        next(): IteratorResult<Elem> {
          if (passThrough) return iterator.next()

          while (true) {
            const nextResult = iterator.next()

            passThrough = nextResult.done || !pred(nextResult.value, index++)

            if (passThrough) return nextResult
          }
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
   * iter.range(0, 5).reduce((res, value) => res + value)
   * result: 6
   * ```
   */
  reduce(op: ReduceFun<Elem>, otherwise?: OptLazy<Elem>): Elem {
    let result: Elem | NoValue = NoValue

    let index = 0

    for (const elem of this) {
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
   * iter.nats.zipWith((a, b) => a + b, [5, 2, 3])
   * result: (5, 3, 5)
   * ```
   */
  zipWith<O extends NonEmpty<any>, R>(
    zipFun: (t: Elem, ...others: O) => R,
    ...otherIterables: ZipIters<O>
  ): Iter<R> {
    if (this.isEmptyInstance || otherIterables.some(i => i === iter.empty())) {
      return iter.empty()
    }

    return this.applyCustom(iterator => {
      const otherIterators = otherIterables.map(toIterator)
      let isDone = false

      return {
        next(): IteratorResult<R> {
          while (!isDone) {
            const values: any[] = []

            const firstResult = iterator.next()

            isDone = firstResult.done
            if (isDone) return DONE

            values.push(firstResult.value)

            for (const otherIterator of otherIterators) {
              const otherResult = otherIterator.next()

              isDone = otherResult.done
              if (isDone) return DONE

              values.push(otherResult.value)
            }

            const [first, ...rest] = values

            return {
              done: false,
              value: zipFun(first, ...(rest as any))
            }
          }

          return DONE
        }
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
   * iter.nats.zip([5, 2, 3])
   * result: ([0, 5], [1, 2], [3, 3])
   * ```
   */
  zip<O extends NonEmpty<any>>(...otherIterables: ZipIters<O>): Iter<Unshift<O, Elem>> {
    const toTuple = (arg: Elem, ...args: O): Unshift<O, Elem> => [arg, ...args] as any

    return this.zipWith(toTuple, ...(otherIterables as any))
  }

  /**
   * Returns an Iter yielding tuples of the elements of this Iter as first elements, and their indices as second element.
   * @example
   * ```typescript
   * iter.of('a').repeat(3).zipWithIndex()
   * result: (['a', 0], ['a', 1], ['a', 2])
   * ```
   */
  zipWithIndex(): Iter<[Elem, number]> {
    return this.map((e, i): [Elem, number] => [e, i])
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
   * iter.range(0, 10, 3).zipAllWith((a, b) => [b, a], [5, 7])
   * result: ([5, 0], [7, 10], [undefined, 3])
   * ```
   */
  zipAllWith<O extends NonEmpty<any>, R>(
    zipFun: (t?: Elem, ...others: OptList<O>) => R,
    ...otherIterables: ZipIters<O>
  ): Iter<R> {
    return this.applyCustom(iterator => {
      const otherIterators = otherIterables.map(toIterator)
      let allDone = false

      return {
        next(): IteratorResult<R> {
          if (allDone) return DONE
          const values: any[] = []

          const { value, done } = iterator.next()
          allDone = done
          values.push(done ? undefined : value)

          for (const otherIterator of otherIterators) {
            const { value, done } = otherIterator.next()
            allDone = allDone && done
            values.push(done ? undefined : value)
          }

          if (allDone) return DONE
          return {
            done: false,
            value: zipFun(...(values as any))
          }
        }
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
   * iter.of(1, 5, 6).zipAll('ac')
   * result: ([1, 'a'], [5, 'c'], [6, undefined])
   * ```
   */
  zipAll<O extends NonEmpty<any>>(...otherIterables: ZipIters<O>): Iter<OptList<Unshift<O, Elem>>> {
    const toTuple: any = (...args: any[]) => args

    return this.zipAllWith(toTuple, ...(otherIterables as any))
  }

  /**
   * Returns an Iter with the indices of the this Iter at which the element satisfies the given `pred` predicate.
   * @param pred a predicate for an element of this Iter and its index
   * @example
   * ```typescript
   * iter.of(1, 2, 5, 6, 4, 3).indicesWhere(isEven)
   * result: (1, 3, 4)
   * ```
   */
  indicesWhere(pred: Pred<Elem>): Iter<number> {
    return this.zipWithIndex()
      .filter(([elem, index]) => pred(elem, index))
      .map(([_, index]) => index)
  }

  /**
   * Returns an Iter with the indices of the this Iter where the element equals the given `elem` value.
   * @param elem the element to compare to
   * @example
   * ```typescript
   * iter('ababba').indicesOf('a')
   * result: (0, 2, 5)
   * ```
   */
  indicesOf(elem: Elem): Iter<number> {
    return this.indicesWhere(e => e === elem)
  }

  /**
   * Returns an Iter that repeatedly yields one value of this Iter and then one value from each given iterable, as long as none of the iterables is done.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * iter('abcba').interleave('QWQ').join()
   * result: 'aQbWcQ'
   * ```
   */
  interleave(...otherIterables: NonEmpty<Iterable<Elem>>): Iter<Elem> {
    const zipped = (this.zip(...otherIterables) as unknown) as Iter<Elem[]>
    return iter.flatten(zipped)
  }

  /**
   * Returns an Iter that repeatedly yields one value of this Iter and then one value from each given iterable, for each iterable as long as it still yields values.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * iter('abcba').interleave('QWQ').join()
   * result: 'aQbWcQba'
   * ```
   */
  interleaveAll(...otherIterables: NonEmpty<Iterable<Elem>>): Iter<Elem> {
    const zipped = (this.zipAll(...otherIterables) as unknown) as Iter<(Elem | undefined)[]>
    return iter.flatten<Elem | undefined>(zipped).patchElem(undefined, 1) as Iter<Elem>
  }

  /**
   * Returns an Iter that indefinitely yields one value of this Iter and then one value from each given iterable, starting back at the start of each iterable if it is exhausted.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * iter('abc').interleaveRound('QW').take(10).join()
   * result: 'aQbWcQaWbQ'
   * ```
   */
  interleaveRound(...otherIterables: NonEmpty<Iterable<Elem>>): Iter<Elem> {
    const repeatedIterables = otherIterables.map(it => iter(it).repeat()) as NonEmpty<Iter<Elem>>

    const iterArrayT = (this.repeat().zip(...repeatedIterables) as unknown) as Iter<Elem[]>

    return iter.flatten(iterArrayT)
  }

  /**
   * Returns a string starting with the given start string, then each element of this Iter separated by the given sep string, and ending with the end string.
   * @param sep the seperator string
   * @param start the start string
   * @param end the end string
   * @example
   * ```typescript
   * iter.of(1, 5, 6).join('<', '|, '>')
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
   * iter.of(1, 3).repeat(3)
   * result: (1, 3, 1, 3, 1, 3)
   * ```
   * @example
   * ```typescript
   * iter.of(1, 3).repeat()
   * result: (1, 3, 1, 3, 1, ...)
   * ```
   */
  repeat(times?: number): Iter<Elem> {
    if (times !== undefined) {
      if (times <= 0) return iter.empty()
      if (times === 1) return this
    }
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustomOperation(iterable => {
      let isDone = false
      let nonEmpty = false
      let remain = times

      let iterator = getIterator(iterable)

      const reset = () => {
        iterator = getIterator(iterable)
        if (remain !== undefined) remain--
      }

      return {
        next(): IteratorResult<Elem> {
          while (!isDone) {
            const nextResult = iterator.next()
            if (nextResult.done) {
              if (!nonEmpty) return DONE
              reset()
              isDone = remain !== undefined && remain <= 0
            } else {
              nonEmpty = true
              return nextResult
            }
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter that yields each distinct value of this Iter at most once.
   * @example
   * ```typescript
   * iter.of(1, 5, 1, 3, 2, 5, 1).distinct()
   * result: (1, 5, 3, 2)
   * ```
   */
  distinct(): Iter<Elem> {
    return this.distinctBy(v => v)
  }

  /**
   * Returns an Iter that applies the given `keyFun` to each element, and will yield only elements for which `keyFun`
   * returns a key that was not calculated before.
   * @typeparam K the type of key that the key function returns
   * @param keyFun a function that, given an element and its index, returns a calculated key
   * @example
   * ```typescript
   * iter.of('bar', 'foo', 'test', 'same').distinctBy(v => v.length)
   * result: ('bar', 'test')
   * ```
   */
  distinctBy<K>(keyFun: (value: Elem, index: number) => K): Iter<Elem> {
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      const set = new Set<K>()
      let index = 0
      let isDone = false

      return {
        next() {
          while (!isDone) {
            const nextResult = iterator.next()

            isDone = nextResult.done

            if (!isDone) {
              const key = keyFun(nextResult.value, index++)

              if (!set.has(key)) {
                set.add(key)
                return nextResult
              }
            }
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter that yields those elements that satify the given `pred` predicate.
   * @param pred a function that take the current element, and the optional previous element and returns a boolean
   * indicating its filter status
   */
  filterWithPrevious(pred: (current: Elem, previous?: Elem) => boolean): Iter<Elem> {
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      let isDone = false
      let last: Elem

      return {
        next() {
          while (!isDone) {
            const nextResult = iterator.next()

            isDone = nextResult.done

            if (!isDone) {
              const shouldYield = pred(nextResult.value, last)
              last = nextResult.value

              if (shouldYield) return nextResult
            }
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter that yields elements from this Iter, only when the element is different from the previous value.
   * @example
   * ```typescript
   * iter.of(1, 3, 3, 2, 5, 5, 2, 3).filterChanged()
   * result: (1, 3, 2, 5, 2, 3)
   * ```
   */
  filterChanged(): Iter<Elem> {
    return this.filterWithPrevious((current, last) => current !== last)
  }

  /**
   * Returns an Iter that yields arrays of the given size of values from this Iter, each shifted that the given step
   * Note: the last window may be smaller than the given size.
   * @param size the window size
   * @param step the amount of elements to shift the next window
   * @example
   * ```typescript
   * iter.nats.sliding(3)
   * result: ([0, 1, 2], [3, 4, 5], [6, 7, 8], ...)
   * ```
   * @example
   * ```typescript
   * iter.nats.sliding(3, 1)
   * result: ([0, 1, 2], [1, 2, 3], [2, 3, 4], ...)
   * ```
   */
  sliding(size: number, step = size): Iter<Elem[]> {
    if (size <= 0 || step <= 0 || this.isEmptyInstance) return iter.empty()

    return this.applyCustomOperation(function*(iterable) {
      let bucket: Elem[] = []

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
   * iter.nats.sample(10)
   * result: (0, 10, 20, 30, ...)
   * ```
   */
  sample(nth: number): Iter<Elem> {
    return this.filter((_, index) => index % nth === 0)
  }

  /**
   * Allows side-effects at any point in the chain, but does not modify the Iter.
   * @param tag a tag that can be used when performing the side-effect
   * @param effect the side-effect to perform for each yielded element
   * @example
   * ```typescript
   * iter.nats.monitor("nats").take(3)
   * result:
   * > nats[0]: 0
   * > nats[1]: 1
   * > nats[2]: 2
   * ```
   */
  monitor(tag: string = '', effect: MonitorEffect<Elem> = defaultMonitorEffect): Iter<Elem> {
    if (this.isEmptyInstance) return this

    return this.applyCustom(iterator => {
      let index = 0
      let isDone = false

      return {
        next() {
          while (!isDone) {
            const nextResult = iterator.next()
            isDone = nextResult.done

            if (!isDone) {
              effect(nextResult.value, index++, tag)
              return nextResult
            }
          }

          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter that yields arrays of values of this Iter each time a value is encountered that satisfied the given pred predicate
   * @param pred a predicate for an element of this Iter and its index
   * @example
   * ```typescript
   * iter.range(4).splitWhere(isPrime)
   * result: ([4], [6], [8, 9, 10], [12], ...)
   * ```
   */
  splitWhere(pred: Pred<Elem>): Iter<Elem[]> {
    if (this.isEmptyInstance) return iter.empty()

    return this.applyCustom(iterator => {
      let bucket: Elem[] = []
      let isDone = false
      let index = 0

      return {
        next() {
          while (!isDone) {
            const { value, done } = iterator.next()
            isDone = done

            if (isDone) {
              return {
                done: false,
                value: bucket
              }
            }

            const newBucket = pred(value, index++)

            if (newBucket) {
              const sendBucket = bucket
              bucket = []
              return { done: false, value: sendBucket }
            } else {
              bucket.push(value)
            }
          }
          return DONE
        }
      }
    })
  }
  /**
   * Returns an Iter that yields arrays of values of this Iter each time a value that equals given elem is encountered
   * @param elem the element on which a new split should be made
   * @example
   * ```typescript
   * iter('a test  foo').splitOnElem(' ')
   * result: (['a'], ['t', 'e', 's', 't'], [], ['f', 'o', 'o'])
   * ```
   */
  splitOnElem(elem: Elem): Iter<Elem[]> {
    return this.splitWhere(e => e === elem)
  }

  /**
   * Returns an Iter that yields the elements of this Iter with the given interIter elements as a sepatator
   * @param interIter an iterator of elements that is used as a separator
   * @example
   * ```typescript
   * iter.fromIterable('abc').intersperse('|').join()
   * result: 'a|b|c'
   * ```
   */
  intersperse(interIter: Iterable<Elem>): Iter<Elem> {
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
   * iter.of(1, 3, 4).mkGroup([10], [100], [90, 80])
   * result: (10, 1, 100, 3, 100, 4, 90, 80)
   * ```
   */
  mkGroup(
    startIter: Iterable<Elem> = iter.empty(),
    sepIter: Iterable<Elem> = iter.empty(),
    endIter: Iterable<Elem> = iter.empty()
  ): Iter<Elem> {
    return iter(startIter).concat(this.intersperse(sepIter), endIter)
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
   * iter.of(0, 1, 5, 2).patchWhere(isEven, 1, () => [10, 11])
   * result: (10, 11, 1, 5, 10, 11)
   * ```
   * @example
   * ```typescript
   * iter.of(0, 1, 5, 2).patchWhere(isEven, 0, () => [10, 11])
   * result: (10, 11, 0, 1, 5, 10, 11, 2)
   * ```
   * @example
   * ```typescript
   * iter.of(0, 1, 5, 2).patchWhere(isEven, 2)
   * result: (5)
   * ```
   * @example
   * ```typescript
   * iter.of(0, 1, 5, 2).patchWhere(isEven, 1, undefined, 1)
   * result: (1, 5, 2)
   * ```
   */
  patchWhere(
    pred: Pred<Elem>,
    remove: number,
    insert?: (elem: Elem, index: number) => Iterable<Elem>,
    amount?: number
  ): Iter<Elem> {
    if (this.isEmptyInstance || (amount !== undefined && amount <= 0)) {
      return this
    }

    return this.applyCustomOperation(function*(iterable) {
      let index = 0
      let skip = 0
      let remain = amount === undefined ? 1 : amount

      for (const elem of iterable) {
        if (amount === undefined) remain = 1

        if (skip > 0) skip--
        else {
          if (remain > 0 && pred(elem, index)) {
            remain--

            if (insert !== undefined) {
              const insertIterable = insert(elem, index)
              yield* checkPureIterable(insertIterable)
            }
            skip = remove
          }

          if (skip <= 0) yield elem
          else skip--
        }
        index++
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
   * iter('abc').patchAt(1, 1, () => 'QW').join
   * result: ('aQWc')
   * ```
   */
  patchAt(index: number, remove: number, insert?: (elem?: Elem) => Iterable<Elem>): Iter<Elem> {
    if (this.isEmptyInstance) {
      if (insert === undefined) return iter.empty()
      return iter(insert())
    }
    return this.applyCustomOperation(function*(iterable) {
      let i = 0
      let skip = 0
      function* ins(elem?: Elem) {
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
   * iter('abcba').patchElem('b', 1, '--').join()
   * result: 'a--c--a'
   * ```
   */
  patchElem(elem: Elem, remove: number, insert?: Iterable<Elem>, amount?: number): Iter<Elem> {
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
  toArray(): Elem[] {
    return [...this]
  }

  /**
   * Returns a Set with all the unique values in this Iter
   */
  toSet(): Set<Elem> {
    return new Set(this)
  }

  /**
   * Returns this Iter as an asynchronous AsyncIter instance
   */
  toAsync(): AsyncIter<Elem> {
    return AsyncIter.fromIterable(this)
  }
}

/**
 * Returns an Iter yielding items from a list of iterables
 * @typeparam E The type of elements the Iterable yields.
 * @param iterable the source iterable
 * @param iterables other iterables to concatenate
 */
export function iter<E>(iterable: Iterable<E>, ...iterables: Iterable<E>[]): Iter<E> {
  const first: Iter<E> = iterable instanceof Iter ? iterable : Iter.fromIterable(iterable)

  if (NonEmpty.isNonEmpty(iterables)) return first.concat(...iterables)
  return first
}

export namespace iter {
  const _empty: Iter<any> = Iter.fromIterable<any>([])

  /**
   * Returns an empty Iter instance.
   * @example
   * ```typescript
   * iter.empty
   * result: ()
   * ```
   */
  export function empty<T>(): Iter<T> {
    return _empty
  }

  /**
   * Returns an Iter instance yielding the given elements.
   * @typeparam E The type of elements the Iter instance can yield.
   * @param elems the source elements
   * @example
   * ```typescript
   * iter.of(1, 3, 5)
   * result: (1, 3, 5)
   * ```
   */
  export function of<E>(...elems: NonEmpty<E>): Iter<E> {
    return iter(elems)
  }

  /**
   * Returns an Iter yielding the array entries from array.entries()
   * @typeparam E The array element type
   * @param arr the source array
   */
  export function arrayEntries<E>(arr: E[]): Iter<[number, E]> {
    return fromIterator(() => arr.entries())
  }

  /**
   * Returns an Iter yielding the map entries from map.entries()
   * @typeparam K the map key type
   * @typeparam V the map value type
   * @param map the source map
   */
  export function mapEntries<K, V>(map: Map<K, V>): Iter<[K, V]> {
    return fromIterator(() => map.entries())
  }

  /**
   * Returns an Iter yielding the map keys from map.keys()
   * @typeparam K the map key type
   * @param map the source map
   */
  export function mapKeys<K>(map: Map<K, any>): Iter<K> {
    return fromIterator(() => map.keys())
  }

  /**
   * Returns an Iter yielding the map keys from map.keys()
   * @typeparam V the map value type
   * @param map the source map
   */
  export function mapValues<V>(map: Map<any, V>): Iter<V> {
    return fromIterator(() => map.values())
  }

  /**
   * Returns an Iter yielding the object entries as tuples of type [string, any]
   * @param obj the source object
   */
  export function objectEntries<T extends {}>(obj: T): Iter<[keyof T, T[keyof T]]> {
    return objectKeys(obj).map((p: keyof T) => [p, obj[p]] as [keyof T, T[keyof T]])
  }

  /**
   * Returns an Iter yielding the object keys as strings
   * @param obj the source object
   */
  export function objectKeys<T extends {}>(obj: T): Iter<keyof T> {
    return fromIterator(function*() {
      for (const prop in obj) {
        yield prop as keyof T
      }
    })
  }

  /**
   * Returns an Iter yielding the object values
   * @param obj the source object
   */
  export function objectValues<V>(obj: Record<any, V>): Iter<V> {
    return objectKeys(obj).map(p => obj[p])
  }

  /**
   * Returns an Iter yielding items from an iterator
   * @typeparam E The type of elements the Iterator yields.
   * @param createIterator a function creating a new iterator
   */
  export function fromIterator<E>(createIterator: () => Iterator<E>) {
    return iter({
      [Symbol.iterator]: () => createIterator()
    })
  }

  /**
   * Returns an Iter yielding a potentially infinite sequence of elements using a generation function
   * @typeparam E The type of elements the Iter yields.
   * @param init The initial value to yield.
   * @param next Function the returns the optional next value to yield based on the current value and its index.
   * @example
   * ```typescript
   * iter.generate(2, v => v * v)
   * result: (2, 4, 16, 256, ...)
   * ```
   */
  export function generate<E>(
    init: E,
    next: (current: E, index: number) => E | undefined
  ): Iter<E> {
    return fromIterator(() => {
      let curValue: E | undefined = init
      let index = 0

      return {
        next(): IteratorResult<E> {
          if (curValue === undefined) return DONE
          const value = curValue
          curValue = next(value, index++)

          return {
            done: false,
            value
          }
        }
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
   * iter.unfold(1, s => ['a'.repeat(s), s * 2])
   * result: ('a', 'aa', 'aaaa', 'aaaaaaaa', ...)
   * ```
   */
  export function unfold<S, E>(
    init: S,
    next: (currentState: S, index: number) => [E, S] | undefined
  ): Iter<E> {
    return fromIterator(() => {
      let state = init
      let index = 0
      let isDone = false

      return {
        next() {
          while (!isDone) {
            const nextYield = next(state, index++)

            if (nextYield === undefined) {
              isDone = true
            } else {
              const [value, newState] = nextYield
              state = newState
              return { done: false, value }
            }
          }
          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter yielding a single element the is created lazily when the item is requested.
   * @typeparam E the type of the element that is created
   * @param create A function that lazily creates an element to yield
   * @example
   * ```typescript
   * iter.fromLazy(Math.random)
   * result: (0.243442)
   * ```
   */
  export function fromLazy<E>(create: () => E): Iter<E> {
    return fromIterator(() => {
      let isDone = false

      return {
        next() {
          while (!isDone) {
            isDone = true
            return { done: false, value: create() }
          }
          return DONE
        }
      }
    })
  }

  /**
   * Returns an Iter yielding all natural numbers starting from 0.
   * @example
   * ```typescript
   * iter.nats
   * result: (0, 1, 2, 3, ...)
   * ```
   */
  export const nats: Iter<number> = generate(0, v => v + 1)

  /**
   * Returns an Iter yielding values in a range from the from value, until the until value if specified, increasing by step.
   * @param from the start value of the range
   * @param until (optional) the end value of the range
   * @param step the step size
   * @example
   * ```typescript
   * iter.range(10, 50, 10)
   * result: (10, 20, 30, 40)
   * ```
   * @example
   * ```typescript
   * iter.range(50, 0, -10)
   * result: (50, 40, 30, 20, 10)
   * ```
   * @example
   * ```typescript
   * iter.range(0, undefined, 3)
   * result: (0, 3, 6, 9, ...)
   * ```
   */
  export function range(from: number, until?: number, step = 1): Iter<number> {
    if (until !== undefined) {
      if (step >= 0 && from >= until) return iter.empty()
      if (step <= 0 && from <= until) return iter.empty()
    }

    return generate(from, v => {
      const next = v + step

      if (until !== undefined) {
        if (step >= 0 && next >= until) return undefined
        if (step <= 0 && next <= until) return undefined
      }

      return next
    })
  }

  /**
   * Returns an Iter yielding infinite unique Symbols.
   * @example
   * ```typescript
   * const [X_AXIS, Y_AXIS, Z_AXIS] = iter.symbols
   * ```
   */
  export const symbols: Iter<symbol> = fromLazy(Symbol).repeat()

  /**
   * Returns an Iter yielding a random floating point number between min and max
   * @param min the minimum value
   * @param max the maximum value
   * @example
   * ```typescript
   * iter.random()
   * result: (0.5234)
   * ```
   * @example
   * ```typescript
   * iter.random(10, 20).repeat()
   * result: (17.3541, 12.1324, 18.4243, ...)
   * ```
   */
  export function random(min = 0.0, max = 1.0): Iter<number> {
    return fromLazy(() => getRandomFloat(min, max))
  }

  /**
   * Returns an Iter yielding a random integer between min and max
   * @param min the minimum value
   * @param max the maximum value
   * @example
   * ```typescript
   * iter.randomInt()
   * result: (535984)
   * ```
   * @example
   * ```typescript
   * iter.randomInt(0, 10).repeat()
   * result: (8, 2, 5, 3, 5, 1, 7, ...)
   * ```
   */
  export function randomInt(min = Number.MIN_VALUE, max = Number.MAX_VALUE): Iter<number> {
    return fromLazy(() => getRandomInt(min, max))
  }

  /**
   * Returns an Iter that yields the values from the source input in reversed order
   * @typeparam E the element type of the source
   * @param input a source string or array of elements
   * @example
   * ```typescript
   * iter.indexedReversed('abc')
   * result: ('c', 'b', 'a')
   * ```
   */
  export function indexedReversed<E>(input: Indexed<E>): Iter<E> {
    if (input.length === 0) return empty()

    return range(input.length - 1, -1, -1).map(index => input[index])
  }

  /**
   * Returns an Iter that yields the values from the source input of length N from index 0 to N-1, and then from N-2 downto 1.
   * @typeparam E the element type of the source
   * @param input a source string or array of elements
   * @example
   * ```typescript
   * iter.indexedBounce('abc')
   * result: ('a', 'b', 'c', 'b' )
   * ```
   */
  export function indexedBounce<E>(input: Indexed<E>): Iter<E> {
    if (input.length === 0) return empty()

    return iter(input).concat(
      fromIterator(function*() {
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
   * iter.flatten(iter.of(iter.of(1, 3)), iter.of(iter.of (2, 4)))
   * result: (1, 3, 2, 4)
   * ```
   */
  export function flatten<E>(iterable: Iterable<Iterable<E>>): Iter<E> {
    if (iterable === empty<Iterable<E>>()) return empty()

    return iter(iterable).flatMap(v => v)
  }

  export const ops = opsCollectors

  export const collector = Op
}

function toAnyIterator<X>(iterable: AnyIterable<X>): AnyIterator<X> {
  return getAnyIterator(checkPureAnyIterable(iterable))
}

/**
 * Enrichment class allowing for manipulation of asynchronous iterables.
 * @typeparam T the element type.
 */
export class AsyncIter<Elem> implements AsyncIterable<Elem> {
  /**
   * Returns an AsyncIter yielding items from an iterable
   * @typeparam E The type of elements the Iterable yields.
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
    return asyncIter.fromIterator(() => getAnyIterator(iterable))
  }

  private constructor(private readonly iterable: AsyncIterable<Elem>) {
    if (iterable instanceof AsyncIter) {
      throw error(Errors.InternalError, 'unnecessary asynciter nesting')
    }
    if (!Type.isAsyncIterable(iterable)) {
      throw error(Errors.NotAsyncIterable, 'argument is not async iterable')
    }
    checkPureAsyncIterable(iterable)
  }

  private get isEmptyInstance() {
    return this === asyncIter.empty()
  }

  private applyCustom<R>(
    createIterator: (iterator: AsyncIterator<Elem>) => AsyncIterator<R>
  ): AsyncIter<R> {
    return asyncIter.fromIterator(() => createIterator(this[Symbol.asyncIterator]()))
  }

  /**
   * Returns an AsyncIter instance yielding the values resulting from the iterator output of the `createIterator` function receiving this iterable as an argument.
   * @typeparam R the result iterator element type
   * @param createIterator a function receiving the current iterable and returning an iterator of new elements
   * @example
   * ```typescript
   * asyncIter([1, 2, 3, 4])
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
    createIterator: (iterable: AsyncIterable<Elem>) => AsyncIterator<R>
  ): AsyncIter<R> {
    return asyncIter.fromIterator(() => createIterator(this))
  }

  /**
   * AsyncIterable interface: When called, returns an AsyncIterator of type T
   */
  [Symbol.asyncIterator](): AsyncIterator<Elem> {
    return getAsyncIterator(this.iterable)
  }

  /**
   * Applies the values of the current AsyncIter to the given `collector` and returns the result.
   * @typeparam R the result type of the collector
   * @param collector the collector to apply
   * @example
   * ```typescript
   * asyncIter([1, 3, 5]).collect(Collectors.sum)
   * result: 9
   * ```
   */
  async collect<Res>(collector: Op<Elem, Res>): Promise<Res> {
    let result = collector.createInitState()
    let index = 0
    if (optPred(result, index, collector.escape)) {
      return collector.stateToResult(result, index)
    }

    for await (const elem of this as AsyncIterable<Elem>) {
      result = collector.nextState(result, elem, index++)
      if (optPred(result, index, collector.escape)) {
        return collector.stateToResult(result, index)
      }
    }
    return collector.stateToResult(result, index)
  }

  /**
   * Returns an AsyncIter yielding each result of applying the collector to the next element in this AsyncIter.
   * @typeparam R the result type of the collector
   * @param collector the collector to apply
   * @example
   * ```typescript
   * asyncIter([1, 3, 4]).collectIter(Collectors.sum)
   * result: (1, 4, 8)
   * ```
   */
  collectIter<Res>(collector: Op<Elem, Res>): AsyncIter<Res> {
    return this.applyCustomOperation(async function*(iterable) {
      let result = collector.createInitState()
      let index = 0
      if (optPred(result, index, collector.escape)) return

      for await (const e of iterable) {
        result = collector.nextState(result, e, index++)
        yield collector.stateToResult(result, index)
        if (optPred(result, index, collector.escape)) return
      }
    })
  }

  /**
   * Applies the given effect function to each element of the AsyncIter, with its index.
   * Note: eagerly gets all values from the iterable.
   * @param effect a function taking an element of the Iter and optionally its index and performs some side-effect.
   */
  async forEach(effect?: Effect<Elem>): Promise<void> {
    if (effect === undefined) {
      for await (const elem of this as AsyncIterable<Elem>);
      return
    }

    let index = 0
    for await (const elem of this as AsyncIterable<Elem>) effect(elem, index++)
  }

  /**
   * Returns an AsyncIter where the given mapFun is applied to each yielded element, with its index.
   * @typeparam R the result type of the given mapFun
   * @param mapFun a function taking an element of this Iter, and optionally its index, and returning a new element of type R
   * @example
   * ```typescript
   * asyncIter([1, 3, 5]).map((value, index) => value + index)
   * result: (1, 4, 7)
   * ```
   */
  map<R>(mapFun: MapFun<Elem, R>): AsyncIter<R> {
    if (this.isEmptyInstance) return asyncIter.empty()

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
   * asyncIter([1, 3, 5, 7]).filter((v, i) => isEven(v + i))
   * result: (3, 7)
   * ```
   */
  filter(pred: Pred<Elem>): AsyncIter<Elem> {
    return this.filterNot((v, i) => !pred(v, i))
  }

  /**
   * Returns an AsyncIter of only those elements for which the given pred predicate returns false
   * @param pred a predicate for an element, optionally with its index
   * @example
   * ```typescript
   * iter.nats.toAsync().filterNot(isEven)
   * result: (1, 3, 5, 7, ...)
   * ```
   */
  filterNot(pred: Pred<Elem>): AsyncIter<Elem> {
    return this.patchWhere(pred, 1)
  }

  /**
   * Returns an AsyncIter that yields all values from the iterables resulting from applying the given flatMapFun to each element in this AsyncIter.
   * @typeparam R the elements of the Iterables resulting from flatMapFun
   * @param flatMapFun a function taking an element from this Iter and returning an iterable with elements of type R
   * @example
   * ```typescript
   * asyncIter([1, 2, 3]).flatMap(e => Iter.of(e).repeat(e))
   * result: (1, 2, 2, 3, 3, 3)
   * ```
   */
  flatMap<R>(flatMapFun: (elem: Elem, index: number) => AnyIterable<R>): AsyncIter<R> {
    if (this.isEmptyInstance) return asyncIter.empty()

    return this.applyCustomOperation(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) {
        yield* flatMapFun(elem, index++)
      }
    })
  }

  /**
   * Returns an AsyncIter yielding the values of this AsyncIter, followed by the values in each of the iterables supplied as arguments.
   * @param otherIterables a non-empty list of iterables of the same type
   * @example
   * ```typescript
   * asyncIter([2, 4]).concat([5, 3], Iter.nats)
   * result: (2, 4, 5, 3, 1, 2, 3, ...)
   * ```
   */
  concat(...otherIterables: NonEmpty<AnyIterable<Elem>>): AsyncIter<Elem> {
    return iter
      .of<AnyIterable<Elem>>(this, ...otherIterables)
      .filter(it => it !== asyncIter.empty<Elem>() && it !== iter.empty<Elem>())
      .toAsync()
      .flatMap(it => checkPureAnyIterable(it))
  }

  /**
   * Returns an AsyncIter yielding the given elements after the elements of this Iter have been yielded
   * @param elems a non-empty list of elements that should be appended
   * @example
   * ```typescript
   * asyncIter([1, 3, 5]).append(6, 7)
   * result: (1, 3, 5, 6, 7)
   * ```
   */
  append(...elems: NonEmpty<Elem>): AsyncIter<Elem> {
    return this.concat(elems)
  }

  /**
   * Returns an AsyncIter yielding the given elements before the elements of this Iter are yielded
   * @param elems a non-empty list of elements that should be prepended
   * @example
   * ```typescript
   * asyncIter([1, 3, 5]).prepend(6, 7)
   * result: (6, 7, 1, 3, 5)
   * ```
   */
  prepend(...elems: NonEmpty<Elem>): AsyncIter<Elem> {
    return AsyncIter.fromIterable(elems).concat(this)
  }

  /**
   * Returns an AsyncIter that skips the first given amount of elements of this AsyncIter, then yields all following elements, if present.
   * @param amount the amount of elements to skip
   * @example
   * ```typescript
   * asyncIter([1, 2, 3]).drop(2)
   * result: (3)
   * ```
   */
  drop(amount: number): AsyncIter<Elem> {
    return this.patchAt(0, amount)
  }

  /**
   * Returs an AsyncIter that skips the last `amount` of elements of this AsyncIter.
   * @param amount the amount of last elements to skip
   * ```typescript
   * iter.range(0, 10).toAsync().dropLast(5)
   * result: (0, 1, 2, 3, 4)
   * ```
   */
  dropLast(amount: number): AsyncIter<Elem> {
    if (amount <= 0) return this
    if (this.isEmptyInstance) return this

    return this.applyCustomOperation(async function*(iterable) {
      const buffer: Elem[] = []

      for await (const elem of iterable) {
        buffer.push(elem)
        if (buffer.length > amount) yield buffer.shift() as Elem
      }
    })
  }

  /**
   * Returns an AsyncIter that yields the first given amount of elements of this AsyncIter if present, then ends.
   * @param amount the amount of elements to yield
   * @example
   * ```typescript
   * asyncIter([1, 2, 3]).take(2)
   * result: (1, 2)
   * ```
   */
  take(amount: number): AsyncIter<Elem> {
    if (amount <= 0 || this.isEmptyInstance) return asyncIter.empty()

    return this.applyCustomOperation(async function*(iterable) {
      let toTake = amount

      for await (const elem of iterable) {
        if (toTake-- <= 0) return
        yield elem
      }
    })
  }

  /**
   * Returs an AsyncIter that yields the last `amount` of elements of this AsyncIter.
   * @param amount the amount of elements to yield
   * ```typescript
   * iter.range(0, 10).toAsync().takeLast(3)
   * result: (7, 8, 9)
   * ```
   */
  takeLast(amount: number): AsyncIter<Elem> {
    if (amount <= 0) return asyncIter.empty()
    if (this.isEmptyInstance) return this

    return this.applyCustomOperation(async function*(iterable) {
      const buffer: Elem[] = []

      for await (const elem of iterable) {
        buffer.push(elem)
        if (buffer.length > amount) buffer.shift()
      }
      yield* buffer
    })
  }

  /**
   * Returns an AsyncIter that yields the items of this AsyncIter starting at the from index, and then yields the specified amount of items, if present.
   * @param from the index at which to start yielding values
   * @param amount the amount of items to yield
   * @example
   * ```typescript
   * asyncIter([1, 2, 3, 4]).slice(1, 2)
   * result: (2, 3)
   * ```
   */
  slice(from: number, amount: number): AsyncIter<Elem> {
    return this.drop(from).take(amount)
  }

  /**
   * Returns an AsyncIter that yields the items of this AsyncIter as long as the given pred predicate holds, then ends.
   * @param pred a predicate taking an element and its index
   * @example
   * ```typescript
   * asyncIter([1, 2, 3]).takeWhile(v => v <= 2)
   * result: (1, 2)
   * ```
   */
  takeWhile(pred: Pred<Elem>): AsyncIter<Elem> {
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
   * asyncIter([1, 2, 3]).dropWhile(v => v < 2)
   * result: (2, 3)
   * ```
   */
  dropWhile(pred: Pred<Elem>): AsyncIter<Elem> {
    if (this.isEmptyInstance) return asyncIter.empty()

    return this.applyCustomOperation(async function*(iterable) {
      const iterator = (getAsyncIterator(iterable) as any) as AsyncIterable<Elem>
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
   * asyncIter([1, 2, 3]).reduce((res, value) => res + value)
   * result: 6
   * ```
   */
  async reduce(op: ReduceFun<Elem>, otherwise?: OptLazy<Elem>): Promise<Elem> {
    let result: Elem | NoValue = NoValue

    let index = 0
    for await (const elem of this as AsyncIterable<Elem>) {
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
   * asyncIter([1, 2]).zipWith((a, b) => a + b, [5, 2, 3])
   * result: (6, 4)
   * ```
   */
  zipWith<O extends NonEmpty<any>, R>(
    zipFun: (t: Elem, ...others: O) => R,
    ...otherIterables: ZipAnyIters<O>
  ): AsyncIter<R> {
    if (this.isEmptyInstance) return asyncIter.empty()
    if (otherIterables.some(it => it === asyncIter.empty() || it === asyncIter.empty())) {
      return asyncIter.empty()
    }

    return this.applyCustomOperation(async function*(iterable) {
      const iterators = [toAnyIterator(iterable), ...otherIterables.map(toAnyIterator)]

      while (true) {
        const results = await Promise.all(iterators.map(it => it.next()))
        if (results.some(r => r.done)) return
        const values: any = results.map(r => r.value)
        const [first, ...rest] = values
        const zipOpt = zipFun(first, ...rest)
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
   * asyncIter([0, 5]).zip(Iter.nats)
   * result: ([0, 0], [5, 1])
   * ```
   */
  zip<O extends NonEmpty<any>>(...otherIterables: ZipAnyIters<O>): AsyncIter<Unshift<O, Elem>> {
    const toTuple = (arg: Elem, ...args: O): Unshift<O, Elem> => [arg, ...args] as any

    return this.zipWith(toTuple, ...(otherIterables as any))
  }

  /**
   * Returns an AsyncIter yielding tuples of the elements of this AsyncIter as first elements, and their indices as second element.
   * @example
   * ```typescript
   * asyncIter('a').repeat(3).zipWithIndex()
   * result: (['a', 0], ['a', 1], ['a', 2])
   * ```
   */
  zipWithIndex(): AsyncIter<[Elem, number]> {
    return this.map((e, i): [Elem, number] => [e, i])
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
   * asyncIter([1, 2, 3]).zipAllWith((a, b) => [b, a], [5, 7])
   * result: ([5, 0], [7, 2], [undefined, 3])
   * ```
   */
  zipAllWith<O extends NonEmpty<any>, R>(
    zipFun: (t?: Elem, ...others: OptList<O>) => R,
    ...otherIterables: ZipAnyIters<O>
  ): AsyncIter<R> {
    return this.applyCustom(iterator => {
      const otherIterators = otherIterables.map(toAnyIterator)
      let allDone = false

      return {
        async next(): Promise<IteratorResult<R>> {
          if (allDone) return DONE
          const values: any[] = []

          const { value, done } = await iterator.next()
          allDone = done
          values.push(done ? undefined : value)

          for (const otherIterator of otherIterators) {
            const { value, done } = await otherIterator.next()
            allDone = allDone && done
            values.push(done ? undefined : value)
          }

          if (allDone) return DONE
          return {
            done: false,
            value: zipFun(...(values as any))
          }
        }
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
   * asyncIter([1, 5, 6]).zipAll('ac')
   * result: ([1, 'a'], [5, 'c'], [6, undefined])
   * ```
   */
  zipAll<O extends NonEmpty<any>>(
    ...otherIterables: ZipAnyIters<O>
  ): AsyncIter<OptList<Unshift<O, Elem>>> {
    const toTuple: any = (...args: any[]) => args

    return this.zipAllWith(toTuple, ...(otherIterables as any))
  }

  /**
   * Returns an AsyncIter with the indices of the this AsyncIter at which the element satisfies the given `pred` predicate.
   * @param pred a predicate for an element of this Iter and its index
   * @example
   * ```typescript
   * asyncIter([1, 2, 5, 6, 4, 3]).indicesWhere(isEven)
   * result: (1, 3, 4)
   * ```
   */
  indicesWhere(pred: Pred<Elem>): AsyncIter<number> {
    return this.zipWithIndex()
      .filter(([elem, index]) => pred(elem, index))
      .map(([_, index]) => index)
  }

  /**
   * Returns an AsyncIter with the indices of the this AsyncIter where the element equals the given `elem` value.
   * @param elem the element to compare to
   * @example
   * ```typescript
   * asyncIter('ababba').indicesOf('a')
   * result: (0, 2, 5)
   * ```
   */
  indicesOf(elem: Elem): AsyncIter<number> {
    return this.indicesWhere(e => e === elem)
  }

  /**
   * Returns an AsyncIter that repeatedly yields one value of this Iter and then one value from each given iterable, as long as none of the iterables is done.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * asyncIter('abcba').interleave('QWQ').join()
   * result: 'aQbWcQ'
   * ```
   */
  interleave(...otherIterables: [AnyIterable<Elem>, ...AnyIterable<Elem>[]]): AsyncIter<Elem> {
    return asyncIter.flatten(this.zip(...otherIterables))
  }

  /**
   * Returns an AsyncIter that repeatedly yields one value of this Iter and then one value from each given iterable, for each iterable as long as it still yields values.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * asyncIter('abcba').interleave('QWQ').join()
   * result: 'aQbWcQba'
   * ```
   */
  interleaveAll(...otherIterables: NonEmpty<AnyIterable<Elem>>): AsyncIter<Elem> {
    return asyncIter
      .flatten<Elem | undefined>(this.zipAll(...otherIterables))
      .patchElem(undefined, 1) as AsyncIter<Elem>
  }

  /**
   * Returns an AsyncIter that indefinitely yields one value of this Iter and then one value from each given iterable, starting back at the start of each iterable if it is exhausted.
   * @param otherIterables a non-empty list of iterables to interleave with.
   * @example
   * ```typescript
   * asyncIter('abc').interleaveRound('QW').take(10).join()
   * result: 'aQbWcQaWbQ'
   * ```
   */
  interleaveRound(...otherIterables: NonEmpty<AnyIterable<Elem>>): AsyncIter<Elem> {
    const its = otherIterables.map(it => AsyncIter.fromIterable(it).repeat()) as NonEmpty<
      AsyncIter<Elem>
    >

    return asyncIter.flatten(this.repeat().zip(...its))
  }

  /**
   * Returns a promise resolving to a string starting with the given start element, then each element of this Iter separated by the given sep element, and ending with the end element.
   * @param sep the seperator string
   * @param start the start string
   * @param end the end string
   * @example
   * ```typescript
   * asyncIter.of([1, 5, 6]).join('<', '|, '>')
   * result: '<1|5|6>'
   * ```
   */
  async join(sep = '', start = '', end = ''): Promise<string> {
    let str = ''

    await this.map(String)
      .intersperse(sep)
      .forEach(e => {
        str = str.concat(String(e))
      })
    return start.concat(str, end)
  }

  /**
   * Repeats the current AsyncIter `times` amount of times, or indefinately if `times` is undefined.
   * @param times the amount of times to repeat this Iter
   * @example
   * ```typescript
   * asyncIter([1, 3]).repeat(3)
   * result: (1, 3, 1, 3, 1, 3)
   * ```
   * @example
   * ```typescript
   * asyncIter([1, 3]).repeat()
   * result: (1, 3, 1, 3, 1, ...)
   * ```
   */
  repeat(times?: number): AsyncIter<Elem> {
    if (times !== undefined) {
      if (times <= 0 || this.isEmptyInstance) return asyncIter.empty()
      if (times === 1) return this
    }

    return this.applyCustomOperation(async function*(iterable) {
      const iterator = getAsyncIterator(iterable)
      const { value, done } = await iterator.next()

      if (done) return

      yield value
      yield* (iterator as any) as AsyncIterable<Elem>

      while (times === undefined || --times > 0) yield* iterable
    })
  }

  /**
   * Returns an AsyncIter that yields each distinct value of this Iter at most once.
   * @example
   * ```typescript
   * asyncIter([1, 5, 1, 3, 2, 5, 1]).distinct()
   * result: (1, 5, 3, 2)
   * ```
   */
  distinct(): AsyncIter<Elem> {
    return this.distinctBy(v => v)
  }

  /**
   * Returns an AsyncIter that applies the given `keyFun` to each element, and will yield only elements for which `keyFun`
   * returns a key that was not calculated before.
   * @typeparam K the type of key that the key function returns
   * @param keyFun a function that, given an element and its index, returns a calculated key
   * @example
   * ```typescript
   * asyncIter(['bar', 'foo', 'test', 'same']).distinctBy(v => v.length)
   * result: ('bar', 'test')
   * ```
   */
  distinctBy<K>(keyFun: (value: Elem, index: number) => K): AsyncIter<Elem> {
    if (this.isEmptyInstance) return asyncIter.empty()

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
  filterWithPrevious(pred: (current: Elem, previous?: Elem) => boolean): AsyncIter<Elem> {
    if (this.isEmptyInstance) return asyncIter.empty()

    return this.applyCustomOperation(async function*(iterable) {
      let last: Elem | undefined = undefined

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
   * asyncIter([1, 3, 3, 2, 5, 5, 2, 3]).filterChanged()
   * result: (1, 3, 2, 5, 2, 3)
   * ```
   */
  filterChanged(): AsyncIter<Elem> {
    return this.filterWithPrevious((current, last) => current !== last)
  }

  /**
   * Returns an AsyncIter that yields arrays of the given size of values from this AsyncIter, each shifted that the given step
   * Note: the last window may be smaller than the given size.
   * @param size the window size
   * @param step the amount of elements to shift the next window
   * @example
   * ```typescript
   * iter.nats.toAsync().sliding(3)
   * result: ([0, 1, 2], [3, 4, 5], [6, 7, 8], ...)
   * ```
   * @example
   * ```typescript
   * iter.nats.toAsync().sliding(3, 1)
   * result: ([0, 1, 2], [1, 2, 3], [2, 3, 4], ...)
   * ```
   */
  sliding(size: number, step = size): AsyncIter<Elem[]> {
    if (size <= 0 || step <= 0 || this.isEmptyInstance) return asyncIter.empty()

    return this.applyCustomOperation(async function*(iterable) {
      let bucket: Elem[] = []

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
   * iter.nats.toAsync().sample(10)
   * result: (0, 10, 20, 30, ...)
   * ```
   */
  sample(nth: number): AsyncIter<Elem> {
    return this.patchWhere((_, i) => i % nth === 0, nth, e => iter.of(e))
  }

  /**
   * Allows side-effects at any point in the chain, but does not modify the Iter.
   * @param tag a tag that can be used when performing the side-effect
   * @param effect the side-effect to perform for each yielded element
   * ```typescript
   * iter.nats.toAsync().monitor("nats").take(3)
   * result:
   * > nats[0]: 0
   * > nats[1]: 1
   * > nats[2]: 2
   * ```
   */
  monitor(tag: string = '', effect: MonitorEffect<Elem> = defaultMonitorEffect): AsyncIter<Elem> {
    if (this.isEmptyInstance) return this

    return this.applyCustomOperation(async function*(iterable) {
      let index = 0
      for await (const elem of iterable) {
        effect(elem, index++, tag)
        yield elem
      }
    })
  }

  /**
   * Returns an AsyncIter that yields arrays of values of this AsyncIter each time a value is encountered that satisfied the given pred predicate
   * @param pred a predicate for an element of this AsyncIter and its index
   * @example
   * ```typescript
   * asyncIter([4, 5, 6, 7, 8, 9, 10]).splitWhere(isPrime)
   * result: ([4], [6], [8, 9, 10])
   * ```
   */
  splitWhere(pred: Pred<Elem>): AsyncIter<Elem[]> {
    if (this.isEmptyInstance) return asyncIter.empty()

    return this.applyCustomOperation(async function*(iterable) {
      let bucket: Elem[] = []
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
   * asyncIter('a test  foo').splitOnElem(' ')
   * result: (['a'], ['t', 'e', 's', 't'], [], ['f', 'o', 'o'])
   * ```
   */
  splitOnElem(elem: Elem): AsyncIter<Elem[]> {
    return this.splitWhere(e => e === elem)
  }

  /**
   * Returns an AsyncIter that yields the elements of this AsyncIter with the given interIter elements as a sepatator
   * @param interIter an iterator of elements that is used as a separator
   * @example
   * ```typescript
   * asyncIter('abc').intersperse('|').join()
   * result: 'a|b|c'
   * ```
   */
  intersperse(interIter: AnyIterable<Elem>): AsyncIter<Elem> {
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
   * asyncIter([1, 3, 4]).mkGroup([10], [100], [90, 80])
   * result: (10, 1, 100, 3, 100, 4, 90, 80)
   * ```
   */
  mkGroup(
    startIter: AnyIterable<Elem> = asyncIter.empty(),
    sepIter: AnyIterable<Elem> = asyncIter.empty(),
    endIter: AnyIterable<Elem> = asyncIter.empty()
  ): AsyncIter<Elem> {
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
   * asyncIter([0, 1, 5, 2]).patchWhere(isEven, 1, () => [10, 11])
   * result: (10, 11, 1, 5, 10, 11)
   * ```
   * @example
   * ```typescript
   * asyncIter([0, 1, 5, 2]).patchWhere(isEven, 0, () => [10, 11])
   * result: (10, 11, 0, 1, 5, 10, 11, 2)
   * ```
   * @example
   * ```typescript
   * asyncIter([0, 1, 5, 2]).patchWhere(isEven, 2)
   * result: (5)
   * ```
   * @example
   * ```typescript
   * asyncIter([0, 1, 5, 2]).patchWhere(isEven, 1, undefined, 1)
   * result: (1, 5, 2)
   * ```
   */
  patchWhere(
    pred: Pred<Elem>,
    remove: number,
    insert?: (elem: Elem, index: number) => AnyIterable<Elem>,
    amount?: number
  ): AsyncIter<Elem> {
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
   * asyncIter('abc').patchAt(1, 1, () => 'QW').join()
   * result: 'aQWc'
   * ```
   */
  patchAt(
    index: number,
    remove: number,
    insert?: (elem?: Elem) => AnyIterable<Elem>
  ): AsyncIter<Elem> {
    if (this.isEmptyInstance) {
      if (insert === undefined) return asyncIter.empty()
      return AsyncIter.fromIterable(insert())
    }

    return this.applyCustomOperation(async function*(iterable) {
      let i = 0
      let skip = 0

      async function* ins(elem?: Elem) {
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
   * asyncIter('abcba').patchElem('b', 1, '--').join()
   * result: ('a--c--a')
   * ```
   */
  patchElem(
    elem: Elem,
    remove: number,
    insert?: AnyIterable<Elem>,
    amount?: number
  ): AsyncIter<Elem> {
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

/**
 * Returns an AsyncIter yielding items from a list of iterables
 * @typeparam E The type of elements the Iterable yields.
 * @param iterable the source iterable
 * @param iterables other iterables to concatenate
 */
export function asyncIter<E>(
  iterable: AnyIterable<E>,
  ...iterables: AnyIterable<E>[]
): AsyncIter<E> {
  const first = AsyncIter.fromIterable(iterable)

  if (NonEmpty.isNonEmpty(iterables)) return first.concat(...iterables)
  return first
}

export namespace asyncIter {
  /**
   * Returns an AsyncIter yielding items from an iterator
   * @typeparam E The type of elements the Iterator yields.
   * @param createIterator a function creating a new iterator
   */
  export function fromIterator<E>(createIterator: () => AnyIterator<E>): AsyncIter<E> {
    if (!Type.isIterator(createIterator())) {
      throw error(Errors.NotAnIterator, 'argument is not an iterator')
    }

    return asyncIter({
      [Symbol.asyncIterator]: () => createIterator() as AsyncIterator<E>
    })
  }

  const _empty: AsyncIter<any> = iter.empty().toAsync()

  /**
   * Returns an empty AsyncIter instance.
   * @example
   * ```typescript
   * asyncIter.empty
   * result: ()
   * ```
   */
  export function empty<T>(): AsyncIter<T> {
    return _empty
  }

  /**
   * Returns an AsyncIter yielding a potentially infinite sequence of elements using a generation function
   * @typeparam E The type of elements the Iter yields.
   * @param init A promise resolving to the initial value to yield.
   * @param next Function the returns a promise resolving to the next value to yield based on the current value.
   * @example
   * ```typescript
   * asyncIter.generate(2, v => v * v)
   * result: (2, 4, 16, 256, ...)
   * ```
   */
  export function generate<E>(
    init: Promise<E>,
    next: (current: E, index: number) => Promise<E | undefined>
  ): AsyncIter<E> {
    return fromIterator(async function*() {
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
   * asyncIter.unfold(1, s => ['a'.repeat(s), s * 2])
   * result: ('a', 'aa', 'aaaa', 'aaaaaaaa', ...)
   * ```
   */
  export function unfold<S, E>(
    init: Promise<S>,
    next: (currentState: S, index: number) => Promise<[E, S] | undefined>
  ) {
    return fromIterator(async function*() {
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
   * asyncIter.fromLazy(Math.random)
   * result: (0.243442)
   * ```
   */
  export function fromLazy<E>(create: () => Promise<E>): AsyncIter<E> {
    return fromIterator(async function*() {
      yield create()
    })
  }

  /**
   * Returns an AsyncIter that yields the values from each Iterable in the given Iterable.
   * @typeparam E the element type that the iterables of the given iterable yield.
   * @param iterable the source async iterable of iterables
   * @example
   * ```typescript
   * asyncIter.flatten(iter.of(iter.of(1, 3)), iter.of(Iter.of (2, 4)).toAsync())
   * result: (1, 3, 2, 4)
   * ```
   */
  export function flatten<E>(iterable: AsyncIterable<AnyIterable<E>>): AsyncIter<E> {
    return asyncIter(iterable).flatMap(v => v)
  }

  /**
   * Returns an AsyncIter that yields the result of the given promise once it has resolve.
   * @typeparam E the type of the promise value
   * @param promise the promise that returns a value
   * @example
   * ```typescript
   * asyncIter.fromPromise(new Promise(resolve => setTimeout(() => resolve('test'), 1000))).forEach(v => console.log(v))
   * result: test
   */
  export function fromPromise<E>(promise: Promise<E>): AsyncIter<E> {
    return fromIterator<E>(async function*() {
      yield promise
    })
  }

  /**
   * Returns an AsyncIter that yields the first value that the given callback consumer passes to the callback.
   * @typeparam E the type of the array of arguments that are passed to the callback
   * @param consume a function that takes a callback function
   */
  export function fromSingleCallback<E extends any[]>(
    consume: (emit: (...v: E) => void) => void
  ): AsyncIter<E> {
    return fromPromise(new Promise<E>(resolve => consume((...values: E) => resolve(values))))
  }

  export const ops = opsCollectors

  export const collector = Op
}
