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
// export type FolderT<A, R> = GenFolder<A, any, R>
export interface FolderT<A, R> extends GenFolder<A, any, R> {}

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
  console.log(
    `${tag || ''}[${index}]: input:${values[0]} prevState:${values[1]}`
  )
}

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
  ): FolderT<A, R> {
    return GenFolder.create(OptLazy.toLazy(initState), nextState, id, escape)
  },
  fixed<R>(result: R): FolderT<any, R> {
    return Folder.create(result, () => result, alwaysTrue)
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
export type MonoFolder<A> = FolderT<A, A>
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

  /**
   * Performs given `monitorEffect` for each input element. By default does a console.log with the given `tag`.
   * @param tag a tag to use with logging
   * @param monitorEffect the effect to perform for each input element
   */
  monitorInput(
    tag: string = '',
    monitorEffect: MonitorEffect<[A, S]> = defaultMonitorEffect
  ): FolderT<A, R> {
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
  mapResult<R2>(mapFun: (result: R) => R2): FolderT<A, R2> {
    return new GenFolder(
      this.createInitState,
      this.nextState,
      (result, size) => mapFun(this.stateToResult(result, size)),
      this.escape
    )
  }

  /**
   * Returns a GenFolder where the given `elems` are prepended to the input further received.
   * @param elems the elements to prepent
   */
  prependInput(...elems: NonEmpty<A>): FolderT<A, R> {
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

  /**
   * Returns a GenFolder where the given `elems` are appended to the input received.
   * Note: since the appending happens when the state is retrieved, getting the result
   * multiple times can give unpredictable results.
   * @param elems the elements to prepent
   */
  appendInput(...elems: NonEmpty<A>): FolderT<A, R> {
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

  /**
   * Returns a GenFolder where the input is filtered according to the given `pred` predicate.
   * @param pred a predicate over input elements
   */
  filterInput(pred: Pred<A>): FolderT<A, R> {
    return GenFolder.create(
      () => ({ state: this.createInitState(), virtualIndex: 0 }),
      (combinedState, elem, index) => {
        if (pred(elem, index)) {
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

  /**
   * Returns a GenFolder where the input is mapped from a source type A2 to the expected input elements of type A.
   * @typeparam A2 the new source/input type
   * @param mapFun a function mapping from the new input type A2 to the expected input type A
   */
  mapInput<A2>(mapFun: MapFun<A2, A>): FolderT<A2, R> {
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

  /**
   * Returns a GenFolder that only processes the initial `amount` values of the input.
   * @param amount the amount of input values to process
   */
  takeInput(amount: number): FolderT<A, R> {
    return this.filterInput((_, index) => index < amount).withEscape(
      (_, index) => index >= amount
    )
  }

  /**
   * Returns a GenFolder that skips the initial `amount` values of the input.
   * @param amount the amount of input values to skip
   */
  dropInput(amount: number): FolderT<A, R> {
    return this.filterInput((_, index) => index >= amount)
  }

  /**
   * Returns a GenFolder that only process `amount` elements from the given `from` index of the input elements.
   * @param from the index to start processing elements
   * @param amount the amount of elements to process
   */
  sliceInput(from: number, amount: number): FolderT<A, R> {
    return this.dropInput(from).takeInput(from + amount)
  }

  /**
   * Returns a GenFolder that only processes elements from the input as long as the given `pred` is true. Ignores the rest.
   * @param pred a predicate over the input elements
   */
  takeWhileInput(pred: Pred<A>): FolderT<A, R> {
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

  /**
   * Returns a GenFolder that skips elements of the input as long as given `pred` is true. Then processes all other elements.
   * @param pred a predicate over the input elements
   */
  dropWhileInput(pred: Pred<A>): FolderT<A, R> {
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

  /**
   * Returns a GenFolder that processes every input element for which the given `keyFun` returns the same key value at most once.
   * @typeparam K the element key type
   * @param keyFun a function taking an input element and its index, and returning a key
   */
  distinctByInput<K>(keyFun: (value: A, index: number) => K): FolderT<A, R> {
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

  /**
   * Returns a GenFolder that returns each unique input element at most once.
   */
  distinctInput(): FolderT<A, R> {
    return this.distinctByInput(id)
  }

  /**
   * Returns a GenFolder that only processes those elements that are not equal to their predecessor.
   */
  filterChangedInput(): FolderT<A, R> {
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

  /**
   * Returns a GenFolder that processes each `nth` element of the input elements.
   * @param nth specifies the index of which each element that has a multiple of `nth` will be processed
   */
  sampleInput(nth: number): FolderT<A, R> {
    return this.filterInput((_, index) => index % nth === 0)
  }

  /**
   * Returns a GenFolder that skips `remove` elements at those input elements for which `pred` returns true,
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
  ): FolderT<A, R> {
    return GenFolder.create(
      () => ({
        state: this.createInitState(),
        toRemove: 0,
        amountLeft: amount || Number.MAX_SAFE_INTEGER,
        virtualIndex: 0
      }),
      (combinedState, elem) => {
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
      ({ state }, size) => this.stateToResult(state, size),
      ({ state }, index) =>
        this.escape !== undefined && this.escape(state, index)
    )
  }

  /**
   * Returns a GenFolder where, at the occurence of given `elem` element, `remove` elements are skipped, and
   * `insert` elements are inserted, at most `amount` times.
   * @param elem the element to find
   * @param remove the amount of elements to skip when the element is found
   * @param insert the optional iterable to insert when the element is found
   * @param amount the maximum amount of time to replace an element
   */
  patchElemInput(
    elem: A,
    remove: number,
    insert?: Iterable<A>,
    amount?: number
  ): FolderT<A, R> {
    return this.patchWhereInput(
      e => e === elem,
      remove,
      insert === undefined ? undefined : () => insert,
      amount
    )
  }
}
