import puppeteer from "puppeteer"
import { Cluster } from "puppeteer-cluster"
import fs from "fs"

const path = "https://www.goodreads.com/review/list/141364798-char";

let startTime = performance.now()

const getBookInfo = async ({page, data: book}) => {
  console.log(book.url)
  try {
    await page.goto(book.url)

    try {
      const genreButton = await page.$('.BookPageMetadataSection__genres button')
      await genreButton.click();
    } catch (error) {
      
    }

    try {
      let titleSection = await page.$(".BookPageTitleSection")
      let series = await titleSection.$("h3 a")
      if (series) {
        book.series = await series.evaluate(node => node.textContent.trim())
        book.series_num = book.series.split(" #")[1]
        book.series = book.series.split(" #")[0]
      }
    } catch (error) {
      // console.log(error)
    }

    const authors = new Set()
    try {
      let names = await page.$$(".ContributorLink__name")
      for (const author of names) {
        authors.add(await author.evaluate(node => node.textContent.trim()))
      }
    } catch (error) {
      console.log(error)
    }
    book.authors = Array.from(authors)

    const genres = []
    try {
      const genreContainer = await page.$$(".BookPageMetadataSection__genreButton")
      // output html content
      if (genreContainer) {
          for (const genre of genreContainer) {
              const button = await genre.$("span .Button__labelItem")
              genres.push(await button.evaluate(node => node.textContent.trim()))
          }
      }
    } catch (error) {
      console.error(error)
    }
    book.genres = genres
  } catch (error) {
    console.log("Error: " + book.url)
    // console.log(error)
  } finally {
    await page.close()
  }
  return book
}

let book = {
  "url": "https://www.goodreads.com/book/show/6473592-gone"
}

const cluster = await Cluster.launch({
  concurrency: Cluster.CONCURRENCY_CONTEXT,
  maxConcurrency: 8,
  puppeteerOptions: {
    headless: "new",
    defaultViewport: null
  }
})


cluster.queue(book, getBookInfo)

await cluster.idle()
await cluster.close()

console.log(book)