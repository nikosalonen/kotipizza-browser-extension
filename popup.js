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
		refreshButton: $("#refreshButton"),
		lastRefreshed: $("#lastRefreshed"),
		nextRefresh: $("#nextRefresh"),
	};

	let lastRefreshTime = 0;
	const REFRESH_COOLDOWN = 60000; // 1 minute in milliseconds

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
		updateRefreshUI();
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

	function updateRefreshUI() {
		const now = Date.now();
		const timeSinceLastRefresh = now - lastRefreshTime;
		const timeUntilNextRefresh = Math.max(
			0,
			cooldownPeriod - timeSinceLastRefresh,
		);

		elements.refreshButton.disabled = timeUntilNextRefresh > 0;
		elements.lastRefreshed.textContent = `Viimeksi päivitetty: ${formatTime(lastRefreshTime)}`;
		elements.nextRefresh.textContent = `Seuraava päivitys: ${formatTime(now + timeUntilNextRefresh)}`;

		if (timeUntilNextRefresh > 0) {
			setTimeout(updateRefreshUI, 1000);
		}
	}

	function formatTime(timestamp) {
		return new Date(timestamp).toLocaleTimeString("fi-FI");
	}

	function refreshPrices() {
		const now = Date.now();
		if (now - lastRefreshTime >= cooldownPeriod) {
			lastRefreshTime = now;
			chrome.storage.local.set({ lastRefreshTime: lastRefreshTime });

			chrome.runtime.sendMessage({ action: "manualRefresh" }, (response) => {
				if (response?.success) {
					showSaveStatus("Hinnat päivitetty!", "white");
					updateUI(response.settings);
				} else {
					showSaveStatus("Päivitys epäonnistui. Yritä uudelleen.", "red");
				}
				updateRefreshUI();
			});
		}
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

	chrome.storage.local.get(null, (settings) => {
		lastRefreshTime = settings.lastRefreshTime || 0;
		updateUI(settings);
	});

	elements.saveButton.addEventListener("click", saveSettings);
	elements.alertThreshold.addEventListener("input", (event) => {
		updateAlertThresholdValue(event.target.value);
	});
	elements.refreshButton.addEventListener("click", refreshPrices);
});
