// Global variables
let map;
let markers = [];
let trafficData = [];
let congestionChart, peakHoursChart, speedTrendChart, safetyChart;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadTrafficData();
    setupEventListeners();
    startLiveUpdates();
});

// Initialize Leaflet map
function initializeMap() {
    // Center on Udaipur
    map = L.map('map').setView([24.5854, 73.7125], 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add scale
    L.control.scale().addTo(map);
}

// Load traffic data from JSON
async function loadTrafficData() {
    try {
        // For GitHub Pages, use relative path
        const response = await fetch('data/trafficData.json');
        trafficData = await response.json();
        
        renderMapMarkers();
        updateKPIs();
        initializeCharts();
        updateSafeRoutes();
        updateAccidentList();
        
        console.log('Data loaded successfully:', trafficData.length, 'roads');
    } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to sample data if JSON fails
        trafficData = getSampleData();
        renderMapMarkers();
        updateKPIs();
        initializeCharts();
    }
}

// Render markers on map
function renderMapMarkers(filter = 'all') {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Filter data based on selection
    let filteredData = trafficData;
    if (filter !== 'all') {
        filteredData = trafficData.filter(road => {
            const congestion = road.congestion;
            if (filter === 'low') return congestion < 40;
            if (filter === 'medium') return congestion >= 40 && congestion <= 70;
            if (filter === 'high') return congestion > 70;
            return true;
        });
    }
    
    // Add markers for each road
    filteredData.forEach(road => {
        const markerColor = getCongestionColor(road.congestion);
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${markerColor}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker(road.location, { icon: icon })
            .addTo(map)
            .bindPopup(createPopupContent(road));
        
        markers.push(marker);
    });
    
    // Adjust map view if needed
    if (filteredData.length > 0 && filteredData.length < trafficData.length) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Create popup content for markers
function createPopupContent(road) {
    return `
        <div class="popup-content">
            <div class="popup-header">${road.road}</div>
            <div style="margin-bottom: 5px;">
                <span style="background-color: ${getCongestionColor(road.congestion)}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">
                    ${road.congestion}% Congestion
                </span>
            </div>
            <div class="popup-stats">
                <div class="popup-stat">
                    <span class="popup-stat-value">${road.averageSpeed}</span>
                    <span class="popup-stat-label">km/h</span>
                </div>
                <div class="popup-stat">
                    <span class="popup-stat-value">${road.accidents}</span>
                    <span class="popup-stat-label">Accidents</span>
                </div>
                <div class="popup-stat">
                    <span class="popup-stat-value">${getCongestionLevel(road.congestion)}</span>
                    <span class="popup-stat-label">Level</span>
                </div>
                <div class="popup-stat">
                    <span class="popup-stat-value">${getSafetyRating(road)}</span>
                    <span class="popup-stat-label">Safety</span>
                </div>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                <i class="fas fa-clock"></i> Last updated: Just now
            </div>
        </div>
    `;
}

// Initialize all charts
function initializeCharts() {
    // Congestion Distribution Chart
    const congestionCtx = document.getElementById('congestionChart').getContext('2d');
    congestionChart = new Chart(congestionCtx, {
        type: 'doughnut',
        data: {
            labels: ['Low (< 40%)', 'Medium (40-70%)', 'High (> 70%)'],
            datasets: [{
                data: [
                    trafficData.filter(r => r.congestion < 40).length,
                    trafficData.filter(r => r.congestion >= 40 && r.congestion <= 70).length,
                    trafficData.filter(r => r.congestion > 70).length
                ],
                backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Peak Hours Chart
    const peakCtx = document.getElementById('peakHoursChart').getContext('2d');
    const peakHours = generatePeakHourData();
    peakHoursChart = new Chart(peakCtx, {
        type: 'bar',
        data: {
            labels: ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM'],
            datasets: [{
                label: 'Congestion %',
                data: peakHours,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Congestion %'
                    }
                }
            }
        }
    });
    
    // Speed Trend Chart
    const speedCtx = document.getElementById('speedTrendChart').getContext('2d');
    const speedTrends = generateSpeedTrendData();
    speedTrendChart = new Chart(speedCtx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Average Speed (km/h)',
                data: speedTrends,
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    }
                }
            }
        }
    });
    
    // Safety Chart
    const safetyCtx = document.getElementById('safetyChart').getContext('2d');
    const safetyData = generateSafetyData();
    safetyChart = new Chart(safetyCtx, {
        type: 'radar',
        data: {
            labels: ['MG Road', 'Lake Pichola Rd', 'Airport Road', 'Hiran Magri', 'Sukhadia Circle', 'Fateh Sagar'],
            datasets: [{
                label: 'Safety Index',
                data: safetyData,
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                borderColor: 'rgb(139, 92, 246)',
                pointBackgroundColor: 'rgb(139, 92, 246)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 2
                    }
                }
            }
        }
    });
}

// Update KPI cards
function updateKPIs() {
    const totalCongestion = trafficData.reduce((sum, road) => sum + road.congestion, 0);
    const avgCongestion = Math.round(totalCongestion / trafficData.length);
    const totalAccidents = trafficData.reduce((sum, road) => sum + road.accidents, 0);
    const avgSpeed = Math.round(trafficData.reduce((sum, road) => sum + road.averageSpeed, 0) / trafficData.length);
    const safeRoutes = trafficData.filter(road => road.congestion < 50 && road.accidents === 0).length;
    
    document.getElementById('avgCongestion').textContent = `${avgCongestion}%`;
    document.getElementById('totalAccidents').textContent = totalAccidents;
    document.getElementById('avgSpeed').textContent = `${avgSpeed} km/h`;
    document.getElementById('safeRoutes').textContent = safeRoutes;
    
    // Update trend indicators
    const congestionTrend = document.getElementById('congestionTrend');
    if (avgCongestion > 60) {
        congestionTrend.innerHTML = '<i class="fas fa-arrow-up text-red-500 mr-1"></i><span>Higher than usual</span>';
    } else if (avgCongestion < 40) {
        congestionTrend.innerHTML = '<i class="fas fa-arrow-down text-green-500 mr-1"></i><span>Lower than usual</span>';
    } else {
        congestionTrend.innerHTML = '<i class="fas fa-minus text-yellow-500 mr-1"></i><span>Normal levels</span>';
    }
    
    // Update safety status
    const safetyStatus = document.getElementById('safetyStatus');
    if (totalAccidents > 5) {
        safetyStatus.innerHTML = '<i class="fas fa-exclamation-triangle text-red-500 mr-1"></i><span>Exercise caution</span>';
    } else if (totalAccidents === 0) {
        safetyStatus.innerHTML = '<i class="fas fa-shield-alt text-green-500 mr-1"></i><span>Safe conditions</span>';
    } else {
        safetyStatus.innerHTML = '<i class="fas fa-info-circle text-yellow-500 mr-1"></i><span>Moderate safety</span>';
    }
}

// Update safe routes list
function updateSafeRoutes() {
    const safeRoutes = trafficData
        .filter(road => road.congestion < 50 && road.accidents === 0)
        .sort((a, b) => a.congestion - b.congestion)
        .slice(0, 6);
    
    const container = document.getElementById('safeRoutesList');
    container.innerHTML = '';
    
    safeRoutes.forEach(route => {
        const routeCard = document.createElement('div');
        routeCard.className = 'bg-green-50 rounded-lg p-4 border border-green-200';
        routeCard.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-gray-800">${route.road}</h4>
                    <div class="flex items-center mt-2">
                        <div class="text-sm text-gray-600 mr-4">
                            <i class="fas fa-tachometer-alt mr-1"></i>
                            ${route.averageSpeed} km/h
                        </div>
                        <div class="text-sm text-green-600">
                            <i class="fas fa-check-circle mr-1"></i>
                            Safe
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-green-600">${route.congestion}%</div>
                    <div class="text-xs text-gray-500">Congestion</div>
                </div>
            </div>
            <div class="mt-3 pt-3 border-t border-green-100">
                <div class="text-xs text-gray-500">
                    <i class="fas fa-map-marker-alt mr-1"></i>
                    Recommended route
                </div>
            </div>
        `;
        container.appendChild(routeCard);
    });
}

// Update accident list
function updateAccidentList() {
    const accidentRoads = trafficData
        .filter(road => road.accidents > 0)
        .sort((a, b) => b.accidents - a.accidents);
    
    const container = document.getElementById('accidentList');
    container.innerHTML = '';
    
    if (accidentRoads.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-gray-500">
                <i class="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
                <p>No accident zones reported today</p>
            </div>
        `;
        return;
    }
    
    accidentRoads.forEach(road => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-red-50 rounded-lg';
        item.innerHTML = `
            <div>
                <div class="font-medium text-gray-800">${road.road}</div>
                <div class="text-sm text-gray-600 mt-1">
                    <i class="fas fa-clock mr-1"></i>
                    Last accident: Today
                </div>
            </div>
            <div class="text-right">
                <div class="text-xl font-bold text-red-600">${road.accidents}</div>
                <div class="text-xs text-gray-500">Incidents</div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            renderMapMarkers(this.dataset.filter);
        });
    });
    
    // Accident filter
    document.getElementById('accidentFilter').addEventListener('click', function() {
        const accidentRoads = trafficData.filter(road => road.accidents > 0);
        
        // Clear all markers
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        
        // Add only accident markers
        accidentRoads.forEach(road => {
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: #EF4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(239,68,68,0.8); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-exclamation" style="color: white; font-size: 10px;"></i>
                      </div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            
            const marker = L.marker(road.location, { icon: icon })
                .addTo(map)
                .bindPopup(createPopupContent(road));
            
            markers.push(marker);
        });
        
        // Adjust map view
        if (accidentRoads.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.2));
        }
    });
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            markers.forEach(marker => map.removeLayer(marker));
            renderMapMarkers('all');
            return;
        }
        
        const filtered = trafficData.filter(road => 
            road.road.toLowerCase().includes(searchTerm)
        );
        
        // Clear all markers
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        
        // Add filtered markers
        filtered.forEach(road => {
            const markerColor = getCongestionColor(road.congestion);
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${markerColor}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-search" style="color: white; font-size: 10px;"></i>
                      </div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            
            const marker = L.marker(road.location, { icon: icon })
                .addTo(map)
                .bindPopup(createPopupContent(road));
            
            markers.push(marker);
        });
        
        // Adjust map view
        if (filtered.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.2));
        }
    });
}

// Start live updates simulation
function startLiveUpdates() {
    setInterval(() => {
        simulateLiveUpdate();
    }, 30000); // Update every 30 seconds
    
    // Update sync time
    setInterval(() => {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById('syncTime').textContent = timeString;
        document.getElementById('lastUpdate').textContent = timeString;
    }, 1000);
}

// Simulate live data updates
function simulateLiveUpdate() {
    // Randomly update some roads
    trafficData.forEach(road => {
        // 30% chance to update congestion
        if (Math.random() < 0.3) {
            const change = Math.floor(Math.random() * 10) - 5; // -5 to +5
            road.congestion = Math.max(0, Math.min(100, road.congestion + change));
        }
        
        // 10% chance to update speed
        if (Math.random() < 0.1) {
            const change = Math.floor(Math.random() * 8) - 4; // -4 to +4
            road.averageSpeed = Math.max(5, Math.min(80, road.averageSpeed + change));
        }
        
        // 5% chance to add an accident (if less than 3)
        if (Math.random() < 0.05 && road.accidents < 3) {
            road.accidents += 1;
        }
    });
    
    // Update all visualizations
    markers.forEach(marker => map.removeLayer(marker));
    renderMapMarkers('all');
    updateKPIs();
    updateSafeRoutes();
    updateAccidentList();
    
    // Add visual feedback
    document.querySelector('header').classList.add('live-update');
    setTimeout(() => {
        document.querySelector('header').classList.remove('live-update');
    }, 1000);
}

// Helper functions
function getCongestionColor(congestion) {
    if (congestion < 40) return '#10B981'; // Green
    if (congestion <= 70) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
}

function getCongestionLevel(congestion) {
    if (congestion < 40) return 'Low';
    if (congestion <= 70) return 'Medium';
    return 'High';
}

function getSafetyRating(road) {
    if (road.accidents === 0 && road.congestion < 50) return 'A';
    if (road.accidents < 2 && road.congestion < 70) return 'B';
    if (road.accidents < 3) return 'C';
    return 'D';
}

function generatePeakHourData() {
    return [30, 75, 60, 45, 40, 65, 85, 70, 40];
}

function generateSpeedTrendData() {
    return [32, 28, 30, 25, 22, 35, 38];
}

function generateSafetyData() {
    return [7, 9, 8, 6, 5, 8];
}

// Sample data fallback
function getSampleData() {
    return [
        {
            "road": "MG Road",
            "location": [24.5854, 73.7125],
            "congestion": 70,
            "accidents": 2,
            "averageSpeed": 25
        },
        {
            "road": "Lake Pichola Road",
            "location": [24.5754, 73.6900],
            "congestion": 40,
            "accidents": 0,
            "averageSpeed": 35
        },
        {
            "road": "Airport Road",
            "location": [24.6050, 73.7250],
            "congestion": 55,
            "accidents": 1,
            "averageSpeed": 30
        },
        {
            "road": "Hiran Magri",
            "location": [24.5700, 73.7300],
            "congestion": 65,
            "accidents": 1,
            "averageSpeed": 28
        },
        {
            "road": "Sukhadia Circle",
            "location": [24.5800, 73.7000],
            "congestion": 85,
            "accidents": 3,
            "averageSpeed": 15
        },
        {
            "road": "Fateh Sagar Road",
            "location": [24.5950, 73.6800],
            "congestion": 35,
            "accidents": 0,
            "averageSpeed": 40
        },
        {
            "road": "Chetak Circle",
            "location": [24.5900, 73.7100],
            "congestion": 75,
            "accidents": 2,
            "averageSpeed": 22
        },
        {
            "road": "Bapu Bazaar",
            "location": [24.5780, 73.6850],
            "congestion": 90,
            "accidents": 1,
            "averageSpeed": 10
        },
        {
            "road": "University Road",
            "location": [24.6000, 73.7400],
            "congestion": 45,
            "accidents": 0,
            "averageSpeed": 38
        },
        {
            "road": "Shastri Circle",
            "location": [24.5720, 73.7050],
            "congestion": 60,
            "accidents": 1,
            "averageSpeed": 27
        },
        {
            "road": "Rani Road",
            "location": [24.5650, 73.6800],
            "congestion": 30,
            "accidents": 0,
            "averageSpeed": 45
        },
        {
            "road": "Delhi Gate",
            "location": [24.5850, 73.6950],
            "congestion": 80,
            "accidents": 2,
            "averageSpeed": 18
        },
        {
            "road": "Ambamata Road",
            "location": [24.5900, 73.6900],
            "congestion": 50,
            "accidents": 0,
            "averageSpeed": 32
        },
        {
            "road": "Ashwini Marg",
            "location": [24.5950, 73.7200],
            "congestion": 40,
            "accidents": 0,
            "averageSpeed": 36
        },
        {
            "road": "Sector 14 Road",
            "location": [24.6100, 73.7100],
            "congestion": 25,
            "accidents": 0,
            "averageSpeed": 48
        }
    ];
}