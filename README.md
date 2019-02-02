# iternal

Provides a powerful API for native ES6 iterables and async iterables.

## Installation

`yarn add iternal`

## API Documentation

Generated by Typedoc:
https://vitoke.github.io/iternal/globals.html

## Usage

### Simple

```typescript
import { iter, Collectors } from 'iternal'

console.log(
  iter.of(1, 3, 5)
    .map(v => v * 2)
    .repeat(2)
    .toArray()
)

> result: [2, 6, 10, 2, 6, 10]


console.log(
  'The min and max value: ',
  iter([8, 3, 6, 7], [2, 10, 2]).collect(Collectors.range)
)

> result: The min and max value:  [ 3, 10 ]


console.log(
  'Average word length:',
  iter(['This', 'is', 'a', 'test'])
    .collect(
      Collectors.average.mapInput(word => word.length)
    )
)

> result: Average word length: 2.75
```

### Advanced

```typescript
import { iter, Collector, Collectors } from 'iternal'

// rangeBy returns the values for which the function gives the minimum and maximum value
const shortestAndLongestStringCollector = Collectors.rangeBy<string>(w => w.length)

// mapInput converts some input type into a type the collector understands
const averageStringLengthCollector = Collectors.average.mapInput<string>(w => w.length)

// We construct a string from the combination of the above two collectors
const verySpecificCollector = Collector.combineWith(
  ([shortest, longest], avgLen) =>
    `Shortest word: ${shortest}, longest word: ${longest}, average length: ${avgLen}`,
  shortestAndLongestStringCollector,
  averageStringLengthCollector
)

// We create an Iter iterable from a string split
const words = iter('This is a very normal sentence'.split(' '))

// Get the final result at once
console.log(words.collect(verySpecificCollector))

> result: Shortest word: a, longest word: sentence, average length: 4.166666666666666

// Get the results for each new word
words.collectIter(verySpecificCollector).forEach(v => console.log(v))

> result:
Shortest word: This, longest word: This, average length: 4
Shortest word: is, longest word: This, average length: 3
Shortest word: a, longest word: This, average length: 2.3333333333333335
Shortest word: a, longest word: This, average length: 2.75
Shortest word: a, longest word: normal, average length: 3.4
Shortest word: a, longest word: sentence, average length: 4.166666666666666
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
   copying data. Then, you can define a Collector that calculates over all the arrays at once without needing to
   combine intermediate results.

2. Iterables can be edited without actually creating an in-memory copied data structure. This means you can arbitrarily
   insert or remove elements at certain positions, you can map and filter the elements without doing anything in memory.
   You are basically creating imaginary structures that only materialize once you start iterating over the structure.

3. As mentioned before, Iterables can represent infinite data. For example, `iter.nats` represents all natural integers
   starting for 0. As long as you are not evaluating (e.g. collecting, or performing `.forEach()`) an infinite Iterable,
   you can safely use them in your code. They are very convenient for use cases like zipping or taking a limited amout.

### Iterables vs Iterators

`iternal` does its best to stick to only the `(Async)Iterable` interfaces, and keep the `(Async)Iterators` under the surface.

Why?

`Iterables` are predictable and should in principle result in the same values every time an iterable is iterated over.
On the contrast, `Iterators` have a hidden state, meaning that they can be partially consumed. This can have undesired effects, since using the same `Iterator` multiple times can give different results. Except for Iterables that depend on impure inputs
(like e.g. `iter.randomInt()`), `Iterables` should always return the same values. This keeps code functional, pure, and
thus predictable.

The result is that `Iter` and `AsyncIter` provide a predicable and pure functional API on top of Iterables.

## Collect your results

A Collector is a very powerful concept, present in languages like Java. It is related to
Reducers, which since React have become more popular.

A Collector specifies a start state, and a combination function taking some element, and producing a new state. This makes
a Collector very similar to a `for` loop. Most `for` loops start with some initial values, then loop over something iterable,
while modifying the initial values, and, once the iterable is done, return some results based on the final state of the
variables.

However, because, in contrast to a `for` loop, a Collector is just an object, it can be re-used and composed. This means that,
once you have written a Collector, you can use it on any iterable object, and you can compose it with other Collectors that
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

Here we have written 2 functions that can get the sum and product of an array of integers. But what if we want both?
We can write something like `const [sum, product] = [getSum(someArray), getProduct(someArray)]` but this will process
the array twice. That should not be necessary. The only way to do it in the above way is to write a new function that
loops over the array once and calculates both results at once.

Now, using Collectors:

```typescript
// already defined as Collectors.sum
const sumCollector = Collector.createMono({ init: 0, next: (state, value) => state + value })

// already defined as Collectors.product
const productCollector = Collector.createMono({ init: 1, next: (state, value) => state * value })

const [sum, product] = iter(someArray).collect(Collector.combine(sumCollector, productCollector))
```

Here, `createMono` just means a Collector of which the state type is the same as its input and output type (called
Monoid in functional programming).

Now that we have written these Collectors, we can also reuse the logic in many different ways. Imagine that we want
to calculate the sum of all lengths of words in an array. We cannot directly use the `sumCollector` defined above,
since it doesn't handle strings as input. Instead of converting our array of strings to an array with the lengths of the
words, we can modify the our Collect to do this input conversion 'on the fly':

```typescript
const wordLengthSum = sumCollector.mapInput(word => word.length)

const totalLength = iter(arrayOfStrings, someOtherArrayOfStrings).collect(wordLengthSum)
```

And again, we can use `Collector.combine` if we want to get multiple results for the array:

```typescript
const wordLengthAverage = Collectors.average.mapInput(word => word.length)

const [totalLength, averageLength] = iter(arrayOfStrings).collect(
  Collector.combine(wordLengthSum, wordLengthAverage)
)
```

`iternal` even defines many input modifiers for Collectors that help modifying the input, for exampe:

```typescript
const aCollector = Collectors.average
  .mapInput<string>(word => word.length)
  .sampleInput(2)
  .dropInput(1)
  .appendInput('test', 'foo')
  .filterInput(word => word.length > 2)
```

This collector will take the average word lengths of the input words, where the input is modified as follows:

- `mapInput` indicates that strings are taken as input, but the length is taken for the average collector
- `filterInput` removes all words with length less than 3
- `appendInput` adds the words 'test' and 'foo' to the input
- `dropInput` skips the first input words
- `sampleInput` takes every 2nd word of the input

It is interesting to note here that, as the list indicates, most of these operations should be read in backward order, since we are transforming are transforming a given input stream towards our desired input stream.

Hopefully you see that you now probably never have to write a `for` loop over some Iterable again.

### Advanced topic: More powerful and efficient Collectors

A collector is very similar to a function called `fold` or `reduce` in functional programming. However, it solves some of the
issues that the functional `fold` method has. Issues of the `fold` method compared to a `for` loop are:

1. A functional fold's state type is also the result type, meaning that the state cannot be some intermediate value from which
   a result is derived.
2. A functional fold always has to process all values of the iterable, even if its result can never change regardless of future inputs. This can be inefficient, but also makes it impossible to fold infinite iterables.
3. A functional fold cannot use mutable objects in its state, since the object would be reused for every future fold and thus
   cause unwanted side-effects.

Let's see how the `iternal` library solves these three drawbacks.

#### Intermediate state

In `iternal`, you can define a function that maps the collector's state to a result of a different type. Imagine the following
`for` loop:

```typescript
function sumIsPrime(someArray) {
  let value = 0

  for (const elem of someArray) value += elem

  return isPrime(value)
}
```

As a Collector:

```typescript
const sumIsPrime = Collector.createMono({ init: 0, next: (state, elem) => state + elem, isPrime })
```

You can actually also do this after the fact with an existing Collector:

```typescript
const sumIsPrime2 = sumCollector.mapResult(isPrime)
```

#### Intermediate return

In `iternal` you can define an 'escape' condition, indicating that the state will never change, and thus iteration can be
interrupted. Let's look at the following `for` loop:

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
const efficientProduct = Collector.createMono({ init: 0, next: (state, value) => state * value, state => state === 0 })
```

Now, we can run this collector on infinite streams (but only if they somewhere meet the escape condition):

```typescript
iter.range(-100).collect(efficientProduct)
>> returns 0

// We use the 'inefficient' productCollector we defined earlier
iter.range(-100).collect(productCollector)
>> never returns, since it has no escape
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

However, let's see what happens using a naive Collector:

```typescript
const createObject = Collector.create({
  init: {},
  next: (state, key) => {
    state[key] = 'init'
    return state
  }
})

const result1 = iter(['a', 'b']).collect(createObject)
> result1 = { a: 'init', b: 'init' }

const result2 = iter(['c']).collect(createObject)
> result2 = { a: 'init', b: 'init', c: 'init' }
```

Ouch, what went wrong here?

Well, since we specified our Collector as a constant that has some object as its initial state, this object will
be used across all collect requests, meaning the object will keep collecting new values in this one only object.

Obviously, that is not desirable.

To fix such cases, you can optionally provide a constructor function as the initial state. `iternal` will recognize
this constructor function, and then create a new object every time the Collector is used:

```typescript
const fixedCreateObject = Collector.create({
  init: () => ({}),
  next: (state, key) => {
  state[key] = 'init'
  return state
  }
})

const result1 = iter(['a', 'b']).collect(fixedCreateObject)
> result1 = { a: 'init', b: 'init' }

const result2 = iter(['c']).collect(fixedCreateObject)
> result2 = { c: 'init' }
```

## Conclusion

I hope to have shown you how powerful and efficient `iternal` can be as a library, and that it should
not be needed to ever write a `for` loop again.

This quick tutorial only scratches the surface of what is possible, since there is also the `AsyncIter`
interface that provides almost the same API as `Iter` but then for asynchronous iterables. The possibilities
are literally endless :)

## Author

Arvid Nicolaas

# Have fun!
