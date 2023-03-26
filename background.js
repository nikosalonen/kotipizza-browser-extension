const API_URL = 'https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=';
let pollingTimeoutID;

// get coordinates from kotipizza.fi nearby restaurants api
chrome.webRequest.onCompleted.addListener(
  (details) => {

    if (
      details.url.startsWith('https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby') &&
      details.method === 'GET' &&
      details.statusCode === 200 &&
      details.initiator === "https://www.kotipizza.fi"
    ) {

      //value of coordinates is coords parameter from details.url
      const coordinates = details.url.split('coordinates=')[1];
      chrome.storage.local.set({ coordinates });
    }
  },
  {
    urls: [
      'https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=*',
    ]
  }
);



function createNotification(restaurant) {
  self.registration.showNotification('Kotipizza Delivery Alert', {
    icon: 'icon128.png',
    body: `${restaurant.displayName} has a delivery fee of ${restaurant.dynamicDeliveryFee} and an estimated delivery time of ${restaurant.currentDeliveryEstimate} minutes.`,
  });
}



async function checkDeliveryFees(coordinates, alertThreshold, alertAmount) {
  const url = `${API_URL}${coordinates}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Fetched data:', data); // Add this line

    //if data has restaurants, save them to storage
    if (data.length > 0) {
      chrome.storage.local.set({ restaurants: data });
    }
    //if alertAmount is 1, create notification for the restaurant with the lowest delivery fee that is not closed and has a delivery fee lower than alertThreshold
    if (alertAmount === "1") {
      const lowestDeliveryFee = data.reduce((prev, current) => (prev.dynamicDeliveryFee < current.dynamicDeliveryFee) ? prev : current);
      if (lowestDeliveryFee.openForDeliveryStatus !== "CLOSED" && lowestDeliveryFee.dynamicDeliveryFee <= alertThreshold) {
        createNotification(lowestDeliveryFee);
      }
    }
    //if alertAmount is 2, create notification for the restaurant with the lowest delivery estimate that is not closed and has a delivery fee lower than alertThreshold
    else if (alertAmount === "2") {
      const lowestDeliveryEstimate = data.reduce((prev, current) => (prev.currentDeliveryEstimate < current.currentDeliveryEstimate) ? prev : current);
      if (lowestDeliveryEstimate.openForDeliveryStatus !== "CLOSED" && lowestDeliveryEstimate.dynamicDeliveryFee <= alertThreshold) {
        createNotification(lowestDeliveryEstimate);
      }
    }
    //if alertAmount is 3, create notification for all restaurant with the lowest delivery fee that is not closed and has a delivery fee lower than alertThreshold and sort them by delivery fee
    else if (alertAmount === "3") {
      const lowestDeliveryFee = data.filter(restaurant => restaurant.openForDeliveryStatus !== "CLOSED" && restaurant.dynamicDeliveryFee <= alertThreshold).sort((a, b) => a.dynamicDeliveryFee - b.dynamicDeliveryFee);
      lowestDeliveryFee.forEach(restaurant => {
        createNotification(restaurant);
      });
    }

  } catch (error) {
    console.error('Error fetching data:', error); // Add this line
  }
}


chrome.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled', 'alertAmount'], (result) => {
  if (result.alertEnabled) {
    checkDeliveryFees(result.coordinates, result.alertThreshold, result.alertAmount);
  }
});

function poll(timeout) {
  chrome.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled', 'alertAmount'], (result) => {
    console.log('Polling:', result);
    if (result.alertEnabled) {
      checkDeliveryFees(result.coordinates, result.alertThreshold, result.alertAmount);
      pollingTimeoutID = setTimeout(() => poll(timeout), timeout);
    }
  });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startPolling') {
    poll(10 * 60 * 1000);
  }
  else if (request.action === 'stopPolling') {
    clearTimeout(pollingTimeoutID);
  }
});
