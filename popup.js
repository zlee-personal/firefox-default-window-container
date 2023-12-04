document.addEventListener('DOMContentLoaded', async () => {
  const selectElement = document.getElementById('container-select');
  const setDefaultButton = document.getElementById('set-default');
  let currentWindow = await browser.windows.getCurrent();

  // Populate the dropdown with the list of containers
  const containers = await browser.contextualIdentities.query({});
  containers.forEach((container) => {
    const option = document.createElement('option');
    option.value = container.cookieStoreId;
    option.textContent = container.name;
    selectElement.appendChild(option);
  });

  // Set the default container for the current window
  setDefaultButton.addEventListener('click', async () => {
    const containerId = selectElement.value;
    browser.runtime.sendMessage({
      action: 'setDefaultContainer',
      windowId: currentWindow.id,
      containerId: containerId
    }).then(() => {
      window.close(); // Close the popup after the selection is made
    }).catch((error) => {
      console.error(`Error setting default container: ${error}`);
    });
  });
});
