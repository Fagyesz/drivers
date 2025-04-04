// Direct Import Component - Self-contained solution
document.addEventListener('DOMContentLoaded', () => {
    // Get the import container
    const importContainer = document.getElementById('import-container');
    if (!importContainer) return;
    
    console.log('Creating direct import UI');
    
    // Create a simple import UI
    importContainer.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title">Import Excel Data</div>
            </div>
            <div class="card-body">
                <div class="file-section">
                    <input type="file" id="direct-file-input" accept=".xlsx,.xls" style="display:none">
                    <label for="direct-file-input" class="file-label">Select Excel File</label>
                    <div id="direct-file-name" class="file-name">No file selected</div>
                </div>
                
                <div id="import-type-section" style="margin-top: 20px; display: none;">
                    <h3>What type of data are you importing?</h3>
                    <div class="import-type-options" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                        <div class="import-type-option" style="display: flex; align-items: center; padding: 10px; background: #fff; border-radius: 4px;">
                            <input type="radio" name="import-type" id="type-people" value="people">
                            <label for="type-people" style="margin-left: 10px; cursor: pointer;">Driver Data</label>
                        </div>
                        <div class="import-type-option" style="display: flex; align-items: center; padding: 10px; background: #fff; border-radius: 4px;">
                            <input type="radio" name="import-type" id="type-vehicles" value="vehicles">
                            <label for="type-vehicles" style="margin-left: 10px; cursor: pointer;">Vehicle Data</label>
                        </div>
                        <div class="import-type-option" style="display: flex; align-items: center; padding: 10px; background: #fff; border-radius: 4px;">
                            <input type="radio" name="import-type" id="type-rounds" value="rounds">
                            <label for="type-rounds" style="margin-left: 10px; cursor: pointer;">Route Data</label>
                        </div>
                    </div>
                    <button id="continue-import-btn" disabled style="margin-top: 15px; padding: 8px 16px; background: #0078d7; color: white; border: none; border-radius: 4px; cursor: pointer;">Continue</button>
                </div>
                
                <div id="direct-preview" style="margin-top: 20px;"></div>
                <div id="direct-import-status" class="import-status" style="margin-top: 15px;"></div>
            </div>
        </div>
    `;
    
    // Add event listeners
    const fileInput = document.getElementById('direct-file-input');
    const fileName = document.getElementById('direct-file-name');
    const importTypeSection = document.getElementById('import-type-section');
    const continueBtn = document.getElementById('continue-import-btn');
    const radioButtons = document.querySelectorAll('input[name="import-type"]');
    const statusEl = document.getElementById('direct-import-status');
    
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                fileName.textContent = file.name;
                importTypeSection.style.display = 'block';
                statusEl.innerHTML = '<div class="status-message success">File selected successfully. Please choose what type of data you are importing.</div>';
            }
        });
    }
    
    // Enable continue button when a radio is selected
    radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            continueBtn.disabled = false;
        });
    });
    
    // Handle continue button
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            const selectedType = document.querySelector('input[name="import-type"]:checked');
            
            if (selectedType) {
                // Show a preview message
                const previewEl = document.getElementById('direct-preview');
                if (previewEl) {
                    previewEl.innerHTML = `
                        <div class="card" style="margin-top: 15px; padding: 15px; background: #f7f7f7;">
                            <h3>Import Preview for ${selectedType.value}</h3>
                            <p>File will be processed and data will be imported as ${selectedType.value}.</p>
                            <button id="process-import-btn" style="margin-top: 15px; padding: 8px 16px; background: #0078d7; color: white; border: none; border-radius: 4px; cursor: pointer;">Import Now</button>
                        </div>
                    `;
                    
                    // Handle the import button
                    const processBtn = document.getElementById('process-import-btn');
                    if (processBtn) {
                        processBtn.addEventListener('click', () => {
                            statusEl.innerHTML = '<div class="status-message success">Import simulated! In a real implementation, this would import the data to the database.</div>';
                        });
                    }
                }
            }
        });
    }
}); 