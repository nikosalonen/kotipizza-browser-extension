const API_URL =
	"https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=";
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let pollingTimeoutID;

function updateIcon(alertEnabled) {
	const iconPath = alertEnabled
		? "assets/icon128.png"
		: "assets/icon128-grayscale.png";
	chrome.action.setIcon({ path: iconPath });
}

async function checkDeliveryFees(coordinates, alertThreshold, alertAmount) {
	const url = `${API_URL}${coordinates}`;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const data = await response.json();
		console.log("Fetched data:", data);

		if (data.length > 0) {
			chrome.storage.local.set({ restaurants: data });
		}

		const filterRestaurant = (restaurant) =>
			restaurant.openForDeliveryStatus !== "CLOSED" &&
			restaurant.dynamicDeliveryFee <= alertThreshold;

		const selectedRestaurant = data
			.filter(filterRestaurant)
			.reduce(
				(prev, current) =>
					alertAmount === "1"
						? prev.dynamicDeliveryFee < current.dynamicDeliveryFee
							? prev
							: current
						: prev.currentDeliveryEstimate < current.currentDeliveryEstimate
							? prev
							: current,
				null,
			);

		if (selectedRestaurant) {
			createNotification(selectedRestaurant);
		}

		return { success: true, data };
	} catch (error) {
		console.error("Error fetching data:", error);
		return { success: false, error: error.message };
	}
}

chrome.webRequest.onCompleted.addListener(
	(details) => {
		if (
			details.url.startsWith(API_URL) &&
			details.method === "GET" &&
			details.statusCode === 200 &&
			details.initiator === "https://www.kotipizza.fi"
		) {
			const coordinates = details.url.split("coordinates=")[1];
			chrome.storage.local.set({ coordinates }, () => {
				console.log("coordinates saved to storage");
				chrome.storage.local.get(
					["coordinates", "alertThreshold", "alertEnabled", "alertAmount"],
					(result) => {
						const { alertThreshold, alertAmount } = result;
						checkDeliveryFees(coordinates, alertThreshold, alertAmount);
					},
				);
			});
		}
	},
	{ urls: [`${API_URL}*`] },
);

function createNotification(restaurant) {
	chrome.notifications.create({
		type: "basic",
		iconUrl: "assets/icon128.png",
		title: "🍕 Pizza time!",
		message: `Toimitusmaksu ravintolassa ${restaurant.displayName} on nyt ${restaurant.dynamicDeliveryFee}€! \nToimitusarvio on ${restaurant.currentDeliveryEstimate} minuttia.`,
	});
}

chrome.notifications.onClicked.addListener(() => {
	chrome.tabs.create({ url: "https://kotipizza.fi" });
});

function poll() {
	chrome.storage.local.get(
		["coordinates", "alertThreshold", "alertEnabled", "alertAmount"],
		async (result) => {
			console.log("Polling:", result);
			if (result.alertEnabled && result.coordinates) {
				await checkDeliveryFees(
					result.coordinates,
					result.alertThreshold,
					result.alertAmount,
				);
				pollingTimeoutID = setTimeout(poll, POLLING_INTERVAL);
			}
		},
	);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.action) {
		case "startPolling":
			clearTimeout(pollingTimeoutID);
			poll();
			updateIcon(true);
			break;
		case "stopPolling":
			chrome.storage.local.set({ restaurants: [] });
			clearTimeout(pollingTimeoutID);
			updateIcon(false);
			break;
		case "updateIcon":
			updateIcon(request.alertEnabled);
			break;
		case "manualRefresh":
			chrome.storage.local.get(
				["coordinates", "alertThreshold", "alertEnabled", "alertAmount"],
				async (result) => {
					const refreshResult = await checkDeliveryFees(
						result.coordinates,
						result.alertThreshold,
						result.alertAmount,
					);
					if (refreshResult.success) {
						chrome.storage.local.get(null, (settings) => {
							chrome.runtime.sendMessage({
								action: "refreshComplete",
								success: true,
								settings: settings,
							});
						});
					} else {
						chrome.runtime.sendMessage({
							action: "refreshComplete",
							success: false,
						});
					}
				},
			);
			break;
		case "resize":
			chrome.windows.getCurrent((window) => {
				chrome.windows.update(window.id, {
					width: request.width,
					height: request.height,
				});
			});
			break;
	}
});

// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.get(
		["alertThreshold", "alertEnabled", "alertAmount"],
		(result) => {
			const defaults = {
				alertThreshold: 5.8,
				alertEnabled: false,
				alertAmount: "1",
			};
			chrome.storage.local.set({ ...defaults, ...result }, () => {
				updateIcon(result.alertEnabled || false);
			});
		},
	);
});

// Start polling if alertEnabled is true when the extension is loaded
chrome.storage.local.get(["alertEnabled"], (result) => {
	if (result.alertEnabled) {
		poll();
	}
});
