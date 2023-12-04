function openInDifferentContainer(cookieStoreId, tab) {
  const tabProperties = {
    active: true,
    cookieStoreId: cookieStoreId,
    index: tab.index+1
  };

  if(tab.url != 'about:newtab' && tab.url != 'about:blank') {
    tabProperties.url = tab.url;
  }

  browser.tabs.create(tabProperties);
  browser.tabs.remove(tab.id);
}; 

(async function () {

const storage_name = 'windowsDefaultContainers';
const default_global_container_id = 'firefox-default';
let lastCookieStoreId = default_global_container_id;
const blankPages = new Set(['about:blank', 'about:newtab']);
const MAC_ADDON_ID = '@testpilot-containers';

// many functions and logic are from always-in-container by tiansh on GitHub

let macAddonEnabled = await (async function () {
  try {
    const macAddonInfo = await browser.management.get(MAC_ADDON_ID);
    return true;
  } catch (e) {
    return false;
  }
}());


const onMACAddonEnabledChange = enabled => info => {
  if (info.id !== MAC_ADDON_ID) return;
  macAddonEnabled = enabled;
};
browser.management.onInstalled.addListener(onMACAddonEnabledChange(true));
browser.management.onEnabled.addListener(onMACAddonEnabledChange(true));
browser.management.onUninstalled.addListener(onMACAddonEnabledChange(false));
browser.management.onDisabled.addListener(onMACAddonEnabledChange(false));



// Function to check and return the stored default container ID for a window
async function getDefaultContainerId(windowId) {
  const windowsDefaultContainers = (await browser.storage.local.get(storage_name))[storage_name];
  return windowsDefaultContainers[windowId];
}

const isMACAssigned = async function (url) {
  if (!macAddonEnabled()) return false;

  try {
    const assignment = await browser.runtime.sendMessage(MAC_ADDON_ID, {
      method: 'getAssignment',
      url,
    });
    return Boolean(assignment);
  } catch (e) {
    return false;
  }
};

// Function to reopen a tab in a specific container
async function reopenTabInContainer(tab, containerId) {
  try {
    console.log('closing old tab')
    await browser.tabs.remove(tab.tabId); // Close the current tab
    } catch (error) {
      console.error(`Error closing tab: ${error}`);
      return;
  }
  console.log('trying to open new tab')
  newtab = await browser.tabs.create({ // Open a new tab with the same URL in the specified container
    url: tab.url === 'about:newtab' ? undefined : tab.url,
    cookieStoreId: containerId,
    // index: tab.index, // Open the tab at the same position
    windowId: tab.windowId,
    // openerTabId: tab.openerTabId,
  });
}

// Function to assign a container to a newly created tab
async function assignDefaultContainer(tab) {
  console.log('assigning default container')
  // full_tab = await browser.tabs.get(tab.tabId)
  // console.log(tab)
  // return;
  try {
    // Retrieve the default container for the window if one is set
    full_tab = await browser.tabs.get(tab.tabId)
    const default_window_condainer_id = await getDefaultContainerId(full_tab.windowId);
    console.log(`default_window_condainer_id: ${default_window_condainer_id}`)
    //console.log(`assigning to ${default_window_condainer_id}`)
  
    // If a default container is set for the window and the tab isn't already in a container
    console.log('given_tab')
    console.log(tab)
    console.log('full_tab before reopen')
    console.log(full_tab)
    if (default_window_condainer_id && full_tab.cookieStoreId === default_global_container_id) {
      await reopenTabInContainer(tab, default_window_condainer_id);
      console.log(`Tab ${full_tab.id} moved to container ${default_window_condainer_id}`);
    } else {
      console.log('didn\'t reopen tab')
    }
  } catch (error) {
    console.error(`Error assigning default container: ${error}`);
  }
  return {
    cancel: true,
  };
}




browser.windows.onFocusChanged.addListener(windowId => {
  browser.tabs.query({active: true, windowId: windowId}).then(tabs => {
    if(tabs.length > 0) {
      console.log('lastCookieStoreId set to ' + tabs[0].cookieStoreId)
      lastCookieStoreId = tabs[0].cookieStoreId;
    }
  });
});

browser.tabs.onActivated.addListener(activeInfo => {
  browser.tabs.query({active: true, windowId: activeInfo.windowId}).then(tabs => {
    tab = tabs[0];

    if (tab.cookieStoreId != default_global_container_id) {
    console.log('lastCookieStoreId set to ' + tab.cookieStoreId)
    lastCookieStoreId = tab.cookieStoreId;
    }
  });
});


browser.tabs.onCreated.addListener(tab => {
  // get active tab cookieStoreId
  if(tab.url == 'about:newtab' && tab.openerTabId == undefined && tab.cookieStoreId == default_global_container_id && lastCookieStoreId != default_global_container_id) {
    console.log('opening newtab in different container')
    openInDifferentContainer(lastCookieStoreId, tab);
  }
});

browser.webNavigation.onBeforeNavigate.addListener(details => {
  console.log('onBeforeNavigate')
  console.log(details)
  // return assignDefaultContainer(details);
});


browser.webRequest.onBeforeRequest.addListener(async function containTab(request) {
  console.log('onBeforeRequest')
  // console.log(request)
  const tab = await browser.tabs.get(request.tabId);

  if (request.tabId === -1) return void 0;
  if (tab.incognito) return void 0;

  try {
    await browser.contextualIdentities.get(tab.cookieStoreId);
    return void 0;
  } catch (e) {
    /* we are not contained yet */
  }
  console.log(await isMACAssigned(request.url))

  if (await isMACAssigned(request.url)) return void 0;

  // if (request && shouldCancelEarly(tab, request)) {
  //   return { cancel: true };
  // }

  console.log('opening in different container')

  if (request.url == 'ext+container:name=Personal&url=about:newtab') {
    console.log('opening newtab in different container')
    openInDifferentContainer((await browser.contextualIdentities.query({name: "Personal"}))[0].cookieStoreId, tab);
    return { cancel: true };
  }
  


  await browser.tabs.create({
    url: request.url,
    active: tab.active,
    index: tab.index,
    windowId: tab.windowId,
    cookieStoreId: lastCookieStoreId,
  });
  browser.tabs.remove(tab.id);

  return { cancel: true };

}, { urls: ['<all_urls>'], types: ['main_frame'] }, ['blocking']);

// browser.webNavigation.onBeforeNavigate.addListener(details => {
//   console.log('onBeforeNavigate')
//   console.log(details)
//   // return assignDefaultContainer(details);
// })


/* // Listen for when a tab is created
browser.webNavigation.onCreatedNavigationTarget.addListener((options) => {
  return assignDefaultContainer(options);
});

// Listen for messages from the popup to set a new default container for a window
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === 'setDefaultContainer' && message.windowId && message.containerId) {
    try {
      // Save the default container ID for the window
      const windowsDefaultContainers = (await browser.storage.local.get(storage_name))[storage_name] || {};
      windowsDefaultContainers[message.windowId] = message.containerId;
      await browser.storage.local.set({[storage_name]: windowsDefaultContainers});
      console.log(`Set default container ${message.containerId} for window ${message.windowId}`);
    } catch (error) {
      console.error(`Error setting default container: ${error}`);
    }
  }
});
 */

})();