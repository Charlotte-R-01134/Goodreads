import axios from "axios"
import fs from "fs"
import { google } from "googleapis"

const apiKey = process.env.apiKey

export default async function(books) {
  const getInfo = async (book) => {
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

      const search = await book_api.volumes.list({
        q: book.title+"+"+book.author,
        limit: 1
      })

      let res = await axios.request({
        method: "get",
        url: search.data.items[0].selfLink
      })

      let info = res.data.volumeInfo

      let genres = new Set()
      if (info.categories) {
        for (const category of info.categories) {
          let split = category.split(" / ")
          for (const genre of split) {
            genres.add(genre.toLowerCase())
          }
        }
      }
      book.genres = Array.from(genres)

      book.authors = info.authors
    } catch (error) {
      console.log(error)
      count += 1
    }

    books[book.book_id] = book
  }

  let count = 0
  let i = 0

  const book_api = google.books({
    version: "v1",
    auth: apiKey
  })

  for (let book_id in books) {
    await getInfo(books[book_id])
    i += 1
    console.log(`${i} / ${Object.keys(books).length}`)
    console.log(`Failed: ${count}`)
  }

  fs.writeFileSync("books.json", JSON.stringify(books))

}

