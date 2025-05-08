document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const exportBtn = document.getElementById('export-btn');
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const resultsDiv = document.getElementById('results');
  
    fetchBtn.addEventListener('click', async () => {
      const year = yearSelect.value;
      const month = monthSelect.value;
      
      try {
        resultsDiv.innerHTML = '<p>Loading...</p>';
        const response = await fetch(
          `/api/purchase_orders?token=6002f37a06cc09759259a7c5eabff471&year=${year}&month=${month}`
        );
        const data = await response.json();
        
        // Display results in table format
        displayAsTable(data.response);
        
      } catch (error) {
        resultsDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
      }
    });
  
    function displayAsTable(orders) {
      if (!orders || orders.length === 0) {
        resultsDiv.innerHTML = '<p>No purchase orders found for this period</p>';
        return;
      }
  
      const tableHTML = `
        <h2>Purchase Orders for ${monthSelect.value}/${yearSelect.value}</h2>
        <div class="table-container">
          <table class="po-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Vendor ID</th>
                <th>Vendor Name</th>
                <th>Item</th>
                <th>Material Description</th>
                <th>Status</th>
                <th>Department</th>
                <th>PO Date</th>
                <th>Cancel Date</th>
                <th>Total Units</th>
                <th>PO Total</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(order => `
                <tr>
                  <td>${order.PurchaseOrderNumber || ''}</td>
                  <td>${order.vendor || ''}</td>
                  <td>${order.VendorName || ''}</td>
                  <td>${order.Item || ''}</td>
                  <td>${order.MaterialDescription || ''}</td>
                  <td>${order.PurchaseOrderStatus || ''}</td>
                  <td>${order.Department || ''}</td>
                  <td>${formatDate(order.PurchaseOrderDate)}</td>
                  <td>${formatDate(order.PurchaseOrdercancelDate)}</td>
                  <td class="numeric">${order.Totalunits || 0}</td>
                  <td class="numeric">${formatCurrency(order.PurchaseOrderTotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
  
      resultsDiv.innerHTML = tableHTML;
    }
  
    function formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString();
    }
  
    function formatCurrency(amount) {
      if (!amount) return '$0.00';
      return '$' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
  
    exportBtn.addEventListener('click', async () => {
        try {
          const year = yearSelect.value;
          const month = monthSelect.value;
          const response = await fetch(
            `/api/purchase_orders?token=6002f37a06cc09759259a7c5eabff471&year=${year}&month=${month}`
          );
          const data = await response.json();
          
          // Create CSV content
          const headers = [
            'PO Number', 'Vendor ID', 'Vendor Name', 'Item', 
            'Material Description', 'Status', 'Department',
            'PO Date', 'Cancel Date', 'Total Units', 'PO Total'
          ].join(',');
          
          const rows = data.response.map(order => [
            order.PurchaseOrderNumber || '',
            order.vendor || '',
            order.VendorName || '',
            order.Item || '',
            order.MaterialDescription || '',
            order.PurchaseOrderStatus || '',
            order.Department || '',
            formatDate(order.PurchaseOrderDate),
            formatDate(order.PurchaseOrdercancelDate),
            order.Totalunits || 0,
            order.PurchaseOrderTotal || 0
          ].join(','));
          
          const csvContent = [headers, ...rows].join('\n');
          
          // Create download link
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `purchase_orders_${month}_${year}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
        } catch (error) {
          alert(`Export failed: ${error.message}`);
        }
      });
  });