const axios = require('axios');

module.exports = async (req, res) => {
  try {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { token, shipmentId, pickTicketId } = req.query;
    const time = Math.floor(Date.now() / 1000);

    // Normalize path
    const path = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/$/, '');

    if (path.startsWith('shipments')) {
      const baseUrl = 'https://secura.app.apparelmagic.com/api/shipments';
      const url = shipmentId ? `${baseUrl}/${shipmentId}` : baseUrl;
      
      const response = await axios.get(url, {
        params: { token, time },
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return res.json(response.data);
    }

    if (path.startsWith('pick_tickets')) {
      const baseUrl = 'https://secura.app.apparelmagic.com/api/pick_tickets';
      const url = pickTicketId ? `${baseUrl}/${pickTicketId}` : baseUrl;
      
      const response = await axios.get(url, {
        params: { token, time },
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return res.json(response.data);
    }

    return res.status(404).json({ error: "Endpoint not found" });

  } catch (error) {
    console.error('Proxy error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({ 
      error: "Proxy request failed",
      message: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};
