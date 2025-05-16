
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
        if (!row) continue;
        
        // Worker header row (e.g., "26 / IMELDA MARTINEZ CENOBIO")
        if (typeof row[0] === 'string' && row[0].match(/^\d+\s*\/\s*.+/)) {
            if (currentWorker) workers.push(currentWorker);
            const parts = row[0].split('/').map(part => part.trim());
            currentWorker = {
                id: parts[0],
                name: parts[1],
                startRow: i,
                operations: []
            };
        }
        // Operations header row
        else if (currentWorker && row[0] === 'Operacion') {
            currentWorker.operationsHeaderRow = i;
        }
        // Worked hours row
        else if (currentWorker && row[0] === 'Horas trabajadas') {
            currentWorker.workedHoursRow = i;
            // The idle time row is ALWAYS the next row after "Horas trabajadas"
            currentWorker.idleTimeRow = i + 1;
        }
        // Efficiency row (after idle time)
        else if (currentWorker && row[0] === 'Eficiencia diaria') {
            currentWorker.efficiencyRow = i;
        }
    }
    
    if (currentWorker) workers.push(currentWorker);
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
        idleTimes[workerId][day] = value || '0:00';
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

    // 3. Process each worker
    const workerSections = findWorkerSections(jsonData);
    workerSections.forEach(worker => {
        // Verify we have all required rows
        if (!worker.workedHoursRow || !worker.idleTimeRow) {
            console.warn(`Missing required rows for worker ${worker.id}`);
            return;
        }

        // Ensure the idle time row exists in our data structure
        if (!jsonData[worker.idleTimeRow]) {
            jsonData[worker.idleTimeRow] = [];
            jsonData[worker.idleTimeRow][0] = ''; // Set empty first cell
        }

        // Update idle times in the data structure
        Object.entries(dayColumns).forEach(([day, col]) => {
            if (idleTimes[worker.id]?.[day]) {
                console.log(`Updating worker ${worker.id} ${day} idle time to ${idleTimes[worker.id][day]}`);
                jsonData[worker.idleTimeRow][col] = idleTimes[worker.id][day];
            }
        });

        // If we have an efficiency row, update it
        if (worker.efficiencyRow) {
            if (!jsonData[worker.efficiencyRow]) {
                jsonData[worker.efficiencyRow] = [];
                jsonData[worker.efficiencyRow][0] = ''; // Set empty first cell
            }

            Object.entries(dayColumns).forEach(([day, col]) => {
                const workedHoursStr = jsonData[worker.workedHoursRow]?.[col] || '0:00';
                const idleHoursStr = jsonData[worker.idleTimeRow]?.[col] || '0:00';
                
                const workedMinutes = timeToMinutes(workedHoursStr);
                const idleMinutes = timeToMinutes(idleHoursStr);
                const realWorkedMinutes = Math.max(0, workedMinutes - idleMinutes);

                // Calculate efficiency for each operation
                let totalStandardMinutes = 0;
                
                for (let i = worker.operationsHeaderRow + 1; i < worker.workedHoursRow; i++) {
                    const row = jsonData[i];
                    if (row && row[0] && row[0] !== '') {
                        const produced = Number(row[col]) || 0;
                        const minutesPerPiece = Number(row[14]) || 0; // Column N
                        
                        if (minutesPerPiece > 0) {
                            totalStandardMinutes += produced * minutesPerPiece;
                        }
                    }
                }

                // Calculate daily efficiency (as decimal)
                const efficiency = realWorkedMinutes > 0 ? 
                    (totalStandardMinutes / realWorkedMinutes) : 0;
                
                // Update efficiency cell directly
                jsonData[worker.efficiencyRow][col] = efficiency;
            });
        }
    });

// Add this at the end of calculateEfficiencies, before the success message
console.log("Modified data structure:", jsonData);

    showStatus('¡Datos actualizados correctamente!', 'success');
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
    // Create a new workbook
    const newWorkbook = XLSX.utils.book_new();
    
    // Convert our modified data to a worksheet
    const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Modified Data");
    
    // Force Excel to recalculate all formulas when opened
    if (!newWorkbook.Workbook) newWorkbook.Workbook = {};
    if (!newWorkbook.Workbook.CalcPr) {
        newWorkbook.Workbook.CalcPr = {
            calcId: 999999,
            calcMode: 'auto',
            fullCalcOnLoad: true
        };
    } else {
        newWorkbook.Workbook.CalcPr.fullCalcOnLoad = true;
    }
    
    // Generate the file with correct formatting
    const wbout = XLSX.write(newWorkbook, {
        bookType: 'xlsx',
        type: 'array',
        cellStyles: true
    });
    
    // Create download
    const blob = new Blob([wbout], {type: 'application/octet-stream'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified_' + fileName.textContent;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
    
    showStatus('Archivo exportado correctamente', 'success');
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