import fs from "fs"
import axios from "axios"
import { google } from "googleapis"

// get books from json

let books = JSON.parse(fs.readFileSync("./data/books.json"))

// find the number where id = "55250747-restore-me"

let book_id = "22733729-the-long-way-to-a-small-angry-planet"
let book = books[book_id]

try {
  // const search = await axios.request({
  //   method: "get",
  //   url: "https://www.googleapis.com/books/v1/volumes",
  //   params: {
  //     q: book.title+"+"+book.author,
  //     limit: 1
  //   }
  // })

  // let res = await axios.request({
  //   method: "get",
  //   url: search.data.items[0].selfLink
  // })

  // let info = res.data.volumeInfo

  // // series
  // console.log(info.seriesInfo)

  const book_api = google.books({
    version: "v1"
  })

  const search = await book_api.volumes.list({
    q: book.title+"+"+book.author,
    limit: 1
  })

  // open first book
  let res = await axios.request({
    method: "get",
    url: search.data.items[0].selfLink
  })

  let info = res.data.volumeInfo

  console.log(info)

} catch (error) {
  console.log(error)
}
