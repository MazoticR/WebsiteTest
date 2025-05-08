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

    const { token, shipmentId, pickTicketId, purchaseOrderId } = req.query;
    const time = Math.floor(Date.now() / 1000);

    // Normalize path
    const path = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/$/, '');

    const baseUrls = {
      shipments: 'https://secura.app.apparelmagic.com/api/shipments',
      pick_tickets: 'https://secura.app.apparelmagic.com/api/pick_tickets',
      purchase_orders: 'https://secura.app.apparelmagic.com/api/purchase_orders'
    };

    // Dynamic endpoint handling
    if (Object.keys(baseUrls).some(endpoint => path.startsWith(endpoint))) {
      const endpoint = Object.keys(baseUrls).find(e => path.startsWith(e));
      const idParam = {
        shipments: shipmentId,
        pick_tickets: pickTicketId,
        purchase_orders: purchaseOrderId
      }[endpoint];

      const url = idParam ? `${baseUrls[endpoint]}/${idParam}` : baseUrls[endpoint];
      
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