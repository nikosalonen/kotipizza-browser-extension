const API_URL =
	"https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=";
let pollingTimeoutID;

function updateIcon(alertEnabled) {
	const iconPath = alertEnabled
		? "assets/icon128.png"
		: "assets/icon128-grayscale.png";
	chrome.action.setIcon({ path: iconPath });
}

async function fetchRestaurantData(coordinates) {
	const url = `${API_URL}${coordinates}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	return response.json();
}

function findBestRestaurant(data, criteria) {
	return data.reduce((best, current) =>
		current[criteria] < best[criteria] &&
		current.openForDeliveryStatus !== "CLOSED"
			? current
			: best,
	);
}

async function checkDeliveryFees(coordinates, alertThreshold, alertAmount) {
	try {
		const data = await fetchRestaurantData(coordinates);
		console.log("Fetched data:", data);

		if (data.length > 0) {
			chrome.storage.local.set({ restaurants: data });
		}

		const criteriaMap = {
			1: "dynamicDeliveryFee",
			2: "currentDeliveryEstimate",
		};

		const criteria = criteriaMap[alertAmount];
		if (criteria) {
			const bestRestaurant = findBestRestaurant(data, criteria);
			if (bestRestaurant.dynamicDeliveryFee <= alertThreshold) {
				createNotification(bestRestaurant);
			}
		}
	} catch (error) {
		console.error("Error fetching data:", error);
	}
}

chrome?.webRequest?.onCompleted.addListener(
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
					["alertThreshold", "alertEnabled", "alertAmount"],
					(result) => {
						if (result.alertEnabled) {
							checkDeliveryFees(
								coordinates,
								result.alertThreshold,
								result.alertAmount,
							);
						}
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
			if (result.alertEnabled && result.coordinates) {
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
	switch (request.action) {
		case "startPolling":
			poll(5 * 60 * 1000);
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
	}
});

// Initial setup
chrome.storage.local.get(
	["coordinates", "alertThreshold", "alertEnabled", "alertAmount"],
	(result) => {
		if (result.alertEnabled && result.coordinates) {
			checkDeliveryFees(
				result.coordinates,
				result.alertThreshold,
				result.alertAmount,
			);
		}
	},
);
