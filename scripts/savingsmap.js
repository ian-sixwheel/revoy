const accessToken = 'pk.eyJ1Ijoic2hhd25jaGkyMDciLCJhIjoiY2t2eDM4eHVoMDBmazJucnBuODFtc3VnZCJ9.FWq9XiUtIMdqiS1wXqzzjQ'
mapboxgl.accessToken = accessToken
const styleURL = 'mapbox://styles/shawnchi207/clmr85qvx020z01rf835l7eco'
const markerURL = 'https://uploads-ssl.webflow.com/644256fe693d807d873bf254/65284f0572370299d4c65015_marker.svg'

// Map initialization
const map = new mapboxgl.Map({
    container: 'map',
    style: styleURL,
    center: [-105, 37.8],
    zoom: 4,
    accessToken: accessToken,
})

// Geocoder initialization for starting point
const startingPointGeocoder = new MapboxGeocoder({
    container: 'starting-point',
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'Starting Point',
    country: 'US',
    marker: false,
    flyTo: false  // Disable the flyTo animation
})

// Geocoder initialization for destination
const destinationGeocoder = new MapboxGeocoder({
    container: 'destination',
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'Destination',
    country: 'US',
    marker:false,
    flyTo: false, // Disable the flyTo animation
})

const routeBtn = document.querySelector('#route-btn')
routeBtn.disabled = true

const calculateBtn = document.querySelector('#calculate-btn')
// calculateBtn.disabled = true
calculateBtn.onclick = (e) => {
    e.preventDefault()
    calculateMetrics()
}



// Append geocoders to your divs
document.getElementById('starting-point').appendChild(startingPointGeocoder.onAdd(map))
document.getElementById('destination').appendChild(destinationGeocoder.onAdd(map))

const geocoders = document.querySelectorAll('.mapboxgl-ctrl-geocoder')
geocoders.forEach( geocoder => {
    geocoder.onmouseenter = () => {
        geocoder.style.zIndex = 10
    }
    geocoder.onmouseleave = () => {
        geocoder.style.zIndex = 1
    }
    geocoder.style.boxShadow = 'none'
    geocoder.style.maxWidth = 'unset'
    geocoder.style.width = '100%'
} )

const tripsInput = document.querySelector('#trips')
const dieselInput = document.querySelector('#diesel-price')
const trucksInput = document.querySelector('#trucks')
trucksInput.defaultValue = 5
trucksInput.setAttribute('min', '1');
tripsInput.defaultValue = 10 
tripsInput.setAttribute('min', '1');
dieselInput.defaultValue = 4.5
dieselInput.setAttribute('min', '0.1');
dieselInput.setAttribute('step', '0.1');


const segmentDistance = 1 //(mile)

// Variables to hold data
let startingPointCoordinates
let destinationCoordinates
let timeSavedPerTrip
let totalElevationGain
let route
let grades = []
let speedDifferences = [];
let timeSaved = [];
let elevations = [];
let elevationGains = [];
let totalTimeSaved




// Function to handle route logic based on geocoder results
const handleRoute = () => {
    if (startingPointCoordinates && destinationCoordinates) {
        routeBtn.disabled = false
        getRoute()
    } else {
        flyToValidPoint()
        routeBtn.disabled
    }
}

const removeRoute = () => {
    const layerIds = ['route-shadow', 'route-border', 'route', 'route-shadow-top', 'route-shadow-bot'];
    layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
        if (map.getSource(layerId)) {
            map.removeSource(layerId);
        }
    });
    flyToValidPoint()
}

const flyToValidPoint = () => {
    if (startingPointCoordinates || destinationCoordinates) {
        const validCoordinates = startingPointCoordinates ? startingPointCoordinates : destinationCoordinates
        map.flyTo({
            center: validCoordinates,
            zoom: 10,
            offset: [window.innerWidth * 0.15, 0]  // Offset to shift center to the right
        })
    }
}

const customMarkerElem = new Image();
customMarkerElem.src = markerURL;
customMarkerElem.style.width = '120px';
customMarkerElem.style.height = '120px';
const startingPointMarker = new mapboxgl.Marker({element: customMarkerElem.cloneNode(true)});
const destinationPointMarker = new mapboxgl.Marker({element: customMarkerElem.cloneNode(true)});



// Listen for result events on geocoders to get coordinates and invoke handleRoute
startingPointGeocoder.on('result', e => {
    startingPointCoordinates = e.result.geometry.coordinates
    startingPointMarker.setLngLat(e.result.geometry.coordinates).addTo(map);
    handleRoute()
})

destinationGeocoder.on('result', e => {
    destinationCoordinates = e.result.geometry.coordinates
    destinationPointMarker.setLngLat(e.result.geometry.coordinates).addTo(map);
    handleRoute()
})

startingPointGeocoder.on('clear', () => {
    startingPointCoordinates = null
    startingPointMarker.remove()
    removeRoute()
})

destinationGeocoder.on('clear', () => {
    destinationCoordinates = null
    destinationPointMarker.remove()
    removeRoute()
})






// ... [previous code remains unchanged]

// Add the terrain source
map.on('load', () => {
    map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
    });
    map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
});




const getRoute = () => {
    calculateBtn.disabled = true
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startingPointCoordinates[0]},${startingPointCoordinates[1]};${destinationCoordinates[0]},${destinationCoordinates[1]}?access_token=${mapboxgl.accessToken}&geometries=geojson`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            route = data.routes[0].geometry.coordinates;
            const routeLineString = turf.lineString(route);
            const chunks = turf.lineChunk(routeLineString, segmentDistance, { units: 'miles' });
            const segments = chunks.features.map(chunk => [chunk.geometry.coordinates[0], chunk.geometry.coordinates[chunk.geometry.coordinates.length - 1]]);
            

            const bounds = new mapboxgl.LngLatBounds();
            route.forEach(coord => bounds.extend(coord));
            const paddingOther = window.innerHeight * 0.3;
            const paddingLeft = window.innerWidth * 0.5;

            map.fitBounds(bounds, { 
                padding: { left: paddingLeft, top: paddingOther, bottom: paddingOther, right: paddingOther },
            });

            map.once('moveend', () => {
                const geojson = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: route
                    }
                };
                drawRoute(geojson);
            });

            map.once('idle', function() {
                // Now, the map has finished loading and rendering, fetch elevations
                getElevation(segments);
            });
        });
};


const getElevation = async (segments) => {


    elevations = []

    for (const segment of segments) {
        const startElevation = map.queryTerrainElevation(segment[0]);
        const endElevation = map.queryTerrainElevation(segment[1]);
        
        elevations.push(startElevation, endElevation);
    }
    console.log('elevations: ', elevations)

    calculateTimeSaved(segments);
};




const calculateTimeSaved = (segments) => {
    timeSaved = []
    elevationGains = []

    if (elevations.length !== 2 * segments.length) {
        console.error("Mismatch in elevations and segments array lengths:", elevations, segments);
        return;
    }

    for (let i = 0; i < segments.length; i++) {
        const startElevation = elevations[2 * i];
        const endElevation = elevations[2 * i + 1];

        // Convert elevation difference to miles
        const elevationDifferenceInMiles = (endElevation - startElevation) * 0.000621371;
        if (elevationDifferenceInMiles > 0) {
            elevationGains.push(elevationDifferenceInMiles);
        }

        // Calculate grade
        const grade = elevationDifferenceInMiles / segmentDistance;
        grades.push(grade);

        // Calculate speed difference
        let speedDifference;
        if (grade <= 0) {
            speedDifference = 0;
        } else {
            speedDifference = 55 - (35 + ((0.06 - grade) * 20 / 0.06));
        }
        speedDifferences.push(speedDifference);

        // Calculate time saved (converted from hours to minutes)
        const timeSavedForSegment = speedDifference === 0 ? 0 : (segmentDistance / speedDifference);
        timeSaved.push(timeSavedForSegment);
    }

    timeSavedPerTrip = timeSaved.reduce((acc, curr) => acc + curr, 0) / 60;
    totalElevationGain = elevationGains.reduce((acc, curr) => acc + curr, 0) * 5280; // Convert miles to feet
    
    calculateBtn.disabled = false
};

function calculateMetrics() {
    const numOfTrucks = parseInt(document.getElementById('trucks').value, 10);
    const tripsPerMonth = parseInt(document.getElementById('trips').value, 10);
    const dieselPrice = parseFloat(document.getElementById('diesel-price').value);
    const isRoundTrip = document.getElementById('round-trip').checked;

    const baseMileage = turf.length(turf.lineString(route), { units: 'miles' });
    const totalMileage = baseMileage * (isRoundTrip ? 2 : 1) * numOfTrucks * tripsPerMonth;
    const savings = Math.round((totalMileage * (dieselPrice / 7)) * 0.05);
    const CO2eSaved = parseFloat((totalMileage * (1 / 7 - 1 / 30) * 0.0010180).toFixed(1));
    const totalTimeSaved = Math.round(timeSavedPerTrip * numOfTrucks * tripsPerMonth * (isRoundTrip ? 2 : 1));

    console.log('Number of Trucks:', numOfTrucks);
    console.log('Trips Per Month:', tripsPerMonth);
    console.log('Diesel Price:', dieselPrice);
    console.log("Grades:", grades);
    console.log("Speed Differences:", speedDifferences);
    console.log("Time Saved for each segment (in minutes):", timeSaved);

    console.log("Elevation for each segment (in minutes):", elevations);
    console.log("Total Elevation Gain (in feet):", totalElevationGain);
    console.log("Total Mileage (in miles):", totalMileage);
    console.log("Savings in Dollars:", savings);
    console.log("CO2e Saved (tonnes):", CO2eSaved);
    console.log("Total Time Saved (in hours):", totalTimeSaved);


    document.querySelector('#hours-saved').innerText = totalTimeSaved;
    document.querySelector('#dollars-saved').innerText = savings;
    document.querySelector('#co2-saved').innerText = CO2eSaved;
}



function drawRoute(lineData) {
    //shadow-bot
    if (!map.getSource('route-shadow-bot')) {
        map.addSource('route-shadow-bot', {
            type: 'geojson',
            data: lineData
        });
    } else {
        map.getSource('route-shadow-bot').setData(lineData);
    }
    

    if (!map.getLayer('route-shadow-bot')) {
        map.addLayer({
            id: 'route-shadow-bot',
            type: 'line',
            source: 'route-shadow-bot',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#6CC5FF',
                'line-width': 12,
                'line-opacity': 0.8,
                'line-blur': 12,
        
            }
        });
    }

    //shadow-top
    if (!map.getSource('route-shadow-top')) {
        map.addSource('route-shadow-top', {
            type: 'geojson',
            data: lineData
        });
    } else {
        map.getSource('route-shadow-top').setData(lineData);
    }
    

    if (!map.getLayer('route-shadow-top')) {
        map.addLayer({
            id: 'route-shadow-top',
            type: 'line',
            source: 'route-shadow-top',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#6CC5FF',
                'line-width': 24,
                'line-opacity': 0.8,
                'line-blur': 40,
        
            }
        });
    }

    // Border Layer
    if (!map.getSource('route-border')) {
        map.addSource('route-border', {
            type: 'geojson',
            data: lineData
        });
    } else {
        map.getSource('route-border').setData(lineData);
    }

    if (!map.getLayer('route-border')) {
        map.addLayer({
            id: 'route-border',
            type: 'line',
            source: 'route-border',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#4AB0F2',
                'line-width': 1
            }
        });
    }

    // Route Line Layer
    if (!map.getSource('route')) {
        map.addSource('route', {
            type: 'geojson',
            data: lineData
        });
    } else {
        map.getSource('route').setData(lineData);
    }

    if (!map.getLayer('route')) {
        map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': 'white',
                'line-width': [
                    "interpolate",
                    ['exponential', 2],
                    ["zoom"],
                    5,2,15,8
                ]
            }
        });
    }
}
