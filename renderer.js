/* globals document, $, setInterval, ctr */

const {exec, execFile} = require('mz/child_process');

const UI_POLL_INTERVAL_MS = 50;
const SHOULD_USE_CLIPBOARD = process.env.DESKTOP_SESSION.startsWith('gnome');
let thisWindowID;
let lastWindowID;
let windowWidth;

const initUI = () => {
  $('body').css({overflow: 'hidden'});
  windowWidth = $('body').width();
  ctr.Ea.b.gh(); // Toggle handwrite
  ctr.Ea.b.C.A.C[2].C.view.Ui(); // Toggle full size
  $('.ita-hwt-grip').remove();
  $('.ita-hwt-close').remove();
};

const getNumberOutput = async (cmd) => {
  return parseInt((await exec(cmd))[0].trim(), 10);
};

const focusLastWindow = async () => {
  if (!lastWindowID) {
    throw new Error('Last window is empty');
  }
  await exec(`xdotool windowfocus ${lastWindowID}`);
};

const main = async () => {
  initUI();
  thisWindowID = await getNumberOutput('xdotool search "Google Chinese Handwriting IME"');
  $('.ita-hwt-backspace').click(async () => {
    await focusLastWindow();
    if (SHOULD_USE_CLIPBOARD) {
      await execFile('python3', ['gnome-helper.py', '!', 'bs']);
    } else {
      await exec('xdotool key BackSpace');
    }
  });
  setInterval(async () => {
    let windowID = await getNumberOutput('xdotool getactivewindow');
    if (windowID !== thisWindowID) {
      lastWindowID = windowID;
    }
    let val = $('#source').val();
    if (val.length > 0) {
      $('#source').val('');
      await focusLastWindow();
      if (SHOULD_USE_CLIPBOARD) {
        await execFile('python3', ['gnome-helper.py', val]);
      } else {
        await execFile('xdotool', ['type', val]);
      }
    }
    let newWidth = $('body').width();
    if (windowWidth !== newWidth) {
      ctr.Ea.b.C.A.C[2].C.view.Ui();
      ctr.Ea.b.C.A.C[2].C.view.Ui();
      windowWidth = newWidth;
    }
  }, UI_POLL_INTERVAL_MS);
};


document.addEventListener('DOMContentLoaded', (event) => {
  let script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js';
  script.onreadystatechange = main;
  script.onload = script.onreadystatechange;
  document.body.appendChild(script);
});

