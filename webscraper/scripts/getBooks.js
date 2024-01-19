import { Cluster } from "puppeteer-cluster"
import fs from "fs"

const path = JSON.parse(fs.readFileSync("./data/config.json")).path

export default async function(shelves) {
  console.log(shelves)
  let books = {}

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

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 4,
    timeout: 100000,
    puppeteerOptions: {
      headless: "new",
      defaultViewport: null
    }
  })

  for (const shelf of shelves) {
    cluster.queue(shelf, getBooksFromShelf)
  }
  
  await cluster.idle()
  await cluster.close()

  fs.writeFile('./data/books.json', JSON.stringify(books), function (err) {
    if (err) throw err
    console.log('Saved!')
  })
}