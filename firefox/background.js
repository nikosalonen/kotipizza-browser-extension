const API_URL = 'https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=';
let pollingTimeoutID;

function updateIcon(alertEnabled) {
  const iconPath = alertEnabled ? 'assets/icon128.png' : 'assets/icon128-grayscale.png';
  browser.browserAction.setIcon({ path: iconPath });
}

async function checkDeliveryFees(coordinates, alertThreshold, alertAmount) {
  const url = `${API_URL}${coordinates}`;
  if (coordinates) {

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log('Fetched data:', data);

      console.log(data)
      if (data.length > 0 && !data.error_code) {
        browser.storage.local.set({ restaurants: data });
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
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

}

// browser.webRequest.onHeadersReceived.addListener(
//   (details) => {
//     for (const header of details.responseHeaders) {
//       if (header.name.toLowerCase() === 'access-control-allow-origin') {
//         header.value = '*';
//       }
//     }
//     return { responseHeaders: details.responseHeaders };
//   },
//   { urls: ['https://apim-kotipizza-ecom-prod.azure-api.net/*'] },
//   ['blocking', 'responseHeaders']
// );

const filter = {
  urls: ['https://apim-kotipizza-ecom-prod.azure-api.net/*']
}
const extraInfoSpec = ['responseHeaders']

browser.webRequest.onCompleted.addListener(
  (details) => {

    if (
      details.url.startsWith('https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby') &&
      details.method === 'GET' &&
      details.statusCode === 200 &&
      (details?.originUrl.startsWith("https://www.kotipizza.fi"))
    ) {
      console.log("coordinates found")
      const coordinates = details.url.split('coordinates=')[1];
      browser.storage.local.set({ coordinates }, () => {
        console.log("coordinates saved to storage")
        browser.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled', 'alertAmount'], (result) => {
          const { alertThreshold, alertAmount } = result;
          checkDeliveryFees(coordinates, alertThreshold, alertAmount);
        });
      });

    }
  },
  filter, extraInfoSpec
);
function createNotification(restaurant) {
  const title = '🍕 Pizza time!';
  const message = `Toimitusmaksu ravintolassa ${restaurant.displayName} on nyt ${restaurant.dynamicDeliveryFee}€! \nToimitusarvio on ${restaurant.currentDeliveryEstimate} minuttia.`;

  browser.notifications.create('pizzaTime', {
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: title,
    message: message,
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

browser.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled', 'alertAmount'], (result) => {
  if (result.alertEnabled) {
    checkDeliveryFees(result.coordinates, result.alertThreshold, result.alertAmount);
  }
});

function poll(timeout) {
  browser.storage.local.get(['coordinates', 'alertThreshold', 'alertEnabled', 'alertAmount'], (result) => {
    console.log('Polling:', result);
    if (result.alertEnabled) {
      checkDeliveryFees(result.coordinates, result.alertThreshold, result.alertAmount);
      pollingTimeoutID = setTimeout(() => poll(timeout), timeout);
    }
  });
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startPolling') {
    poll(5 * 60 * 1000); // data is updated every 10 minutes but we get feedback faster polling every 5 minutes
    updateIcon(true);
  }
  else if (request.action === 'stopPolling') {
    browser.storage.local.set({ restaurants: [] });
    clearTimeout(pollingTimeoutID);
    updateIcon(false);
  } else if (request.action === 'updateIcon') {
    updateIcon(request.alertEnabled);
  }
});
