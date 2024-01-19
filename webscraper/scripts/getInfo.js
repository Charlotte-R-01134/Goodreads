import { Cluster } from "puppeteer-cluster"
import fs from "fs"
import puppeteer from "puppeteer"

export default async function(books) {
  const getBookInfo = async ({page, data:book}) => {
    // const page = await browser.newPage()
    try {
      await page.goto(book.url)
  
      try {
        let titleSection = await page.$(".BookPageTitleSection")
        let series = await titleSection.$("h3 a")
        if (series) {
          book.series = await series.evaluate(node => node.textContent.trim())
          book.series_num = book.series.split(" #")[1]
          book.series = book.series.split(" #")[0]
        }
      } catch (error) {}
  
      const authors = new Set()
      try {
        let names = await page.$$(".ContributorLink__name")
        for (const author of names) {
          authors.add(await author.evaluate(node => node.textContent.trim()))
        }
      } catch (error) {}
      book.authors = Array.from(authors)

      // console.log(authors)
  
      const genres = []
      try {
        const genreContainer = await page.$$(".BookPageMetadataSection__genreButton")
        if (genreContainer) {
            for (const genre of genreContainer) {
                const button = await genre.$("span .Button__labelItem")
                genres.push(await button.evaluate(node => node.textContent.trim()))
            }
        } else {
          console.log("no genres")
        }
      } catch (error) {}
      book.genres = genres // doesn't work when in clusters
    } catch (error) {
      console.log(book.url)
      console.log(error)
    } finally {
      console.log(book)
      await page.close()
    }
    return book
  }

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 1,
    timeout: 120000, // 2 minutes
    puppeteerOptions: {
      headless: "new",
      defaultViewport: null,
      ignoreHTTPSErrors: true
    }
  })

  for (const book_id in books) {
    cluster.queue(books[book_id], getBookInfo)
  }

  cluster.on('taskerror', (err, data, willRetry) => {
    if (willRetry) {
      console.warn(`Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`);
    } else {
      console.error(`Failed to crawl ${data}: ${err.message}`);
    }
  })

  await cluster.idle()
  await cluster.close()

  // console.log(books)
  // const browser = await puppeteer.launch({
  //   headless: "new",
  //   defaultViewport: null,

  // })

  // for (let book_id in books) {
  //   books[book_id] = await getBookInfo(books[book_id])
  // }

  // await browser.close()

  fs.writeFile('books.json', JSON.stringify(books), function (err) {
    if (err) throw err
    console.log('Saved!')
  })
}