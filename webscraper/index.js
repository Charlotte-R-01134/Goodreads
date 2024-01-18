import puppeteer from "puppeteer"
import { Cluster } from "puppeteer-cluster"
import fs from "fs"

const path = "https://www.goodreads.com/review/list/141364798-char";

let startTime = performance.now()

let books = {}

const getShelves = async () => {
  const page = await browser.newPage()

  await page.goto(path)
  let shelves = ["read", "currently-reading", "to-read"]

  let shelvesSection = await page.$eval("#paginatedShelfList", (shelfList) => {
    const dvs = shelfList.querySelectorAll("div");
    return Array.from(dvs).map((div) => div.textContent.trim().split('\u200e')[0].slice(0, -2));
  })

  for (const shelf of shelvesSection) {
    if(['Read', 'Currently Reading', 'Want to Read'].includes(shelf)) continue
    shelves.push(shelf)
  }

  // remove empty string
  shelves = shelves.filter(shelf => shelf !== "")

  await page.close();
  return shelves
}

let browser = await puppeteer.launch({
  headless: "new",
  defaultViewport: null,
  timeout: 0
})

let shelves = await getShelves()

await browser.close()

const cluster = await Cluster.launch({
  concurrency: Cluster.CONCURRENCY_CONTEXT,
  maxConcurrency: 4,
  timeout: 100000,
  puppeteerOptions: {
    headless: "new",
    defaultViewport: null
  }
})

const getPages = (total) => {
  let books_per_page = 30
  return Math.ceil(total / books_per_page)
}

const getBooksFromShelf = async ({ page, data: url}) => {
  let count = 0
  try {
    await page.goto(`${path}?shelf=${url}`)

    const textContent = await page.$eval('#infiniteStatus', element => element.textContent.trim());
    const pages = getPages(textContent.split(' ')[2])
    
    for (let i = 0, p = 1; i < pages; i++, p++) {    
      // scroll to bottom of page
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
        // wait for page to load
        return new Promise((resolve) => {
          setTimeout(resolve, 1000)
        })
      })
    }

    // count number of books
    let tbody = await page.$("#booksBody", {waitUntil: 'domcontentloaded'})
    // output number of books
    const trs = await tbody.$$("tr")

    for (const tr of trs) {
      // book_id = tr.find('td', class_='field title').find('a').get('href').split("/")[3]
      let book_id = await tr.$eval('td.field.title a', element => element.getAttribute('href').split("/")[3])
      if (!books[book_id]) {
        let ratings = await tr.$$eval("span.staticStars.notranslate span.p10", (stars) => stars)
        let rating = ratings.length
        
        let read = []
        try {
          read = await tr.$$eval("span.date_read_value", (dateElements) => {
            return dateElements.map(dateElement => dateElement.textContent.trim())
          })
        } catch (error) {}

        let pages = 0
        try {
          pages = await tr.$eval("td.field.num_pages div.value nobr", (element) => element.textContent.trim().split("\n")[0])
        } catch (error) {}

        try {
          books[book_id] = {
            "cover_url": await tr.$eval("td.field.cover img", (element) => element.getAttribute("src")),
            "title": await tr.$eval("td.field.title a", (element) => element.textContent.trim().split("\n")[0]),
            "series": null,
            "series_num": null,
            "authors": [],
            "pages": pages,
            "edition": await tr.$eval("td.field.format div.value", (element) => element.textContent.trim()),
            "publication_date": await tr.$eval("td.field.date_pub div.value", (element) => element.textContent.trim()),
            "avg_rating": await tr.$eval("td.field.avg_rating div.value", (element) => element.textContent.trim()),
            "rating": rating,
            "date_read": read,
            "shelves": [url],
            "genres": [],
            "url": "https://www.goodreads.com" + await tr.$eval("td.field.title a", (element) => element.getAttribute("href"))
          }
          count += 1
        } catch (error) {}
      } else {
        books[book_id].shelves.push(url)
        count += 1
      }
    }
  } finally {
    await page.close();
  }
  console.log(url + ": " + count)
}

const getBookInfo = async ({page, data: book}) => {
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
      if (genreContainer) {
          for (const genre of genreContainer) {
              const button = await genre.$("span .Button__labelItem")
              genres.push(await button.evaluate(node => node.textContent.trim()))
          }
      }
    } catch (error) {}
    book.genres = genres // doesn't work when in clusters
  } catch (error) {
    console.log("Error: " + book.url)
    console.log(error)
    console.log()
  } finally {
    await page.close()
  }
  return book
}

for (const shelf of shelves) {
  cluster.queue(shelf, getBooksFromShelf)
}

await cluster.idle()
await cluster.close()

const clusterInfo = await Cluster.launch({
  concurrency: Cluster.CONCURRENCY_CONTEXT,
  maxConcurrency: 10,
  timeout: 100000,
  puppeteerOptions: {
    headless: "new",
    defaultViewport: null
  }
})

// await cluster.idle()

for (const book_id in books) {
  clusterInfo.queue(books[book_id], getBookInfo)
  // cluster.queue(books[book_id], getBookInfo)
}

await clusterInfo.idle()
await clusterInfo.close()

fs.writeFile('books.json', JSON.stringify(books), function (err) {
  if (err) throw err
  console.log('Saved!')
})

let endTime = performance.now()

let minutes = Math.floor((endTime - startTime) / 60000)
let seconds = ((endTime - startTime) % 60000) / 1000

if (minutes > 0) {
  console.log(`Time elapsed: ${minutes} minutes ${seconds} seconds`)
} else {
  console.log(`Time elapsed: ${seconds} seconds`)
}
