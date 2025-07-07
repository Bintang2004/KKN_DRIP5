// Active button management
function setActive(button) {
    document.querySelectorAll('.time-button').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
}

// Date and time update
function updateDateAndTime() {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    // Create date in WITA timezone (UTC+8)
    const now = new Date();
    const witaOffset = 8 * 60; // WITA is UTC+8
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const witaTime = new Date(utc + (witaOffset * 60000));
    
    const dayName = days[now.getDay()];
    const day = witaTime.getDate();
    const monthName = months[witaTime.getMonth()];
    const year = witaTime.getFullYear();
    
    const hours = witaTime.getHours().toString().padStart(2, '0');
    const minutes = witaTime.getMinutes().toString().padStart(2, '0');
    const seconds = witaTime.getSeconds().toString().padStart(2, '0');

    const formattedDate = `${dayName}, ${day} ${monthName} ${year}`;
    const formattedTime = `${hours}:${minutes}:${seconds} WITA`;

    document.getElementById('current-time').textContent = `${formattedDate} - ${formattedTime}`;
}

// Update only soil moisture metrics
function updateSoilMoistureMetrics() {
    // Ensure soil moisture manager is working properly
    if (window.soilMoistureManager) {
        // Force update display to ensure synchronization
        window.soilMoistureManager.updateDisplay();
        
        // Also update the chart if it exists
        if (window.charts && window.charts['chart2']) {
            window.soilMoistureManager.updateChart();
        }
    }
    
    // Update next schedule
    const now = new Date();
    const witaOffset = 8 * 60; // WITA is UTC+8
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const witaTime = new Date(utc + (witaOffset * 60000));
    const nextSchedule = new Date(witaTime.getTime() + (Math.random() * 8 * 60 * 60 * 1000));
    
    const hours = nextSchedule.getHours().toString().padStart(2, '0');
    const minutes = nextSchedule.getMinutes().toString().padStart(2, '0');
    document.getElementById('next-schedule').textContent = `${hours}:${minutes} WITA`;
}

// Initialize on page load
window.onload = function() {
    updateDateAndTime();
    
    // Initialize all systems in proper order
    setTimeout(() => {
        // First initialize weather
        if (typeof WeatherAPI !== 'undefined' && !window.weatherAPI) {
            window.weatherAPI = new WeatherAPI();
        }
        
        // Then initialize water volume manager
        if (typeof WaterVolumeManager !== 'undefined' && !window.waterVolumeManager) {
            window.waterVolumeManager = new WaterVolumeManager();
        }
        
        // Then initialize soil moisture manager
        if (typeof SoilMoistureManager !== 'undefined' && !window.soilMoistureManager) {
            window.soilMoistureManager = new SoilMoistureManager();
        }
        
        // Load settings after all managers are initialized
        if (window.irrigationSettings && window.irrigationSettings.loadSettings) {
            window.irrigationSettings.loadSettings();
        }
    }, 500);
    
    // Force update all displays after initialization
    setTimeout(() => {
        if (window.waterVolumeManager) {
            window.waterVolumeManager.updateDisplay();
            window.waterVolumeManager.updateNextScheduleDisplay();
        }
        if (window.soilMoistureManager) {
            window.soilMoistureManager.updateDisplay();
            window.soilMoistureManager.forceSyncScheduledIrrigations();
        }
        if (window.weatherAPI) {
            window.weatherAPI.updateEnvironmentalDisplay();
        }
        
        // Force sync between managers
        if (window.waterVolumeManager && window.soilMoistureManager) {
            window.waterVolumeManager.syncWithSoilManager();
            
            // Ensure schedules are properly synchronized
            setTimeout(() => {
                window.soilMoistureManager.forceSyncScheduledIrrigations();
                window.waterVolumeManager.updateNextScheduleDisplay();
                window.soilMoistureManager.updateNextScheduleDisplay();
                
                // Final integration check
                console.log('🔄 System integration complete');
                console.log('Water Manager:', window.waterVolumeManager ? 'Ready' : 'Not Ready');
                console.log('Soil Manager:', window.soilMoistureManager ? 'Ready' : 'Not Ready');
                console.log('Weather API:', window.weatherAPI ? 'Ready' : 'Not Ready');
                console.log('Settings:', window.irrigationSettings ? 'Ready' : 'Not Ready');
            }, 2000);
        }
    }, 2000);
    
    loadData('daily');
    
    // Update time every second
    setInterval(updateDateAndTime, 1000);
    
    // Update next schedule display every minute to keep it current
    setInterval(() => {
        if (window.waterVolumeManager) {
            window.waterVolumeManager.updateNextScheduleDisplay();
        }
        if (window.soilMoistureManager) {
            window.soilMoistureManager.updateNextScheduleDisplay();
        }
    }, 60000);
    
    // Update metrics every 30 seconds to ensure synchronization
    setInterval(() => {
        updateSoilMoistureMetrics();
        
        // Check system integration health
        if (window.waterVolumeManager && window.soilMoistureManager) {
            // Ensure schedules stay synchronized
            const waterSchedules = window.waterVolumeManager.settings.schedules
                .filter(s => s.enabled)
                .map(s => s.time);
            const soilSchedules = window.soilMoistureManager.settings.scheduledIrrigations;
            
            if (JSON.stringify(waterSchedules.sort()) !== JSON.stringify(soilSchedules.sort())) {
                console.log('⚠️ Schedule desync detected, resyncing...');
                window.soilMoistureManager.forceSyncScheduledIrrigations();
            }
        }
    }, 30000);
};

document.addEventListener('DOMContentLoaded', function() {
    loadData('daily');
});

let charts = {};

// Monthly averages function
function getMonthlyAverages(fieldNumber, callback) {
    const apiKey = 'XP0SNX40V07E6PNK';
    const channelId = '2983766';
    const url = `https://api.thingspeak.com/channels/${channelId}/fields/${fieldNumber}.json?api_key=${apiKey}&results=720`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const monthlyData = {};

            data.feeds.forEach(feed => {
                const date = new Date(feed.created_at);
                const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;

                if (!monthlyData[monthYear]) {
                    monthlyData[monthYear] = [];
                }

                if (feed[`field${fieldNumber}`] !== null) {
                    monthlyData[monthYear].push(parseFloat(feed[`field${fieldNumber}`]));
                }
            });

            const averages = [];
            for (const monthYear in monthlyData) {
                const average = monthlyData[monthYear].reduce((acc, val) => acc + val, 0) / monthlyData[monthYear].length;
                const [month, year] = monthYear.split('-');
                averages.push({
                    x: new Date(year, month - 1),
                    y: parseFloat(average.toFixed(2))
                });
            }

            callback(null, averages);
        })
        .catch(error => {
            console.error('Error fetching monthly data:', error);
            callback(error, null);
        });
}

function loadData(period) {
    const resultsCount = {
        daily: 24,
        weekly: 168,
        monthly: 720
    };

    const labels = {
        daily: { unit: 'hour', format: 'HH:mm' },
        weekly: { unit: 'day', format: 'MMM dd' },
        monthly: { unit: 'month', format: 'MMM yyyy' }
    };

    const fields = [
        { id: 'chart1', fieldNumber: 1, color: '#3b82f6', averageId: 'average1-value', title: 'Water Level', unit: 'cm' },
        { id: 'chart2', fieldNumber: 2, color: '#10b981', averageId: 'average2-value', title: 'Soil Moisture', unit: '%' },
    ];

    fields.forEach(field => {
        if (field.fieldNumber === 1) {
            // Use water volume manager for water volume data
            if (window.waterVolumeManager) {
                const data = window.waterVolumeManager.getChartData(period);
                const ctx = document.getElementById(field.id).getContext('2d');
                if (charts[field.id]) {
                    charts[field.id].destroy();
                }
                charts[field.id] = createChart(ctx, data, field.color, labels[period].unit, labels[period].format, field.title);
                updateAverage(field.averageId, data, 'L');
                document.getElementById(field.id).parentElement.querySelector('.chart-message').textContent = '';
            }
        } else if (field.fieldNumber === 2) {
            // Use soil moisture manager for soil moisture data
            if (window.soilMoistureManager) {
                const data = window.soilMoistureManager.getChartData(period);
                const ctx = document.getElementById(field.id).getContext('2d');
                if (charts[field.id]) {
                    charts[field.id].destroy();
                }
                charts[field.id] = createChart(ctx, data, field.color, labels[period].unit, labels[period].format, field.title);
                updateAverage(field.averageId, data, field.unit);
                document.getElementById(field.id).parentElement.querySelector('.chart-message').textContent = '';
                
                // Store reference for real-time updates
                window.charts = window.charts || {};
                window.charts[field.id] = charts[field.id];
            }
        } else if (period === 'monthly') {
            getMonthlyAverages(field.fieldNumber, function(error, data) {
                if (error) {
                    document.getElementById(field.id).parentElement.querySelector('.chart-message').textContent = `Gagal mengambil data: ${error.message}. Periksa koneksi internet atau coba lagi nanti.`;
                    updateAverage(field.averageId, null, field.unit);
                } else {
                    const ctx = document.getElementById(field.id).getContext('2d');
                    if (charts[field.id]) {
                        charts[field.id].destroy();
                    }
                    charts[field.id] = createChart(ctx, data, field.color, labels[period].unit, labels[period].format, field.title);
                    updateAverage(field.averageId, data, field.unit);
                    document.getElementById(field.id).parentElement.querySelector('.chart-message').textContent = '';
                }
            });
        } else {
            getData(field.fieldNumber, period, resultsCount[period], function(error, data) {
                if (error) {
                    document.getElementById(field.id).parentElement.querySelector('.chart-message').textContent = `Gagal mengambil data: ${error.message}. Periksa koneksi internet atau coba lagi nanti.`;
                    updateAverage(field.averageId, null, field.unit);
                } else if (data === null) {
                    document.getElementById(field.id).parentElement.querySelector('.chart-message').textContent = 'Sistem Offline: Tidak ada data untuk periode ini';
                    updateAverage(field.averageId, null, field.unit);
                } else {
                    const ctx = document.getElementById(field.id).getContext('2d');
                    if (charts[field.id]) {
                        charts[field.id].destroy();
                    }
                    charts[field.id] = createChart(ctx, data, field.color, labels[period].unit, labels[period].format, field.title);
                    updateAverage(field.averageId, data, field.unit);
                    document.getElementById(field.id).parentElement.querySelector('.chart-message').textContent = '';
                }
            });
        }
    });
}

function getData(fieldNumber, period, resultsCount, callback) {
    const apiKey = 'XP0SNX40V07E6PNK';
    const channelId = '2983766';
    const url = `https://api.thingspeak.com/channels/${channelId}/fields/${fieldNumber}.json?api_key=${apiKey}&results=${resultsCount}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const values = [];
            const dailyData = {};

            data.feeds.forEach(feed => {
                if (feed[`field${fieldNumber}`] !== null) {
                    const date = new Date(feed.created_at);
                    const day = date.toISOString().split('T')[0];
                    const time = date.toISOString().split('T')[1];
                    const value = parseFloat(feed[`field${fieldNumber}`]);

                    if (!dailyData[day]) {
                        dailyData[day] = [];
                    }
                    dailyData[day].push({ time, value });
                }
            });

            if (period === 'weekly') {
                Object.keys(dailyData).forEach(day => {
                    const sum = dailyData[day].reduce((acc, item) => acc + item.value, 0);
                    const avg = sum / dailyData[day].length;
                    values.push({
                        x: new Date(day),
                        y: avg
                    });
                });
            } else if (period === 'monthly') {
                const weeklyData = {};
                Object.keys(dailyData).forEach(day => {
                    const date = new Date(day);
                    const weekYear = `${date.getFullYear()}-W${getWeekNumber(date)}`;

                    if (!weeklyData[weekYear]) {
                        weeklyData[weekYear] = [];
                    }
                    weeklyData[weekYear].push(...dailyData[day].map(item => item.value));
                });

                Object.keys(weeklyData).forEach(weekYear => {
                    const sum = weeklyData[weekYear].reduce((acc, v) => acc + v, 0);
                    const avg = sum / weeklyData[weekYear].length;
                    values.push({
                        x: new Date(weekYearToDate(weekYear)),
                        y: avg
                    });
                });
            } else {
                const today = new Date().toISOString().split('T')[0];
                if (dailyData[today]) {
                    values.push(...dailyData[today].map(item => ({
                        x: new Date(`${today}T${item.time}`),
                        y: item.value
                    })));
                }
            }

            if (values.length === 0 && period === 'daily') {
                callback(null, null);
            } else {
                callback(null, values);
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            callback(error, null);
        });
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function weekYearToDate(weekYear) {
    const [year, week] = weekYear.split('-W');
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

function calculateAverage(data) {
    const sum = data.reduce((acc, point) => acc + point.y, 0);
    return (sum / data.length).toFixed(2);
}

function createChart(ctx, data, borderColor, unit, format, title) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, borderColor + '20');
    gradient.addColorStop(1, borderColor + '05');

    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                data: data,
                borderColor: borderColor,
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: borderColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                showLine: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: borderColor,
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    intersect: false,
                    mode: 'index'
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: unit,
                        tooltipFormat: format,
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'MMM dd',
                            month: 'MMM yyyy'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawOnChartArea: true,
                        drawTicks: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 12
                        },
                        maxTicksLimit: 8
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawOnChartArea: true,
                        drawTicks: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 12
                        },
                        maxTicksLimit: 6
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            animation: {
                duration: 0 // Disable animations for smoother updates
            },
            hover: {
                animationDuration: 0
            }
        }
    });
}

function updateAverage(elementId, data, unit) {
    const element = document.getElementById(elementId);
    if (element) {
        if (data === null || data.length === 0) {
            element.textContent = `-- ${unit || 'L'}`;
        } else {
            const average = calculateAverage(data);
            element.textContent = `${average} ${unit || 'L'}`;
        }
    }
}