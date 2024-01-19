import puppeteer from "puppeteer"
import fs from "fs"

// path string from config.json
const path = JSON.parse(fs.readFileSync("./data/config.json")).path

export default async function() {

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

  fs.writeFileSync("./data/shelves.json", JSON.stringify(shelves, null, 2))
  console.log("Saved!")

}