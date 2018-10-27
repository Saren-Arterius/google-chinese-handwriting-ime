/* globals document, $, setInterval, ctr, alert */

const {
  exec,
  execFile,
  execFileSync,
  spawn
} = require('mz/child_process');
const {CONFIG} = require('./config.js');

const PADDING_PX = 4;
const WINDOW_HEIGHT = 302;
const WINDOW_WIDTH = Math.round(WINDOW_HEIGHT * (CONFIG.touchpad_support.coords.touchpad_max.x / CONFIG.touchpad_support.coords.touchpad_max.y)) - PADDING_PX;

const DRAW_AREA_WIDTH = WINDOW_WIDTH;
const DRAW_AREA_HEIGHT = 193.99;
const SELECT_AREA_HEIGHT = 40.99;
const AREA_START_X = PADDING_PX;
const AREA_END_X = Math.floor((DRAW_AREA_WIDTH * CONFIG.touchpad_support.coords.desktop_dpi_scale));
const AREA_START_Y = PADDING_PX;
const AREA_END_Y = Math.floor(((DRAW_AREA_HEIGHT + SELECT_AREA_HEIGHT) * CONFIG.touchpad_support.coords.desktop_dpi_scale));

console.log('Area', AREA_START_X, AREA_END_X, AREA_START_Y, AREA_END_Y);

let helper;
if (CONFIG.use_clipboard) {
  helper = spawn('python3', ['gnome-helper.py']);
}
let thisWindowID;
let activeWindowID;
let lastWindowID;
let windowWidth;
let currentTimeout;
let firstHelperInput = true;
const States = {
  TOUCHPAD_INIT: 1,
  TOUCHPAD_READY: 2,
  TOUCHPAD_IDLE: 3,
  DRAWING_START_TOUCH: 4,
  DRAWING_MOVING: 5,
  DRAWING_END_TOUCH: 6,
  SELECTING_START_TOUCH: 7,
  SELECTING_MOVING: 8,
  SELECTING_END_TOUCH: 9,
  INPUTTING: 10
};
let state = States.TOUCHPAD_INIT;

const focusLastWindow = async () => {
  if (!lastWindowID) {
    throw new Error('Last window is empty');
  }
  await exec(`xdotool windowfocus ${lastWindowID}`);
};

if (CONFIG.touchpad_support.enabled) {
  const findTouchpadXInputID = async () => {
    let touchpadXInputID;
    try {
      let [out] = await execFile('xinput', ['list']);
      out.split('\n').some((line) => {
        if (line.toLowerCase().includes('touchpad')) {
          line.split('\t').some((col) => {
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
    let touchpadXInputID = CONFIG.touchpad_support.preferred_device_id.xinput;
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
    xinput.stdout.on('data', async (data) => {
      let line = data.toString();
      if (line.startsWith('EVENT type 14 ')) {
        let key = line.split('\n')[2].split(' ')[5];
        if (CONFIG.touchpad_support.key_mappings.escape[key]) {
          console.log('Escape');
          state = States.TOUCHPAD_IDLE;
          spawn('xinput', ['enable', touchpadXInputID]);
          await focusLastWindow();
        }
        if (CONFIG.touchpad_support.key_mappings.clear_timeout[key]) {
          console.log('Clear timer');
          if (currentTimeout) {
            clearTimeout(currentTimeout);
          }
        }
      }
    });

    let evtest = spawn('evtest');
    let touchpadEventID = CONFIG.touchpad_support.preferred_device_id.dev_event;
    let availableDevicesMsg = '';

    let absX = null;
    let absY = null;
    evtest.stdout.on('data', (data) => {
      if (state === States.TOUCHPAD_INIT || state === States.TOUCHPAD_IDLE || state === States.INPUTTING) {
        return;
      }
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
          if (activeWindowID !== thisWindowID && state !== States.TOUCHPAD_NEXT) {
            state = States.TOUCHPAD_IDLE;
            execFileSync('xinput', ['enable', touchpadXInputID]);
            if (currentTimeout) {
              clearTimeout(currentTimeout);
            }
          } else if (touchOn) {
            let isOptionSelect = absY / CONFIG.touchpad_support.coords.touchpad_max.y > DRAW_AREA_HEIGHT / (DRAW_AREA_HEIGHT + SELECT_AREA_HEIGHT);
            let isMoving = state === States.SELECTING_MOVING || state === States.DRAWING_MOVING;
            if (isOptionSelect) {
              if (!isMoving) {
                state = States.SELECTING_START_TOUCH;
              }
            } else if (!isMoving) {
              state = States.DRAWING_START_TOUCH;
            }
          } else if (state === States.DRAWING_MOVING) {
            state = States.DRAWING_END_TOUCH;
          } else if (state === States.SELECTING_MOVING) {
            state = States.SELECTING_END_TOUCH;
          }
        }
      });
      let relX = AREA_START_X + Math.floor((AREA_END_X - AREA_START_X) * (absX / CONFIG.touchpad_support.coords.touchpad_max.x));
      let relY = AREA_START_Y + Math.floor((AREA_END_Y - AREA_START_Y) * (absY / CONFIG.touchpad_support.coords.touchpad_max.y));
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
      if (state === States.SELECTING_START_TOUCH) {
        state = States.SELECTING_MOVING;
        spawn('xinput', ['disable', touchpadXInputID]);
        spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY]);
      } else if (state === States.DRAWING_START_TOUCH) {
        state = States.DRAWING_MOVING;
        spawn('xinput', ['disable', touchpadXInputID]);
        spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY, 'mousedown', '-w', thisWindowID, '1']);
      } else if (state === States.SELECTING_MOVING) {
        spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY]);
      } else if (state === States.DRAWING_MOVING) {
        spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY]);
      } else if (state === States.DRAWING_END_TOUCH) {
        state = States.TOUCHPAD_READY;
        spawn('xdotool', ['mouseup', '-w', thisWindowID, '1']);
        spawn('xinput', ['enable', touchpadXInputID]);
        currentTimeout = setTimeout(() => {
          let out = execFileSync('xdotool', ['getmouselocation']).toString();
          let [x, y] = [out.split(' ')[0].split(':')[1], out.split(' ')[1].split(':')[1]];
          spawn('xdotool', ['mousemove', '-w', thisWindowID, AREA_START_X, AREA_END_Y, 'click', '1', 'mousemove', x, y]);
        }, CONFIG.touchpad_support.candidate_timeout_ms);
      } else if (state === States.SELECTING_END_TOUCH) {
        state = States.TOUCHPAD_READY;
        spawn('xdotool', ['click', '1']);
        spawn('xinput', ['enable', touchpadXInputID]);
      }
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
  while (windowWidth) {
    try {
      $('body > ul > li:nth-child(7)').click(); // Toggle handwrite
      ctr.Ea.b.gh(); // Spawn it
      break;
    } catch (e) {
      await sleep(CONFIG.ui_poll_interval_ms); // Element may not be ready?
    }
  }
  ctr.Ea.b.C.A.C[2].C.view.Ui(); // Toggle full size
  $('.ita-hwt-grip').remove();
  $('.ita-hwt-close').remove();
};

const getNumberOutput = async (cmd) => {
  return parseInt((await exec(cmd))[0].trim(), 10);
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
    }
  });
  setInterval(async () => {
    activeWindowID = await getNumberOutput('xdotool getactivewindow');
    if (activeWindowID !== thisWindowID) {
      lastWindowID = activeWindowID;
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
    }
    let val = $('#source').val();
    if (val.length > 0) {
      state = States.INPUTTING;
      $('#source').val('');
      let loop = helper && firstHelperInput ? 2 : 1;
      firstHelperInput = false;
      for (let i = 0; i < loop; i++) {
        await sleep(CONFIG.ui_poll_interval_ms / 2);
        await focusLastWindow();
        await sleep(CONFIG.ui_poll_interval_ms / 2);
        if (helper) {
          console.log('helper', val);
          helper.stdin.write(`${val}\n`);
        } else {
          console.log('xdotool', val);
          await execFile('xdotool', ['type', val]);
        }
        await sleep(CONFIG.ui_poll_interval_ms / 2);
      }
      if (state === States.INPUTTING) {
        await execFile('xdotool', ['windowfocus', thisWindowID]);
        state = States.TOUCHPAD_READY;
      }
    }
    let newWidth = $('body').width();
    if (windowWidth !== newWidth) {
      ctr.Ea.b.C.A.C[2].C.view.Ui();
      ctr.Ea.b.C.A.C[2].C.view.Ui();
      windowWidth = newWidth;
    }
  }, CONFIG.ui_poll_interval_ms);


  $(() => {
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
