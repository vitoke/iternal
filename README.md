# iternal

Provides a powerful API for native ES6 iterables and async iterables.

## Installation

`yarn add iternal`

## Usage

### Simple

```typescript
import { Fold, Folds } from 'iternal'

console.log('The average: ', Fold.fold([0, 8, 6, 7], Folds.average))

result: The average: 5.25
```

### Advanced

```typescript
import { Iter, Fold, Folds } from 'iternal'

Iter.randomInt(0, 100)
  .repeat()
  .foldIter(Fold.combine(Folds.last(), Folds.sum, Folds.product, Folds.average))
  .map(
    ([value, sum, prod, avg]) =>
      `The latest value is ${value}. The current sum is ${sum}, the product ${prod} and the average ${avg}`
  )
  .take(5)
  .forEach(v => console.log(v))

result: (example output)
The latest value is 49. The current sum is 49, the product 49 and the average 49
The latest value is 66. The current sum is 115, the product 3234 and the average 57.5
The latest value is 3. The current sum is 118, the product 9702 and the average 39.33333333333333
The latest value is 54. The current sum is 172, the product 523908 and the average 43
The latest value is 99. The current sum is 271, the product 51866892 and the average 54.2
```
