const electron = require('electron');
// Module to control application life.
// Module to create native browser window.
const {
  BrowserWindow,
  app
} = electron;

const path = require('path');
const url = require('url');


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 302,
    minWidth: 400,
    minHeight: 302,
    maxHeight: 302
  });
  mainWindow.setMenu(null);
  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  mainWindow.setAlwaysOnTop(true);
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  const filter = {
    urls: [
      'https://translate.google.com/translate/releases/*/r/js/desktop_module_main.js'
    ]
  };

  let redirected = false;
  electron.session.defaultSession.webRequest.onBeforeRequest(filter, async (details, callback) => {
    if (!redirected && details.url.indexOf('desktop_module_main.js') !== -1) {
      redirected = true;
      return callback({
        redirectURL: 'https://translate.google.com/translate/releases/twsfe_w_20180220_RC00/r/js/desktop_module_main.js'
      });
    }
    return callback({});
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
