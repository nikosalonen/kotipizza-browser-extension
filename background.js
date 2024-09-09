// background.js

const API_URL =
	"https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=";
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
		const data = await response.json();
		console.log("Fetched data:", data);

		if (data.length > 0) {
			chrome.storage.local.set({ restaurants: data });
		}

		const filterRestaurant = (restaurant) =>
			restaurant.openForDeliveryStatus !== "CLOSED" &&
			restaurant.dynamicDeliveryFee <= alertThreshold;

		let selectedRestaurant;
		if (alertAmount === "1") {
			selectedRestaurant = data.reduce((prev, current) =>
				prev.dynamicDeliveryFee < current.dynamicDeliveryFee ? prev : current,
			);
		} else if (alertAmount === "2") {
			selectedRestaurant = data.reduce((prev, current) =>
				prev.currentDeliveryEstimate < current.currentDeliveryEstimate
					? prev
					: current,
			);
		}

		if (selectedRestaurant && filterRestaurant(selectedRestaurant)) {
			createNotification(selectedRestaurant);
		}
	} catch (error) {
		console.error("Error fetching data:", error);
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

function poll(timeout) {
	chrome.storage.local.get(
		["coordinates", "alertThreshold", "alertEnabled", "alertAmount"],
		(result) => {
			console.log("Polling:", result);
			if (result.alertEnabled) {
				checkDeliveryFees(
					result.coordinates,
					result.alertThreshold,
					result.alertAmount,
				);
				pollingTimeoutID = setTimeout(() => poll(timeout), timeout);
			}
		},
	);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "startPolling") {
		poll(5 * 60 * 1000);
		updateIcon(true);
	} else if (request.action === "stopPolling") {
		chrome.storage.local.set({ restaurants: [] });
		clearTimeout(pollingTimeoutID);
		updateIcon(false);
	} else if (request.action === "updateIcon") {
		updateIcon(request.alertEnabled);
	}
});

// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.get(
		["alertThreshold", "alertEnabled", "alertAmount"],
		(result) => {
			if (!result.alertThreshold)
				chrome.storage.local.set({ alertThreshold: 5.8 });
			if (result.alertEnabled === undefined)
				chrome.storage.local.set({ alertEnabled: false });
			if (!result.alertAmount) chrome.storage.local.set({ alertAmount: "1" });
		},
	);
});
