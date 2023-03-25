document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['alertThreshold', 'coordinates'], (result) => {
    document.getElementById('alertThreshold').value = result.alertThreshold;
    document.getElementById('coordinates').value = result.coordinates;
  });
});
document.getElementById('save').addEventListener('click', () => {
  const coordinates = document.getElementById('coordinates').value;
  const alertThreshold = parseFloat(document.getElementById('alertThreshold').value);
  const alertEnabled = document.getElementById('alertEnabled').checked;

  chrome.storage.local.set({
    coordinates: coordinates,
    alertThreshold: alertThreshold,
    alertEnabled: alertEnabled,
  }, () => {
    console.log('Settings saved');
  });
});


async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission not granted for notifications.');
  }
}
