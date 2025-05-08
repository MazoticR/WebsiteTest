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
        
        console.log("API Response:", data); // Debugging
        
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
        <h2>Ordenes de ${monthSelect.value}/${yearSelect.value}</h2>
        <div class="table-container">
          <table class="po-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Vendor ID</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Items Count</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(order => `
                <tr>
                  <td>${order.purchase_order_id || ''}</td>
                  <td>${order.vendor_id || ''}</td>
                  <td>${formatDate(order.date)}</td>
                  <td>${formatDate(order.date_due)}</td>
                  <td>${getStatus(order)}</td>
                  <td class="numeric">${order.qty || 0}</td>
                  <td class="numeric">${formatCurrency(order.amount)}</td>
                  <td class="numeric">${order.purchase_order_items ? order.purchase_order_items.length : 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
  
      resultsDiv.innerHTML = tableHTML;
    }
  
    function getStatus(order) {
      if (order.qty_open === "0.00") return "Completed";
      if (order.qty_cxl && order.qty_cxl !== "0.00") return "Cancelled";
      if (order.qty_received && order.qty_received !== "0.00") return "Partially Received";
      return "Open";
    }
  
    function formatDate(dateString) {
      if (!dateString) return '';
      // The API returns dates in format "MM/DD/YYYY"
      const [month, day, year] = dateString.split('/');
      return `${day}/${month}/${year}`;
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
            'PO Number', 'Vendor ID', 'Date', 'Due Date', 
            'Status', 'Qty', 'Amount', 'Items Count'
          ].join(',');
          
          const rows = data.response.map(order => [
            order.purchase_order_id || '',
            order.vendor_id || '',
            formatDate(order.date),
            formatDate(order.date_due),
            getStatus(order),
            order.qty || 0,
            order.amount || 0,
            order.purchase_order_items ? order.purchase_order_items.length : 0
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