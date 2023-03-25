const API_URL = 'https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=';



async function fetchData(coordinates) {
  const response = await fetch(API_URL + coordinates);
  const data = await response.json();
  return data;
}

function createNotification(restaurant) {
  console.log('create Notification!')
  self.registration.showNotification('Kotipizza Delivery Alert', {
    icon: 'icon128.png',
    body: `${restaurant.displayName} has a delivery fee of ${restaurant.dynamicDeliveryFee} and an estimated delivery time of ${restaurant.currentDeliveryEstimate} minutes.`,
  });
}



async function checkDeliveryFees(coordinates, alertThreshold) {
  const url = `${API_URL}${coordinates}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Fetched data:', data); // Add this line
    data.forEach((restaurant) => {
      if (restaurant.dynamicDeliveryFee <= alertThreshold) {
        createNotification(restaurant);
      }
    });
  } catch (error) {
    console.error('Error fetching data:', error); // Add this line
  }
}


chrome.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled'], (result) => {
  if (result.alertEnabled) {
    checkDeliveryFees(result.coordinates, result.alertThreshold);
  }
});

function poll() {
  chrome.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled'], (result) => {
    console.log('Polling:', result); // Add this line
    if (result.alertEnabled) {
      checkDeliveryFees(result.coordinates, result.alertThreshold);
    }
    setTimeout(poll, 30 * 1000); // Poll every 10 minutes
  });
}


// Start the polling
poll();
