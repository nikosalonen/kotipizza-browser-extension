document.addEventListener("DOMContentLoaded", () => {
	browser.runtime.getManifest().then((manifest) => {
		document.getElementById("version").textContent = manifest.version;
	});
});
