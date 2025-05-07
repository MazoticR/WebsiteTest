let currentShipmentData = null;

const COMPANY_DATA = {
  secura: {
    name: "Secura Inc",
    address1: "22922 Los Alisos Blvd Ste K-359",
    address2: "Mission Viejo, California 92691-2856"
  },
  libertad: {
    name: "Libertad Inc", 
    address1: "22922 Los Alisos Blvd Ste K-359",
    address2: "Mission Viejo, California 92691-2856"
  }
};

async function fetchShipment() {
  const shipmentId = document.getElementById('shipmentId').value.trim();
  if (!shipmentId) {
    showError("Ingresa un Shipment ID");
    return;
  }

  document.getElementById('error').style.display = 'none';
  document.getElementById('processing').style.display = 'block';
  document.getElementById('labels-container').innerHTML = '';

  try {
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
      throw new Error("No se encontro informacion para ese shipment id.");
    }
    
    const shipment = data.response[0];
    let customerPOs = [];
    
    if (shipment.selected_pick_ticket_ids) {
      const pickTicketIds = normalizePickTicketIds(shipment.selected_pick_ticket_ids);
      
      if (pickTicketIds.length > 0) {
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
    processShipmentForLabels(shipment);
    
  } catch (error) {
    console.error("Fetch error:", error);
    showError(error.message);
  } finally {
    document.getElementById('processing').style.display = 'none';
  }
}

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

function processShipmentForLabels(shipment) {
  const boxes = {};
  
  shipment.boxes.forEach(box => {
    boxes[box.box_number] = {
      boxNumber: box.box_number,
      totalBoxes: shipment.boxes.length,
      items: [],
      styles: new Set(),
      sizes: {},
      colors: new Set()
    };
    
    box.box_items.forEach(item => {
      boxes[box.box_number].items.push({
        style: item.style_number,
        description: item.description,
        color: item.attr_2,
        size: item.size,
        qty: item.qty
      });
      
      boxes[box.box_number].styles.add(item.style_number);
      boxes[box.box_number].colors.add(item.attr_2);
      
      if (!boxes[box.box_number].sizes[item.size]) {
        boxes[box.box_number].sizes[item.size] = 0;
      }
      boxes[box.box_number].sizes[item.size] += parseInt(item.qty);
    });
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
      customer_po: shipment.customer_po || 'N/A',
      date: shipment.date,
      trackingNumber: shipment.tracking_number || 'N/A'
    },
    boxes: boxes
  };

  generateAllLabels();
}

function generateAllLabels() {
  const labelsContainer = document.getElementById('labels-container');
  labelsContainer.innerHTML = '';
  
  const { header, boxes } = currentShipmentData;
  const companyId = document.getElementById('company-select').value;
  const company = COMPANY_DATA[companyId];
  
  Object.values(boxes).forEach(box => {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
    
    const sizesDisplay = Object.entries(box.sizes)
      .map(([size, qty]) => `${size}:${qty}`)
      .join(' ');
    
    const totalQty = box.items.reduce((sum, item) => sum + parseInt(item.qty), 0);
    
   labelDiv.innerHTML = `
    <div class="label-header">
      <strong>FROM:</strong> ${company.name}<br>
      ${company.address1}<br>
      ${company.address2}
    </div>
    <div class="label-po"> CUSTOMER PO#: ${header.customer_po}</div>
	
    <div class="label-divider"></div> <!-- Visible line -->
	
     <div class="label-cartons">CARTON: ${box.boxNumber} of ${box.totalBoxes}</div>
    <div class="label-style">
      <div><strong>STYLE:</strong> ${Array.from(box.styles).join(', ')}</div>
      <div><strong>QTY:</strong> ${totalQty}</div>
      <div><strong>SIZES:</strong> ${sizesDisplay}</div>
      <div><strong>COLOR:</strong> ${Array.from(box.colors).join(', ')}</div>
    </div>
    
    <div class="label-divider"></div> <!-- Visible line -->
	
    <div class="label-ship-to">
      <div><strong>SHIP TO:</strong> ${header.customer}</div>
      ${header.address1 ? `<div>${header.address1}</div>` : ''}
      ${header.address2 ? `<div>${header.address2}</div>` : ''}
      <div>${header.city ? `${header.city}, ` : ''}${header.state} ${header.zip}</div>
      ${header.country ? `<div>${header.country}</div>` : ''}
    </div>
   <div class="label-footer">
	${new Date().toLocaleDateString()} <!-- Current date instead of shipment date -->
	</div>
  `;
  
    
    labelsContainer.appendChild(labelDiv);
  });
}

// Función auxiliar para truncar texto largo
function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

async function exportLabelsToPDF() {
    try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const labelWidth = 101.6;
    const labelHeight = 152.4;
    const posX = 10;
    const posY = 10;

    const options = {
      scale: 3,
      logging: true,
      useCORS: true,
      backgroundColor: null,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('.label').forEach(label => {
          label.style.width = `${labelWidth}mm`;
          label.style.height = `${labelHeight}mm`;
          // Ensure lines are visible in PDF
          clonedDoc.querySelectorAll('.label-divider').forEach(line => {
            line.style.backgroundColor = '#000000';
            line.style.height = '1px';
          });
        });
      }
    };

    const labels = document.querySelectorAll('.label');
    const pdfContainer = document.getElementById('pdf-container');
    pdfContainer.innerHTML = '';

    // Tamaño de la etiqueta en mm (4×6 pulgadas)
    //const labelWidth = 101.6;
    //const labelHeight = 152.4;
    
    // Posición en la hoja A4 (esquina superior izquierda)
   // const posX = 10; // Margen izquierdo 10mm
  //    const posY = 10; // Margen superior 10mm
/*
    const options = {
      scale: 3, // Alta resolución
      logging: true,
      useCORS: true,
      backgroundColor: null,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('.label').forEach(label => {
          label.style.width = `${labelWidth}mm`;
          label.style.height = `${labelHeight}mm`;
          label.style.padding = '5mm';
          label.style.boxSizing = 'border-box';
        });
      }
    };*/

    for (let i = 0; i < labels.length; i++) {
      if (i > 0) {
        pdf.addPage(); // Nueva página A4
      }
      
      const clone = labels[i].cloneNode(true);
      clone.className = 'label-pdf';
      pdfContainer.appendChild(clone);

      await new Promise(resolve => {
        html2canvas(clone, options).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          // Añadir imagen en posición X,Y con tamaño de etiqueta
          pdf.addImage(imgData, 'PNG', posX, posY, labelWidth, labelHeight);
          pdfContainer.removeChild(clone);
          resolve();
        });
      });
    }

    pdf.save('box-labels.pdf');
  } catch (error) {
    console.error("PDF Error:", error);
    showError("Error generando el PDF, por favor revisa la consola.");
  }
}

function printLabels() {
  window.print();
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function() {
  const shipmentInput = document.getElementById('shipmentId');
  shipmentInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') fetchShipment();
  });
  
  document.getElementById('print-btn').addEventListener('click', printLabels);
  shipmentInput.focus();
});

window.fetchShipment = fetchShipment;
window.printLabels = printLabels;
window.exportLabelsToPDF = exportLabelsToPDF;