const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'history.json');

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '{}');
    return {};
  }
  const data = fs.readFileSync(HISTORY_FILE);
  return JSON.parse(data.toString());
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

exports.runAutomation = async (links) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--disable-setuid-sandbox', '--no-sandbox'],
  });

  const history = loadHistory();
  const today = new Date().toISOString().split('T')[0];

  if (!history[today]) {
    history[today] = [];
  }

  for (let url of links) {
    try {
      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1366, height: 768 });
      await page.goto(url, { waitUntil: 'networkidle2' });

      // Human-like behavior
      await sleep(getRandomInt(2000, 4000));
      await autoScroll(page);
      await sleep(getRandomInt(5000, 12000));

      // Log success
      history[today].push({
        url,
        visitedAt: new Date().toISOString(),
        status: 'success'
      });

      console.log(`Visited: ${url}`);

      await page.close();
    } catch (err) {
      console.error(`Failed to visit: ${url}`, err.message);
      history[today].push({
        url,
        visitedAt: new Date().toISOString(),
        status: 'failed'
      });
    }
  }

  saveHistory(history);
  await browser.close();
};