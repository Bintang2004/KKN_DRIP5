function fetchDataForReport(columnNames, callback) {
    const apiKey = 'XP0SNX40V07E6PNK';
    const channelId = '2983766';
    const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${apiKey}&results=720`; // Mengambil data untuk laporan
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const csvData = [];
            // Gunakan nama kolom kustom jika disediakan
            const headers = columnNames.length > 0 ? columnNames : ['Timestamp', 'Field1', 'Field2'];
            csvData.push(headers.join(',')); // Header CSV
            
            data.feeds.forEach(feed => {
                csvData.push([
                    feed.created_at,
                    feed.field1 || '',
                    feed.field2 || '',
                ].join(','));
            });
            callback(csvData.join('\n'));
        })
        .catch(error => {
            console.error('Error fetching data for report:', error);
            callback('Error,Error,Error\nTidak dapat mengambil data,Periksa koneksi internet,Coba lagi nanti');
        });
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        showNotification('Data berhasil diunduh!', 'success');
    } else {
        showNotification('Browser tidak mendukung download otomatis', 'error');
    }
}

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
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background: linear-gradient(135deg, #32CD32, #228B22);' : 'background: linear-gradient(135deg, #FF6B6B, #FF4757);'}
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
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
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Nama kolom kustom yang ditentukan dalam kode
const customColumnNames = [
    'Timestamp',
    'Water Level (cm)',
    'Soil Moisture (%)',
];

document.getElementById('download-report').addEventListener('click', function() {
    // Show loading state
    const button = this;
    const originalText = button.textContent;
    button.textContent = 'Mengunduh...';
    button.disabled = true;
    
    fetchDataForReport(customColumnNames, function(csvContent) {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        const filename = `Drip_Irrigation_Monitoring_${dateString}.csv`;
        
        downloadCSV(csvContent, filename);
        
        // Reset button state
        button.textContent = originalText;
        button.disabled = false;
    });
});