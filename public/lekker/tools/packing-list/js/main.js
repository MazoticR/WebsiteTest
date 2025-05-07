let currentShipmentData = null;

// Toma de datos con control de errores
async function fetchShipment() {
  const shipmentId = document.getElementById('shipmentId').value.trim();
  if (!shipmentId) {
    showError("Please enter a Shipment ID");
    return;
  }

  // Reinicio UI
  document.getElementById('error').style.display = 'none';
  document.getElementById('processing').style.display = 'block';
  document.getElementById('results').innerHTML = '';
  document.getElementById('exportButtons').style.display = 'none';

  try {
    console.log(`Fetching shipment ${shipmentId}...`);
    const response = await fetch(`/api/shipments?token=6002f37a06cc09759259a7c5eabff471&shipmentId=${shipmentId}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.response || data.response.length === 0) {
      throw new Error("No shipment information found.");
    }
    
    const shipment = data.response[0];
    let customerPOs = [];
    
    // Procesado de pick tickets
    if (shipment.selected_pick_ticket_ids) {
      const pickTicketIds = normalizePickTicketIds(shipment.selected_pick_ticket_ids);
      
      if (pickTicketIds.length > 0) {
        console.log(`Fetching ${pickTicketIds.length} pick tickets...`);
        const pickTicketResponses = await Promise.all(
          pickTicketIds.map(id => 
            fetch(`/api/pick_tickets?token=6002f37a06cc09759259a7c5eabff471&pickTicketId=${id}`)
              .then(res => res.ok ? res.json() : null)
              .catch(() => null)
          )
        );
        
        customerPOs = extractCustomerPOs(pickTicketResponses);
      }
    }
    
    shipment.customer_po = customerPOs.length > 0 ? customerPOs.join(', ') : 'N/A';
    processShipmentData(shipment);
    
  } catch (error) {
    console.error("Fetch error:", error);
    showError(error.message);
  } finally {
    document.getElementById('processing').style.display = 'none';
  }
}

// Funcion de ayuda
function normalizePickTicketIds(ids) {
  if (Array.isArray(ids)) return ids.filter(Boolean);
  if (typeof ids === 'string') return ids.split(',').map(id => id.trim()).filter(Boolean);
  return [String(ids)].filter(id => id && !['null', 'undefined'].includes(id));
}

function extractCustomerPOs(responses) {
  const pos = new Set();
  responses.forEach(response => {
    const po = response?.response?.[0]?.customer_po?.trim();
    if (po) pos.add(po);
  });
  return Array.from(pos);
}


function processShipmentData(shipment) {
  const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL'];
  const SIZE_ALIASES = {
    '2XL': 'XXL',
    '3XL': 'XXXL',
    '4XL': 'XXXXL'
  };

  const groupedItems = {};
  const sizeTotals = {};
  const styleCount = new Set();
  
  shipment.boxes.forEach(box => {
    box.box_items.forEach(item => {
      let normalizedSize = item.size.toUpperCase().trim();
      normalizedSize = SIZE_ALIASES[normalizedSize] || normalizedSize;
      
      const quantity = parseInt(item.qty) || 0;
      const key = `${item.style_number}|${item.description}|${item.attr_2}|${normalizedSize}|${quantity}`;
      
      if (!groupedItems[key]) {
        groupedItems[key] = {
          style: item.style_number,
          description: item.description,
          color: item.attr_2,
          size: normalizedSize,
          originalSize: item.size,
          sizeOrder: SIZE_ORDER.indexOf(normalizedSize),
          qtyPerBox: quantity,
          totalQty: 0,
          boxes: []
        };
        styleCount.add(item.style_number);
      }
      
      groupedItems[key].totalQty += quantity;
      groupedItems[key].boxes.push(box.box_number);
    });
  });

  const sortedData = Object.values(groupedItems).sort((a, b) => {
    if (a.style !== b.style) return a.style.localeCompare(b.style);
    if (a.sizeOrder !== b.sizeOrder) return a.sizeOrder - b.sizeOrder;
    return b.qtyPerBox - a.qtyPerBox;
  });

  const displayData = sortedData.map(item => {
    const boxNumbers = Array.from(item.boxes).sort((a, b) => a - b);
    const boxRange = boxNumbers.length > 1 
      ? `${boxNumbers[0]}-${boxNumbers[boxNumbers.length - 1]}` 
      : boxNumbers[0];
      
    sizeTotals[item.size] = (sizeTotals[item.size] || 0) + item.totalQty;
    
    return {
      'Box Range': boxRange,
      '# Boxes': boxNumbers.length,
      'Qty/Box': item.qtyPerBox,
      'Style': item.style,
      'Description': item.description,
      'Color': item.color,
      'Size': item.originalSize,
      'Total Qty': item.totalQty
    };
  });

  currentShipmentData = {
    header: {
      customer: shipment.customer_name,
      address1: shipment.address_1 || '',
      address2: shipment.address_2 || '',
      city: shipment.city || '',
      state: shipment.state || '',
      zip: shipment.postal_code || '',
      country: shipment.country || '',
      shipmentId: shipment.id,
      date: shipment.date,
      customer_po: shipment.customer_po || 'N/A'
    },
    body: displayData,
    footer: {
      totalStyles: styleCount.size,
      totalBoxes: shipment.boxes.length,
      totalQty: displayData.reduce((sum, item) => sum + item['Total Qty'], 0),
      sizeTotals: sizeTotals
    }
  };

  displayResults();
}

function displayResults() {
  const { header, body, footer } = currentShipmentData;
  
  const addressLines = [
    header.address1,
    header.address2,
    `${header.city}, ${header.state} ${header.zip}`,
    header.country
  ].filter(line => line.trim() !== '');

  const headerHTML = `
    <div id="header">
      <h2>SHIP TO: ${header.customer}</h2>
      <div class="address" style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">
        ${addressLines.map(line => `<div>${line}</div>`).join('')}
      </div>
      <p>
        <strong>Shipment ID:</strong> ${header.shipmentId} | 
        <strong>Date:</strong> ${header.date} | 
        <strong>Customer PO:</strong> ${header.customer_po || 'N/A'}
      </p>
    </div>
  `;
  
  let tableHTML = '<table><tr>';
  Object.keys(body[0]).forEach(key => {
    tableHTML += `<th>${key}</th>`;
  });
  tableHTML += '</tr>';
  
  body.forEach(row => {
    tableHTML += `<tr data-size="${row['Size']}">`;
    Object.values(row).forEach(val => {
      tableHTML += `<td>${val}</td>`;
    });
    tableHTML += '</tr>';
  });
  tableHTML += '</table>';
  
  const footerHTML = `
    <div id="footer">
      <h3>SUMMARY</h3>
      <p><strong>Total Styles:</strong> ${footer.totalStyles} | 
         <strong>Total Boxes:</strong> ${footer.totalBoxes} | 
         <strong>Total Quantity:</strong> ${footer.totalQty}</p>
      <p><strong>Size Breakdown:</strong> 
        ${Object.entries(footer.sizeTotals)
          .map(([size, qty]) => `${size} (${qty})`)
          .join(', ')}
      </p>
    </div>
  `;
  
  document.getElementById('results').innerHTML = headerHTML + tableHTML + footerHTML;
  document.getElementById('exportButtons').style.display = 'block';
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}


// Iniciar
document.addEventListener('DOMContentLoaded', function() {
  const shipmentInput = document.getElementById('shipmentId');
  shipmentInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') fetchShipment();
  });
  shipmentInput.focus();
});

// Hacer las funciones disponibles
window.fetchShipment = fetchShipment;
window.currentShipmentData = currentShipmentData;
