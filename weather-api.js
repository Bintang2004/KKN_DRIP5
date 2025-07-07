// Real-time Weather API Integration for Kelurahan Tanah Jaya, Bulukumba
class WeatherAPI {
    constructor() {
        this.location = {
            name: 'Kelurahan Tanah Jaya',
            city: 'Bulukumba',
            province: 'Sulawesi Selatan',
            lat: -5.5567, // Koordinat Bulukumba
            lon: 120.1989,
            timezone: 'Asia/Makassar' // WITA
        };
        
        // Multiple real-time weather API sources for maximum accuracy
        this.apiSources = [
            {
                name: 'OpenWeatherMap',
                url: 'https://api.openweathermap.org/data/2.5/weather',
                key: '4f4b8b9c8e8f4a5d9c7b6a3e2f1d0c9b', // Demo API key - replace with real key
                enabled: false, // Disabled for demo - enable with real API key
                priority: 1
            },
            {
                name: 'WeatherAPI',
                url: 'https://api.weatherapi.com/v1/current.json',
                key: 'b8a7c6d5e4f3g2h1i0j9k8l7m6n5o4p3', // Demo API key - replace with real key
                enabled: false, // Disabled for demo - enable with real API key
                priority: 2
            },
            {
                name: 'AccuWeather',
                url: 'https://dataservice.accuweather.com/currentconditions/v1/',
                key: 'x9y8z7a6b5c4d3e2f1g0h9i8j7k6l5m4', // Demo API key - replace with real key
                enabled: false, // Disabled for demo - enable with real API key
                priority: 3
            }
        ];
        
        this.currentWeather = {
            condition: 'cerah',
            temperature: 28,
            humidity: 65,
            windSpeed: 12,
            description: 'Cerah berawan',
            lastUpdate: new Date(),
            source: 'loading',
            pressure: 1013,
            visibility: 10,
            uvIndex: 5,
            cloudCover: 25
        };
        
        // Enhanced weather mapping for better accuracy
        this.weatherMapping = {
            // OpenWeatherMap condition codes
            '01d': 'cerah', '01n': 'cerah',
            '02d': 'cerah', '02n': 'cerah',
            '03d': 'mendung', '03n': 'mendung',
            '04d': 'mendung', '04n': 'mendung',
            '09d': 'hujan', '09n': 'hujan',
            '10d': 'hujan', '10n': 'hujan',
            '11d': 'hujan', '11n': 'hujan',
            '13d': 'hujan', '13n': 'hujan',
            '50d': 'mendung', '50n': 'mendung',
            
            // WeatherAPI condition codes
            'sunny': 'cerah',
            'clear': 'cerah',
            'partly-cloudy': 'cerah',
            'cloudy': 'mendung',
            'overcast': 'mendung',
            'mist': 'mendung',
            'fog': 'mendung',
            'light-rain': 'hujan',
            'moderate-rain': 'hujan',
            'heavy-rain': 'hujan',
            'thunderstorm': 'hujan'
        };
        
        this.initializeWeatherSystem();
    }

    async initializeWeatherSystem() {
        console.log('🌤️ Initializing real-time weather system...');
        
        // Try to get real weather data immediately
        await this.fetchRealWeatherData();
        
        // Set up frequent updates for real-time accuracy
        setInterval(() => {
            this.fetchRealWeatherData();
        }, 10 * 60 * 1000); // Update every 10 minutes
        
        // Set up hourly detailed updates
        setInterval(() => {
            this.fetchDetailedWeatherData();
        }, 60 * 60 * 1000); // Detailed update every hour
        
        // Emergency fallback check every 5 minutes
        setInterval(() => {
            this.checkWeatherDataFreshness();
        }, 5 * 60 * 1000);
    }

    async fetchRealWeatherData() {
        console.log('🔄 Fetching real-time weather data...');
        
        // Check if any API sources are enabled
        const enabledSources = this.apiSources.filter(source => source.enabled);
        
        if (enabledSources.length === 0) {
            console.log('ℹ️ No API sources enabled, using intelligent fallback...');
            this.generateIntelligentFallback();
            return;
        }
        
        // Try all API sources in priority order
        for (const source of enabledSources.sort((a, b) => a.priority - b.priority)) {
            if (!source.enabled) continue;
            
            try {
                let response;
                
                switch (source.name) {
                    case 'OpenWeatherMap':
                        response = await this.fetchFromOpenWeatherMap(source);
                        break;
                    case 'WeatherAPI':
                        response = await this.fetchFromWeatherAPI(source);
                        break;
                    case 'AccuWeather':
                        response = await this.fetchFromAccuWeather(source);
                        break;
                }
                
                if (response) {
                    this.processWeatherData(response, source.name);
                    console.log(`✅ Weather data successfully fetched from ${source.name}`);
                    return;
                }
            } catch (error) {
                console.warn(`⚠️ ${source.name} API failed: ${error.message}`);
                continue;
            }
        }
        
        // If all APIs fail, use intelligent fallback
        console.log('🔄 All enabled APIs failed, using intelligent fallback...');
        this.generateIntelligentFallback();
    }

    async fetchFromOpenWeatherMap(source) {
        try {
            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const url = `${source.url}?lat=${this.location.lat}&lon=${this.location.lon}&appid=${source.key}&units=metric&lang=id`;
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            return {
                source: 'OpenWeatherMap',
                weather: [{
                    icon: data.weather[0].icon,
                    description: data.weather[0].description,
                    main: data.weather[0].main
                }],
                main: {
                    temp: data.main.temp,
                    humidity: data.main.humidity,
                    pressure: data.main.pressure
                },
                wind: {
                    speed: data.wind.speed
                },
                visibility: data.visibility / 1000, // Convert to km
                clouds: {
                    all: data.clouds.all
                },
                name: data.name,
                dt: data.dt
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw new Error(`OpenWeatherMap API error: ${error.message}`);
            return null;
        }
    }

    async fetchFromWeatherAPI(source) {
        try {
            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const url = `${source.url}?key=${source.key}&q=${this.location.lat},${this.location.lon}&lang=id`;
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            return {
                source: 'WeatherAPI',
                weather: [{
                    icon: this.mapWeatherAPICondition(data.current.condition.code),
                    description: data.current.condition.text,
                    main: data.current.condition.text
                }],
                main: {
                    temp: data.current.temp_c,
                    humidity: data.current.humidity,
                    pressure: data.current.pressure_mb
                },
                wind: {
                    speed: data.current.wind_kph / 3.6 // Convert to m/s
                },
                visibility: data.current.vis_km,
                clouds: {
                    all: data.current.cloud
                },
                uv: data.current.uv,
                name: data.location.name,
                dt: new Date(data.location.localtime).getTime() / 1000
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw new Error(`WeatherAPI error: ${error.message}`);
            return null;
        }
    }

    async fetchFromAccuWeather(source) {
        try {
            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for two requests
            
            // First get location key
            const locationUrl = `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${source.key}&q=${this.location.lat},${this.location.lon}`;
            const locationResponse = await fetch(locationUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            if (!locationResponse.ok) {
                clearTimeout(timeoutId);
                throw new Error(`Location lookup failed: ${locationResponse.status}`);
            }
            
            const locationData = await locationResponse.json();
            const locationKey = locationData.Key;
            
            // Get current conditions
            const weatherUrl = `${source.url}${locationKey}?apikey=${source.key}&details=true&language=id`;
            const weatherResponse = await fetch(weatherUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!weatherResponse.ok) {
                throw new Error(`Weather fetch failed: ${weatherResponse.status}`);
            }
            
            const data = await weatherResponse.json();
            const current = data[0];
            
            return {
                source: 'AccuWeather',
                weather: [{
                    icon: this.mapAccuWeatherIcon(current.WeatherIcon),
                    description: current.WeatherText,
                    main: current.WeatherText
                }],
                main: {
                    temp: current.Temperature.Metric.Value,
                    humidity: current.RelativeHumidity,
                    pressure: current.Pressure.Metric.Value
                },
                wind: {
                    speed: current.Wind.Speed.Metric.Value / 3.6 // Convert to m/s
                },
                visibility: current.Visibility.Metric.Value,
                clouds: {
                    all: current.CloudCover
                },
                uv: current.UVIndex,
                name: locationData.LocalizedName,
                dt: new Date(current.LocalObservationDateTime).getTime() / 1000
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw new Error(`AccuWeather API error: ${error.message}`);
            return null;
        }
    }

    mapWeatherAPICondition(code) {
        // WeatherAPI condition code mapping
        const conditionMap = {
            1000: '01d', // Sunny
            1003: '02d', // Partly cloudy
            1006: '03d', // Cloudy
            1009: '04d', // Overcast
            1030: '50d', // Mist
            1063: '10d', // Patchy rain possible
            1180: '09d', // Light rain
            1183: '09d', // Light rain
            1186: '10d', // Moderate rain
            1189: '10d', // Moderate rain
            1192: '10d', // Heavy rain
            1195: '10d', // Heavy rain
            1273: '11d', // Thunderstorm
            1276: '11d'  // Heavy thunderstorm
        };
        
        return conditionMap[code] || '01d';
    }

    mapAccuWeatherIcon(iconNumber) {
        // AccuWeather icon mapping
        const iconMap = {
            1: '01d', 2: '02d', 3: '02d', 4: '02d', 5: '02d', 6: '03d',
            7: '04d', 8: '04d', 11: '50d', 12: '09d', 13: '10d', 14: '10d',
            15: '11d', 16: '11d', 17: '11d', 18: '10d', 19: '13d', 20: '13d',
            21: '13d', 22: '13d', 23: '13d', 24: '13d', 25: '13d', 26: '10d',
            29: '10d', 30: '01d', 31: '01d', 32: '01d', 33: '01n', 34: '02n',
            35: '02n', 36: '02n', 37: '50n', 38: '04n', 39: '10n', 40: '10n',
            41: '11n', 42: '11n', 43: '13n', 44: '13n'
        };
        
        return iconMap[iconNumber] || '01d';
    }

    processWeatherData(data, source) {
        try {
            const weatherIcon = data.weather[0].icon;
            const condition = this.weatherMapping[weatherIcon] || 'cerah';
            
            // Enhanced weather data processing
            this.currentWeather = {
                condition: condition,
                temperature: Math.round(data.main.temp),
                humidity: Math.round(data.main.humidity),
                windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
                description: data.weather[0].description,
                pressure: Math.round(data.main.pressure),
                visibility: data.visibility || 10,
                cloudCover: data.clouds ? data.clouds.all : 0,
                uvIndex: data.uv || 5,
                lastUpdate: new Date(),
                source: source,
                dataAge: 0,
                accuracy: 'high'
            };
            
            // Update environmental data in header
            this.updateEnvironmentalDisplay();
            
            // Update fallback status indicator
            this.updateFallbackStatus();
            
            // Update soil moisture manager with weather condition
            if (window.soilMoistureManager) {
                const currentSoilWeather = window.soilMoistureManager.settings.weather;
                if (currentSoilWeather !== condition) {
                    window.soilMoistureManager.setWeather(condition);
                    console.log(`🌤️ Weather updated: ${condition} (from ${source})`);
                }
            }
            
            // Show weather update notification
            this.showWeatherUpdateNotification(source);
            
            console.log(`✅ Weather processed from ${source}:`, this.currentWeather);
            
        } catch (error) {
            console.error('Error processing weather data:', error);
            this.generateIntelligentFallback();
        }
    }

    generateIntelligentFallback() {
        // Generate intelligent weather based on historical patterns and time
        const now = new Date();
        const hour = now.getHours();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        
        // Sulawesi Selatan climate intelligence
        const isRainySeason = month >= 11 || month <= 4; // Nov-Apr
        const isDrySeason = month >= 5 && month <= 10; // May-Oct
        const isAfternoon = hour >= 12 && hour <= 17;
        const isEvening = hour >= 18 && hour <= 20;
        
        let condition, temp, humidity, windSpeed, description;
        
        if (isRainySeason) {
            // Rainy season patterns
            if (isAfternoon) {
                // Afternoon thunderstorms common
                const rainChance = Math.random();
                if (rainChance < 0.4) {
                    condition = 'hujan';
                    temp = 24 + Math.random() * 3; // 24-27°C
                    humidity = 85 + Math.random() * 10; // 85-95%
                    description = 'Hujan sore';
                } else {
                    condition = 'mendung';
                    temp = 27 + Math.random() * 3; // 27-30°C
                    humidity = 75 + Math.random() * 15; // 75-90%
                    description = 'Berawan sore';
                }
            } else {
                condition = 'cerah';
                temp = 26 + Math.random() * 4; // 26-30°C
                humidity = 70 + Math.random() * 15; // 70-85%
                description = 'Cerah berawan';
            }
        } else {
            // Dry season patterns
            if (isAfternoon) {
                condition = 'cerah';
                temp = 30 + Math.random() * 5; // 30-35°C
                humidity = 50 + Math.random() * 20; // 50-70%
                description = 'Cerah panas';
            } else {
                condition = 'cerah';
                temp = 28 + Math.random() * 4; // 28-32°C
                humidity = 55 + Math.random() * 20; // 55-75%
                description = 'Cerah';
            }
        }
        
        // Night adjustments
        if (hour < 6 || hour > 19) {
            temp -= 4; // Cooler at night
            humidity += 10; // Higher humidity at night
        }
        
        windSpeed = 8 + Math.random() * 8; // 8-16 km/h
        
        this.currentWeather = {
            condition: condition,
            temperature: Math.round(temp),
            humidity: Math.round(humidity),
            windSpeed: Math.round(windSpeed),
            description: description,
            pressure: 1010 + Math.random() * 10,
            visibility: 8 + Math.random() * 4,
            cloudCover: condition === 'cerah' ? 10 + Math.random() * 20 : 60 + Math.random() * 30,
            uvIndex: condition === 'cerah' ? 6 + Math.random() * 4 : 2 + Math.random() * 3,
            lastUpdate: new Date(),
            source: 'Intelligent Fallback',
            dataAge: 0,
            accuracy: 'simulated'
        };
        
        this.updateEnvironmentalDisplay();
        
        // Update fallback status indicator
        this.updateFallbackStatus();
        
        if (window.soilMoistureManager) {
            window.soilMoistureManager.setWeather(condition);
        }
        
        console.log('🤖 Intelligent weather fallback generated:', this.currentWeather);
        
        // Update fallback status
        this.updateFallbackStatus();
    }

    async fetchDetailedWeatherData() {
        // Fetch additional weather details for enhanced accuracy
        try {
            // Only try if OpenWeatherMap is enabled
            const openWeatherSource = this.apiSources.find(s => s.name === 'OpenWeatherMap' && s.enabled);
            if (!openWeatherSource) {
                console.log('ℹ️ OpenWeatherMap not enabled, skipping detailed forecast');
                return;
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            // Get weather forecast for better prediction
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${this.location.lat}&lon=${this.location.lon}&appid=${openWeatherSource.key}&units=metric`;
            
            const response = await fetch(forecastUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.processForecastData(data);
            }
        } catch (error) {
            console.log('ℹ️ Forecast data unavailable (using simulated data):', error.message);
        }
    }

    processForecastData(data) {
        // Process forecast data for better weather prediction
        const nextHours = data.list.slice(0, 3); // Next 9 hours
        
        // Predict weather changes
        const upcomingConditions = nextHours.map(item => {
            const icon = item.weather[0].icon;
            return this.weatherMapping[icon] || 'cerah';
        });
        
        // If rain is predicted, adjust current conditions
        if (upcomingConditions.includes('hujan') && this.currentWeather.condition !== 'hujan') {
            this.currentWeather.description += ' (hujan diprediksi)';
            this.currentWeather.humidity = Math.min(95, this.currentWeather.humidity + 10);
        }
        
        console.log('📊 Weather forecast processed for enhanced accuracy');
    }

    checkWeatherDataFreshness() {
        const now = new Date();
        const dataAge = (now - this.currentWeather.lastUpdate) / 1000 / 60; // minutes
        
        this.currentWeather.dataAge = Math.round(dataAge);
        
        // If data is older than 30 minutes, try to refresh
        if (dataAge > 30) {
            console.log('⚠️ Weather data is stale, attempting refresh...');
            this.fetchRealWeatherData();
        }
        
        // Update accuracy based on data age
        if (dataAge < 10) {
            this.currentWeather.accuracy = 'very-high';
        } else if (dataAge < 30) {
            this.currentWeather.accuracy = 'high';
        } else if (dataAge < 60) {
            this.currentWeather.accuracy = 'medium';
        } else {
            this.currentWeather.accuracy = 'low';
        }
    }

    updateEnvironmentalDisplay() {
        // Update temperature display with enhanced info
        const tempElements = document.querySelectorAll('.env-item');
        if (tempElements.length > 0) {
            tempElements[0].innerHTML = `
                <span class="env-icon">🌡️</span>
                <span>${this.currentWeather.temperature}°C</span>
            `;
            tempElements[0].title = `Tekanan: ${this.currentWeather.pressure} hPa, UV: ${this.currentWeather.uvIndex}`;
        }
        
        // Update humidity display with enhanced info
        if (tempElements.length > 1) {
            tempElements[1].innerHTML = `
                <span class="env-icon">💧</span>
                <span>${this.currentWeather.humidity}% RH</span>
            `;
            tempElements[1].title = `Visibilitas: ${this.currentWeather.visibility} km`;
        }
        
        // Update wind speed display with enhanced info
        if (tempElements.length > 2) {
            tempElements[2].innerHTML = `
                <span class="env-icon">💨</span>
                <span>${this.currentWeather.windSpeed} km/h</span>
            `;
            tempElements[2].title = `Tutupan awan: ${this.currentWeather.cloudCover}%`;
        }
        
        // Update weather description in location card with data source
        const locationDetails = document.querySelector('.location-details p');
        if (locationDetails) {
            const accuracyIcon = this.getAccuracyIcon();
            locationDetails.textContent = `${this.location.name}, ${this.location.city} - ${this.currentWeather.description} ${accuracyIcon}`;
            locationDetails.title = `Sumber: ${this.currentWeather.source} | Akurasi: ${this.currentWeather.accuracy} | Update: ${this.currentWeather.dataAge} menit lalu`;
        }
        
        // Update weather status indicator
        this.updateWeatherStatusIndicator();
    }

    getAccuracyIcon() {
        switch (this.currentWeather.accuracy) {
            case 'very-high': return '🟢';
            case 'high': return '🟡';
            case 'medium': return '🟠';
            case 'low': return '🔴';
            default: return '⚪';
        }
    }

    updateWeatherStatusIndicator() {
        // Update fallback status in irrigation card
        this.updateFallbackStatusInIrrigationCard();
    }

    updateFallbackStatusInIrrigationCard() {
        const fallbackStatus = document.getElementById('weather-fallback-status');
        const fallbackSource = document.getElementById('fallback-source');
        const fallbackUpdate = document.getElementById('fallback-update');
        
        if (fallbackStatus && fallbackSource && fallbackUpdate) {
            const isSimulated = this.currentWeather.source === 'Intelligent Fallback';
            
            // Update source text
            if (isSimulated) {
                fallbackSource.textContent = 'Data simulasi aktif';
                fallbackStatus.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05))';
                fallbackStatus.style.borderColor = 'rgba(245, 158, 11, 0.2)';
            } else {
                fallbackSource.textContent = `Data real-time dari ${this.currentWeather.source}`;
                fallbackStatus.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))';
                fallbackStatus.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            }
            
            // Update time
            fallbackUpdate.textContent = `Update ${this.currentWeather.dataAge}m lalu`;
            
            // Update icon based on accuracy
            const fallbackIcon = fallbackStatus.querySelector('.fallback-icon');
            if (fallbackIcon) {
                if (isSimulated) {
                    fallbackIcon.textContent = '🤖';
                } else {
                    fallbackIcon.textContent = this.getAccuracyIcon();
                }
            }
        }
    }

    updateFallbackStatus() {
        // Update the weather status indicator when fallback or other weather processing occurs
        this.updateWeatherStatusIndicator();
    }

    getSourceIcon() {
        switch (this.currentWeather.source) {
            case 'OpenWeatherMap':
            case 'WeatherAPI':
            case 'AccuWeather':
                return '📡';
            case 'Intelligent Fallback':
            case 'Manual Override':
                return '🤖';
            default:
                return '📊';
        }
    }

    showWeatherUpdateNotification(source) {
        // Show subtle notification for weather updates
        if (this.lastNotificationTime && (new Date() - this.lastNotificationTime) < 300000) {
            return; // Don't spam notifications (max 1 per 5 minutes)
        }
        
        this.lastNotificationTime = new Date();
        
       const isSimulated = source === 'Intelligent Fallback';
       const icon = isSimulated ? '🤖' : '🌤️';
       const message = isSimulated ? 'Menggunakan data cuaca simulasi' : `Cuaca diperbarui dari ${source}`;
       
        const notification = document.createElement('div');
        notification.className = 'weather-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
               <span>${icon}</span>
               <span>${message}</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
           background: linear-gradient(135deg, ${isSimulated ? '#f59e0b' : '#3b82f6'}, ${isSimulated ? '#d97706' : '#2563eb'});
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
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

    getCurrentWeather() {
        return this.currentWeather;
    }

    getWeatherHistory(days = 7) {
        // Generate realistic weather history based on current patterns
        const history = [];
        const now = new Date();
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const weather = this.generateHistoricalWeather(date);
            
            history.push({
                date: date,
                condition: weather.condition,
                temperature: weather.temperature,
                humidity: weather.humidity,
                description: weather.description
            });
        }
        
        return history;
    }

    generateHistoricalWeather(date) {
        // Generate realistic historical weather based on patterns
        const month = date.getMonth() + 1;
        const hour = date.getHours();
        const isRainySeason = month >= 11 || month <= 4;
        
        let condition, temp, humidity, description;
        
        if (isRainySeason) {
            const rainChance = Math.random();
            if (rainChance < 0.3) {
                condition = 'hujan';
                temp = 24 + Math.random() * 4;
                humidity = 80 + Math.random() * 15;
                description = 'Hujan';
            } else if (rainChance < 0.6) {
                condition = 'mendung';
                temp = 26 + Math.random() * 4;
                humidity = 70 + Math.random() * 20;
                description = 'Berawan';
            } else {
                condition = 'cerah';
                temp = 28 + Math.random() * 4;
                humidity = 60 + Math.random() * 20;
                description = 'Cerah berawan';
            }
        } else {
            condition = 'cerah';
            temp = 29 + Math.random() * 5;
            humidity = 50 + Math.random() * 25;
            description = 'Cerah';
        }
        
        return { condition, temperature: temp, humidity, description };
    }

    // Method to manually set weather (for testing)
    setManualWeather(condition, temperature, humidity, windSpeed) {
        this.currentWeather = {
            condition: condition,
            temperature: temperature || this.currentWeather.temperature,
            humidity: humidity || this.currentWeather.humidity,
            windSpeed: windSpeed || this.currentWeather.windSpeed,
            description: `Manual: ${condition}`,
            pressure: this.currentWeather.pressure,
            visibility: this.currentWeather.visibility,
            cloudCover: this.currentWeather.cloudCover,
            uvIndex: this.currentWeather.uvIndex,
            lastUpdate: new Date(),
            source: 'Manual Override',
            dataAge: 0,
            accuracy: 'manual'
        };
        
        this.updateEnvironmentalDisplay();
        
        if (window.soilMoistureManager) {
            window.soilMoistureManager.setWeather(condition);
        }
        
        console.log('🔧 Manual weather override applied:', this.currentWeather);
    }

    // Get detailed weather status for debugging
    getDetailedStatus() {
        return {
            ...this.currentWeather,
            apiSources: this.apiSources,
            location: this.location,
            systemStatus: 'operational'
        };
    }
}

// Initialize weather API
let weatherAPI;

document.addEventListener('DOMContentLoaded', function() {
    weatherAPI = new WeatherAPI();
    window.weatherAPI = weatherAPI;
    
    console.log('🌤️ Real-time weather system initialized');
    
    // Update fallback status on initialization
    setTimeout(() => {
        if (window.weatherAPI) {
            window.weatherAPI.updateFallbackStatus();
        }
    }, 1000);
});
