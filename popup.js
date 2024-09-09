document.addEventListener("DOMContentLoaded", () => {
	const $ = (selector) => document.querySelector(selector);

	const elements = {
		alertThreshold: $("#alertThreshold"),
		alertEnabled: $("#alertEnabled"),
		alertAmount: $("#alertAmount"),
		coordinates: $("#coordinates"),
		saveButton: $("#save"),
		saveStatus: $("#saveStatus"),
		restaurantsTable: $("#restaurantsTable"),
	};

	function updateUI(settings) {
		const {
			alertThreshold,
			alertEnabled,
			alertAmount,
			coordinates,
			restaurants,
		} = settings;

		elements.alertThreshold.value = alertThreshold || 5.8;
		updateAlertThresholdValue(alertThreshold);

		elements.alertEnabled.checked = alertEnabled;
		elements.alertAmount.value =
			alertAmount || elements.alertAmount.options[0].value;

		if (restaurants?.length && alertEnabled) {
			generateRestaurantsTable(restaurants);
		}

		if (!coordinates) {
			elements.coordinates.textContent =
				"Ei sijantitietoa, käy asettamassa toimitusosoite kotipizza.fi sivulla.";
			elements.coordinates.style.display = "flex";
		} else {
			elements.coordinates.style.display = "none";
		}
	}

	function saveSettings() {
		const settings = {
			alertThreshold: elements.alertThreshold.value,
			alertEnabled: elements.alertEnabled.checked,
			alertAmount: elements.alertAmount.value,
		};

		settings.alertEnabled ? startPolling() : stopPolling();
		updateIcon(settings.alertEnabled);

		chrome.storage.local.set(settings, () => {
			const { lastError } = chrome.runtime;
			if (lastError) {
				showSaveStatus(`Tallennus epäonnistui: ${lastError.message}`, "red");
			} else {
				showSaveStatus("Tallennettu!", "white");
			}
		});
	}

	function showSaveStatus(message, color) {
		elements.saveStatus.textContent = message;
		elements.saveStatus.style.color = color;
		setTimeout(() => {
			elements.saveStatus.textContent = "";
		}, 3000);
	}

	function generateRestaurantsTable(restaurants) {
		const table = document.createElement("table");
		table.className = "restaurants-table";

		const headers = [
			"Ravintola",
			"Toimitusmaksu (€)",
			"Toimitusarvio (minuttia)",
		];
		const headerRow = document.createElement("tr");

		for (const headerText of headers) {
			const header = document.createElement("th");
			header.textContent = headerText;
			headerRow.appendChild(header);
		}

		table.appendChild(headerRow);

		for (const restaurant of restaurants) {
			const row = document.createElement("tr");
			for (const value of [
				restaurant.displayName,
				restaurant.dynamicDeliveryFee,
				restaurant.currentDeliveryEstimate,
			]) {
				const cell = document.createElement("td");
				cell.textContent = value;
				row.appendChild(cell);
			}
			table.appendChild(row);
		}

		elements.restaurantsTable.innerHTML = "";
		elements.restaurantsTable.appendChild(table);
	}

	function startPolling() {
		chrome.runtime.sendMessage({ action: "startPolling" });
	}

	function stopPolling() {
		chrome.runtime.sendMessage({ action: "stopPolling" });
	}

	function updateIcon(alertEnabled) {
		chrome.runtime.sendMessage({ action: "updateIcon", alertEnabled });
	}

	function updateAlertThresholdValue(value) {
		$("#alertThresholdValue").textContent = `${value} €`;
	}

	chrome.storage.local.get(null, updateUI);

	elements.saveButton.addEventListener("click", saveSettings);
	elements.alertThreshold.addEventListener("input", (event) => {
		updateAlertThresholdValue(event.target.value);
	});
});
