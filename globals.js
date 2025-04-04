// Ensure modules are available globally
window.checkModules = function() {
    console.log('Checking module exports...');
    if (typeof window.ImportManager !== 'function') {
        console.error('ImportManager is not defined globally');
    } else {
        console.log('ImportManager is available globally');
    }
    
    if (typeof window.MappingUI !== 'function') {
        console.error('MappingUI is not defined globally');
    } else {
        console.log('MappingUI is available globally');
    }
    
    if (typeof window.ExcelPreview !== 'function') {
        console.error('ExcelPreview is not defined globally');
    } else {
        console.log('ExcelPreview is available globally');
    }
}

// Ensure class is globally accessible
window.makeGlobal = function() {
    try {
        if (typeof ExcelPreview === 'function' && !window.ExcelPreview) {
            window.ExcelPreview = ExcelPreview;
            console.log('Exported ExcelPreview to window');
        }
        
        if (typeof MappingUI === 'function' && !window.MappingUI) {
            window.MappingUI = MappingUI;
            console.log('Exported MappingUI to window');
        }
        
        if (typeof ImportManager === 'function' && !window.ImportManager) {
            window.ImportManager = ImportManager;
            console.log('Exported ImportManager to window');
        }
    } catch (e) {
        console.error('Error making classes global:', e);
    }
} 