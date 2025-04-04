// Reset modal script - runs immediately when loaded
(function() {
    // Hide the modal immediately 
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        console.log('Immediately hiding modal');
        modalContainer.style.display = 'none';
    }
    
    // Add event listener for when DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Check again in case the DOM was not loaded yet
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            console.log('Hiding modal on DOMContentLoaded');
            modalContainer.style.display = 'none';
        }
        
        // Fix z-index of tab buttons to ensure they're on top
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.style.zIndex = '1000';
            btn.style.position = 'relative';
        });
    });
    
    // Just in case, try again after a short delay
    setTimeout(() => {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            console.log('Hiding modal after timeout');
            modalContainer.style.display = 'none';
        }
    }, 500);
})(); 