const { Iter, AsyncIter, Fold, Folds } = require('../../dist/iternal.umd.js')

// const valueIter = Iter.range(0, 10).patchFirstWhere(v => v > 1, 1)

// valueIter.foreach(console.log)
// console.log(Iter.range(0, 10).fold(Fold.findLastOpt(v => v < 0)))
// Iter.range(0, 10)
//   .interleaveAll(Iter.range(0, 5), Iter.range(10, 18))
//   .take(100)
//   .forEach(v => console.log(v))

// Iter.range(0, 10)
//   .foldIter(Fold.partition(v => v % 2 === 0))
//   .forEach(v => console.log(v))

// Iter.of(1, 2, 2, 3, 5, 4, 4, 1, 1, 1, 6)
//   .filterChanged()
//   .forEach(v => console.log(v))

// console.log(
//   Iter.fromIterable('This is a test a string')
//     .patchAt(10, 0, () => ' hello ')
//     .splitOnElem(' ')
//     .map(v => v.join(''))
//     .fold(Fold.inverseFrequencies())
// )

const r = Fold.combine(Folds.sum, Folds.count).mapResult(([sum, count]) => sum / count)

// console.log(r.apply(Iter.of(1, 3, 5, 3, 4)))

// Iter.of(1, 3, 5, 3, 4)
//   .foldIter(r)
//   .monitor()
// Iter.of(1, 3, 5, 3, 4)
//   .foldIter(Fold.average)
//   .monitor()
// console.log(
//   Fold.findOr('X', e => e === 'b')
//     .combine(Fold.findOr('Y', e => e === 'c'))
//     .apply(
//       Iter.fromIterable('abcdef')
//         .monitor()
//         .monitor()
//     )
// )
// console.log(Fold.findLastOr(undefined).apply('abc'))
Fold.foldIter('abcdef', Fold.combine(Folds.first(), Folds.elemAt(2, 'X'), Folds.last())).forEach(
  console.log
)
// .monitor()
// .map(a => true)
// .monitor()
// .forEach(console.log)

// async function run() {
//   while (true) {
//     await new Promise(resolve => setTimeout(resolve, 100))

//   }
// }

Iter.randomInt(0, 100)
  .repeat()
  .foldIter(Fold.combine(Folds.last(), Folds.sum, Folds.product, Folds.average))
  .map(
    ([value, sum, prod, avg]) =>
      `The latest value is ${value}. The current sum is ${sum}, the product ${prod} and the average ${avg}`
  )
  .take(5)
  .forEach(v => console.log(v))

// run()
// const chars = ' X'
// Iter.randomInt(0, chars.length)
//   .repeat()
//   .map(i => chars[i])
//   .sliding(80, 10)
//   .map(arr => arr.join(''))
//   .toAsync()
//   .delay(30)
//   .forEach(console.log)
