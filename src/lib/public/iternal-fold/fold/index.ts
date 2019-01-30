/**
 * @module iternal
 */

import {
  combine as _combine,
  combineWith as _combineWith
} from '../../../private/iternal-shared'
import { AnyIterable } from '../../constants'
import { AsyncIter } from '../../iternal-async'
import { Iter } from '../../iternal-sync'
import { FolderT, GenFolder } from '../gen-folder'

export namespace Fold {
  /**
   * Returns the result of applying the given `folder` to each element yielded by the given `iterable`
   * @typeparam the iterable element type
   * @typeparam R the folder result type
   * @param iterable an iterable yielding elements of type A
   * @param folder a folder taking elements of type A and returning a result of type R
   */
  export function fold<A, R>(iterable: Iterable<A>, folder: FolderT<A, R>): R {
    return Iter.fromIterable(iterable).fold(folder)
  }

  /**
   * Returns an Iter yielding the results of applying the given `folder` to each element yielded by the given `iterable`
   * @typeparam the iterable element type
   * @typeparam R the folder result type
   * @param iterable an iterable yielding elements of type A
   * @param folder a folder taking elements of type A and returning a result of type R
   */
  export function foldIter<A, R>(
    iterable: Iterable<A>,
    folder: FolderT<A, R>
  ): Iter<R> {
    return Iter.fromIterable(iterable).foldIter(folder)
  }

  /**
   * Returns the result of applying the given `folder` to each element yielded by the given `iterable`
   * @typeparam the iterable element type
   * @typeparam R the folder result type
   * @param iterable an async iterable yielding elements of type A
   * @param folder a folder taking elements of type A and returning a result of type R
   */
  export function foldAsync<A, R>(
    iterable: AnyIterable<A>,
    folder: FolderT<A, R>
  ): Promise<R> {
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
    folder: FolderT<A, R>
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
    ...otherFolders: FolderT<A, any>[]
  ): FolderT<A, GR> {
    return _combineWith(combineFun, folder1, folder2, ...otherFolders)
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
  export function combine<A, R, R2, GR extends [R, R2, ...unknown[]]>(
    folder1: FolderT<A, R>,
    folder2: FolderT<A, R2>,
    ...otherFolders: FolderT<A, unknown>[]
  ): FolderT<A, GR> {
    return _combine(folder1, folder2, ...otherFolders)
  }

  export function pipe<A, S, R, S2, R2>(
    folder1: GenFolder<A, S, R>,
    folder2: GenFolder<R, S2, R2>
  ): FolderT<A, R2> {
    return GenFolder.create(
      () => ({
        state1: folder1.createInitState(),
        state2: folder2.createInitState()
      }),
      (states, elem, index) => {
        states.state1 = folder1.nextState(states.state1, elem, index)
        states.state2 = folder2.nextState(
          states.state2,
          folder1.stateToResult(states.state1, index),
          index
        )
        return states
      },
      ({ state2 }, index) => folder2.stateToResult(state2, index),
      ({ state1, state2 }, index) =>
        (folder1.escape !== undefined && folder1.escape(state1, index)) ||
        (folder2.escape !== undefined && folder2.escape(state2, index))
    )
  }
}
