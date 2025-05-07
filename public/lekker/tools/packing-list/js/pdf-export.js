function exportToPDF() {
  const { header, body, footer } = currentShipmentData;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Cabezal
  doc.setFontSize(16);
  doc.text(`Packing List - ${header.customer}`, 20, 15, { align: 'left' });
  
  // Direccion
  doc.setFontSize(10);
  const addressLines = [
    header.address1,
    header.address2,
    `${header.city}, ${header.state} ${header.zip}`,
    header.country
  ].filter(line => line.trim() !== '');
  
  let addressY = 25;
  const leftMargin = 20;
  addressLines.forEach(line => {
    doc.text(line, leftMargin, addressY, { align: 'left' });
    addressY += 5;
  });

  // Informacion de envio
  doc.text(
    `Shipment ID: ${header.shipmentId} | Date: ${header.date} | Customer PO: ${header.customer_po || 'N/A'}`,
    105,
    addressY + 5,
    { align: 'center' }
  );

  // Tabla principal
  const tableWidth = 148;
  doc.autoTable({
    head: [['Box Range', 'Qty/Box', 'Style', 'Description', 'Color', 'Size', 'Total Qty']],
    body: body.map(row => [
      row['Box Range'],
      row['Qty/Box'],
      row['Style'],
      row['Description'],
      row['Color'],
      row['Size'],
      row['Total Qty']
    ]),
    startY: addressY + 12,
    margin: { left: 31, right: 31 },
    tableWidth: 148,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      valign: 'middle',
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    headerStyles: {
      fillColor: [233, 236, 239],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 3,
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 15 },
      2: { cellWidth: 20 },
      3: { cellWidth: 38 },
      4: { cellWidth: 15 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 }
    },
    bodyStyles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: 'center'
    }
  });

  // Tabla del breakdown
  const sizeBreakdown = calculateSizeBreakdown(body);
  const summaryStartY = doc.lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text('Size Breakdown Summary', 105, summaryStartY, { align: 'center' });

  doc.autoTable({
    startY: summaryStartY + 5,
    margin: { left: 6.5 },
    tableWidth: 180,
    head: [[
      { content: 'Style#', styles: { cellWidth: 20 } },
      { content: 'Style Description', styles: { cellWidth: 40 } },
      { content: 'COLOR CODE', styles: { cellWidth: 20 } },
      { content: 'XS', styles: { cellWidth: 12 } },
      { content: 'S', styles: { cellWidth: 12 } },
      { content: 'M', styles: { cellWidth: 12 } },
      { content: 'L', styles: { cellWidth: 12 } },
      { content: 'XL', styles: { cellWidth: 12 } },
      { content: '2XL', styles: { cellWidth: 12 } },
      { content: '3XL', styles: { cellWidth: 12 } },
      { content: '4XL', styles: { cellWidth: 12 } },
      { content: 'TOTAL UNITS', styles: { cellWidth: 20 } }
    ]],
    body: sizeBreakdown.rows,
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      valign: 'middle',
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 5
    },
    headerStyles: {
      fillColor: [233, 236, 239],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0.3,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 35 },
      2: { cellWidth: 20 },
      3: { cellWidth: 10, overflow: 'hidden' },
      4: { cellWidth: 10, overflow: 'hidden' },
      5: { cellWidth: 10, overflow: 'hidden' },
      6: { cellWidth: 10, overflow: 'hidden' },
      7: { cellWidth: 10, overflow: 'hidden' },
      8: { cellWidth: 10, overflow: 'hidden' },
      9: { cellWidth: 10, overflow: 'hidden' },
      10: { cellWidth: 10, overflow: 'hidden' },
      11: { cellWidth: 15 }
    }
  });

  // Pie de pagina
  doc.setFontSize(10);
  doc.text(
    `Total Styles: ${footer.totalStyles} | Total Boxes: ${footer.totalBoxes} | Total Quantity: ${footer.totalQty}`,
    105,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );
  
  const finalY = doc.lastAutoTable.finalY + 15;
  const today = new Date();
  const formattedDate = `${today.getMonth()+1}/${today.getDate()}/${today.getFullYear()}`;
  
  doc.setFontSize(10);
  doc.text('Received by: __________________________', 20, finalY+10);
  doc.text('Received date: __________________________', 20, finalY+20);
  doc.text(`Packing List Date: ${formattedDate}`, 140, finalY);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(20, finalY - 5, 190, finalY - 5);
  
  doc.save(`PackingList_${header.shipmentId}.pdf`);
}

function calculateSizeBreakdown(body) {
  const sizeMap = {
    'XS': 0, 'S': 0, 'M': 0, 'L': 0, 
    'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0
  };
  
  const styles = {};
  let grandTotal = 0;

  body.forEach(row => {
    const size = row.Size.toUpperCase();
    const qty = parseInt(row['Total Qty']) || 0;
    
    if (!styles[row.Style]) {
      styles[row.Style] = {
        description: row.Description,
        color: row.Color,
        sizes: JSON.parse(JSON.stringify(sizeMap)),
        total: 0
      };
    }
    
    if (styles[row.Style].sizes.hasOwnProperty(size)) {
      styles[row.Style].sizes[size] += qty;
      styles[row.Style].total += qty;
      sizeMap[size] += qty;
      grandTotal += qty;
    }
  });

  const rows = Object.keys(styles).map(style => [
    style,
    styles[style].description,
    styles[style].color,
    styles[style].sizes.XS,
    styles[style].sizes.S,
    styles[style].sizes.M,
    styles[style].sizes.L,
    styles[style].sizes.XL,
    styles[style].sizes['2XL'],
    styles[style].sizes['3XL'],
    styles[style].sizes['4XL'],
    styles[style].total
  ]);

  rows.push([
    'TOTAL',
    '',
    '',
    sizeMap.XS,
    sizeMap.S,
    sizeMap.M,
    sizeMap.L,
    sizeMap.XL,
    sizeMap['2XL'],
    sizeMap['3XL'],
    sizeMap['4XL'],
    grandTotal
  ]);

  return {
    rows: rows,
    totalStyles: Object.keys(styles).length,
    grandTotal: grandTotal
  };
}
