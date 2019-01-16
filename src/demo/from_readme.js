const { Iter, Fold, Folds } = require('../../dist/iternal.umd.js')

console.log('The average: ', Fold.fold([0, 8, 6, 7], Folds.average))

Iter.randomInt(0, 100)
  .repeat()
  .foldIter(Fold.combine(Folds.last(), Folds.sum, Folds.product, Folds.average))
  .map(
    ([value, sum, prod, avg]) =>
      `The latest value is ${value}. The current sum is ${sum}, the product ${prod} and the average ${avg}`
  )
  .take(5)
  .forEach(v => console.log(v))
