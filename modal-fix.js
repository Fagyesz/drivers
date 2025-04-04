// Modal Fix Script
document.addEventListener('DOMContentLoaded', () => {
    // Find and hide any open modals
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        console.log('Hiding modal container');
        modalContainer.style.display = 'none';
    }
    
    // Make sure tab buttons are clickable
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.style.zIndex = '1000';
        button.style.position = 'relative';
        
        // Reinitialize click handler
        button.addEventListener('click', (e) => {
            console.log('Tab button clicked:', button.textContent.trim());
            
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected tab content
            const tabPanes = document.querySelectorAll('.tab-pane');
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === tabId) {
                    pane.classList.add('active');
                }
            });
        });
    });
    
    // Add close handler for modal
    const closeBtn = document.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modalContainer) {
                modalContainer.style.display = 'none';
            }
        });
    }
    
    // Add cancel button handler
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (modalContainer) {
                modalContainer.style.display = 'none';
            }
        });
    }
    
    // Make backdrop close the modal too
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            if (modalContainer) {
                modalContainer.style.display = 'none';
            }
        });
    }
    
    console.log('Modal fix script applied');
}); 