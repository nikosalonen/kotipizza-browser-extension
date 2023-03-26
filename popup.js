document.addEventListener('DOMContentLoaded', () => {
  // Get the current values from storage and populate the inputs
  chrome.storage.local.get(['alertThreshold', 'coordinates', 'alertEnabled', 'restaurants', 'alertAmount'], (result) => {
    document.getElementById('alertThreshold').value = `${result.alertThreshold}`.replace('.', ',');
    document.getElementById('alertEnabled').checked = result.alertEnabled;

    //select the alertAmount option that matches the value in storage
    const alertAmount = document.getElementById('alertAmount');
    for (let i = 0; i < alertAmount.options.length; i++) {
      if (alertAmount.options[i].value === result.alertAmount) {
        alertAmount.options[i].selected = true;
        break;
      }
    }


    if (result.restaurants?.length && result.alertEnabled) {
      generateRestaurantsTable(result.restaurants);
    }
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
    const alertThreshold = parseFloat((document.getElementById('alertThreshold').value).replace(',', '.'));
    const alertEnabled = document.getElementById('alertEnabled').checked;
    const saveStatus = document.getElementById('saveStatus');
    const alertAmount = document.getElementById('alertAmount').value;
    if (alertEnabled) {
      startPolling();
    } else {
      stopPolling();
    }
    chrome.storage.local.set({
      alertThreshold: alertThreshold,
      alertEnabled: alertEnabled,
      alertAmount: alertAmount,
    }, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        saveStatus.innerHTML = `Tallennus epäonnistui: ${lastError.message}`;
        saveStatus.style.color = 'red';
      } else {
        saveStatus.innerHTML = 'Tallennettu!';
        saveStatus.style.color = 'white';
        // Optionally, clear the message after a few seconds
        setTimeout(() => {
          saveStatus.innerHTML = '';
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


});
