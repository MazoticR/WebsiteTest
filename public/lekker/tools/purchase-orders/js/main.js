document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fetchBtn = document.getElementById('fetch-btn');
    const exportBtn = document.getElementById('export-btn');
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const resultsDiv = document.getElementById('results');

    // Configuration
    const EXCLUDED_VENDOR_IDS = ["91", "26", "10", "70"];
    const vendorCache = {};
    const API_TOKEN = '6002f37a06cc09759259a7c5eabff471';

    // Helper Functions
    const formatDateForAPI = (year, month, day) => 
        `${year}-${month.padStart(2, '0')}-${String(day).padStart(2, '0')}`; // Fixed: String() conversion

    const getMonthName = (monthValue) => [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ][parseInt(monthValue) - 1];

    const formatDisplayDate = (dateString) => 
        dateString ? dateString.split('/').reverse().join('/') : '';

    const formatCurrency = (amount) => 
        amount ? '$' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') : '$0.00';

    const getFirstItemField = (order, field) => 
        order.purchase_order_items?.[0]?.[field] || '';

    const getStatus = (order) => {
        if (order.qty_open === "0.00") return "Completado";
        if (order.qty_cxl && order.qty_cxl !== "0.00") return "Cancelado";
        if (order.qty_received && order.qty_received !== "0.00") return "Parcialmente Recibido";
        return "Abierto";
    };

    // Main Functions
    async function fetchVendorNames(vendorIds) {
        if (!vendorIds.length) return;
        const time = Math.floor(Date.now() / 1000);
        try {
            const response = await fetch(`/api/vendors?token=${API_TOKEN}&time=${time}`);
            const data = await response.json();
            data.response?.forEach(vendor => {
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
        if (!orders?.length) {
            resultsDiv.innerHTML = '<p>No se encontraron órdenes de compra para este período</p>';
            return;
        }
        resultsDiv.innerHTML = `
            <h2>Órdenes de Compra - ${getMonthName(monthSelect.value)}/${yearSelect.value}</h2>
            <div class="table-container">
                <table class="po-table">
                    <thead><tr>
                        <th>PO Number</th><th>Vendor ID</th><th>Vendor Name</th>
                        <th>Item</th><th>Material Description</th><th>Status</th>
                        <th>Department</th><th>PO Date</th><th>Due Date</th>
                        <th>Total Units</th><th>PO Total</th>
                    </tr></thead>
                    <tbody>
                        ${orders.map(order => `
                            <tr>
                                <td>${order.purchase_order_id || ''}</td>
                                <td>${order.vendor_id || ''}</td>
                                <td>${vendorCache[order.vendor_id] || 'Vendor no encontrado'}</td>
                                <td>${getFirstItemField(order, 'style_number')}</td>
                                <td>${getFirstItemField(order, 'description')}</td>
                                <td>${getStatus(order)}</td>
                                <td>${order.division_id || ''}</td>
                                <td>${formatDisplayDate(order.date)}</td>
                                <td>${formatDisplayDate(order.date_due)}</td>
                                <td class="numeric">${order.qty || 0}</td>
                                <td class="numeric">${formatCurrency(order.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    // Event Listeners
    fetchBtn.addEventListener('click', async () => {
        const year = yearSelect.value;
        const month = monthSelect.value.padStart(2, '0');
        const time = Math.floor(Date.now() / 1000);

        try {
            resultsDiv.innerHTML = '<p>Cargando...</p>';
            const params = new URLSearchParams({
                token: API_TOKEN,
                time: time,
                'parameters[0][field]': 'date_internal',
                'parameters[0][operator]': '>=',
                'parameters[0][value]': formatDateForAPI(year, month, '01'),
                'parameters[1][field]': 'date_internal',
                'parameters[1][operator]': '<=',
                'parameters[1][value]': formatDateForAPI(year, month, 
                    new Date(year, month, 0).getDate().toString()) // Fixed: .toString()
            });

            const response = await fetch(`/api/purchase_orders?${params}`);
            const data = await response.json();
            const filteredOrders = data.response?.filter(order => 
                order.vendor_id && !EXCLUDED_VENDOR_IDS.includes(order.vendor_id)
            ) || [];

            await fetchVendorNames([...new Set(filteredOrders.map(o => o.vendor_id))]);
            displayAsTable(filteredOrders);

        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        }
    });

    exportBtn.addEventListener('click', async () => {
        const year = yearSelect.value;
        const month = monthSelect.value.padStart(2, '0');
        const time = Math.floor(Date.now() / 1000);

        try {
            const params = new URLSearchParams({
                token: API_TOKEN,
                time: time,
                'parameters[0][field]': 'date_internal',
                'parameters[0][operator]': '>=',
                'parameters[0][value]': formatDateForAPI(year, month, '01'),
                'parameters[1][field]': 'date_internal',
                'parameters[1][operator]': '<=',
                'parameters[1][value]': formatDateForAPI(year, month, 
                    new Date(year, month, 0).getDate().toString()) // Fixed: .toString()
            });

            const response = await fetch(`/api/purchase_orders?${params}`);
            const data = await response.json();
            const filteredOrders = data.response?.filter(order => 
                order.vendor_id && !EXCLUDED_VENDOR_IDS.includes(order.vendor_id)
            ) || [];

            const csvContent = [
                ['PO Number', 'Vendor ID', 'Vendor Name', 'Item', 'Material Description', 
                 'Status', 'Department', 'PO Date', 'Due Date', 'Total Units', 'PO Total'].join(','),
                ...filteredOrders.map(order => [
                    order.purchase_order_id || '',
                    order.vendor_id || '',
                    vendorCache[order.vendor_id] || 'Vendor no encontrado',
                    getFirstItemField(order, 'style_number'),
                    getFirstItemField(order, 'description'),
                    getStatus(order),
                    order.division_id || '',
                    formatDisplayDate(order.date),
                    formatDisplayDate(order.date_due),
                    order.qty || 0,
                    order.amount || 0
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ordenes_compra_${month}_${year}.csv`;
            link.click();
        } catch (error) {
            alert(`Error al exportar: ${error.message}`);
        }
    });
});