const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

// Add at the top of your server.js
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Load history from JSON file
function loadHistory() {
  const historyPath = path.join(__dirname, 'history.json');
  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, '{}');
    return {};
  }
  const data = fs.readFileSync(historyPath);
  return JSON.parse(data.toString());
}

// Bot logic
const bot = require('./bot');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Home Route
app.get('/', (req, res) => {
  const history = loadHistory();
  res.render('dashboard', { status: '', history });
});

// Run Automation
app.post('/run', async (req, res) => {
  const links = req.body.links.split('\n').map(link => link.trim()).filter(Boolean);
  if (links.length === 0) return res.send("Please enter valid URLs");

  await bot.runAutomation(links);

  const history = loadHistory();
  res.render('dashboard', { status: `Visited ${links.length} links successfully!`, history });
});

// SEO Tools Page
app.get('/seo', (req, res) => {
  res.render('seo', { result: '' });
});

// Fake Keyword Suggestions
function getKeywordSuggestions(keyword) {
  const base = [
    `${keyword} courses`,
    `${keyword} colleges`,
    `${keyword} entrance exam`,
    `best ${keyword} institute`,
    `${keyword} scope`,
    `how to become a ${keyword}`,
    `${keyword} jobs`,
    `${keyword} salary`,
    `${keyword} syllabus`,
    `${keyword} eligibility`
  ];
  return base.slice(0, 5);
}

// Handle Keyword Research
app.post('/suggest-keywords', (req, res) => {
  const keyword = req.body.keyword.trim();
  if (!keyword) return res.redirect('/seo');

  const suggestions = getKeywordSuggestions(keyword).join('\n');
  const output = `🎯 Top Keywords Related to "${keyword}":\n\n${suggestions}`;
  res.render('seo', { result: output });
});

// Handle Meta Tag Generation
app.post('/generate-meta', (req, res) => {
  const content = req.body.content.trim().toLowerCase();
  if (!content) return res.redirect('/seo');

  const words = content.split(/\s+/);
  const topWords = [...new Set(words)].filter(w => w.length > 4).slice(0, 5);

  const metaTitle = `${topWords.join(' ')} | SearchMyColleges`;
  const metaDescription = content.substring(0, 160) + '...';

  const output = `🏷️ Meta Title:\n${metaTitle}\n\n📝 Meta Description:\n${metaDescription}`;
  res.render('seo', { result: output });
});

// History Page
app.get('/history', (req, res) => {
  const history = loadHistory();
  res.render('history', { history });
});

// Export as CSV
app.get('/history.csv', (req, res) => {
  const history = loadHistory();

  if (Object.keys(history).length === 0) {
    return res.status(404).send('No history found to export.');
  }

  let csv = 'Date,URL,Visited At,Status\n';

  Object.entries(history).forEach(([date, entries]) => {
    entries.forEach(entry => {
      const visitedAt = new Date(entry.visitedAt).toLocaleString();
      csv += `"${date}","${entry.url}","${visitedAt}","${entry.status}"\n`;
    });
  });

  res.header('Content-Type', 'text/csv');
  res.header('Content-Disposition', 'attachment; filename=automation-history.csv');
  res.send(csv);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

app.post('/start', async (req, res) => {
    try {
        const url = req.body.url;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Update history before processing
        const history = loadHistory();
        const today = new Date().toISOString().split('T')[0];
        if (!history[today]) {
            history[today] = [];
        }
        
        const entry = {
            url: url,
            visitedAt: new Date().toISOString(),
            status: 'Processing'
        };
        
        history[today].push(entry);
        fs.writeFileSync(path.join(__dirname, 'history.json'), JSON.stringify(history, null, 2));

        const browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080'
            ],
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
        });

        const page = await browser.newPage();
        console.log('Navigating to:', url);
        
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Update history after successful processing
        entry.status = 'Completed';
        fs.writeFileSync(path.join(__dirname, 'history.json'), JSON.stringify(history, null, 2));
        
        await browser.close();
        res.json({ success: true, message: 'Processing completed' });
    } catch (error) {
        console.error('Error:', error);
        // Update history with error status
        if (entry) {
            entry.status = 'Failed';
            fs.writeFileSync(path.join(__dirname, 'history.json'), JSON.stringify(history, null, 2));
        }
        res.status(500).json({ error: error.message });
    }
});