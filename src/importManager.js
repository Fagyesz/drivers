// Import Manager Component - Simplified version for testing
class ImportManager {
    constructor(containerId, options = {}) {
        console.log('ImportManager constructor called for', containerId);
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container element with ID "${containerId}" not found`);
            return;
        }

        console.log('Container found:', this.container);
        this.options = options || {};
        
        // Render a very simple test UI
        this.render();
    }

    render() {
        console.log('ImportManager render() called - using simple test version');
        
        // Create a simple test UI
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Import Excel Test</div>
                </div>
                <div class="card-body">
                    <p>This is a test of the ImportManager component. If you can see this text, the component is loading correctly.</p>
                    <div style="margin: 20px 0;">
                        <button id="test-button" class="btn">Test Button</button>
                    </div>
                    <div id="test-output" style="margin-top: 20px;">
                        Click the button to test the component.
                    </div>
                </div>
            </div>
        `;
        
        // Add a simple event listener
        const testButton = document.getElementById('test-button');
        if (testButton) {
            testButton.addEventListener('click', () => {
                const testOutput = document.getElementById('test-output');
                if (testOutput) {
                    testOutput.innerHTML = `
                        <div class="status-message success">
                            Button clicked successfully at ${new Date().toLocaleTimeString()}!
                        </div>
                    `;
                }
            });
        }
        
        console.log('ImportManager simple test UI rendered');
    }

    reset() {
        console.log('Resetting ImportManager');
        this.render();
    }
}

// Export module for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportManager;
} 

// Make it global for browser
if (typeof window !== 'undefined') {
    window.ImportManager = ImportManager;
    console.log('ImportManager exposed to window object');
} 