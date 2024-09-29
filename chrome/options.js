document.addEventListener("DOMContentLoaded", () => {
	chrome.management.getSelf((info) => {
		document.getElementById("version").textContent = info.version;
	});
});
