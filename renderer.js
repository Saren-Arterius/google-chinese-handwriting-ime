/* globals document, $, setInterval, ctr, alert */

const {
  exec,
  execFile,
  execFileSync,
  spawn
} = require('mz/child_process');


// Options start

const UI_POLL_INTERVAL_MS = 50;
const SHOULD_USE_CLIPBOARD = process.env.DESKTOP_SESSION.startsWith('gnome') || true;

// Touchpad settings
const TOUCHPAD_SUPPORT = true;
const TOUCHPAD_EVENT_ID = null; // autodetect
const TOUCHPAD_XINPUT_ID = null; // autodetect
const TOUCHPAD_ESCAPE_KEYS = {
  9: true
};
const TOUCHPAD_MAX_X = 1216;
const TOUCHPAD_MAX_Y = 680;
const DPI_SCALE = 1.3;
const DRAW_AREA_WIDTH = 417.99;
const DRAW_AREA_HEIGHT = 193.99;
const SELECT_AREA_HEIGHT = 40.99;
const AREA_START_X = 4;
const AREA_END_X = Math.floor((DRAW_AREA_WIDTH * DPI_SCALE) + (AREA_START_X / 2));
const AREA_START_Y = 4;
const AREA_END_Y = Math.floor(((DRAW_AREA_HEIGHT + SELECT_AREA_HEIGHT) * DPI_SCALE) + (AREA_START_Y / 2));
console.log(AREA_START_X, AREA_END_X, AREA_START_Y, AREA_END_Y);
// Options end

let helper;
if (SHOULD_USE_CLIPBOARD) {
  helper = spawn('python3', ['gnome-helper.py']);
}
let thisWindowID;
let activeWindowID;
let lastWindowID;
let windowWidth;


const States = {
  TOUCHPAD_INIT: 1,
  TOUCHPAD_READY: 2,
  TOUCHPAD_IDLE: 3,
  DRAWING_START_TOUCH: 4,
  DRAWING_MOVING: 5,
  DRAWING_END_TOUCH: 6
};
let state = States.TOUCHPAD_INIT;


if (TOUCHPAD_SUPPORT) {
  const findTouchpadXInputID = async () => {
    let touchpadXInputID;
    try {
      let [out] = await execFile('xinput', ['list']);
      out.split('\n').some((line) => {
        console.log(line);
        if (line.toLowerCase().includes('touchpad')) {
          line.split('\t').some((col) => {
            console.log(col);
            if (col.startsWith('id=')) {
              [, touchpadXInputID] = col.split('=');
              return true;
            }
            return false;
          });
          return true;
        }
        return false;
      });
      if (touchpadXInputID === null) {
        throw new Error(`Please manually edit renderer.js and fill TOUCHPAD_XINPUT_ID as id={number} below.\n\n${out}`);
      }
    } catch (e) {
      console.error(e);
      throw new Error(`xinput is required! ${JSON.stringify(e)}`);
    }
    return touchpadXInputID;
  };

  (async () => {
    let touchpadXInputID = TOUCHPAD_XINPUT_ID;
    if (touchpadXInputID === null) {
      try {
        touchpadXInputID = await findTouchpadXInputID();
      } catch (e) {
        alert(e.message);
        return;
      }
    }
    console.log(`touchpadXinputID: ${touchpadXInputID}`);

    let xinput = spawn('xinput', ['test-xi2', '--root']);
    xinput.stdout.on('data', (data) => {
      let line = data.toString();
      if (line.startsWith('EVENT type 14 ') && TOUCHPAD_ESCAPE_KEYS[line.split('\n')[2].split(' ')[5]]) {
        console.log('cancel shit');
        state = States.TOUCHPAD_IDLE;
      }
    });

    let evtest = spawn('evtest');
    let touchpadEventID = TOUCHPAD_EVENT_ID;
    let availableDevicesMsg = '';

    let absX = null;
    let absY = null;
    evtest.stdout.on('data', (data) => {
      if (state === States.TOUCHPAD_INIT || state === States.TOUCHPAD_IDLE) {
        return;
      }
      console.log('Data', state);
      let lines = data.toString();
      lines.split('\n').forEach((line) => {
        let cols = line.trim().split(' ');
        if (cols[8] === '(ABS_X),') {
          absX = parseInt(cols[10], 10);
        } else if (cols[8] === '(ABS_Y),') {
          absY = parseInt(cols[10], 10);
        }
      });
      lines.split('\n').forEach((line) => {
        let cols = line.trim().split(' ');
        if (cols[8] === '(BTN_TOUCH),') {
          let touchOn = parseInt(cols[10], 10) === 1;
          if (activeWindowID !== thisWindowID) {
            state = States.TOUCHPAD_IDLE;
          } else if (touchOn) {
            if (state !== States.DRAWING_MOVING) {
              state = States.DRAWING_START_TOUCH;
            }
          } else {
            state = States.DRAWING_END_TOUCH;
          }
        }
      });
      let relX = Math.floor((AREA_END_X - AREA_START_X) * (absX / TOUCHPAD_MAX_X));
      let relY = Math.floor((AREA_END_Y - AREA_START_Y) * (absY / TOUCHPAD_MAX_Y));
      if (state === States.DRAWING_START_TOUCH) {
        console.log('Start touch');
        execFileSync('xinput', ['disable', touchpadXInputID]);
        execFileSync('xdotool', ['mousemove', '-w', thisWindowID, relX, relY, 'mousedown', '-w', thisWindowID, '1']);
        state = States.DRAWING_MOVING;
      } else if (state === States.DRAWING_MOVING) {
        execFileSync('xdotool', ['mousemove', '-w', thisWindowID, relX, relY]);
      } else if (state === States.DRAWING_END_TOUCH) {
        execFileSync('xdotool', ['mouseup', '-w', thisWindowID, '1']);
        execFileSync('xinput', ['enable', touchpadXInputID]);
        state = States.TOUCHPAD_READY;
      }
      console.log(state);
    });

    evtest.stderr.on('data', (data) => {
      let line = data.toString();
      if (touchpadEventID === null && line.toLowerCase().includes('touchpad')) {
        touchpadEventID = line.replace('/dev/input/event', '').split(':');
      }
      if (line.includes('Select the device event number')) {
        if (touchpadEventID === null) {
          alert(`Please manually edit renderer.js and fill TOUCHPAD_DEVICE_ID as /dev/input/event{number} below.\n\n${availableDevicesMsg}`);
        } else {
          console.log(`touchpadEventID: ${touchpadEventID}`);
          evtest.stdin.write(`${touchpadEventID}\n`);
          state = States.TOUCHPAD_IDLE;
        }
      } else if (state === States.TOUCHPAD_INIT) {
        availableDevicesMsg += line;
      }
    });

    evtest.on('error', (err) => {
      console.error(err);
      alert('evtest is required!', JSON.stringify(err));
    });
    xinput.on('error', (err) => {
      console.error(err);
      alert('xinput is required!', JSON.stringify(err));
    });
  })();
}

const sleep = (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

const initUI = async () => {
  $('body').css({
    overflow: 'hidden'
  });
  windowWidth = $('body').width();
  while (true) {
    try {
      $('body > ul > li:nth-child(7)').click(); // Toggle handwrite
      ctr.Ea.b.gh(); // Spawn it
      break;
    } catch (e) {
      await sleep(UI_POLL_INTERVAL_MS); // Element may not be ready?
    }
  }
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
  await initUI();
  thisWindowID = await getNumberOutput('xdotool search "Google Chinese Handwriting IME"');
  $('.ita-hwt-backspace').click(async () => {
    await focusLastWindow();
    if (helper) {
      helper.stdin.write('bs!!\n');
    } else {
      await exec('xdotool key BackSpace');
    }
  });
  $('.ita-hwt-canvas').click(() => {
    if (state === States.TOUCHPAD_IDLE) {
      state = States.TOUCHPAD_READY;
      console.log('idle -> ready');
    }
  });
  setInterval(async () => {
    activeWindowID = await getNumberOutput('xdotool getactivewindow');
    if (activeWindowID !== thisWindowID) {
      lastWindowID = activeWindowID;
    }
    let val = $('#source').val();
    if (val.length > 0) {
      $('#source').val('');
      await focusLastWindow();
      if (helper) {
        helper.stdin.write(`${val}\n`);
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


  $(() => {
    console.log('hadha');
    $('body').append(`
      <style>
        .ita-hwt-candidate {
          padding: 6px 0px 3px 0px !important;
          text-align: center;
          flex: 1;
        }
        .ita-hwt-candidates {
          display: flex;
        }
      </style>
    `);
  });
};


document.addEventListener('DOMContentLoaded', (event) => {
  let script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js';
  script.onreadystatechange = main;
  script.onload = script.onreadystatechange;
  document.body.appendChild(script);
});
