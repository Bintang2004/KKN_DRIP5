// Soil Moisture Management System
class SoilMoistureManager {
    constructor() {
        this.settings = {
            currentMoisture: 45, // percentage
            irrigationDuration: 15, // minutes (configurable from settings)
            moistureIncreaseRate: 2.0, // percentage per minute during irrigation
            moistureDecreaseRate: {
                cerah: 1, // percentage per 15 minutes (faster evaporation)
                mendung: 1, // percentage per 30 minutes (slower evaporation)
                hujan: 0 // no decrease during rain
            },
            weather: 'cerah', // cerah, mendung, hujan
            isIrrigating: false,
            irrigationStartTime: null,
            irrigationTargetMoisture: 40, // target moisture after irrigation (25-40% range)
            lastUpdate: new Date(),
            autoWeatherChange: true,
            scheduledIrrigations: ['07:00', '16:00'], // 7 AM and 4 PM
            lastIrrigationCheck: new Date(),
            lastMoistureDecrease: new Date(),
            moistureDecreaseAccumulator: 0 // Track partial decreases
        };
        
        this.moistureRanges = {
            'Sangat Kering': { min: 0, max: 15, color: '#ef4444', status: 'dry' },
            'Kering': { min: 16, max: 24, color: '#f59e0b', status: 'low' },
            'Optimal (Drip Irrigation)': { min: 25, max: 40, color: '#10b981', status: 'wet' },
            'Lembap': { min: 41, max: 69, color: '#3b82f6', status: 'very-wet' },
            'Sangat Basah (Hujan)': { min: 70, max: 100, color: '#8b5cf6', status: 'saturated' }
        };
        
        this.weatherIcons = {
            cerah: '☀️',
            mendung: '☁️',
            hujan: '🌧️'
        };
        
        this.loadSettings();
        this.initializeSystem();
        this.startMoistureSimulation();
        this.startScheduledIrrigationCheck();
    }

    loadSettings() {
        const saved = localStorage.getItem('soilMoistureSettings');
        if (saved) {
            const savedSettings = JSON.parse(saved);
            // Ensure all numeric values are valid
            if (typeof savedSettings.currentMoisture === 'number' && !isNaN(savedSettings.currentMoisture)) {
                this.settings.currentMoisture = savedSettings.currentMoisture;
            }
            if (typeof savedSettings.irrigationDuration === 'number' && !isNaN(savedSettings.irrigationDuration)) {
                this.settings.irrigationDuration = savedSettings.irrigationDuration;
            }
            // Copy other valid settings
            this.settings.weather = savedSettings.weather || this.settings.weather;
            this.settings.isIrrigating = savedSettings.isIrrigating || false;
            this.settings.scheduledIrrigations = savedSettings.scheduledIrrigations || this.settings.scheduledIrrigations;
        }
        
        // Sync with irrigation settings if available
        const irrigationSettings = localStorage.getItem('irrigationSettings');
        if (irrigationSettings) {
            const parsed = JSON.parse(irrigationSettings);
            if (parsed.irrigation) {
                this.settings.irrigationDuration = parsed.irrigation.duration || 15;
            }
            if (parsed.waterLevel) {
                this.settings.scheduledIrrigations = [
                    parsed.waterLevel.schedule1 || '07:00',
                    parsed.waterLevel.schedule2 || '16:00'
                ];
            }
        }
        
        // Ensure currentMoisture is a valid number
        if (typeof this.settings.currentMoisture !== 'number' || isNaN(this.settings.currentMoisture) || this.settings.currentMoisture < 0 || this.settings.currentMoisture > 100) {
            this.settings.currentMoisture = 45;
        }
        
        // Ensure irrigationDuration is valid
        if (typeof this.settings.irrigationDuration !== 'number' || isNaN(this.settings.irrigationDuration) || this.settings.irrigationDuration < 5) {
            this.settings.irrigationDuration = 15;
        }
    }

    saveSettings() {
        // Validate data before saving
        const settingsToSave = {
            ...this.settings,
            currentMoisture: typeof this.settings.currentMoisture === 'number' && !isNaN(this.settings.currentMoisture) ? this.settings.currentMoisture : 45,
            irrigationDuration: typeof this.settings.irrigationDuration === 'number' && !isNaN(this.settings.irrigationDuration) ? this.settings.irrigationDuration : 7
        };
        localStorage.setItem('soilMoistureSettings', JSON.stringify(this.settings));
    }

    initializeSystem() {
        // Force immediate display update
        this.updateDisplay();
        
        // Create weather control
        this.updateDisplay();
        this.createWeatherControl();
        
        // Listen for irrigation events from water volume manager
        if (window.waterVolumeManager) {
            this.setupIrrigationListener();
        }
        
        // Listen for weather updates from WeatherAPI
        this.setupWeatherListener();
        
        // Setup irrigation synchronization with water volume manager
        this.setupIrrigationSync();
        
        // Force another update after 1 second to ensure everything is loaded
        setTimeout(() => {
            this.updateDisplay();
        }, 1000);
    }

    createWeatherControl() {
        // Add weather control to the soil moisture card
        const soilCard = document.querySelector('.metric-card:nth-child(2)');
        const existingControl = document.getElementById('weather-control');
        
        if (soilCard && !existingControl) {
            const weatherControl = document.createElement('div');
            weatherControl.id = 'weather-control';
            weatherControl.className = 'weather-control';
            weatherControl.innerHTML = `
                <div class="weather-header">
                    <span class="weather-label">Cuaca:</span>
                    <span class="weather-display" id="weather-display">${this.weatherIcons[this.settings.weather]} ${this.settings.weather.charAt(0).toUpperCase() + this.settings.weather.slice(1)}</span>
                </div>
                <div class="weather-buttons">
                    <button class="weather-btn ${this.settings.weather === 'cerah' ? 'active' : ''}" onclick="soilMoistureManager.setWeather('cerah')" title="Evaporasi: -1% per 15 menit">☀️ Cerah</button>
                    <button class="weather-btn ${this.settings.weather === 'mendung' ? 'active' : ''}" onclick="soilMoistureManager.setWeather('mendung')" title="Evaporasi: -1% per 30 menit">☁️ Mendung</button>
                    <button class="weather-btn ${this.settings.weather === 'hujan' ? 'active' : ''}" onclick="soilMoistureManager.setWeather('hujan')" title="Kelembaban naik ke 75-90%">🌧️ Hujan</button>
                </div>
            `;
            
            // Insert weather control at the end (after empty moisture button)
            soilCard.appendChild(weatherControl);
        } else if (existingControl) {
            // If control exists, move it to the end
            soilCard.appendChild(existingControl);
        }
    }

    setupIrrigationSync() {
        // Wait for water volume manager to be available
        const checkWaterManager = () => {
            if (window.waterVolumeManager) {
                this.syncWithWaterManager();
            } else {
                setTimeout(checkWaterManager, 500);
            }
        };
        checkWaterManager();
    }

    syncWithWaterManager() {
        // Override water volume manager's performIrrigation to sync with soil moisture
        const originalPerformIrrigation = window.waterVolumeManager.performIrrigation.bind(window.waterVolumeManager);
        
        window.waterVolumeManager.performIrrigation = () => {
            // Check if water is sufficient
            if (window.waterVolumeManager.settings.currentLevel >= window.waterVolumeManager.settings.irrigationVolume) {
                // Perform water volume irrigation
                originalPerformIrrigation();
                
                // Start soil moisture irrigation
                this.startIrrigation();
                
                // Show combined notification
                this.showNotification(`🌱 Penyiraman manual dimulai - ${window.waterVolumeManager.settings.irrigationVolume}L digunakan`, 'success');
            } else {
                this.showNotification('Air tidak cukup untuk penyiraman!', 'error');
            }
        };
        
        // Sync scheduled irrigation times
        this.syncScheduledIrrigations();
    }

    syncScheduledIrrigations() {
        // Get schedules from water volume manager
        if (window.waterVolumeManager && window.waterVolumeManager.settings.schedules) {
            const activeSchedules = window.waterVolumeManager.settings.schedules
                .filter(schedule => schedule.enabled)
                .map(schedule => schedule.time);
            
            this.settings.scheduledIrrigations = activeSchedules;
            this.saveSettings();
        }
    }

    setupWeatherListener() {
        // Check for weather updates every minute
        setInterval(() => {
            if (window.weatherAPI) {
                const currentWeather = window.weatherAPI.getCurrentWeather();
                if (currentWeather.condition !== this.settings.weather) {
                    this.settings.weather = currentWeather.condition;
                    this.updateWeatherDisplay();
                    this.saveSettings();
                }
            }
        }, 60000);
    }

    updateWeatherDisplay() {
        const weatherDisplay = document.getElementById('weather-display');
        if (weatherDisplay) {
            weatherDisplay.textContent = `${this.weatherIcons[this.settings.weather]} ${this.settings.weather.charAt(0).toUpperCase() + this.settings.weather.slice(1)}`;
        }
        this.updateWeatherButtons();
    }

    setupIrrigationListener() {
        // Override the performIrrigation method to trigger soil moisture increase
        const originalPerformIrrigation = window.waterVolumeManager.performIrrigation.bind(window.waterVolumeManager);
        
        window.waterVolumeManager.performIrrigation = () => {
            const result = originalPerformIrrigation();
            if (window.waterVolumeManager.settings.currentLevel >= window.waterVolumeManager.settings.irrigationVolume) {
                this.startIrrigation();
            }
            return result;
        };
    }

    startScheduledIrrigationCheck() {
        // Check every minute for scheduled irrigations
        setInterval(() => {
            this.checkScheduledIrrigation();
        }, 60000);
    }

    checkScheduledIrrigation() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Force sync schedules with water volume manager
        this.forceSyncScheduledIrrigations();
        
        // Check if it's time for scheduled irrigation
        if (this.settings.scheduledIrrigations.includes(currentTime)) {
            const lastCheck = new Date(this.settings.lastIrrigationCheck);
            const timeSinceLastCheck = (now - lastCheck) / 1000 / 60; // minutes
            
            // Only trigger if we haven't checked in the last 2 minutes (prevent multiple triggers)
            if (timeSinceLastCheck > 2) {
                this.settings.lastIrrigationCheck = now;
                this.saveSettings();
                
                // Don't trigger here - let water volume manager handle it
                // This prevents double triggering
                console.log(`Scheduled irrigation time detected: ${currentTime}`);
            }
        }
    }

    forceSyncScheduledIrrigations() {
        // Force immediate sync with water volume manager settings
        if (window.waterVolumeManager && window.waterVolumeManager.settings.schedules) {
            const activeSchedules = window.waterVolumeManager.settings.schedules
                .filter(schedule => schedule.enabled)
                .map(schedule => schedule.time);
            
            // Only update if schedules have changed
            const currentSchedulesStr = JSON.stringify(this.settings.scheduledIrrigations.sort());
            const newSchedulesStr = JSON.stringify(activeSchedules.sort());
            
            if (currentSchedulesStr !== newSchedulesStr) {
                this.settings.scheduledIrrigations = activeSchedules;
                this.saveSettings();
                console.log('✅ Soil moisture schedules synced with water manager:', activeSchedules);
            }
        }
        
        // Also sync with global irrigation settings
        const irrigationSettings = localStorage.getItem('irrigationSettings');
        if (irrigationSettings) {
            try {
                const parsed = JSON.parse(irrigationSettings);
                if (parsed.waterLevel) {
                    const globalSchedules = [
                        ...(parsed.waterLevel.schedule1Enabled ? [parsed.waterLevel.schedule1] : []),
                        ...(parsed.waterLevel.schedule2Enabled ? [parsed.waterLevel.schedule2] : [])
                    ];
                    
                    const currentSchedulesStr = JSON.stringify(this.settings.scheduledIrrigations.sort());
                    const globalSchedulesStr = JSON.stringify(globalSchedules.sort());
                    
                    if (currentSchedulesStr !== globalSchedulesStr) {
                        this.settings.scheduledIrrigations = globalSchedules;
                        this.saveSettings();
                        console.log('✅ Soil moisture schedules synced with global settings:', globalSchedules);
                    }
                }
            } catch (e) {
                console.error('Error syncing with global settings:', e);
            }
        }
        
        // Update next schedule display in control panel
        this.updateNextScheduleDisplay();
    }
    
    updateNextScheduleDisplay() {
        const nextScheduleElement = document.getElementById('next-schedule');
        if (!nextScheduleElement) return;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        // Get enabled schedules and convert to minutes
        const enabledSchedules = this.settings.scheduledIrrigations
            .map(timeString => {
                const [hours, minutes] = timeString.split(':').map(Number);
                return { time: timeString, minutes: hours * 60 + minutes };
            })
            .sort((a, b) => a.minutes - b.minutes);
        
        if (enabledSchedules.length === 0) {
            nextScheduleElement.textContent = 'Tidak ada jadwal';
            return;
        }
        
        // Find next schedule
        let nextSchedule = enabledSchedules.find(schedule => schedule.minutes > currentTime);
        
        // If no schedule today, use first schedule tomorrow
        if (!nextSchedule) {
            nextSchedule = enabledSchedules[0];
            nextScheduleElement.textContent = `${nextSchedule.time}`;
            
            // Update description to show it's tomorrow
            const descriptionElement = document.querySelector('.control-item:nth-child(4) .control-description');
            if (descriptionElement) {
                descriptionElement.textContent = 'Besok pagi';
            }
        } else {
            nextScheduleElement.textContent = nextSchedule.time;
            
            // Update description for today's schedule
            const descriptionElement = document.querySelector('.control-item:nth-child(4) .control-description');
            if (descriptionElement) {
                const hoursUntil = Math.floor((nextSchedule.minutes - currentTime) / 60);
                const minutesUntil = (nextSchedule.minutes - currentTime) % 60;
                
                if (hoursUntil > 0) {
                    descriptionElement.textContent = `Dalam ${hoursUntil} jam ${minutesUntil} menit`;
                } else {
                    descriptionElement.textContent = `Dalam ${minutesUntil} menit`;
                }
            }
        }
        
        console.log('🕐 Soil manager next schedule updated:', nextSchedule ? nextSchedule.time : 'None', 'from schedules:', this.settings.scheduledIrrigations);
    }

    startIrrigation() {
        if (this.settings.isIrrigating) return;
        
        // Ensure currentMoisture is valid before starting irrigation
        if (typeof this.settings.currentMoisture !== 'number' || isNaN(this.settings.currentMoisture)) {
            this.settings.currentMoisture = 45;
        }
        
        this.settings.isIrrigating = true;
        this.settings.irrigationStartTime = new Date();
        
        // Calculate target moisture and increase rate
        const currentMoisture = this.settings.currentMoisture;
        const targetMoisture = Math.min(40, Math.max(25, currentMoisture + 12)); // Target 25-40% range
        this.settings.irrigationTargetMoisture = targetMoisture;
        
        // Reset evaporation accumulator during irrigation
        this.settings.moistureDecreaseAccumulator = 0;
        
        const duration = typeof this.settings.irrigationDuration === 'number' && !isNaN(this.settings.irrigationDuration) ? this.settings.irrigationDuration : 15;
        
        this.saveSettings();
        
        // Only show notification if not triggered by water volume manager
        if (!window.waterVolumeManager || !window.waterVolumeManager.settings.isIrrigating) {
            this.showNotification(`🌱 Drip irrigation dimulai - target ${targetMoisture.toFixed(1)}% (${duration} menit)`, 'success');
        }
        
        // Stop irrigation after duration
        setTimeout(() => {
            this.stopIrrigation();
        }, duration * 60 * 1000);
    }

    stopIrrigation() {
        if (!this.settings.isIrrigating) return;
        
        this.settings.isIrrigating = false;
        this.settings.irrigationStartTime = null;
        
        // Reset evaporation accumulator after irrigation
        this.settings.moistureDecreaseAccumulator = 0;
        this.settings.lastMoistureDecrease = new Date();
        
        this.saveSettings();
        
        const finalMoisture = this.settings.currentMoisture.toFixed(1);
        
        // Only show notification if not managed by water volume manager
        if (!window.waterVolumeManager || !window.waterVolumeManager.settings.isIrrigating) {
            this.showNotification(`🌱 Drip irrigation selesai - kelembaban: ${finalMoisture}%`, 'success');
        }
        
        // Log the irrigation event
        this.logMoisture('irrigation_complete');
    }

    setWeather(weather) {
        const oldWeather = this.settings.weather;
        this.settings.weather = weather;
        this.saveSettings();
        
        // Update weather display
        const weatherDisplay = document.getElementById('weather-display');
        if (weatherDisplay) {
            weatherDisplay.textContent = `${this.weatherIcons[weather]} ${weather.charAt(0).toUpperCase() + weather.slice(1)}`;
        }
        
        // Update active button
        this.updateWeatherButtons();
        
        // Handle rain effect
        if (weather === 'hujan' && oldWeather !== 'hujan') {
            this.applyRainEffect();
        }
        
        this.showNotification(`Cuaca diubah ke ${weather}`, 'success');
    }

    emptyMoisture() {
        this.settings.currentMoisture = 0;
        this.settings.moistureDecreaseAccumulator = 0;
        this.updateDisplay();
        this.saveSettings();
        this.logMoisture('manual_empty');
        this.showNotification('Kelembaban tanah dikosongkan (0%)', 'success');
    }

    applyRainEffect() {
        // Rain immediately increases moisture to 70-90% (saturated)
        const rainMoisture = 75 + Math.random() * 15; // 75-90%
        this.settings.currentMoisture = Math.min(100, Math.max(0, rainMoisture));
        
        // Reset evaporation accumulator during rain
        this.settings.moistureDecreaseAccumulator = 0;
        
        this.updateDisplay();
        this.saveSettings();
        this.logMoisture('rain_event');
        this.showNotification('🌧️ Hujan meningkatkan kelembaban tanah!', 'success');
    }

    startMoistureSimulation() {
        // Update moisture every 1 minute for realistic time-based changes
        this.moistureInterval = setInterval(() => {
            this.updateMoisture();
        }, 60000); // 1 minute intervals
        
        // Update display every 15 seconds to ensure UI sync
        this.displayInterval = setInterval(() => {
            this.updateDisplay();
        }, 15000);
    }

    updateWeatherButtons() {
        document.querySelectorAll('.weather-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Find and activate the correct button
        const buttons = document.querySelectorAll('.weather-btn');
        buttons.forEach(btn => {
            if (btn.textContent.toLowerCase().includes(this.settings.weather)) {
                btn.classList.add('active');
            }
        });
    }

    updateMoisture() {
        const now = new Date();
        const lastUpdate = this.settings.lastUpdate ? new Date(this.settings.lastUpdate) : new Date(now.getTime() - 60000);
        const timeDiff = (now - lastUpdate) / 1000 / 60; // minutes
        
        // Prevent excessive time differences (max 60 minutes for stability)
        const actualTimeDiff = Math.min(timeDiff, 60);
        
        // Ensure currentMoisture is valid before calculations
        if (typeof this.settings.currentMoisture !== 'number' || isNaN(this.settings.currentMoisture)) {
            this.settings.currentMoisture = 45;
        }
        
        let moistureChanged = false;
        
        if (this.settings.isIrrigating) {
            // Increase moisture during irrigation
            this.processIrrigationIncrease(actualTimeDiff);
            moistureChanged = true;
        } else if (this.settings.weather !== 'hujan') {
            // Process natural evaporation based on weather
            moistureChanged = this.processNaturalEvaporation(actualTimeDiff);
        }
        
        // Ensure final value is valid
        if (typeof this.settings.currentMoisture !== 'number' || isNaN(this.settings.currentMoisture)) {
            this.settings.currentMoisture = 45;
            moistureChanged = true;
        }
        
        // Clamp values to valid range
        const oldMoisture = this.settings.currentMoisture;
        this.settings.currentMoisture = Math.max(0, Math.min(100, this.settings.currentMoisture));
        if (oldMoisture !== this.settings.currentMoisture) moistureChanged = true;
        
        this.settings.lastUpdate = now;
        this.saveSettings();
        
        // Only update display if moisture actually changed
        if (moistureChanged) {
            this.updateDisplay();
        }
        
        // Log moisture changes periodically
        if (Math.random() < 0.1) { // 10% chance to log each update
            this.logMoisture('periodic_update');
        }
    }

    processIrrigationIncrease(timeDiff) {
        const irrigationStartTime = this.settings.irrigationStartTime ? new Date(this.settings.irrigationStartTime) : new Date();
        const irrigationTime = (new Date() - irrigationStartTime) / 1000 / 60; // minutes
        
        if (irrigationTime <= this.settings.irrigationDuration) {
            // Gradual increase during irrigation
            // Target: increase from current to 25-40% range over irrigation duration
            const targetMoisture = Math.min(40, Math.max(25, this.settings.currentMoisture + 15));
            const totalIncrease = targetMoisture - this.settings.currentMoisture;
            const increaseRate = totalIncrease / this.settings.irrigationDuration;
            
            const increaseAmount = increaseRate * timeDiff;
            this.settings.currentMoisture = Math.min(targetMoisture, this.settings.currentMoisture + increaseAmount);
            
            // Ensure we don't exceed 40% during drip irrigation
            this.settings.currentMoisture = Math.min(40, this.settings.currentMoisture);
        }
    }

    processNaturalEvaporation(timeDiff) {
        let moistureChanged = false;
        const oldMoisture = this.settings.currentMoisture;
        
        // Get evaporation parameters based on weather
        const evaporationParams = this.getEvaporationParameters();
        
        if (evaporationParams.rate > 0) {
            // Add time to accumulator
            this.settings.moistureDecreaseAccumulator += timeDiff;
            
            // Check if enough time has passed for a decrease
            while (this.settings.moistureDecreaseAccumulator >= evaporationParams.interval) {
                // Apply one decrease unit
                this.settings.currentMoisture = Math.max(0, this.settings.currentMoisture - evaporationParams.rate);
                this.settings.moistureDecreaseAccumulator -= evaporationParams.interval;
                moistureChanged = true;
                
                // Log evaporation event
                if (Math.random() < 0.3) { // 30% chance to log
                    this.logMoisture(`evaporation_${this.settings.weather}`);
                }
            }
        }
        
        return moistureChanged;
    }

    getEvaporationParameters() {
        switch (this.settings.weather) {
            case 'cerah':
                return {
                    rate: 1, // 1% decrease
                    interval: 15, // every 15 minutes
                    description: 'Evaporasi cepat (cuaca cerah)'
                };
            case 'mendung':
                return {
                    rate: 1, // 1% decrease  
                    interval: 30, // every 30 minutes
                    description: 'Evaporasi lambat (cuaca mendung)'
                };
            case 'hujan':
                return {
                    rate: 0, // no decrease during rain
                    interval: Infinity,
                    description: 'Tidak ada evaporasi (hujan)'
                };
            default:
                return {
                    rate: 1,
                    interval: 20, // default 20 minutes
                    description: 'Evaporasi normal'
                };
        }
    }

    updateDisplay() {
        // Ensure currentMoisture is a valid number
        if (typeof this.settings.currentMoisture !== 'number' || isNaN(this.settings.currentMoisture) || this.settings.currentMoisture < 0 || this.settings.currentMoisture > 100) {
            this.settings.currentMoisture = 45.0;
            this.saveSettings();
        }
        
        // Update soil moisture value
        const soilMoistureValue = document.getElementById('soil-moisture-value');
        if (soilMoistureValue) {
            const moistureValue = Number(this.settings.currentMoisture);
            if (!isNaN(moistureValue) && moistureValue >= 0 && moistureValue <= 100) {
                soilMoistureValue.textContent = `${moistureValue.toFixed(1)}%`;
            } else {
                soilMoistureValue.textContent = '45.0%';
                this.settings.currentMoisture = 45.0;
                this.saveSettings();
            }
        } else {
            // If element not found, try again in 500ms
            setTimeout(() => {
                this.updateDisplay();
            }, 500);
        }
        
        // Update status badge
        const statusBadge = document.querySelector('.metric-card:nth-child(2) .status-badge');
        if (statusBadge) {
            const moistureValue = Number(this.settings.currentMoisture);
            const range = this.getMoistureRange(moistureValue);
            
            // Map status to display text
            const statusText = {
                'dry': 'DRY',
                'low': 'LOW', 
                'wet': 'WET',
                'very-wet': 'VERY WET',
                'saturated': 'SATURATED'
            };
            
            statusBadge.textContent = statusText[range.status] || 'WET';
            statusBadge.className = `status-badge ${range.status}`;
        }
        
        // Update weather display to match current weather
        this.updateWeatherDisplay();
        
        // Update irrigation status if currently irrigating
        if (this.settings.isIrrigating) {
            const irrigationCard = document.querySelector('.metric-card:nth-child(3)');
            if (irrigationCard) {
                const statusBadge = irrigationCard.querySelector('.status-badge');
                const metricValue = irrigationCard.querySelector('.metric-value');
                
                if (statusBadge) {
                    statusBadge.textContent = 'IRRIGATING';
                    statusBadge.className = 'status-badge running';
                }
                if (metricValue) metricValue.textContent = 'Drip Active';
            }
        } else {
            // Reset irrigation status when not irrigating
            const irrigationCard = document.querySelector('.metric-card:nth-child(3)');
            if (irrigationCard) {
                const statusBadge = irrigationCard.querySelector('.status-badge');
                const metricValue = irrigationCard.querySelector('.metric-value');
                
                if (statusBadge) {
                    statusBadge.textContent = 'STANDBY';
                    statusBadge.className = 'status-badge running';
                }
                if (metricValue) metricValue.textContent = 'Ready';
            }
        }
        
        // Force chart update if available
        if (window.charts && window.charts['chart2']) {
            this.updateChart();
        }
    }

    updateChart() {
        // Update chart with current data
        if (window.charts && window.charts['chart2']) {
            const currentData = this.getChartData('daily');
            const chart = window.charts['chart2'];
            
            // Update chart data
            chart.data.datasets[0].data = currentData;
            chart.update('none'); // Update without animation for smooth real-time updates
            
            // Update average display
            if (currentData.length > 0) {
                const average = currentData.reduce((sum, point) => sum + point.y, 0) / currentData.length;
                const averageElement = document.getElementById('average2-value');
                if (averageElement) {
                    averageElement.textContent = `${average.toFixed(1)} %`;
                }
            }
        }
    }

    getMoistureRange(moisture) {
        for (const [name, range] of Object.entries(this.moistureRanges)) {
            if (moisture >= range.min && moisture <= range.max) {
                return { ...range, name };
            }
        }
        return this.moistureRanges['Sangat Kering']; // fallback
    }

    getChartData(period) {
        // Generate realistic chart data based on irrigation and weather patterns
        const logs = JSON.parse(localStorage.getItem('soilMoistureLogs') || '[]');
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'monthly':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
        
        // Generate simulated data if no logs exist or insufficient data
        if (logs.length < 10) {
            return this.generateRealisticSimulatedData(startDate, now, period);
        }
        
        const filteredLogs = logs.filter(log => new Date(log.timestamp) >= startDate);
        
        const chartData = [];
        filteredLogs.forEach(log => {
            chartData.push({
                x: new Date(log.timestamp),
                y: log.moisture
            });
        });
        
        // Add current moisture as end point
        chartData.push({
            x: now,
            y: this.settings.currentMoisture
        });
        
        return chartData;
    }

    generateRealisticSimulatedData(startDate, endDate, period) {
        const data = [];
        const intervalMinutes = period === 'daily' ? 15 : period === 'weekly' ? 60 : 240; // 15min, 1h, 4h
        
        let currentTime = new Date(startDate);
        let moisture = Math.max(20, this.settings.currentMoisture - 10); // Start near current value
        let weather = 'cerah'; // Default weather
        let evaporationAccumulator = 0;
        
        while (currentTime <= endDate) {
            const hour = currentTime.getHours();
            const minute = currentTime.getMinutes();
            
            // Simulate weather changes (20% chance every 4 hours)
            if (hour % 4 === 0 && minute === 0 && Math.random() < 0.2) {
                const weatherOptions = ['cerah', 'mendung', 'hujan'];
                weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
            }
            
            // Simulate irrigation at scheduled times
            if ((hour === 7 || hour === 16) && minute === 0 && moisture < 35) {
                // Irrigation event - gradual increase over 15 minutes
                const irrigationDuration = 15;
                const targetMoisture = Math.min(40, moisture + 12);
                const increasePerMinute = (targetMoisture - moisture) / irrigationDuration;
                
                for (let i = 0; i <= irrigationDuration; i += 5) {
                    const irrigationTime = new Date(currentTime.getTime() + i * 60 * 1000);
                    moisture += increasePerMinute * 5; // Increase every 5 minutes
                    moisture = Math.min(40, moisture); // Cap at 40% for drip irrigation
                    
                    data.push({
                        x: new Date(irrigationTime),
                        y: parseFloat(moisture.toFixed(1))
                    });
                }
                evaporationAccumulator = 0; // Reset after irrigation
            } else {
                // Natural evaporation based on weather
                evaporationAccumulator += intervalMinutes;
                
                let shouldDecrease = false;
                
                if (weather === 'cerah' && evaporationAccumulator >= 15) {
                    moisture = Math.max(0, moisture - 1); // -1% per 15 minutes
                    evaporationAccumulator -= 15;
                    shouldDecrease = true;
                } else if (weather === 'mendung' && evaporationAccumulator >= 30) {
                    moisture = Math.max(0, moisture - 1); // -1% per 30 minutes
                    evaporationAccumulator -= 30;
                    shouldDecrease = true;
                } else if (weather === 'hujan') {
                    // Rain effect - immediate increase to 75-90%
                    if (Math.random() < 0.3) { // 30% chance of rain effect
                        moisture = 75 + Math.random() * 15;
                        evaporationAccumulator = 0;
                    }
                }
            
                data.push({
                    x: new Date(currentTime),
                    y: parseFloat(moisture.toFixed(1))
                });
            }
            
            currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
        }
        
        // Ensure the last data point matches current moisture
        if (data.length > 0) {
            data[data.length - 1].y = this.settings.currentMoisture;
        }
        
        return data;
    }

    logMoisture(eventType = 'update') {
        const logs = JSON.parse(localStorage.getItem('soilMoistureLogs') || '[]');
        logs.push({
            timestamp: new Date().toISOString(),
            moisture: this.settings.currentMoisture,
            weather: this.settings.weather,
            isIrrigating: this.settings.isIrrigating,
            eventType: eventType,
            evaporationAccumulator: this.settings.moistureDecreaseAccumulator
        });
        
        // Keep only last 1000 logs
        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }
        
        localStorage.setItem('soilMoistureLogs', JSON.stringify(logs));
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            z-index: 1001;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            font-size: 14px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        `;
        
        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else if (type === 'info') {
            notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
        } else {
            notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Force immediate sync of schedules
        this.forceSyncScheduledIrrigations();
        
        // Validate numeric settings
        if (typeof this.settings.currentMoisture !== 'number' || isNaN(this.settings.currentMoisture)) {
            this.settings.currentMoisture = 45;
        }
        
        // Update irrigation duration and recalculate rates if needed
        if (newSettings.irrigationDuration) {
            const duration = parseFloat(newSettings.irrigationDuration);
            if (!isNaN(duration) && duration >= 5) {
                this.settings.irrigationDuration = duration;
            }
        }
        
        // Update moisture thresholds
        if (newSettings.moistureThresholds) {
            this.settings.moistureThresholds = newSettings.moistureThresholds;
        }
        
        // Update auto irrigation setting
        if (typeof newSettings.autoIrrigation === 'boolean') {
            this.settings.autoIrrigation = newSettings.autoIrrigation;
        }
        
        // Update scheduled irrigation times
        if (newSettings.scheduledIrrigations) {
            this.settings.scheduledIrrigations = newSettings.scheduledIrrigations;
            console.log('Soil moisture schedules updated:', this.settings.scheduledIrrigations);
        } else if (newSettings.schedules) {
            // Handle water volume manager schedule format
            this.settings.scheduledIrrigations = newSettings.schedules
                .filter(schedule => schedule.enabled)
                .map(schedule => schedule.time);
            console.log('Soil moisture schedules updated from water manager:', this.settings.scheduledIrrigations);
        }
        
        this.saveSettings();
        this.updateDisplay();
        
        // Force update next schedule display
        setTimeout(() => {
            this.updateNextScheduleDisplay();
        }, 100);
    }

    // Get current moisture status for other systems
    getCurrentMoistureStatus() {
        // Ensure valid data before returning
        if (typeof this.settings.currentMoisture !== 'number' || isNaN(this.settings.currentMoisture)) {
            this.settings.currentMoisture = 45;
            this.saveSettings();
        }
        
        return {
            moisture: this.settings.currentMoisture,
            range: this.getMoistureRange(this.settings.currentMoisture),
            isIrrigating: this.settings.isIrrigating,
            weather: this.settings.weather
        };
    }

    // Get detailed moisture status for debugging/monitoring
    getDetailedStatus() {
        const evaporationParams = this.getEvaporationParameters();
        
        return {
            currentMoisture: this.settings.currentMoisture,
            weather: this.settings.weather,
            isIrrigating: this.settings.isIrrigating,
            evaporationRate: evaporationParams.rate,
            evaporationInterval: evaporationParams.interval,
            evaporationAccumulator: this.settings.moistureDecreaseAccumulator,
            timeUntilNextDecrease: Math.max(0, evaporationParams.interval - this.settings.moistureDecreaseAccumulator),
            moistureRange: this.getMoistureRange(this.settings.currentMoisture),
            lastUpdate: this.settings.lastUpdate
        };
    }

    // Check if irrigation should be triggered based on moisture level
    shouldTriggerIrrigation() {
        // Use settings thresholds if available, otherwise default to 35%
        const threshold = this.settings.moistureThresholds ? this.settings.moistureThresholds.min : 35;
        return this.settings.currentMoisture < threshold && !this.settings.isIrrigating && this.settings.autoIrrigation !== false;
    }

    // Get irrigation effectiveness (how much moisture will increase)
    getIrrigationEffectiveness() {
        const currentMoisture = this.settings.currentMoisture;
        const targetMoisture = Math.min(40, Math.max(25, currentMoisture + 12));
        return {
            currentMoisture: currentMoisture,
            targetMoisture: targetMoisture,
            increase: targetMoisture - currentMoisture,
            duration: this.settings.irrigationDuration
        };
    }
}

// Initialize soil moisture manager
let soilMoistureManager;

document.addEventListener('DOMContentLoaded', function() {
    // Clear any corrupted data first
    const saved = localStorage.getItem('soilMoistureSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (typeof parsed.currentMoisture !== 'number' || isNaN(parsed.currentMoisture)) {
                localStorage.removeItem('soilMoistureSettings');
            }
        } catch (e) {
            localStorage.removeItem('soilMoistureSettings');
        }
    }
    
    // Initialize immediately
    soilMoistureManager = new SoilMoistureManager();
    window.soilMoistureManager = soilMoistureManager;
    
    // Force initial display update
    setTimeout(() => {
        if (window.soilMoistureManager) {
            window.soilMoistureManager.updateDisplay();
        }
    }, 100);
});