/**
 * @module iternal
 */

import { optPred } from '../../../private/iternal-common'
import { AnyIterable, NonEmpty } from '../../constants'
import { AsyncIter } from '../../iternal-async'
import { Iter } from '../../iternal-sync'
import { Folder, GenFolder } from '../gen-folder'

export namespace Fold {
  /**
   * Returns the result of applying the given `folder` to each element yielded by the given `iterable`
   * @typeparam the iterable element type
   * @typeparam R the folder result type
   * @param iterable an iterable yielding elements of type A
   * @param folder a folder taking elements of type A and returning a result of type R
   */
  export function fold<A, R>(iterable: Iterable<A>, folder: Folder<A, R>): R {
    return Iter.fromIterable(iterable).fold(folder)
  }

  /**
   * Returns an Iter yielding the results of applying the given `folder` to each element yielded by the given `iterable`
   * @typeparam the iterable element type
   * @typeparam R the folder result type
   * @param iterable an iterable yielding elements of type A
   * @param folder a folder taking elements of type A and returning a result of type R
   */
  export function foldIter<A, R>(iterable: Iterable<A>, folder: Folder<A, R>): Iter<R> {
    return Iter.fromIterable(iterable).foldIter(folder)
  }

  /**
   * Returns the result of applying the given `folder` to each element yielded by the given `iterable`
   * @typeparam the iterable element type
   * @typeparam R the folder result type
   * @param iterable an async iterable yielding elements of type A
   * @param folder a folder taking elements of type A and returning a result of type R
   */
  export function foldAsync<A, R>(iterable: AnyIterable<A>, folder: Folder<A, R>): Promise<R> {
    return AsyncIter.fromIterable(iterable).fold(folder)
  }

  /**
   * Returns an Iter yielding the results of applying the given `folder` to each element yielded by the given `iterable`
   * @typeparam the iterable element type
   * @typeparam R the folder result type
   * @param iterable an async iterable yielding elements of type A
   * @param folder a folder taking elements of type A and returning a result of type R
   */
  export function foldAsyncIter<A, R>(
    iterable: AnyIterable<A>,
    folder: Folder<A, R>
  ): AsyncIter<R> {
    return AsyncIter.fromIterable(iterable).foldIter(folder)
  }

  /**
   * Returns a Folder where the provided GenFolders are run in parallel.
   * The given `combineFun` is applied to the array of results.
   * Note: due to type system limitations only the type of the first other folder is kept
   * @typeparam A the input element type
   * @typeparam S the state type of the provided `firstFolder`
   * @typeparam R the output type of the provided `firstFolder`
   * @typeparam S2 the state type of the provided `otherFolder`
   * @typeparam R2 the output type of the provided `otherFolder`
   * @typeparam GR the result type of the `combineFun` function
   * @param combineFun a function that takes the tupled output of all provided folders, and combines them into one result value
   * @param folder1 a Folder taking the same type of elements
   * @param folder2 a Folder taking the same type of elements
   * @param otherFolders a number of Folders taking the same type of elements
   */
  export function combineWith<A, S, R, S2, R2, GR>(
    combineFun: (...results: [R, R2, ...any[]]) => GR,
    folder1: GenFolder<A, S, R>,
    folder2: GenFolder<A, S2, R2>,
    ...otherFolders: Folder<A, any>[]
  ): Folder<A, GR> {
    return GenFolder.create<A, [S, S2, ...any[]], GR>(
      () => [
        folder1.createInitState(),
        folder2.createInitState(),
        ...otherFolders.map(folder => folder.createInitState())
      ],
      ([state1, state2, ...otherStates], elem, index) => [
        folder1.nextState(state1, elem, index),
        folder2.nextState(state2, elem, index),
        ...Iter.fromIterable(otherStates).zipWith(
          (state, folder) => folder.nextState(state, elem, index),
          otherFolders
        )
      ],
      ([state1, state2, ...otherStates]) =>
        combineFun(
          folder1.stateToResult(state1),
          folder2.stateToResult(state2),
          ...Iter.fromIterable(otherStates).zipWith(
            (state, folder) => folder.stateToResult(state),
            otherFolders
          )
        ),
      ([state1, state2, ...otherStates], index) =>
        optPred(state1, index, folder1.escape) &&
        optPred(state2, index, folder2.escape) &&
        Iter.fromIterable(otherStates)
          .zipWith((state, folder) => optPred(state, index, folder.escape), otherFolders)
          .fold(andFolder)
    )
  }

  /**
   * Returns a Folder running the provided Folders are run in parallel.
   * The results are collected into an array.
   * Note: due to type system limitations only the type of the first other folder is kept
   * @typeparam A the input element type
   * @typeparam R the output type of the provided `firstFolder`
   * @typeparam R2 the output type of the provided `otherFolder`
   * @param folder1 a Folder taking the same type of elements
   * @param folder2 a Folder taking the same type of elements
   * @param otherFolders a number of Folders taking the same type of elements
   */
  export function combine<A, R, R2>(
    folder1: Folder<A, R>,
    folder2: Folder<A, R2>,
    ...otherFolders: Folder<A, unknown>[]
  ): Folder<A, [R, R2, ...unknown[]]> {
    return combineWith((...results) => results, folder1, folder2, ...otherFolders)
  }

  export function combineFixedWith<A, R, GR>(
    combineFun: (...results: [R, R, ...R[]]) => GR,
    folder1: Folder<A, R>,
    folder2: Folder<A, R>,
    ...otherFolders: Folder<A, R>[]
  ): Folder<A, GR> {
    return combineWith(combineFun, folder1, folder2, ...otherFolders)
  }

  export function combineFixed<A, R>(
    folder1: Folder<A, R>,
    ...otherFolders: NonEmpty<Folder<A, R>>
  ): Folder<A, [R, R, ...R[]]> {
    return combine(folder1, ...otherFolders) as Folder<A, [R, R, ...R[]]>
  }

  const andFolder: Folder<boolean, boolean> = GenFolder.create<boolean, boolean, boolean>(
    () => true,
    (state, value) => state && value,
    state => state
  )
}
