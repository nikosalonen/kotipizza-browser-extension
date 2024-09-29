const API_URL =
	"https://apim-kotipizza-ecom-prod.azure-api.net/webshop/v1/restaurants/nearby?type=DELIVERY&coordinates=";
let pollingTimeoutID;

function updateIcon(alertEnabled) {
	const iconPath = alertEnabled
		? "assets/icon128.png"
		: "assets/icon128-grayscale.png";
	browser.browserAction.setIcon({ path: iconPath });
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
			browser.storage.local.set({ restaurants: data });
		}

		const criteriaMap = {
			1: "dynamicDeliveryFee",
			2: "currentDeliveryEstimate",
		};

		const criteria = criteriaMap[alertAmount];
		if (criteria) {
			const bestRestaurant = findBestRestaurant(data, criteria);
			if (
				bestRestaurant.dynamicDeliveryFee <= alertThreshold &&
				restaurant.openForDeliveryStatus !== "CLOSED"
			) {
				createNotification(bestRestaurant);
			}
		}
	} catch (error) {
		console.error("Error fetching data:", error);
	}
}

browser.webRequest.onCompleted.addListener(
	(details) => {
		console.log("webRequest listener triggered:", details.url);
		if (
			details.url.startsWith(API_URL) &&
			details.method === "GET" &&
			details.statusCode === 200 &&
			details.originUrl.includes("kotipizza.fi")
		) {
			console.log("API call detected");
			const coordinates = details.url.split("coordinates=")[1];
			console.log("Extracted coordinates:", coordinates);
			browser.storage.local.set({ coordinates }, () => {
				console.log("Coordinates saved to storage");
				browser.storage.local.get(
					["alertThreshold", "alertEnabled", "alertAmount"],
					(result) => {
						console.log("Retrieved from storage:", result);
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
	browser.notifications.create({
		type: "basic",
		iconUrl: "assets/icon128.png",
		title: "🍕 Pizza time!",
		message: `Toimitusmaksu ravintolassa ${restaurant.displayName} on nyt ${restaurant.dynamicDeliveryFee}€! \nToimitusarvio on ${restaurant.currentDeliveryEstimate} minuttia.`,
	});
}

browser.notifications.onClicked.addListener(() => {
	browser.tabs.create({ url: "https://kotipizza.fi" });
});

function poll(timeout) {
	browser.storage.local.get(
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

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.action) {
		case "startPolling":
			poll(5 * 60 * 1000);
			updateIcon(true);
			break;
		case "stopPolling":
			browser.storage.local.set({ restaurants: [] });
			clearTimeout(pollingTimeoutID);
			updateIcon(false);
			break;
		case "updateIcon":
			updateIcon(request.alertEnabled);
			break;
	}
});

// Initial setup
browser.storage.local.get(
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

browser.runtime.onInstalled.addListener(() => {
	console.log("Extension installed or updated");
	browser.storage.local.get(null, (items) => {
		console.log("All storage items:", items);
	});
});
