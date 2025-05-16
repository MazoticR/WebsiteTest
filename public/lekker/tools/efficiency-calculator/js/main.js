
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

    function isCurrentDay(dayAbbr) {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const today = new Date().getDay(); // 0=Sunday
    return dayAbbr === days[today];
}
    
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
    
    const workerSections = findWorkerSections(jsonData);
    const days = detectDays(jsonData); // Make sure you have this helper function
    
    workerSections.forEach(section => {
        const workerDiv = document.createElement('div');
        workerDiv.className = 'worker-section';
        
        workerDiv.innerHTML = `
            <h3>${section.id} / ${section.name}</h3>
                <div class="idle-time-header">
                    <span class="label">Tiempo Inactivo:</span>
                    <div class="idle-time-controls-container">
                        <button class="scroll-left">&lt;</button>
                        <div class="idle-time-controls">
                            ${days.map(day => `<div class="idle-time-input ${isCurrentDay(day.name) ? 'current-day' : ''}">
                                <label>${day.name}</label>
                                <input type="text" 
                                    class="idle-time" 
                                    data-worker="${section.id}" 
                                    data-day="${day.name}" 
                                    placeholder="0:00" 
                                    pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$">
                                </div>`).join('')}
                        </div>
                        <button class="scroll-right">&gt;</button>
                    </div>
                </div>`
        
        workerControls.appendChild(workerDiv);
    });

    document.querySelectorAll('.idle-time').forEach(input => {
    input.addEventListener('blur', (e) => {
        if (!e.target.validity.valid) {
            e.target.classList.add('invalid');
            showStatus('Formato incorrecto. Use HH:MM (ej. 1:30)', 'error');
        } else {
            e.target.classList.remove('invalid');
        }
    });
});
}

// Helper function to detect days
function detectDays(data) {
    const days = [];
    const headerRow = data.find(row => row && row[0] === 'Operacion');
    if (headerRow) {
        headerRow.forEach((cell, index) => {
            if (['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].includes(cell)) {
                days.push({ name: cell, index });
            }
        });
    }
    return days;
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
    
    // 1. Collect all idle times from inputs
    idleTimeInputs.forEach(input => {
        const workerId = input.dataset.worker;
        const day = input.dataset.day;
        const value = input.value.trim();
        
        if (!idleTimes[workerId]) idleTimes[workerId] = {};
        idleTimes[workerId][day] = value || '0:00'; // Default to 0:00 if empty
    });

    // 2. Find day columns
    const headerRow = jsonData.find(row => row && row[0] === 'Operacion');
    const dayColumns = {};
    if (headerRow) {
        headerRow.forEach((cell, index) => {
            if (['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].includes(cell)) {
                dayColumns[cell] = index;
            }
        });
    }

    // 3. Process each worker section
    const workerSections = findWorkerSections(jsonData);
    workerSections.forEach(worker => {
        // Find the "Horas tiempo inactivo" row
        const idleTimeRow = jsonData[worker.workedHoursRow + 1];
        
        // Update idle times and calculate efficiencies for each day
        Object.entries(dayColumns).forEach(([day, col]) => {
            // Update idle time in the worksheet data
            if (idleTimeRow && idleTimes[worker.id]?.[day]) {
                idleTimeRow[col] = idleTimes[worker.id][day];
            }

            // Calculate real worked time (worked hours - idle time)
            const workedHoursStr = jsonData[worker.workedHoursRow]?.[col] || '0:00';
            const idleHoursStr = idleTimes[worker.id]?.[day] || '0:00';
            
            const workedMinutes = timeToMinutes(workedHoursStr);
            const idleMinutes = timeToMinutes(idleHoursStr);
            const realWorkedMinutes = Math.max(0, workedMinutes - idleMinutes);

            // Calculate efficiency for each operation
            let totalEfficiency = 0;
            let operationCount = 0;
            
            // Get all operation rows for this worker
            for (let i = worker.operationsHeaderRow + 1; i < worker.workedHoursRow; i++) {
                const row = jsonData[i];
                if (row && row[0] && row[0] !== '') { // Valid operation row
                    const produced = Number(row[col]) || 0;
                    const target = Number(row[3]) || 1; // Column D (index 3) is "Meta"
                    
                    if (target > 0 && realWorkedMinutes > 0) {
                        const operationEfficiency = (produced / target) * 100;
                        totalEfficiency += operationEfficiency;
                        operationCount++;
                    }
                }
            }

            // Update efficiency in the worksheet
            const avgEfficiency = operationCount > 0 ? (totalEfficiency / operationCount) : 0;
            if (jsonData[worker.efficiencyRow]) {
                jsonData[worker.efficiencyRow][col] = avgEfficiency.toFixed(2);
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
}


),

// Add this after the DOMContentLoaded event listener
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('scroll-left')) {
        const controls = e.target.nextElementSibling;
        controls.scrollBy({ left: -200, behavior: 'smooth' });
    } else if (e.target.classList.contains('scroll-right')) {
        const controls = e.target.previousElementSibling;
        controls.scrollBy({ left: 200, behavior: 'smooth' });
    }
});