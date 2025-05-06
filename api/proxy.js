const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const { token, shipmentId, pickTicketId } = req.query;
    const time = Math.floor(Date.now() / 1000);
    
    // Shipments endpoint
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

    // Pick tickets endpoint
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