import { FoldFun, Pred } from '../../constants'

/**
 * A Folder taking input types of type A and returning results of type R
 * @typeparam A the input element type
 * @typeparam R the result type
 */
export type Folder<A, R> = GenFolder<A, any, R>

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

/**
 * A Dictionary, represented as a map of keys K to arrays of values V
 * @typeparam K the key type
 * @typeparam V the value type
 */

export interface GenFolder<A, S, R> {
  readonly createInitState: () => S
  readonly nextState: FoldFun<A, S>
  readonly stateToResult: (state: S) => R
  readonly escape?: Pred<S>

  mapResult<R2>(mapFun: (result: R) => R2): GenFolder<A, S, R2>

  combineWith<S2, R2, GR>(
    combineFun: (...results: [R, R2, ...any[]]) => GR,
    otherFolder: GenFolder<A, S2, R2>,
    ...otherFolders: Folder<A, any>[]
  ): GenFolder<A, [S, S2, ...any[]], GR>

  combine<S2, R2>(
    otherFolder: GenFolder<A, S2, R2>,
    ...otherFolders: Folder<A, any>[]
  ): GenFolder<A, [S, S2, ...any[]], [R, R2, ...any[]]>
}
