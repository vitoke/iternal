import { Iter, Fold, Folds } from '..'

// Simple

console.log(
  Iter.of(1, 3, 5)
    .map(v => v * 2)
    .toArray()
)

console.log('The min and max value: ', Fold.fold([8, 3, 6, 7], Folds.range))

console.log(
  'Average word length:',
  Fold.fold(['This', 'is', 'a', 'test'], Folds.average.mapInput(w => w.length))
)

// Advanced

// rangeBy returns the values for which the function gives the minimum and maximum value
const shortestAndLongestStringFolder = Folds.rangeBy<string>(w => w.length)

// mapInput converts some input type into a type the folder understands
const averageStringLengthFolder = Folds.average.mapInput<string>(w => w.length)

// We construct a string from the combination of the above two folders
const verySpecificFolder = Fold.combineWith(
  ([shortest, longest], avgLen) =>
    `Shortest word: ${shortest}, longest word: ${longest}, average length: ${avgLen}`,
  shortestAndLongestStringFolder,
  averageStringLengthFolder
)

// We create an Iter iterable from a string split
const words = Iter.fromIterable('This is a very normal sentence'.split(' '))

// Get the final result at once
console.log(words.fold(verySpecificFolder))

// Get the results for each new word
words.foldIter(verySpecificFolder).forEach(v => console.log(v))
