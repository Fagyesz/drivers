const { ipcRenderer } = require('electron');
const os = require('os');

document.addEventListener('DOMContentLoaded', () => {
    const issueForm = document.getElementById('issue-form');
    const backBtn = document.getElementById('back-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const submissionStatus = document.getElementById('submission-status');
    const systemInfoField = document.getElementById('system-info');
    
    // Populate system info
    const systemInfo = {
        os: `${os.platform()} ${os.release()}`,
        arch: os.arch(),
        memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
        appVersion: 'v1.0.0' // You would get this from app info
    };
    
    systemInfoField.value = `OS: ${systemInfo.os}\nArchitecture: ${systemInfo.arch}\nMemory: ${systemInfo.memory}\nApp Version: ${systemInfo.appVersion}`;
    
    // Handle back button click
    backBtn.addEventListener('click', () => {
        window.history.back();
    });
    
    // Handle cancel button click
    cancelBtn.addEventListener('click', () => {
        window.history.back();
    });
    
    // Handle form submission
    issueForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const issueData = {
            type: document.getElementById('issue-type').value,
            title: document.getElementById('issue-title').value,
            description: document.getElementById('issue-description').value,
            systemInfo: systemInfo,
            includeLogs: document.getElementById('include-logs').checked,
            timestamp: new Date().toISOString()
        };
        
        try {
            // Show loading state
            submissionStatus.textContent = 'Submitting issue report...';
            submissionStatus.className = 'status-message info';
            
            // Send data to main process
            const result = await ipcRenderer.invoke('log-issue', issueData);
            
            if (result.success) {
                // Show success message
                submissionStatus.textContent = 'Issue report submitted successfully. Thank you!';
                submissionStatus.className = 'status-message success';
                
                // Reset form
                issueForm.reset();
                
                // Redirect back to main app after a delay
                setTimeout(() => {
                    window.history.back();
                }, 3000);
            } else {
                throw new Error(result.error || 'Failed to submit issue report');
            }
        } catch (error) {
            // Show error message
            submissionStatus.textContent = `Error: ${error.message}`;
            submissionStatus.className = 'status-message error';
        }
    });
}); 