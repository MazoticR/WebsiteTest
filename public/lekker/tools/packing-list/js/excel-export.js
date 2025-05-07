function exportToExcel() {
  const { header, body } = currentShipmentData;
  const headers = Object.keys(body[0]);
  const csvRows = [
    headers.join(','),
    ...body.map(row => 
      headers.map(field => 
        `"${String(row[field] || '').replace(/"/g, '""')}"`
      ).join(',')
    )
  ];
  
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PackingList_${header.shipmentId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
