const axios = require('axios');
const express = require('express');
const app = express();

// Your existing API proxy
const apiProxy = async (req, res) => {
  try {
    const { token, shipmentId, pickTicketId } = req.query;
    const time = Math.floor(Date.now() / 1000);
    
    if (req.url.includes('/shipments')) {
      const url = shipmentId 
        ? `https://secura.app.apparelmagic.com/api/shipments/${shipmentId}`
        : 'https://secura.app.apparelmagic.com/api/shipments';
      
      const response = await axios.get(url, { 
        params: { token, time },
        headers: { 'Accept': 'application/json' }
      });
      return res.json(response.data);
    }

    if (req.url.includes('/pick_tickets')) {
      const url = pickTicketId
        ? `https://secura.app.apparelmagic.com/api/pick_tickets/${pickTicketId}`
        : 'https://secura.app.apparelmagic.com/api/pick_tickets';
      
      const response = await axios.get(url, {
        params: { token, time },
        headers: { 'Accept': 'application/json' }
      });
      return res.json(response.data);
    }

    res.status(404).json({ error: "Endpoint not found" });
  } catch (error) {
    res.status(500).json({ 
      error: "Proxy error",
      details: error.message 
    });
  }
};

// New Notion embed route
app.get('/notion-embed', async (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Packing List Tool</title>
        <style>
          body { 
            font-family: Arial;
            text-align: center;
            padding: 40px;
            background: #f7f7f7;
          }
          iframe {
            border: 1px solid #ddd;
            border-radius: 8px;
            width: 100%;
            height: 600px;
          }
        </style>
      </head>
      <body>
        <h2>📦 Packing List Tool</h2>
        <iframe src="/tools/packing-list"></iframe>
        <p><small>Having issues? <a href="/tools/packing-list" target="_blank">Open in new tab</a></small></p>
      </body>
    </html>
  `);
});

// Existing API routes
app.get('/api/shipments', apiProxy);
app.get('/api/pick_tickets', apiProxy);

// Serve static files (HTML/CSS/JS)
app.use(express.static('public'));

module.exports = app;
