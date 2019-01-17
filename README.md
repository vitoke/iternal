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

## Motivation

ES6 Iterables are awesome, but miss some basic functionality that e.g. Arrays have, like `.map` and
`.filter`.

At the same time, Iterables in some ways are more powerful than Arrays, in that they can represent infinite data
because by nature they are lazy. This means that each next element is evaluated only when requested. The drawback
compared to Arrays is that Iterables are not indexed, so getting the nth element requires iterating over all n
elements.

### Why then are Iterables so great?

1. Iterables can be combined lazily, without needing to create intermediate structures.
   Imagine that you have 2 or more large arrays of data, and you want to perform some calculation over all of them.
   Normally you can choose either to copy all data into one large array and perform the calculation over this array,
   or you can write a function that takes an array and returns an intermediate value, and then combine the results
   of all the arrays. Using Iterables, you can concatenate the arrays, creating a 'virtual' large array without actually
   copying data. Then, you can define a Fold operation that calculates over all the arrays at once without needing to
   combine intermediate results.

2. Iterables can be edited without actually creating an in-memory copied data structure. This means you can arbitrarily
   insert or remove elements at certain positions, you can map and filter the elements without doing anything in memory.
   You are basically creating imaginary structures that only materialize once you start iterating over the structure.

3. As mentioned before, Iterables can represent infinite data. For example, `Iter.nats` represents all natural integers
   starting for 0. As long as you are not evaluating (e.g. folding, or performing `.forEach()`) an infinite Iterable,
   you can safely use them in your code. They are very convenient for use cases like zipping or taking a limited amout.

### Iterables vs Iterators

`iternal` does its best to stick to only the `(Async)Iterable` interfaces, and keep the `(Async)Iterators` under the surface.

Why?

`Iterables` are predictable and should in principle result in the same values every time an iterable is iterated over.
On the contrast, `Iterators` have a hidden state, meaning that they can be partially consumed. This can have undesired effects, since using the same `Iterator` multiple times can give different results. Except for Iterables that depend on impure inputs
(like e.g. `Iter.randomInt()`), `Iterables` should always return the same values. This keeps code functional, pure, and
thus predictable.

The result is that `Iter` and `AsyncIter` provide a predicable and pure functional API on top of Iterables.

## Use the Fold

A Fold is a very powerful concept from functional programming that is, in my opinion, underused. It is related to
Reducers, which since React have become more popular.

A Fold specifies a start state, and a combination function taking some element, and producing a new state. This makes
a Fold very similar to a `for` loop. Most `for` loops start with some initial values, then loop over something iterable,
while modifying the initial values, and, once the iterable is done, return some results based on the final state of the
variables.

However, because, in contrast to a `for` loop, a Fold is just an object, it can be re-used and composed. This means that,
once you have written a Fold object, you can use it on any iterable object, and you can compose it with other Folds that
will run in 'parallel'. This is impossible using basic `for` loops. That's a major boost to re-usable components.

Let's take some examples:

```typescript
function getSum(array) {
  let sum = 0
  for (const value of array) sum += value
  return sum
}

function getProduct(array) {
  let product = 1
  for (const value of array) product *= value
  return product
}
```

Here we have written 2 functions that can get the sum and average of an array of integers. But what if we want both?
We can write something like `const [sum, product] = [getSum(someArray), getProduct(someArray)]` but this will process
the array twice. That should not be necessary.

Now, using Folds:

```typescript
// already defined as Folds.sum
const sumFolder = MonoFolder.create(0, (state, value) => state + value)

// already defined as Folds.product
const productFolder = MonoFolder.create(1, (state, value) => state * value)

const [sum, product] = Fold.fold(someArray, Fold.combine(sumFolder, productFolder))
```

Here, `MonoFolder` just means a `Folder` of which the state type is the same as its input and output type (called
Monoid in functional programming).

Now that we have written these Folds, we can also reuse the logic in many different ways. Imagine that we want
to calculate the sum of all lengths of words in an array. We cannot directly use the `sumFold` defined above,
since it doesn't handle strings. Instead of converting our array of strings to an array with the lengths of the
words, we can modify the our Fold to do this conversion 'on the fly':

```typescript
const wordLengthSum = sumFolder.mapInput(s => s.length)

const totalLength = Fold.fold(arrayOfStrings, wordLengthSum)
```

And again, we can use `Fold.combine` if we want to get multiple results for the array:

```typescript
const wordLengthAverage = Folds.average.mapInput(s => s.length)

const [totalLength, averageLength] = Fold.fold(arrayOfStrings, Fold.combine(wordLengthSum, wordLengthAverage)
```

Hopefully you see that you now probably never have to write a `for` loop over some Iterable again.

### Advanced topic: More powerful and efficient Folds

The typical functional fold has the benefits descriped above, but also has a number of drawbacks compared to `for` loops:

1. A functional fold's state type is also the result type, meaning that the state cannot be some intermediate value from which
   a result is derived.
2. A functional fold always has to process all values of the iterable, even if its result can never change regardless of future inputs. This can be inefficient, but also makes it impossible to fold infinite iterables.
3. A functional fold cannot use mutable objects in its state, since the object would be reused for every future fold and thus
   cause unwanted side-effects.

Let's see how the `iternal` library solves these three drawbacks.

#### Intermediate state

In `iternal`, you can define a function that maps the folder's state to a result of a different type. Imagine the following
`for` loop:

```typescript
function sumIsPrime(someArray) {
  let value = 0

  for (const elem of someArray) value += elem

  return isPrime(value)
}
```

As a Folder:

```typescript
const sumIsPrime = Folder.create(0, (state, elem) => state + elem, isPrime)
```

You can actually also do this after the fact with an existing Folder:

```typescript
const sumIsPrime2 = sumFolder.mapResult(isPrime)
```

#### Intermediate return

In `iternal` you can define an 'escape' condition, indicating that the state will never change, and thus iteration can be
interrupted.

```typescript
function getEfficientProduct(array) {
  let product = 1
  for (const value of array) {
    // if any value equals 0 the result will always be 0
    if (value === 0) return 0
    product *= value
  }
}
```

We can express the `return` condition in `iternal` by supplying an `escape` predicate as follows:

```typescript
const efficientProduct = MonoFolder.create(0, (state, value) => state * value, state => state === 0)
```

Now, we can run this folder on infinite streams (but only if they somewhere meet the escape contidion):

```typescript
Iter.range(-100).fold(efficientProduct)
>> returns 0

Iter.range(-100).fold(productFolder)
>> never returns
```

#### Using mutable state

Imagine that you need to create some Object from an iterable like the following `for` loop:

```typescript
function createObject(array) {
  let object = {}
  for (const key of array) {
    object[key] = 'init'
  }
  return object
}
```

Everytime you call this `createObject` function, you will receive a new object, which is what you expect.

However, let's see what happens using a naive Folder:

```typescript
const createObject = Folder.create({}, (state, key) => {
  state[key] = 'init'
  return state
})

const result1 = Fold.fold(['a', 'b'], createObject)
> result1 = { a: 'init', b: 'init' }

const result2 = Fold.fold(['c', createObject])
> result2 = { a: 'init', b: 'init', c: 'init' }
```

Ouch, what went wrong here?

Well, since we specified our Folder as a constant that has some object as its initial state, this object will
be used across all folds, meaning the object will keep collecting new values in this one only object.

Obviously, that is not desirable.

To fix such cases, you can optionally provide a constructor function as the initial state. `iternal` will recognize
this constructor function, and then create a new object every time the Folder is used:

```typescript
const fixedCreateObject = Folder.create(() => ({}), (state, key) => {
  state[key] = 'init'
  return state
})

const result1 = Fold.fold(['a', 'b'], fixedCreateObject)
> result1 = { a: 'init', b: 'init' }

const result2 = Fold.fold(['c', fixedCreateObject])
> result2 = { c: 'init' }
```

## Conclusion

I hope to have shown you how powerful and efficient `iternal` can be as a library, and that it should
not be needed to ever write a `for` loop again.

This quick tutorial only scratches the surface of what is possible, since there is also the `AsyncIter`
interface that provides almost the same API as `Iter` but then for asynchronous iterables. The possibilities
are literally endless :)

# Have fun!
