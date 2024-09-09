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
	const cooldownPeriod = 60000; // 1 minute in milliseconds

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
		} else {
			elements.restaurantsTable.innerHTML = "";
		}

		if (!coordinates) {
			elements.coordinates.textContent =
				"Ei sijantitietoa, käy asettamassa toimitusosoite kotipizza.fi sivulla.";
			elements.coordinates.style.display = "flex";
		} else {
			elements.coordinates.style.display = "none";
		}
		updateRefreshUI();
		setTimeout(updatePopupSize, 0);
	}

	function saveSettings() {
		const settings = {
			alertThreshold: elements.alertThreshold.value,
			alertEnabled: elements.alertEnabled.checked,
			alertAmount: elements.alertAmount.value,
		};

		chrome.runtime.sendMessage(
			{ action: settings.alertEnabled ? "startPolling" : "stopPolling" },
			(response) => {
				if (chrome.runtime.lastError) {
					console.error("Error sending message:", chrome.runtime.lastError);
					showSaveStatus("Virhe asetuksien tallennuksessa", "red");
				} else {
					chrome.storage.local.set(settings, () => {
						if (chrome.runtime.lastError) {
							console.error("Error saving settings:", chrome.runtime.lastError);
							showSaveStatus("Virhe asetuksien tallennuksessa", "red");
						} else {
							showSaveStatus("Tallennettu!", "white");
						}
					});
				}
			},
		);
	}

	function updatePopupSize() {
		const contentWrapper = $("#content-wrapper");
		const width = contentWrapper.offsetWidth;
		const height = contentWrapper.offsetHeight;

		// Add a small buffer to the height to account for potential scrollbar
		const bufferedHeight = height + 20;

		document.body.style.width = `${width}px`;
		document.body.style.height = `${bufferedHeight}px`;

		// Notify the browser to resize the popup
		chrome.runtime.sendMessage({
			action: "resize",
			width,
			height: bufferedHeight,
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

			chrome.runtime.sendMessage({ action: "manualRefresh" });
			showSaveStatus("Päivitetään hintoja...", "white");
			updateRefreshUI();
		}
	}

	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.action === "refreshComplete") {
			if (message.success) {
				showSaveStatus("Hinnat päivitetty!", "white");
				updateUI(message.settings);
			} else {
				showSaveStatus("Päivitys epäonnistui. Yritä uudelleen.", "red");
			}
			updateRefreshUI();
		}
	});

	function updateAlertThresholdValue(value) {
		$("#alertThresholdValue").textContent = `${value} €`;
	}

	chrome.storage.local.get(null, (settings) => {
		lastRefreshTime = settings.lastRefreshTime || 0;
		updateUI(settings);
	});

	elements.saveButton.addEventListener("click", saveSettings);
	elements.alertThreshold.addEventListener("input", (event) => {
		updateAlertThresholdValue(event.target.value);
	});
	elements.refreshButton.addEventListener("click", refreshPrices);

	// Add event listeners for content changes that might affect size
	const resizeObserver = new ResizeObserver(updatePopupSize);
	resizeObserver.observe($("#content-wrapper"));

	// Initial size update
	updatePopupSize();
});
