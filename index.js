/* globals document */
let webview = document.getElementById('webview');

/*
webview.addEventListener('dom-ready', () => {
  webview.openDevTools();
});
*/

webview.addEventListener('ipc-message', (event) => {
  console.log(JSON.parse(event.channel));
  webview.sendInputEvent(JSON.parse(event.channel));
});
