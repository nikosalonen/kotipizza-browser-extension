const API_URL = 'https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=';
let pollingTimeoutID;

function updateIcon(alertEnabled) {
  const iconPath = alertEnabled ? 'assets/icon128.png' : 'assets/icon128-grayscale.png';
  chrome.action.setIcon({ path: iconPath });
}

async function checkDeliveryFees(coordinates, alertThreshold, alertAmount) {
  const url = `${API_URL}${coordinates}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Fetched data:', data);

    if (data.length > 0) {
      chrome.storage.local.set({ restaurants: data });
    }
    if (alertAmount === "1") {
      const lowestDeliveryFee = data.reduce((prev, current) => (prev.dynamicDeliveryFee < current.dynamicDeliveryFee) ? prev : current);
      if (lowestDeliveryFee.openForDeliveryStatus !== "CLOSED" && lowestDeliveryFee.dynamicDeliveryFee <= alertThreshold) {
        createNotification(lowestDeliveryFee);
      }
    } else if (alertAmount === "2") {
      const lowestDeliveryEstimate = data.reduce((prev, current) => (prev.currentDeliveryEstimate < current.currentDeliveryEstimate) ? prev : current);
      if (lowestDeliveryEstimate.openForDeliveryStatus !== "CLOSED" && lowestDeliveryEstimate.dynamicDeliveryFee <= alertThreshold) {
        createNotification(lowestDeliveryEstimate);
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (
      details.url.startsWith('https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby') &&
      details.method === 'GET' &&
      details.statusCode === 200 &&
      details.initiator === "https://www.kotipizza.fi"
    ) {

      const coordinates = details.url.split('coordinates=')[1];
      chrome.storage.local.set({ coordinates }, () => {
        console.log("coordinates saved to storage")
        chrome.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled', 'alertAmount'], (result) => {
          const { alertThreshold, alertAmount } = result;
          checkDeliveryFees(coordinates, alertThreshold, alertAmount);
        });
      });

    }
  },
  {
    urls: [
      'https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=*',
    ]
  }
);
function createNotification(restaurant) {
  self.registration.showNotification('🍕 Pizza time!', {
    icon: 'icon128.png',
    body: `Toimitusmaksu ravintolassa ${restaurant.displayName} on nyt ${restaurant.dynamicDeliveryFee}€! \nToimitusarvio on ${restaurant.currentDeliveryEstimate} minuttia.`

  });
}


self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  // Perform your desired action, for example, opening a URL in a new tab
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('https://kotipizza.fi'); // Replace with the desired URL
    })
  );
});

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
    updateIcon(true);
  }
  else if (request.action === 'stopPolling') {
    chrome.storage.local.set({ restaurants: [] });
    clearTimeout(pollingTimeoutID);
    updateIcon(false);
  } else if (request.action === 'updateIcon') {
    updateIcon(request.alertEnabled);
  }
});
