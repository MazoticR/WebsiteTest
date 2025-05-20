document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const exportBtn = document.getElementById('export-btn');
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const resultsDiv = document.getElementById('results');

    const EXCLUDED_VENDOR_IDS = [
        "91",  // SECURA
        "26",  // CUT ME TENDER
        '10',  // LEKKER
        '70'   // ELEGANT FASHION
    ];
    
    // Cache para los nombres de vendors
    const vendorCache = {};
  
    fetchBtn.addEventListener('click', async () => {
        const year = yearSelect.value;
        const month = monthSelect.value.padStart(2, '0');
        const time = Math.floor(Date.now() / 1000); // Unix timestamp
        
        try {
            resultsDiv.innerHTML = '<p>Cargando...</p>';
            
            // Fetch ALL POs (API date filtering isn't working)
            const poResponse = await fetch(
                `/api/purchase_orders?token=6002f37a06cc09759259a7c5eabff471&time=${time}`
            );
            const poData = await poResponse.json();
            
            // Filter by month and excluded vendors (client-side)
            const filteredOrders = poData.response.filter(order => {
                if (!order.date) return false;
                const [orderMonth, orderDay, orderYear] = order.date.split('/');
                return orderYear === year && orderMonth === month;
            }).filter(order => 
                order.vendor_id && !EXCLUDED_VENDOR_IDS.includes(order.vendor_id)
            );
            
            // Fetch vendor names
            const vendorIds = [...new Set(filteredOrders.map(order => order.vendor_id))];
            await fetchVendorNames(vendorIds);
            
            // Display results
            displayAsTable(filteredOrders);
            
        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        }
    });
  
    async function fetchVendorNames(vendorIds) {
        if (vendorIds.length === 0) return;
        const time = Math.floor(Date.now() / 1000);
        
        try {
            const response = await fetch(
                `/api/vendors?token=6002f37a06cc09759259a7c5eabff471&time=${time}`
            );
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            // Cache vendor names
            data.response.forEach(vendor => {
                if (vendor.vendor_id && vendor.vendor_name) {
                    vendorCache[vendor.vendor_id] = vendor.vendor_name;
                }
            });
            
        } catch (error) {
            console.error("Error fetching vendors:", error);
            resultsDiv.innerHTML += `<p class="error-warning">Nota: No se pudieron cargar los nombres de los proveedores</p>`;
        }
    }
  
    function displayAsTable(orders) {
        if (!orders || orders.length === 0) {
            resultsDiv.innerHTML = '<p>No se encontraron órdenes de compra para este período</p>';
            return;
        }
  
        const tableHTML = `
            <h2>Órdenes de Compra - ${getMonthName(monthSelect.value)}/${yearSelect.value}</h2>
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
                            <th>Due Date</th>
                            <th>Total Units</th>
                            <th>PO Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map(order => `
                            <tr>
                                <td>${order.purchase_order_id || ''}</td>
                                <td>${order.vendor_id || ''}</td>
                                <td>${vendorCache[order.vendor_id] || 'Vendor no encontrado'}</td>
                                <td>${getFirstItemField(order, 'style_number') || ''}</td>
                                <td>${getFirstItemField(order, 'description') || ''}</td>
                                <td>${getStatus(order)}</td>
                                <td>${order.division_id || ''}</td>
                                <td>${formatDate(order.date)}</td>
                                <td>${formatDate(order.date_due)}</td>
                                <td class="numeric">${order.qty || 0}</td>
                                <td class="numeric">${formatCurrency(order.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        resultsDiv.innerHTML = tableHTML;
    }
  
    // Helper functions (unchanged)
    function getFirstItemField(order, field) {
        if (!order.purchase_order_items || !order.purchase_order_items.length) return '';
        return order.purchase_order_items[0][field] || '';
    }
  
    function getStatus(order) {
        if (order.qty_open === "0.00") return "Completado";
        if (order.qty_cxl && order.qty_cxl !== "0.00") return "Cancelado";
        if (order.qty_received && order.qty_received !== "0.00") return "Parcialmente Recibido";
        return "Abierto";
    }
  
    function getMonthName(monthValue) {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[parseInt(monthValue) - 1];
    }
  
    function formatDate(dateString) {
        if (!dateString) return '';
        const [month, day, year] = dateString.split('/');
        return `${day}/${month}/${year}`;
    }
  
    function formatCurrency(amount) {
        if (!amount) return '$0.00';
        return '$' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
  
    exportBtn.addEventListener('click', async () => {
        const year = yearSelect.value;
        const month = monthSelect.value.padStart(2, '0');
        const time = Math.floor(Date.now() / 1000);
        
        try {
            const response = await fetch(
                `/api/purchase_orders?token=6002f37a06cc09759259a7c5eabff471&time=${time}`
            );
            const data = await response.json();
            
            // Client-side filtering
            const filteredOrders = data.response.filter(order => {
                if (!order.date) return false;
                const [orderMonth, orderDay, orderYear] = order.date.split('/');
                return orderYear === year && orderMonth === month;
            }).filter(order => 
                order.vendor_id && !EXCLUDED_VENDOR_IDS.includes(order.vendor_id)
            );
            
            // Generate CSV
            const headers = [
                'PO Number', 'Vendor ID', 'Vendor Name', 'Item', 
                'Material Description', 'Status', 'Department',
                'PO Date', 'Due Date', 'Total Units', 'PO Total'
            ].join(',');
            
            const rows = filteredOrders.map(order => [
                order.purchase_order_id || '',
                order.vendor_id || '',
                vendorCache[order.vendor_id] || 'Vendor no encontrado',
                getFirstItemField(order, 'style_number'),
                getFirstItemField(order, 'description'),
                getStatus(order),
                order.division_id || '',
                formatDate(order.date),
                formatDate(order.date_due),
                order.qty || 0,
                order.amount || 0
            ].map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','));
            
            // Download CSV
            const csvContent = [headers, ...rows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `ordenes_compra_${month}_${year}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            alert(`Error al exportar: ${error.message}`);
        }
    });
});