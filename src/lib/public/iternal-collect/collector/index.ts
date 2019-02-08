/**
 * @module iternal
 */

import { optPred } from '../../../private/iternal-common'
import { MapFun, MonitorEffect, NonEmpty, OptLazy, Pred, ReduceFun, Lazy } from '../../constants'

/**
 * A Collector taking input types of type A and returning results of type R
 * @typeparam A the input element type
 * @typeparam R the result type
 */
export interface Collector<A, R> extends StateCollector<A, any, R> {}

/**
 * A Reduce function that has the same input and output type
 * @typeparam A the input and result type
 */
export type MonoFun<A> = ReduceFun<A, A>

/**
 * A Collector that has the same input and result type
 * @typeparam A the input and result type
 */
export interface MonoCollector<A> extends Collector<A, A> {}

function id(v: any) {
  return v
}

function alwaysTrue() {
  return true
}

const defaultMonitorEffect: MonitorEffect<[any, any]> = (
  values: [any, any],
  index: number,
  tag?: string
) => {
  console.log(`${tag || ''}[${index}]: input:${values[0]} prevState:${values[1]}`)
}

export namespace Collector {
  /**
   * Creates a new Collector object from element type A to result type R
   * @typeparam A the input element type
   * @typeparam R the state and result type
   * @param definition: the definition of the collector, containing:
   *   - `initState`: the initial state of the Collector, optionally lazy
   *   - `nextState`: a function taking the current state R and the next element A and returns the next state R
   *   - `escape?`: a predicate over a state R indicating whether its value can still ever change
   */
  export function create<A, R>(definition: {
    init: OptLazy<R>
    next: ReduceFun<A, R>
    escape?: Pred<R>
  }): Collector<A, R> {
    return createState({ ...definition, stateToResult: id })
  }

  /**
   * Creates a new monoid-like MonoCollector object taking and generating elements of type A
   * @typeparam A the input and output element type
   * @param definition the definition of the collector, containing:
   *   - `init`: the initial state of the Collector, optionally lazy
   *   - `next`: a function taking the current state A and the next element A and returns the next state A
   *   - `escape?`: a predicate over a state A indicating whether its value can still ever change
   */
  export function createMono<A>(definition: {
    init: OptLazy<A>
    next: MonoFun<A>
    escape?: Pred<A>
  }): MonoCollector<A> {
    return create(definition)
  }

  export function createState<A, S, R>(definition: {
    init: OptLazy<S>
    next: ReduceFun<A, S>
    stateToResult: (state: S, size: number) => R
    escape?: Pred<S>
  }): StateCollector<A, S, R> {
    return StateCollector.create(definition)
  }

  export function fixed<R>(result: R): Collector<any, R> {
    return create({ init: result, next: () => result, escape: alwaysTrue })
  }

  /**
   * Returns a Collector where the provided GenCollectors are run in parallel.
   * The given `combineFun` is applied to the array of results.
   * Note: due to type system limitations only the type of the first other collector is kept
   * @typeparam A the input element type
   * @typeparam R the output type of the provided `col1`
   * @typeparam R2 the output type of the provided `col2`
   * @typeparam GR the result type of the `combineFun` function
   * @param combineFun a function that takes the tupled output of all provided collectors, and combines them into one result value
   * @param col1 a Collector taking the same type of elements
   * @param col2 a Collector taking the same type of elements
   * @param otherCollectors a number of Collectors taking the same type of elements
   */
  export function combineWith<A, R, R2, GR>(
    combineFun: (...results: [R, R2, ...any[]]) => GR,
    col1: Collector<A, R>,
    col2: Collector<A, R2>,
    ...otherCollectors: Collector<A, any>[]
  ): Collector<A, GR> {
    return createState<A, any[], GR>({
      init: () => [
        col1.createInitState(),
        col2.createInitState(),
        ...otherCollectors.map(col => col.createInitState())
      ],
      next: ([state1, state2, ...otherStates], elem, index) => {
        const newStates = [col1.nextState(state1, elem, index), col2.nextState(state2, elem, index)]

        let i = 0
        for (const state of otherStates) {
          newStates.push(otherCollectors[i].nextState(state, elem, index))
          i++
        }
        return newStates
      },
      stateToResult: ([state1, state2, ...otherStates], index) => {
        const results = []

        let i = 0
        for (const state of otherStates) {
          results.push(otherCollectors[i].stateToResult(state, index))
          i++
        }
        return combineFun(
          col1.stateToResult(state1, index),
          col2.stateToResult(state2, index),
          ...results
        )
      },
      escape: ([state1, state2, ...otherStates], index) => {
        const esc = optPred(state1, index, col1.escape) && optPred(state2, index, col2.escape)

        if (esc) return true
        let i = 0
        for (const state of otherStates) {
          if (optPred(state, index, otherCollectors[i].escape)) return true
          i++
        }
        return false
      }
    })
  }

  /**
   * Returns a Collector running the provided Collectors are run in parallel.
   * The results are collected into an array.
   * Note: due to type system limitations only the type of the first other collector is kept
   * @typeparam A the input element type
   * @typeparam R the output type of the provided `col1`
   * @typeparam R2 the output type of the provided `col2`
   * @param col1 a Collector taking the same type of elements
   * @param col2 a Collector taking the same type of elements
   * @param otherCollectors a number of Collectors taking the same type of elements
   */
  export function combine<A, R, R2, GR extends [R, R2, ...unknown[]]>(
    col1: Collector<A, R>,
    col2: Collector<A, R2>,
    ...otherCollectors: Collector<A, unknown>[]
  ): Collector<A, GR> {
    return combineWith<A, R, R2, GR>((...results) => results as GR, col1, col2, ...otherCollectors)
  }

  /**
   * Returns a collector that feeds all input to the first `col1` collector, and for each input element takes the output value
   * from `col1` and feeds this value to `col2`. The output value is the value resulting from `col2`.
   * @typeparam A the input element type
   * @typeparam R the result type of `col1`
   * @typeparam R2 the result type of `col2`
   * @param col1 the collector that receives the input
   * @param col2 the collector that produces the output
   */
  export function pipe<A, R, R2>(col1: Collector<A, R>, col2: Collector<R, R2>): Collector<A, R2> {
    return createState({
      init: () => ({
        state1: col1.createInitState(),
        state2: col2.createInitState()
      }),
      next: (states, elem, index) => {
        states.state1 = col1.nextState(states.state1, elem, index)
        states.state2 = col2.nextState(
          states.state2,
          col1.stateToResult(states.state1, index),
          index
        )
        return states
      },
      stateToResult: ({ state2 }, index) => col2.stateToResult(state2, index),
      escape: ({ state1, state2 }, index) =>
        (col1.escape !== undefined && col1.escape(state1, index)) ||
        (col2.escape !== undefined && col2.escape(state2, index))
    })
  }
}

export type StateCollectorDefinition<A, S, R> = {
  createInitState: Lazy<S>
  nextState: ReduceFun<A, S>
  stateToResult: (state: S, size: number) => R
  escape?: Pred<S>
}

/**
 * Generic Collector type
 * Represents a generic collectable computation
 * @typeparam A the input element type
 * @typeparam S the intermediate state type
 * @typeparam R the output value type
 */
export class StateCollector<A, S, R> {
  /**
   * Creates a new Collector object from element type A to result type R
   * @typeparam A the input element type
   * @typeparam S the intermediate state type
   * @typeparam R the result type
   * @param definition the definition of the state collector, containing:
   *   - `initState`: the initial state of the Collector, optionally lazy
   *   - `nextState`: a function taking the current state S and the next element A and returns the next state S
   *   - `stateToResult`: a function that takes a state S and maps it to a result R
   *   - `escape?`: a predicate over a state S indicating whether its value can still ever change
   */
  static create<A, S, R>(definition: {
    init: OptLazy<S>
    next: ReduceFun<A, S>
    stateToResult: (state: S, size: number) => R
    escape?: Pred<S>
  }): StateCollector<A, S, R> {
    return new StateCollector({
      createInitState: OptLazy.toLazy(definition.init),
      nextState: definition.next,
      stateToResult: definition.stateToResult,
      escape: definition.escape
    })
  }

  /**
   * Constructs a new Collector instance
   * @param createInitState a lazy value generating the initial state for the collect operation
   * @param nextState a function taking the current state S and the next element A and its index, and returning the next state
   * @param stateToResult a function that maps a state S to an output value R
   * @param escape an optional function indicating that the output value will never change no matter what input is offered further
   */
  private constructor(private readonly definition: StateCollectorDefinition<A, S, R>) {}

  get createInitState() {
    return this.definition.createInitState
  }
  get nextState() {
    return this.definition.nextState
  }
  get stateToResult() {
    return this.definition.stateToResult
  }
  get escape() {
    return this.definition.escape
  }

  /**
   * Performs given `monitorEffect` for each input element. By default does a console.log with the given `tag`.
   * @param tag a tag to use with logging
   * @param effect the effect to perform for each input element
   */
  monitorInput(
    tag: string = '',
    effect: MonitorEffect<[A, S]> = defaultMonitorEffect
  ): Collector<A, R> {
    return new StateCollector({
      ...this.definition,
      nextState: (state, elem, index) => {
        effect([elem, state], index, tag)
        return this.definition.nextState(state, elem, index)
      }
    })
  }

  /**
   * Returns a Collector where the output value(s) are mapped using the given `mapFun`
   * @typeparam R2 the new output type
   * @param mapFun a function from current output type R to new output type R2
   */
  mapResult<R2>(mapFun: (result: R) => R2): Collector<A, R2> {
    return new StateCollector({
      ...this.definition,
      stateToResult: (result, size) => mapFun(this.stateToResult(result, size))
    })
  }

  /**
   * Returns a Collector where the given `elems` are prepended to the input further received.
   * @param elems the elements to prepent
   */
  prependInput(...elems: NonEmpty<A>): Collector<A, R> {
    return new StateCollector({
      ...this.definition,
      createInitState: () => {
        let state = this.createInitState()
        let index = 0
        for (const elem of elems) {
          state = this.nextState(state, elem, index)
          index++
        }
        return state
      },
      nextState: (state, elem, index) => this.nextState(state, elem, index + elems.length)
    })
  }

  /**
   * Returns a Collector where the given `elems` are appended to the input received.
   * Note: since the appending happens when the state is retrieved, getting the result
   * multiple times can give unpredictable results.
   * @param elems the elements to prepent
   */
  appendInput(...elems: NonEmpty<A>): Collector<A, R> {
    return new StateCollector({
      ...this.definition,
      stateToResult: (state, size) => {
        let rState = state
        let index = size
        for (const elem of elems) {
          rState = this.nextState(rState, elem, index)
          index++
        }
        return this.stateToResult(rState, index)
      }
    })
  }

  /**
   * Returns a Collector where the input is filtered according to the given `pred` predicate.
   * @param pred a predicate over input elements
   */
  filterInput(pred: Pred<A>): Collector<A, R> {
    return Collector.createState({
      init: () => ({ state: this.createInitState(), virtualIndex: 0 }),
      next: (combinedState, elem, index) => {
        if (pred(elem, index)) {
          combinedState.state = this.nextState(
            combinedState.state,
            elem,
            combinedState.virtualIndex++
          )
        }
        return combinedState
      },
      stateToResult: ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
      escape: ({ state, virtualIndex }) =>
        this.escape !== undefined && this.escape(state, virtualIndex)
    })
  }

  /**
   * Returns a Collector where the input is mapped from a source type A2 to the expected input elements of type A.
   * @typeparam A2 the new source/input type
   * @param mapFun a function mapping from the new input type A2 to the expected input type A
   */
  mapInput<A2>(mapFun: MapFun<A2, A>): Collector<A2, R> {
    return new StateCollector({
      ...this.definition,
      nextState: (state, elem, index) => this.nextState(state, mapFun(elem, index), index)
    })
  }

  private withEscape(pred: Pred<S>): StateCollector<A, S, R> {
    return new StateCollector({ ...this.definition, escape: pred })
  }

  /**
   * Returns a Collector that only processes the initial `amount` values of the input.
   * @param amount the amount of input values to process
   */
  takeInput(amount: number): Collector<A, R> {
    return this.filterInput((_, index) => index < amount).withEscape((_, index) => index >= amount)
  }

  /**
   * Returns a Collector that skips the initial `amount` values of the input.
   * @param amount the amount of input values to skip
   */
  dropInput(amount: number): Collector<A, R> {
    return this.filterInput((_, index) => index >= amount)
  }

  /**
   * Returns a Collector that only processes the last `amount` values of the input.
   * @param amount the amount of last input values to process
   */
  takeLastInput(amount: number): Collector<A, R> {
    return Collector.createState({
      init: () => ({ state: this.createInitState(), elems: new Array<A>() }),
      next: (combinedState, elem) => {
        combinedState.elems.push(elem)
        if (combinedState.elems.length > amount) combinedState.elems.shift()
        return combinedState
      },
      stateToResult: combinedState => {
        let state = combinedState.state
        let index = 0
        for (const elem of combinedState.elems) {
          state = this.nextState(state, elem, index++)
        }
        return this.stateToResult(state, index)
      },
      escape: (combinedState, index) =>
        this.escape !== undefined && this.escape(combinedState.state, index)
    })
  }

  /**
   * Returns a Collector that skips the last `amount` values of the input.
   * @param amount the amount of last input values to skip
   */
  dropLastInput(amount: number): Collector<A, R> {
    return Collector.createState({
      init: () => ({ state: this.createInitState(), elems: new Array<A>(), virtualIndex: 0 }),
      next: (combinedState, elem) => {
        combinedState.elems.push(elem)
        if (combinedState.elems.length > amount) {
          combinedState.state = this.nextState(
            combinedState.state,
            combinedState.elems.shift() as A,
            combinedState.virtualIndex++
          )
        }
        return combinedState
      },
      stateToResult: combinedState =>
        this.stateToResult(combinedState.state, combinedState.virtualIndex),
      escape: combinedState =>
        this.escape !== undefined && this.escape(combinedState.state, combinedState.virtualIndex)
    })
  }

  /**
   * Returns a Collector that only process `amount` elements from the given `from` index of the input elements.
   * @param from the index to start processing elements
   * @param amount the amount of elements to process
   */
  sliceInput(from: number, amount: number): Collector<A, R> {
    return this.dropInput(from).takeInput(from + amount)
  }

  /**
   * Returns a Collector that only processes elements from the input as long as the given `pred` is true. Ignores the rest.
   * @param pred a predicate over the input elements
   */
  takeWhileInput(pred: Pred<A>): Collector<A, R> {
    return Collector.createState({
      init: () => ({ state: this.createInitState(), done: false }),
      next: (combinedState, elem, index) => {
        if (!combinedState.done) combinedState.done = !pred(elem, index)
        if (!combinedState.done) {
          combinedState.state = this.nextState(combinedState.state, elem, index)
        }
        return combinedState
      },
      stateToResult: ({ state }, size) => this.stateToResult(state, size),
      escape: ({ state, done }, index) =>
        done || (this.escape !== undefined && this.escape(state, index))
    })
  }

  /**
   * Returns a Collector that skips elements of the input as long as given `pred` is true. Then processes all other elements.
   * @param pred a predicate over the input elements
   */
  dropWhileInput(pred: Pred<A>): Collector<A, R> {
    return Collector.createState({
      init: () => ({ state: this.createInitState(), done: false, virtualIndex: 0 }),
      next: (combinedState, elem, index) => {
        if (!combinedState.done) combinedState.done = !pred(elem, index)
        if (combinedState.done) {
          combinedState.state = this.nextState(
            combinedState.state,
            elem,
            combinedState.virtualIndex++
          )
        }
        return combinedState
      },
      stateToResult: ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
      escape: ({ state, virtualIndex }) =>
        this.escape !== undefined && this.escape(state, virtualIndex)
    })
  }

  /**
   * Returns a Collector that processes every input element for which the given `keyFun` returns the same key value at most once.
   * @typeparam K the element key type
   * @param keyFun a function taking an input element and its index, and returning a key
   */
  distinctByInput<K>(keyFun: (value: A, index: number) => K): Collector<A, R> {
    return Collector.createState({
      init: () => ({
        state: this.createInitState(),
        dict: new Set<K>(),
        virtualIndex: 0
      }),
      next: (combinedState, elem, index) => {
        const key = keyFun(elem, index)
        if (combinedState.dict.has(key)) return combinedState
        combinedState.dict.add(key)
        combinedState.state = this.nextState(
          combinedState.state,
          elem,
          combinedState.virtualIndex++
        )
        return combinedState
      },
      stateToResult: ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
      escape: ({ state, virtualIndex }) =>
        this.escape !== undefined && this.escape(state, virtualIndex)
    })
  }

  /**
   * Returns a Collector that returns each unique input element at most once.
   */
  distinctInput(): Collector<A, R> {
    return this.distinctByInput(id)
  }

  /**
   * Returns a Collector that only processes those elements that are not equal to their predecessor.
   */
  filterChangedInput(): Collector<A, R> {
    return Collector.createState<A, { state: S; prevElem: A | undefined; virtualIndex: number }, R>(
      {
        init: () => ({
          state: this.createInitState(),
          prevElem: undefined,
          virtualIndex: 0
        }),
        next: (combinedState, elem, index) => {
          if (elem !== combinedState.prevElem) {
            combinedState.prevElem = elem
            combinedState.state = this.nextState(
              combinedState.state,
              elem,
              combinedState.virtualIndex++
            )
          }
          return combinedState
        },
        stateToResult: ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
        escape: ({ state, virtualIndex }) =>
          this.escape !== undefined && this.escape(state, virtualIndex)
      }
    )
  }

  /**
   * Returns a Collector that processes each `nth` element of the input elements.
   * @param nth specifies the index of which each element that has a multiple of `nth` will be processed
   */
  sampleInput(nth: number): Collector<A, R> {
    return this.filterInput((_, index) => index % nth === 0)
  }

  /**
   * Returns a Collector that skips `remove` elements at those input elements for which `pred` returns true,
   * and then inserts th e optional iterable resulting from calling `insert` with the found element and its
   * index, at most `amount` times.
   * @param pred the predicate over input elements
   * @param remove the amount of elements to skip when pred is true
   * @param insert the iterable elements to insert when pred is true
   * @param amount the maximum amount of times to replace an input element
   */
  patchWhereInput(
    pred: Pred<A>,
    remove: number,
    insert?: (elem: A, index: number) => Iterable<A>,
    amount?: number
  ): Collector<A, R> {
    return Collector.createState({
      init: () => ({
        state: this.createInitState(),
        toRemove: 0,
        amountLeft: amount || Number.MAX_SAFE_INTEGER,
        virtualIndex: 0
      }),
      next: (combinedState, elem) => {
        if (combinedState.toRemove <= 0) {
          if (
            (amount === undefined || combinedState.amountLeft > 0) &&
            pred(elem, combinedState.virtualIndex)
          ) {
            combinedState.toRemove = remove
            combinedState.amountLeft--

            if (insert !== undefined) {
              for (const el of insert(elem, combinedState.virtualIndex)) {
                combinedState.state = this.nextState(
                  combinedState.state,
                  el,
                  combinedState.virtualIndex++
                )
              }
            }
          }

          if (combinedState.toRemove <= 0) {
            combinedState.state = this.nextState(
              combinedState.state,
              elem,
              combinedState.virtualIndex++
            )
          }
        }
        combinedState.toRemove--

        return combinedState
      },
      stateToResult: ({ state }, size) => this.stateToResult(state, size),
      escape: ({ state }, index) => this.escape !== undefined && this.escape(state, index)
    })
  }

  /**
   * Returns a Collector where, at the occurence of given `elem` element, `remove` elements are skipped, and
   * `insert` elements are inserted, at most `amount` times.
   * @param elem the element to find
   * @param remove the amount of elements to skip when the element is found
   * @param insert the optional iterable to insert when the element is found
   * @param amount the maximum amount of time to replace an element
   */
  patchElemInput(elem: A, remove: number, insert?: Iterable<A>, amount?: number): Collector<A, R> {
    return this.patchWhereInput(
      e => e === elem,
      remove,
      insert === undefined ? undefined : () => insert,
      amount
    )
  }
}
