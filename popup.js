document.addEventListener("DOMContentLoaded", () => {
	const $ = (selector) => document.querySelector(selector);

	const alertThresholdInput = $("#alertThreshold");
	const alertAmountSelect = $("#alertAmount");
	const alertEnabledCheckbox = $("#alertEnabled");
	const saveButton = $("#save");
	const saveStatus = $("#saveStatus");
	const coordinatesDiv = $("#coordinates");
	const restaurantsTableContainer = $("#restaurantsTableContainer");

	// Function to update the UI
	function updateUI(data) {
		alertThresholdInput.value = data.alertThreshold || 5.8;
		updateAlertThresholdValue(data.alertThreshold);

		alertEnabledCheckbox.checked = data.alertEnabled;

		alertAmountSelect.value =
			data.alertAmount || alertAmountSelect.options[0].value;

		if (data.restaurants?.length && data.alertEnabled) {
			generateRestaurantsTable(data.restaurants);
		} else {
			restaurantsTableContainer.innerHTML =
				"<p>Ei saatavilla olevia ravintoloita.</p>";
		}

		if (!data.coordinates) {
			coordinatesDiv.textContent =
				"Ei sijaintitietoa, käy asettamassa toimitusosoite kotipizza.fi sivulla.";
			coordinatesDiv.style.display = "flex";
		} else {
			coordinatesDiv.style.display = "none";
		}
	}

	// Function to load data and update UI
	function loadDataAndUpdateUI() {
		chrome.storage.local.get(
			[
				"alertThreshold",
				"coordinates",
				"alertEnabled",
				"restaurants",
				"alertAmount",
			],
			(result) => {
				updateUI(result);
			},
		);
	}

	// Initial load
	loadDataAndUpdateUI();

	// Listen for changes in chrome.storage
	chrome.storage.onChanged.addListener((changes, namespace) => {
		if (namespace === "local") {
			loadDataAndUpdateUI();
		}
	});

	saveButton.addEventListener("click", () => {
		const alertThreshold = alertThresholdInput.value;
		const alertEnabled = alertEnabledCheckbox.checked;
		const alertAmount = alertAmountSelect.value;

		chrome.runtime.sendMessage({
			action: alertEnabled ? "startPolling" : "stopPolling",
		});

		chrome.storage.local.set(
			{ alertThreshold, alertEnabled, alertAmount },
			() => {
				const { lastError } = chrome.runtime;
				if (lastError) {
					saveStatus.textContent = `Tallennus epäonnistui: ${lastError.message}`;
					saveStatus.style.color = "red";
				} else {
					saveStatus.textContent = "Tallennettu!";
					saveStatus.style.color = "white";
					setTimeout(() => {
						saveStatus.textContent = "";
					}, 3000);
				}
			},
		);
	});

	function generateRestaurantsTable(restaurants) {
		const table = document.createElement("table");
		table.innerHTML = `
      <tr>
        <th>Ravintola</th>
        <th>Toimitusmaksu (€)</th>
        <th>Toimitusarvio (minuttia)</th>
      </tr>
    `;

		for (const restaurant of restaurants) {
			const row = table.insertRow();
			if (restaurant.openForDeliveryStatus === "CLOSED") {
				row.innerHTML = `
					<td>${restaurant.displayName}</td>
					<td colspan="2">SULJETTU</td>
				`;
			} else {
				row.innerHTML = `
					<td>${restaurant.displayName}</td>
					<td>${restaurant.dynamicDeliveryFee}</td>
					<td>${restaurant.currentDeliveryEstimate}</td>
				`;
			}
		}

		restaurantsTableContainer.innerHTML = "";
		restaurantsTableContainer.appendChild(table);
	}

	function updateAlertThresholdValue(value) {
		$("#alertThresholdValue").textContent = `${value} €`;
	}

	alertThresholdInput.addEventListener("input", (event) => {
		updateAlertThresholdValue(event.target.value);
	});
});
