// Preload script for Electron
const { contextBridge, ipcRenderer } = require('electron');

// Expose electronAPI to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Generic data operations
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Data operations
  getData: (schema) => ipcRenderer.invoke('get-data', schema),
  getById: (schema, id) => ipcRenderer.invoke('get-by-id', schema, id),
  createData: (schema, data) => ipcRenderer.invoke('create-data', schema, data),
  updateData: (schema, id, data) => ipcRenderer.invoke('update-data', schema, id, data),
  deleteData: (schema, id) => ipcRenderer.invoke('delete-data', schema, id),
  countData: (schema) => ipcRenderer.invoke('count-data', schema),
  
  // Schema operations
  getSchemaFields: (schema) => ipcRenderer.invoke('get-schema-fields', schema),
  
  // Excel import operations
  importExcelFile: (filePath) => ipcRenderer.invoke('import-excel-file', filePath),
  processImportedData: () => ipcRenderer.invoke('process-imported-data'),
  
  // Vehicle-round connections
  getVehicleRounds: (platenumber) => ipcRenderer.invoke('get-vehicle-rounds', platenumber),
  
  // Alert operations
  updateAlertStatus: (id, status) => ipcRenderer.invoke('update-alert-status', id, status)
}); 