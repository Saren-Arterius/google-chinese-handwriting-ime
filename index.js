/* globals document */
let webview = document.getElementById('webview');

/*
webview.addEventListener('dom-ready', () => {
  webview.openDevTools();
});
*/

webview.addEventListener('ipc-message', (event) => {
  let ie = JSON.parse(event.channel);
  webview.sendInputEvent(ie);
});
