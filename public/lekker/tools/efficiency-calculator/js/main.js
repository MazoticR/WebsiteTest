
document.addEventListener('DOMContentLoaded', () => {
    const excelFileInput = document.getElementById('excelFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const workerControls = document.getElementById('workerControls');
    const calculateBtn = document.getElementById('calculateBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const status = document.getElementById('status');
    
    let workbook = null;
    let worksheet = null;
    let jsonData = [];
    
    uploadBtn.addEventListener('click', handleFileUpload);
    calculateBtn.addEventListener('click', calculateEfficiencies);
    downloadBtn.addEventListener('click', downloadModifiedFile);
    
    function handleFileUpload() {
        const file = excelFileInput.files[0];
        if (!file) {
            showStatus('Please select a file first', 'error');
            return;
        }
        
        fileName.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first worksheet
            const firstSheetName = workbook.SheetNames[0];
            worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Display controls for adding idle time
            displayWorkerControls();
            
            fileInfo.classList.remove('hidden');
            calculateBtn.classList.remove('hidden');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
function displayWorkerControls() {
    workerControls.innerHTML = '';
    
    // Find all worker sections
    const workerSections = findWorkerSections(jsonData);
    
    // Find day columns (Lun, Mar, Mie, etc.)
    const days = [];
    const headerRow = jsonData.find(row => row && row[0] === 'Operacion');
    if (headerRow) {
        for (let i = 0; i < headerRow.length; i++) {
            if (['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].includes(headerRow[i])) {
                days.push({
                    name: headerRow[i],
                    index: i
                });
            }
        }
    }

    workerSections.forEach(section => {
        const workerDiv = document.createElement('div');
        workerDiv.className = 'worker-section';
        
        const workerName = section.name;
        const workerId = section.id;
        
        workerDiv.innerHTML = `
            <h3>${workerId} / ${workerName}</h3>
            <div class="idle-time-controls">
                ${days.map(day => `
                    <div class="idle-time-input">
                        <label>${day.name}:</label>
                        <input type="text" 
                               class="idle-time" 
                               data-worker="${workerId}" 
                               data-day="${day.name}" 
                               placeholder="HH:MM" 
                               pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$">
                    </div>
                `).join('')}
            </div>
        `;
        
        workerControls.appendChild(workerDiv);
    });
}
    
    function findWorkerSections(data) {
        const workers = [];
        let currentWorker = null;
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row && row[0] && typeof row[0] === 'string' && row[0].includes('/')) {
                // This is a worker header row
                if (currentWorker) {
                    workers.push(currentWorker);
                }
                
                const parts = row[0].split('/');
                currentWorker = {
                    id: parts[0].trim(),
                    name: parts[1].trim(),
                    startRow: i,
                    operations: []
                };
            } else if (currentWorker && row && row[0] && row[0] === 'Operacion') {
                // This is the operations header row
                currentWorker.operationsHeaderRow = i;
            } else if (currentWorker && row && row[0] && row[0] === 'Horas trabajadas') {
                // This is the worked hours row
                currentWorker.workedHoursRow = i;
                currentWorker.idleTimeRow = i + 1;
                currentWorker.efficiencyRow = i + 2;
                currentWorker.bonusRow = i + 3;
                currentWorker.endRow = i + 7; // Adjust based on your file structure
            }
        }
        
        if (currentWorker) {
            workers.push(currentWorker);
        }
        
        return workers;
    }
    
    function calculateEfficiencies() {
        const idleTimeInputs = document.querySelectorAll('.idle-time');
        const idleTimes = {};
        
        // Collect all idle times
        idleTimeInputs.forEach(input => {
            const workerId = input.dataset.worker;
            const day = input.dataset.day;
            const value = input.value.trim();
            
            if (!idleTimes[workerId]) {
                idleTimes[workerId] = {};
            }
            
            idleTimes[workerId][day] = value;
        });
        
        // Find day columns
        const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const dayColumns = {};
        days.forEach(day => {
            const index = jsonData[3].indexOf(day); // Find day column index
            if (index !== -1) {
                dayColumns[day] = index;
            }
        });
        
        // Process each worker
        const workerSections = findWorkerSections(jsonData);
        
        workerSections.forEach(worker => {
            // Get operations rows
            const operations = [];
            for (let i = worker.operationsHeaderRow + 1; i < worker.workedHoursRow; i++) {
                if (jsonData[i] && jsonData[i][0] && jsonData[i][0] !== '') {
                    operations.push(jsonData[i]);
                }
            }
            
            // Process each day
            Object.entries(dayColumns).forEach(([day, col]) => {
                // Skip if no data for this day
                if (!jsonData[worker.workedHoursRow] || !jsonData[worker.workedHoursRow][col]) {
                    return;
                }
                
                // Get worked hours and idle time
                let workedHoursStr = jsonData[worker.workedHoursRow][col];
                let idleTimeStr = idleTimes[worker.id]?.[day] || '0:00';
                
                // Convert to minutes
                const workedMinutes = timeToMinutes(workedHoursStr);
                const idleMinutes = timeToMinutes(idleTimeStr);
                
                // Calculate real worked time (worked - idle)
                const realWorkedMinutes = Math.max(0, workedMinutes - idleMinutes);
                
                // Update idle time in the data
                if (jsonData[worker.idleTimeRow]) {
                    jsonData[worker.idleTimeRow][col] = minutesToTime(idleMinutes);
                }
                
                // Calculate efficiency
                let totalEfficiency = 0;
                let operationCount = 0;
                
                operations.forEach(op => {
                    const produced = op[col] || 0;
                    const target = op[3] || 1; // Meta is in column D (index 3)
                    
                    if (target > 0 && realWorkedMinutes > 0) {
                        const operationEfficiency = (produced / target) * 100;
                        totalEfficiency += operationEfficiency;
                        operationCount++;
                    }
                });
                
                const avgEfficiency = operationCount > 0 ? (totalEfficiency / operationCount) : 0;
                
                // Update efficiency in the data
                if (jsonData[worker.efficiencyRow]) {
                    jsonData[worker.efficiencyRow][col] = avgEfficiency;
                }
            });
        });
        
        showStatus('Efficiencies recalculated successfully!', 'success');
        downloadBtn.classList.remove('hidden');
    }
    
    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        
        // Handle cases like "10:01" or "0:-4"
        const parts = timeStr.toString().split(':');
        let hours = parseInt(parts[0]) || 0;
        let minutes = parseInt(parts[1]) || 0;
        
        // Handle negative minutes (like "0:-4")
        if (minutes < 0) {
            hours -= 1;
            minutes = 60 + minutes;
        }
        
        return hours * 60 + minutes;
    }
    
    function minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    
    function downloadModifiedFile() {
        // Convert jsonData back to worksheet
        const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
        
        // Update the workbook
        workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;
        
        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        
        // Create download link
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modified_' + fileName.textContent;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('File downloaded successfully!', 'success');
    }
    
    function showStatus(message, type) {
        status.textContent = message;
        status.className = type;
    }
});