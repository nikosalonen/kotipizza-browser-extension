document.addEventListener('DOMContentLoaded', () => {
  // Get the current values from storage and populate the inputs
  chrome.storage.local.get(['alertThreshold', 'coordinates', 'alertEnabled'], (result) => {
    document.getElementById('alertThreshold').value = result.alertThreshold;
    document.getElementById('alertEnabled').checked = result.alertEnabled;
    console.log(result.coordinates);
    const coords = document.getElementById('coordinates');
    if (!result.coordinates) {
      coords.innerHTML = 'Ei sijantitietoa, käy asettamassa toimitusosoite kotipizza.fi sivulla.';
      coords.style.display = "flex"
    } else {
      document.getElementById('coordinates').innerHTML = "";
      coords.style.display = "none"
    }
  });

  // Save button click event listener
  document.getElementById('save').addEventListener('click', () => {
    const alertThreshold = parseFloat(document.getElementById('alertThreshold').value);
    const alertEnabled = document.getElementById('alertEnabled').checked;

    console.log(alertEnabled, alertThreshold);

    chrome.storage.local.set({
      alertThreshold: alertThreshold,
      alertEnabled: alertEnabled,
    }, () => {
      console.log('Tallennettu!');
    });
  });

  // Request notification permission
  async function requestNotificationPermission() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission not granted for notifications.');
    }
  }
});
