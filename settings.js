// Settings Management
let currentSettings = {
    waterLevel: {
        tankCapacity: 90,
        irrigationVolume: 7,
        lowLevelThreshold: 20,
        schedule1: '07:00',
        schedule2: '16:00',
        schedule1Enabled: true,
        schedule2Enabled: true
    },
    soilMoisture: {
        min: 40,
        max: 80,
        optimal: 65
    },
    irrigation: {
        duration: 15,
        interval: 30
    },
    alerts: {
        enabled: true,
        autoIrrigation: true
    }
};

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('irrigationSettings');
    if (savedSettings) {
        currentSettings = { ...currentSettings, ...JSON.parse(savedSettings) };
    }
    updateSettingsUI();
}

// Save settings to localStorage
function saveSettingsToStorage() {
    localStorage.setItem('irrigationSettings', JSON.stringify(currentSettings));
}

// Update UI with current settings
function updateSettingsUI() {
    // Water Level settings
    document.getElementById('tankCapacity').value = currentSettings.waterLevel.tankCapacity;
    document.getElementById('irrigationVolume').value = currentSettings.waterLevel.irrigationVolume;
    document.getElementById('lowLevelThreshold').value = currentSettings.waterLevel.lowLevelThreshold;
    document.getElementById('schedule1').value = currentSettings.waterLevel.schedule1;
    document.getElementById('schedule2').value = currentSettings.waterLevel.schedule2;
    document.getElementById('schedule1Enabled').checked = currentSettings.waterLevel.schedule1Enabled;
    document.getElementById('schedule2Enabled').checked = currentSettings.waterLevel.schedule2Enabled;
    
    // Soil Moisture settings
    document.getElementById('soilMoistureMin').value = currentSettings.soilMoisture.min;
    document.getElementById('soilMoistureMax').value = currentSettings.soilMoisture.max;
    document.getElementById('soilMoistureOptimal').value = currentSettings.soilMoisture.optimal;
    
    // Irrigation settings
    document.getElementById('irrigationDuration').value = currentSettings.irrigation.duration;
    document.getElementById('irrigationInterval').value = currentSettings.irrigation.interval;
    
    // Alert settings
    document.getElementById('enableAlerts').checked = currentSettings.alerts.enabled;
    document.getElementById('enableAutoIrrigation').checked = currentSettings.alerts.autoIrrigation;
    
    // Update control panel display
    updateControlPanelDisplay();
}

// Update control panel with current settings
function updateControlPanelDisplay() {
    const waterThreshold = document.querySelector('.control-item:nth-child(1) .control-value');
    const soilTarget = document.querySelector('.control-item:nth-child(2) .control-value');
    const duration = document.querySelector('.control-item:nth-child(3) .control-value');
    
    if (waterThreshold) {
        waterThreshold.textContent = `${(currentSettings.waterLevel.tankCapacity * currentSettings.waterLevel.lowLevelThreshold / 100).toFixed(1)}L`;
    }
    if (soilTarget) {
        soilTarget.textContent = `${currentSettings.soilMoisture.min}-${currentSettings.soilMoisture.max}%`;
    }
    if (duration) {
        duration.textContent = `${currentSettings.irrigation.duration} min`;
        
        // Re-sync both managers after reset
        if (window.waterVolumeManager && window.soilMoistureManager) {
            window.waterVolumeManager.syncWithSoilManager();
        }
    }
}

// Open settings modal
function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Load current settings into form
    updateSettingsUI();
}

// Close settings modal
function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Save settings
function saveSettings() {
    // Validate inputs
    const tankCapacity = parseInt(document.getElementById('tankCapacity').value);
    const irrigationVolume = parseInt(document.getElementById('irrigationVolume').value);
    const lowLevelThreshold = parseInt(document.getElementById('lowLevelThreshold').value);
    const schedule1 = document.getElementById('schedule1').value;
    const schedule2 = document.getElementById('schedule2').value;
    const schedule1Enabled = document.getElementById('schedule1Enabled').checked;
    const schedule2Enabled = document.getElementById('schedule2Enabled').checked;
    
    const soilMin = parseInt(document.getElementById('soilMoistureMin').value);
    const soilMax = parseInt(document.getElementById('soilMoistureMax').value);
    const soilOptimal = parseInt(document.getElementById('soilMoistureOptimal').value);
    
    const duration = parseInt(document.getElementById('irrigationDuration').value);
    const interval = parseInt(document.getElementById('irrigationInterval').value);
    
    // Validation
    if (tankCapacity <= 0) {
        showNotification('Tank capacity must be greater than 0', 'error');
        return;
    }
    
    if (irrigationVolume <= 0 || irrigationVolume > tankCapacity) {
        showNotification('Irrigation volume must be between 1 and tank capacity', 'error');
        return;
    }
    
    if (lowLevelThreshold <= 0 || lowLevelThreshold > 100) {
        showNotification('Low level threshold must be between 1 and 100', 'error');
        return;
    }
    
    if (soilMin >= soilMax) {
        showNotification('Soil moisture minimum must be less than maximum', 'error');
        return;
    }
    
    if (soilOptimal < soilMin || soilOptimal > soilMax) {
        showNotification('Optimal soil moisture must be between minimum and maximum', 'error');
        return;
    }
    
    // Update settings
    currentSettings = {
        waterLevel: {
            tankCapacity: tankCapacity,
            irrigationVolume: irrigationVolume,
            lowLevelThreshold: lowLevelThreshold,
            schedule1: schedule1,
            schedule2: schedule2,
            schedule1Enabled: schedule1Enabled,
            schedule2Enabled: schedule2Enabled
        },
        soilMoisture: {
            min: soilMin,
            max: soilMax,
            optimal: soilOptimal
        },
        irrigation: {
            duration: duration,
            interval: interval
        },
        alerts: {
            enabled: document.getElementById('enableAlerts').checked,
            autoIrrigation: document.getElementById('enableAutoIrrigation').checked
        }
    };
    
    // Save to localStorage
    saveSettingsToStorage();
    
    // Comprehensive system integration
    integrateAllSystems();
    
    // Update water level manager if available
    if (window.waterVolumeManager) {
        window.waterVolumeManager.updateSettings({
            tankCapacity: tankCapacity,
            irrigationVolume: irrigationVolume,
            lowLevelThreshold: lowLevelThreshold,
            schedules: [
                { time: schedule1, enabled: schedule1Enabled },
                { time: schedule2, enabled: schedule2Enabled }
            ]
        });
    }
    
    // Update UI
    updateControlPanelDisplay();
    
    // Show success message
    showNotification('Settings saved successfully!', 'success');
    
    // Close modal
    closeSettings();
}

// Comprehensive system integration function
function integrateAllSystems() {
    const activeSchedules = [
        ...(currentSettings.waterLevel.schedule1Enabled ? [currentSettings.waterLevel.schedule1] : []),
        ...(currentSettings.waterLevel.schedule2Enabled ? [currentSettings.waterLevel.schedule2] : [])
    ];
    
    // Update water level manager
    if (window.waterVolumeManager) {
        window.waterVolumeManager.updateSettings({
            tankCapacity: currentSettings.waterLevel.tankCapacity,
            irrigationVolume: currentSettings.waterLevel.irrigationVolume,
            lowLevelThreshold: currentSettings.waterLevel.lowLevelThreshold,
            schedules: [
                { time: currentSettings.waterLevel.schedule1, enabled: currentSettings.waterLevel.schedule1Enabled },
                { time: currentSettings.waterLevel.schedule2, enabled: currentSettings.waterLevel.schedule2Enabled }
            ],
            autoIrrigation: currentSettings.alerts.autoIrrigation
        });
    }
    
    // Update soil moisture manager
    if (window.soilMoistureManager) {
        window.soilMoistureManager.updateSettings({
            irrigationDuration: currentSettings.irrigation.duration,
            scheduledIrrigations: activeSchedules,
            moistureThresholds: {
                min: currentSettings.soilMoisture.min,
                max: currentSettings.soilMoisture.max,
                optimal: currentSettings.soilMoisture.optimal
            },
            autoIrrigation: currentSettings.alerts.autoIrrigation,
            forceSync: true
        });
    }
    
    // Update weather integration
    if (window.weatherAPI) {
        // Ensure weather affects soil moisture properly
        const currentWeather = window.weatherAPI.getCurrentWeather();
        if (window.soilMoistureManager) {
            window.soilMoistureManager.setWeather(currentWeather.condition);
        }
    }
    
    // Force synchronization between all managers
    setTimeout(() => {
        if (window.waterVolumeManager && window.soilMoistureManager) {
            // Sync schedules
            window.waterVolumeManager.syncWithSoilManager();
            window.soilMoistureManager.forceSyncScheduledIrrigations();
            
            // Update displays
            window.waterVolumeManager.updateDisplay();
            window.waterVolumeManager.updateNextScheduleDisplay();
            window.soilMoistureManager.updateDisplay();
            window.soilMoistureManager.updateNextScheduleDisplay();
            
            // Update control panel
            updateControlPanelDisplay();
        }
    }, 300);
}

// Reset settings to default
function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
        currentSettings = {
            waterLevel: {
                tankCapacity: 90,
                irrigationVolume: 7,
                lowLevelThreshold: 20,
                schedule1: '07:00',
                schedule2: '16:00',
                schedule1Enabled: true,
                schedule2Enabled: true
            },
            soilMoisture: {
                min: 40,
                max: 80,
                optimal: 65
            },
            irrigation: {
                duration: 15,
                interval: 30
            },
            alerts: {
                enabled: true,
                autoIrrigation: true
            }
        };
        
        updateSettingsUI();
        showNotification('Settings reset to default values', 'success');
        
        // Comprehensive system integration after reset
        integrateAllSystems();
    }
}

// Show notification
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        z-index: 1001;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background: linear-gradient(135deg, #10b981, #059669);' : 'background: linear-gradient(135deg, #ef4444, #dc2626);'}
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        max-width: 300px;
        font-size: 14px;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Get current settings (for use by other modules)
function getCurrentSettings() {
    return currentSettings;
}

// Check if irrigation should be triggered based on current settings
function shouldTriggerIrrigation(waterLevel, soilMoisture) {
    if (!currentSettings.alerts.autoIrrigation) {
        return false;
    }
    
    // Check if water level is sufficient
    if (waterLevel < currentSettings.waterLevel.alert) {
        return false;
    }
    
    // Check if soil moisture is below minimum
    return soilMoisture < currentSettings.soilMoisture.min;
}

// Check if irrigation should stop based on current settings
function shouldStopIrrigation(soilMoisture) {
    return soilMoisture >= currentSettings.soilMoisture.max;
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    
    // Close modal when clicking outside
    document.getElementById('settingsModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeSettings();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('settingsModal').classList.contains('show')) {
            closeSettings();
        }
    });
});

// Export functions for use by other modules
window.irrigationSettings = {
    getCurrentSettings,
    shouldTriggerIrrigation,
    shouldStopIrrigation,
    openSettings,
    closeSettings,
    saveSettings,
    resetSettings
};