let container = decodeURIComponent(window.location.hash).split("://")[1]
// console.log(container)
let cookieStoreId = (await browser.contextualIdentities.query({name: container}))[0]

if (cookieStoreId == undefined) {
    document.body.innerHTML = "Container not found: " + container
} else {
    cookieStoreId = cookieStoreId.cookieStoreId
    let this_tab = await browser.tabs.getCurrent()
    browser.tabs.create({active: true, cookieStoreId: cookieStoreId})

    // cloase this tab
    browser.tabs.remove(this_tab.id)
}