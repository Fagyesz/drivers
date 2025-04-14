/**
 * Notification Service - Handles showing and managing notifications
 */

// Logger setup
let rendererLogger;
try {
  rendererLogger = require('../utils/logger').renderer;
} catch (error) {
  // Fallback to console if logger not available
  rendererLogger = {
    info: console.info,
    error: console.error,
    warn: console.warn
  };
}

/**
 * Show a notification to the user
 * @param {string} message - The message to display
 * @param {string} type - Notification type: 'info', 'success', 'error', 'warning'
 * @param {number} duration - Duration in milliseconds before auto-hiding
 */
function showNotification(message, type = "info", duration = 3000) {
  rendererLogger.info("Showing notification", { message, type });

  // Remove any existing notifications
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Get icon based on type
  let icon = "ℹ️";
  switch (type) {
    case "success":
      icon = "✅";
      break;
    case "error":
      icon = "❌";
      break;
    case "warning":
      icon = "⚠️";
      break;
    default:
      icon = "ℹ️";
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  // Create notification content
  notification.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-message">${message}</span>
    <span class="notification-close">✕</span>
  `;

  // Add to document
  document.body.appendChild(notification);

  // Add close button handler
  const closeButton = notification.querySelector(".notification-close");
  closeButton.addEventListener("click", () => {
    notification.classList.add("hide");
    setTimeout(() => notification.remove(), 300);
  });

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.classList.add("hide");
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  // Log notification
  rendererLogger.info("Notification shown", { message, type });
  
  // Return notification element for potential manipulation
  return notification;
}

/**
 * Show a confirmation dialog
 * @param {string} message - The message to display
 * @param {string} title - Dialog title
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
function showConfirmation(message, title = "Confirm") {
  return new Promise((resolve) => {
    // Create modal container if it doesn't exist
    let modalContainer = document.getElementById("modal-container");
    if (!modalContainer) {
      modalContainer = document.createElement("div");
      modalContainer.id = "modal-container";
      modalContainer.className = "modal-container";
      document.body.appendChild(modalContainer);
    }

    // Create confirmation dialog
    modalContainer.innerHTML = `
      <div class="modal confirmation-modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <span class="modal-close-btn">✕</span>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="button secondary" id="modal-cancel-btn">Cancel</button>
          <button class="button" id="modal-confirm-btn">Confirm</button>
        </div>
      </div>
    `;

    // Show the modal
    modalContainer.style.display = "flex";
    
    // Add event listeners
    const closeBtn = modalContainer.querySelector(".modal-close-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const confirmBtn = document.getElementById("modal-confirm-btn");
    
    // Handle close
    closeBtn.addEventListener("click", () => {
      modalContainer.style.display = "none";
      resolve(false);
    });
    
    // Handle cancel
    cancelBtn.addEventListener("click", () => {
      modalContainer.style.display = "none";
      resolve(false);
    });
    
    // Handle confirm
    confirmBtn.addEventListener("click", () => {
      modalContainer.style.display = "none";
      resolve(true);
    });
  });
}

/**
 * Show an error message in a specified container
 * @param {string} message - Error message to display
 * @param {string} containerId - ID of the container element
 */
function showErrorMessage(message, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;
  
  // Remove existing error messages
  const existingErrors = container.querySelectorAll(".error-message");
  existingErrors.forEach(el => el.remove());
  
  container.prepend(errorDiv);
}

/**
 * Show an info message in a specified container
 * @param {string} message - Info message to display
 * @param {string} containerId - ID of the container element
 */
function showInfoMessage(message, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const infoDiv = document.createElement("div");
  infoDiv.className = "info-message";
  infoDiv.textContent = message;
  
  // Remove existing info messages
  const existingInfos = container.querySelectorAll(".info-message");
  existingInfos.forEach(el => el.remove());
  
  container.prepend(infoDiv);
}

module.exports = {
  showNotification,
  showConfirmation,
  showErrorMessage,
  showInfoMessage
}; 