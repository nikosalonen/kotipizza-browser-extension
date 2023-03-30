document.addEventListener('DOMContentLoaded', () => {
  const $ = (selector) => document.querySelector(selector);

  chrome.storage.local.get(['alertThreshold', 'coordinates', 'alertEnabled', 'restaurants', 'alertAmount'], (result) => {
    const { alertThreshold, coordinates, alertEnabled, restaurants, alertAmount } = result;

    const alertThresholdInput = $('#alertThreshold');
    alertThresholdInput.value = alertThreshold || 5.8;
    updateAlertThresholdValue(alertThreshold);

    $('#alertEnabled').checked = alertEnabled;

    const alertAmountSelect = $('#alertAmount');
    alertAmountSelect.value = alertAmount || alertAmountSelect.options[0].value;

    if (restaurants?.length && alertEnabled) {
      generateRestaurantsTable(restaurants);
    }

    const coords = $('#coordinates');
    if (!coordinates) {
      coords.textContent = 'Ei sijantitietoa, käy asettamassa toimitusosoite kotipizza.fi sivulla.';
      coords.style.display = "flex";
    } else {
      coords.style.display = "none";
    }
  });
  $('#save').addEventListener('click', () => {
    const alertThreshold = $('#alertThreshold').value;
    const alertEnabled = $('#alertEnabled').checked;
    const alertAmount = $('#alertAmount').value;
    const saveStatus = $('#saveStatus');

    alertEnabled ? startPolling() : stopPolling();
    updateIcon(alertEnabled);
    chrome.storage.local.set({ alertThreshold, alertEnabled, alertAmount }, () => {
      const { lastError } = chrome.runtime;
      if (lastError) {
        saveStatus.textContent = `Tallennus epäonnistui: ${lastError.message}`;
        saveStatus.style.color = 'red';
      } else {
        saveStatus.textContent = 'Tallennettu!';
        saveStatus.style.color = 'white';
        setTimeout(() => {
          saveStatus.textContent = '';
        }, 3000);
      }
    });
  });
  function generateRestaurantsTable(restaurants) {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '20px';

    const headerRow = document.createElement('tr');

    ['Ravintola', 'Toimitusmaksu (€)', 'Toimitusarvio (minuttia)'].forEach((headerText) => {
      const header = document.createElement('th');
      header.textContent = headerText;
      header.style.border = '2px solid #FFF';
      header.style.padding = '10px';
      header.style.backgroundColor = '#2e9151';
      header.style.color = '#FFF';
      headerRow.appendChild(header);
    });

    table.appendChild(headerRow);

    restaurants.forEach((restaurant) => {
      const row = document.createElement('tr');

      [restaurant.displayName, restaurant.dynamicDeliveryFee, restaurant.currentDeliveryEstimate].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        cell.style.border = '2px solid #FFF';
        cell.style.padding = '10px';
        cell.style.backgroundColor = '#4da66d';
        cell.style.color = '#FFF';
        row.appendChild(cell);
      });

      table.appendChild(row);
    });

    document.getElementById('restaurantsTable').appendChild(table);

  }

  function startPolling() {
    chrome.runtime.sendMessage({ action: 'startPolling' });
  }

  function stopPolling() {
    chrome.runtime.sendMessage({ action: 'stopPolling' });
  }

  function updateIcon(alertEnabled) {
    chrome.runtime.sendMessage({ action: 'updateIcon', alertEnabled: alertEnabled });
  }
  function updateAlertThresholdValue(value) {
    document.getElementById('alertThresholdValue').textContent = `${value} €`;
  }

  document.getElementById('alertThreshold').addEventListener('input', (event) => {
    chrome.storage.local.set({
      alertThreshold: event.target.value,
    })
    updateAlertThresholdValue(event.target.value);
  });

  updateAlertThresholdValue(document.getElementById('alertThreshold').value);
});
