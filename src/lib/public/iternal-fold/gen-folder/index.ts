/**
 * @module iternal
 */

import {
  FoldFun,
  Pred,
  OptLazy,
  NonEmpty,
  MapFun,
  MonitorEffect
} from '../../constants'

/**
 * A Folder taking input types of type A and returning results of type R
 * @typeparam A the input element type
 * @typeparam R the result type
 */
export type Folder<A, R> = GenFolder<A, any, R>
export const Folder = {
  /**
   * Creates a new Folder object from element type A to result type R
   * @typeparam A the input element type
   * @typeparam R the state and result type
   * @param initState the initial state of the folder, optionally lazy
   * @param nextState a function taking the current state R and the next element A and returns the next state R
   * @param escape a predicate over a state R indicating whether its value can still ever change
   */
  create<A, R>(
    initState: OptLazy<R>,
    nextState: FoldFun<A, R>,
    escape?: Pred<R>
  ): Folder<A, R> {
    return GenFolder.create(
      OptLazy.toLazy(initState),
      nextState,
      v => v,
      escape
    )
  },
  fixed<R>(result: R): Folder<any, R> {
    return Folder.create(result, () => result, () => true)
  }
}

/**
 * A Fold function that has the same input and output type
 * @typeparam A the input and result type
 */
export type MonoFun<A> = FoldFun<A, A>

/**
 * A Folder that has the same input and result type
 * @typeparam A the input and result type
 */
export type MonoFolder<A> = Folder<A, A>
export const MonoFolder = {
  /**
   * Creates a new monoid-like MonoFolder object taking and generating elements of type A
   * @typeparam A the input and output element type
   * @param initState the initial state of the folder, optionally lazy
   * @param nextState a function taking the current state A and the next element A and returns the next state A
   * @param escape a predicate over a state A indicating whether its value can still ever change
   */
  create<A>(
    initState: OptLazy<A>,
    nextState: MonoFun<A>,
    escape?: Pred<A>
  ): MonoFolder<A> {
    return Folder.create(OptLazy.toLazy(initState), nextState, escape)
  }
}

/**
 * Generic Folder type
 * Represents a generic foldable computation
 * @typeparam A the input element type
 * @typeparam S the intermediate state type
 * @typeparam R the output value type
 */
export class GenFolder<A, S, R> {
  /**
   * Creates a new Folder object from element type A to result type R
   * @typeparam A the input element type
   * @typeparam S the intermediate state type
   * @typeparam R the result type
   * @param initState the initial state of the folder, optionally lazy
   * @param nextState a function taking the current state S and the next element A and returns the next state S
   * @param stateToResult a function that takes a state S and maps it to a result R
   * @param escape a predicate over a state S indicating whether its value can still ever change
   */
  static create<A, S, R>(
    initState: OptLazy<S>,
    nextState: FoldFun<A, S>,
    stateToResult: (state: S, size: number) => R,
    escape?: Pred<S>
  ): GenFolder<A, S, R> {
    return new GenFolder(
      OptLazy.toLazy(initState),
      nextState,
      stateToResult,
      escape
    )
  }

  readonly nextState: FoldFun<A, S>
  private monitorEffect?: MonitorEffect<[A, S]>

  /**
   * Constructs a new GenFolder instance
   * @param createInitState a lazy value generating the initial state for the fold function
   * @param nextState a function taking the current state S and the next element A and its index, and returning the next state
   * @param stateToResult a function that maps a state S to an output value R
   * @param escape an optional function indicating that the output value will never change no matter what input is offered further
   */
  private constructor(
    readonly createInitState: () => S,
    nextState: FoldFun<A, S>,
    readonly stateToResult: (state: S, size: number) => R,
    readonly escape?: Pred<S>
  ) {
    this.nextState = (state, elem, index) => {
      if (this.monitorEffect !== undefined) {
        this.monitorEffect([elem, state], index)
      }
      return nextState(state, elem, index)
    }
  }

  monitorInput(
    tag: string = '',
    monitorEffect: MonitorEffect<[A, S]> = ([e, s], i, t) =>
      console.log(`${t || ''}[${i}]: input:${e} prevState:${s}`)
  ): Folder<A, R> {
    if (this.monitorEffect === undefined) {
      this.monitorEffect = (input, index) => monitorEffect(input, index, tag)
    } else {
      const currentEffect = this.monitorEffect
      this.monitorEffect = (input, index) => {
        currentEffect(input, index)
        monitorEffect(input, index)
      }
    }
    return this
  }

  /**
   * Returns a GenFolder where the output value(s) are mapped using the given `mapFun`
   * @typeparam R2 the new output type
   * @param mapFun a function from current output type R to new output type R2
   */
  mapResult<R2>(mapFun: (result: R) => R2): Folder<A, R2> {
    return new GenFolder(
      this.createInitState,
      this.nextState,
      (result, size) => mapFun(this.stateToResult(result, size)),
      this.escape
    )
  }

  prependInput(...elems: NonEmpty<A>): Folder<A, R> {
    return new GenFolder(
      () => {
        let state = this.createInitState()
        let index = 0
        for (const elem of elems) {
          state = this.nextState(state, elem, index)
          index++
        }
        return state
      },
      (state, elem, index) => this.nextState(state, elem, index + elems.length),
      this.stateToResult,
      this.escape
    )
  }

  appendInput(...elems: NonEmpty<A>): Folder<A, R> {
    return new GenFolder(
      this.createInitState,
      this.nextState,
      (state, size) => {
        let rState = state
        let index = size
        for (const elem of elems) {
          rState = this.nextState(rState, elem, index)
          index++
        }
        return this.stateToResult(rState, index)
      },
      this.escape
    )
  }

  filterInput(filterFun: Pred<A>): Folder<A, R> {
    return GenFolder.create(
      () => ({ state: this.createInitState(), virtualIndex: 0 }),
      (combinedState, elem, index) => {
        if (filterFun(elem, index)) {
          combinedState.state = this.nextState(
            combinedState.state,
            elem,
            combinedState.virtualIndex++
          )
        }
        return combinedState
      },
      ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
      ({ state, virtualIndex }) =>
        this.escape !== undefined && this.escape(state, virtualIndex)
    )
  }

  mapInput<A2>(mapFun: MapFun<A2, A>): Folder<A2, R> {
    return new GenFolder<A2, S, R>(
      this.createInitState,
      (state, elem, index) => this.nextState(state, mapFun(elem, index), index),
      this.stateToResult,
      this.escape
    )
  }

  private withEscape(pred: Pred<S>): GenFolder<A, S, R> {
    return GenFolder.create(
      this.createInitState,
      this.nextState,
      this.stateToResult,
      pred
    )
  }

  takeInput(amount: number): Folder<A, R> {
    return this.filterInput((_, index) => index < amount).withEscape(
      (_, index) => index >= amount
    )
  }

  dropInput(amount: number): Folder<A, R> {
    return this.filterInput((_, index) => index >= amount)
  }

  sliceInput(from: number, amount: number): Folder<A, R> {
    return this.dropInput(from).takeInput(from + amount)
  }

  takeWhileInput(pred: Pred<A>): Folder<A, R> {
    return new GenFolder(
      () => ({ state: this.createInitState(), done: false }),
      (combinedState, elem, index) => {
        if (!combinedState.done) combinedState.done = !pred(elem, index)
        if (!combinedState.done) {
          combinedState.state = this.nextState(combinedState.state, elem, index)
        }
        return combinedState
      },
      ({ state }, size) => this.stateToResult(state, size),
      ({ state, done }, index) =>
        done || (this.escape !== undefined && this.escape(state, index))
    )
  }

  dropWhileInput(pred: Pred<A>): Folder<A, R> {
    return GenFolder.create(
      () => ({ state: this.createInitState(), done: false, virtualIndex: 0 }),
      (combinedState, elem, index) => {
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
      ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
      ({ state, virtualIndex }) =>
        this.escape !== undefined && this.escape(state, virtualIndex)
    )
  }

  distinctByInput<K>(keyFun: (value: A, index: number) => K): Folder<A, R> {
    return GenFolder.create(
      () => ({
        state: this.createInitState(),
        dict: new Set<K>(),
        virtualIndex: 0
      }),
      (combinedState, elem, index) => {
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
      ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
      ({ state, virtualIndex }) =>
        this.escape !== undefined && this.escape(state, virtualIndex)
    )
  }

  distinctInput(): Folder<A, R> {
    return this.distinctByInput(v => v)
  }

  filterChangedInput(): Folder<A, R> {
    return GenFolder.create<
      A,
      { state: S; prevElem: A | undefined; virtualIndex: number },
      R
    >(
      () => ({
        state: this.createInitState(),
        prevElem: undefined,
        virtualIndex: 0
      }),
      (combinedState, elem, index) => {
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
      ({ state, virtualIndex }) => this.stateToResult(state, virtualIndex),
      ({ state, virtualIndex }) =>
        this.escape !== undefined && this.escape(state, virtualIndex)
    )
  }

  sampleInput(nth: number): Folder<A, R> {
    return this.filterInput((_, index) => index % nth === 0)
  }

  // TODO index is not always strictly increasing
  patchWhereInput(
    pred: Pred<A>,
    remove: number,
    insert?: (elem: A, index: number) => Iterable<A>,
    amount?: number
  ): Folder<A, R> {
    return GenFolder.create(
      () => ({
        state: this.createInitState(),
        toRemove: 0,
        amountLeft: amount || 0
      }),
      (combinedState, elem, index) => {
        if (combinedState.toRemove <= 0) {
          if (
            (amount === undefined || combinedState.amountLeft > 0) &&
            pred(elem, index)
          ) {
            combinedState.toRemove = remove
            combinedState.amountLeft--

            if (insert !== undefined) {
              for (const el of insert(elem, index)) {
                combinedState.state = this.nextState(
                  combinedState.state,
                  el,
                  index
                )
              }
            }
          }

          if (combinedState.toRemove <= 0) {
            combinedState.state = this.nextState(
              combinedState.state,
              elem,
              index
            )
          }
        }
        combinedState.toRemove--

        return combinedState
      },
      ({ state }, size) => this.stateToResult(state, size),
      ({ state }, index) =>
        this.escape !== undefined && this.escape(state, index)
    )
  }

  patchElemInput(
    elem: A,
    remove: number,
    insert?: Iterable<A>,
    amount?: number
  ): Folder<A, R> {
    return this.patchWhereInput(
      e => e === elem,
      remove,
      insert === undefined ? undefined : () => insert,
      amount
    )
  }
}
