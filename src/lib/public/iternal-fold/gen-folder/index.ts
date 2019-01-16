/**
 * @module iternal
 */

import { FoldFun, Pred, OptLazy } from '../../constants'

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
  create<A, R>(initState: OptLazy<R>, nextState: FoldFun<A, R>, escape?: Pred<R>): Folder<A, R> {
    return GenFolder.create(OptLazy.toLazy(initState), nextState, v => v, escape)
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
  create<A>(initState: OptLazy<A>, nextState: MonoFun<A>, escape?: Pred<A>): MonoFolder<A> {
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
    stateToResult: (state: S) => R,
    escape?: Pred<S>
  ): GenFolder<A, S, R> {
    return new GenFolder(OptLazy.toLazy(initState), nextState, stateToResult, escape)
  }

  /**
   * Constructs a new GenFolder instance
   * @param createInitState a lazy value generating the initial state for the fold function
   * @param nextState a function taking the current state S and the next element A and its index, and returning the next state
   * @param stateToResult a function that maps a state S to an output value R
   * @param escape an optional function indicating that the output value will never change no matter what input is offered further
   */
  private constructor(
    readonly createInitState: () => S,
    readonly nextState: FoldFun<A, S>,
    readonly stateToResult: (state: S) => R,
    readonly escape?: Pred<S>
  ) {}

  /**
   * Returns a GenFolder where the output value(s) are mapped using the given `mapFun`
   * @typeparam R2 the new output type
   * @param mapFun a function from current output type R to new output type R2
   */
  mapResult<R2>(mapFun: (result: R) => R2): GenFolder<A, S, R2> {
    return new GenFolder(
      this.createInitState,
      this.nextState,
      result => mapFun(this.stateToResult(result)),
      this.escape
    )
  }
}
