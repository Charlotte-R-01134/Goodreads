import getShelves from "./scripts/getShelves.js"
import getBooks from "./scripts/getBooks.js"
import getInfo from "./scripts/getInfo.js"

import fs from "fs"

let startTime = performance.now()

// await getShelves()

// get shelves from json
let shelves = JSON.parse(fs.readFileSync("./data/shelves.json"))

// await getBooks(shelves)

let books = JSON.parse(fs.readFileSync("./data/books.json"))

console.log(Object.keys(books).length)

// await getInfo(books)

let endTime = performance.now()

let minutes = Math.floor((endTime - startTime) / 60000)
let seconds = ((endTime - startTime) % 60000) / 1000

if (minutes > 0) {
  console.log(`Time elapsed: ${minutes} minutes ${seconds} seconds`)
} else {
  console.log(`Time elapsed: ${seconds} seconds`)
}
