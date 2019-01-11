# iternal

Provides a powerful API for native JS iterables and async iterables.

## Installation

`yarn add iternal`

## Usage

### Simple

```typescript
const allFolds = Folds.last().combine(Folds.sum, Folds.product, Folds.average)
const resultIter = Iter.randomInt(0, 100)
  .foldIter(allFolds)
  .map(
    ([value, sum, prod, avg]) =>
      `The latest value is ${value}. The current sum is ${sum}, the product ${prod} and the average ${avg}`
  )
resultIter.take(10).forEach(console.log)
```
