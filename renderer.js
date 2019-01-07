/* globals document, $, setInterval, ctr, alert */

const {
  exec,
  execFile,
  execFileSync,
  spawn
} = require('mz/child_process');
const {ipcRenderer} = require('electron');
const {CONFIG} = require('./config.js');

const WINDOW_HEIGHT = 302;
const PADDING_PX = 4;
const TOUCHPAD_LENGTH_X = CONFIG.touchpad_support.touchpad_coords.max.x - CONFIG.touchpad_support.touchpad_coords.min.x;
const TOUCHPAD_LENGTH_Y = CONFIG.touchpad_support.touchpad_coords.max.y - CONFIG.touchpad_support.touchpad_coords.min.y;
const DRAW_AREA_HEIGHT = 193.99;
const SELECT_AREA_HEIGHT = 40.99;
const WINDOW_WIDTH = Math.round((WINDOW_HEIGHT * (TOUCHPAD_LENGTH_X / TOUCHPAD_LENGTH_Y)) * ((DRAW_AREA_HEIGHT + SELECT_AREA_HEIGHT) / WINDOW_HEIGHT)) + PADDING_PX;

const DRAW_AREA_WIDTH = WINDOW_WIDTH;
const AREA_START_X = PADDING_PX;
const AREA_END_X = Math.floor(DRAW_AREA_WIDTH) - PADDING_PX;
const AREA_START_Y = PADDING_PX;
const AREA_END_Y = Math.floor(DRAW_AREA_HEIGHT + SELECT_AREA_HEIGHT) - PADDING_PX;

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
let pointer = {style: {}};
let hint = {style: {}};

const States = {
  TOUCHPAD_INIT: 1,
  TOUCHPAD_READY: 2,
  TOUCHPAD_IDLE: 3,
  DRAWING_START_TOUCH: 4,
  DRAWING_MOVING: 5,
  DRAWING_END_TOUCH: 6,
  SELECTING_START_TOUCH: 7,
  SELECTING_MOVING: 8,
  SELECTING_END_TOUCH: 9
};

let state = States.TOUCHPAD_INIT;

const focusLastWindow = async () => {
  if (!lastWindowID) {
    console.error('Last window is empty');
    return false;
  }
  await exec(`xdotool windowfocus ${lastWindowID}`);
  return true;
};


if (CONFIG.touchpad_support.enabled) {
  const findTouchpadXInputID = async () => {
    let touchpadXInputID;
    try {
      let [out] = await execFile('xinput', ['list']);
      out.split('\n').some((line) => {
        if (line.toLowerCase().includes('touchpad') || line.toLowerCase().includes('finger')) {
          if (CONFIG.touchpad_support.device_blacklist.some(d => line.toLowerCase().includes(d.toLowerCase()))) return false;
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
    let unclutter;
    xinput.stdout.on('data', async (data) => {
      let line = data.toString();
      if (line.startsWith('EVENT type 14 ')) {
        let key = line.split('\n')[2].split(' ')[5];
        if (CONFIG.touchpad_support.key_mappings.escape[key]) {
          console.log('Escape');
          execFileSync('xinput', ['enable', touchpadXInputID]);
          if (unclutter) {
            unclutter.kill();
            unclutter = null;
          }
          pointer.style.opacity = 0;
          hint.style.opacity = 0;
          state = States.TOUCHPAD_IDLE;
        }
        if (CONFIG.touchpad_support.key_mappings.clear_timeout[key]) {
          console.log('Clear timer');
          if (currentTimeout) {
            clearTimeout(currentTimeout);
            currentTimeout = null;
          }
          if (state !== States.TOUCHPAD_IDLE && state !== States.TOUCHPAD_INIT) {
            hint.style.opacity = 0.5;
          }
          ipcRenderer.sendToHost(JSON.stringify({
            type: 'keyDown', keyCode: 'Backspace'
          }));
          ipcRenderer.sendToHost(JSON.stringify({
            type: 'keyUp', keyCode: 'Backspace'
          }));
        }
      }
    });

    let evtest = spawn('evtest');
    let touchpadEventID = CONFIG.touchpad_support.preferred_device_id.dev_event;
    let availableDevicesMsg = '';

    let absX = null;
    let absY = null;
    evtest.stdout.on('data', (data) => {
      if (state === States.TOUCHPAD_INIT || state === States.TOUCHPAD_IDLE) {
        return;
      }
      let oldState = state;
      let lines = data.toString();
      let touchEventCols;
      lines.split('\n').forEach((line) => {
        let cols = line.trim().split(' ');
        if (cols[8] === '(ABS_X),') {
          absX = parseInt(cols[10], 10);
        } else if (cols[8] === '(ABS_Y),') {
          absY = parseInt(cols[10], 10);
        } else if (cols[8] === '(BTN_TOUCH),') {
          touchEventCols = cols;
        }
      });
      if (touchEventCols) {
        let touchOn = parseInt(touchEventCols[10], 10) === 1;
        console.log('TouchOn', touchOn);
        if (touchOn) {
          pointer.style.opacity = 1;
          hint.style.opacity = 0;
          let isOptionSelect = absY / CONFIG.touchpad_support.touchpad_coords.max.y > DRAW_AREA_HEIGHT / (DRAW_AREA_HEIGHT + SELECT_AREA_HEIGHT);
          let isMoving = state === States.SELECTING_MOVING || state === States.DRAWING_MOVING;
          if (isOptionSelect) {
            if (!isMoving) {
              state = States.SELECTING_START_TOUCH;
            }
          } else if (!isMoving) {
            state = States.DRAWING_START_TOUCH;
          }
        } else if (state === States.DRAWING_MOVING) {
          pointer.style.opacity = 0;
          state = States.DRAWING_END_TOUCH;
        } else if (state === States.SELECTING_MOVING) {
          pointer.style.opacity = 0;
          state = States.SELECTING_END_TOUCH;
        }
      }
      let relX = AREA_START_X + Math.floor((AREA_END_X - AREA_START_X) * ((absX - CONFIG.touchpad_support.touchpad_coords.min.x) / TOUCHPAD_LENGTH_X));
      let relY = AREA_START_Y + Math.floor((AREA_END_Y - AREA_START_Y) * ((absY - CONFIG.touchpad_support.touchpad_coords.min.y) / TOUCHPAD_LENGTH_Y));

      if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }
      if (state === States.SELECTING_START_TOUCH) {
        state = States.SELECTING_MOVING;
        spawn('xinput', ['disable', touchpadXInputID]);
        if (lastWindowID) {
          spawn('xdotool', ['windowfocus', lastWindowID]);
        }
        if (!unclutter) {
          unclutter = spawn('unclutter', ['-idle', '0.01']);
        }
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseMove', x: relX, y: relY
        }));
        // spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY]);
      } else if (state === States.DRAWING_START_TOUCH) {
        state = States.DRAWING_MOVING;
        spawn('xinput', ['disable', touchpadXInputID]);
        if (lastWindowID) {
          spawn('xdotool', ['windowfocus', lastWindowID]);
        }
        if (!unclutter) {
          unclutter = spawn('unclutter', ['-idle', '0.01']);
        }
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseDown', x: relX, y: relY, button: 'left', clickCount: 1
        }));
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseMove', x: relX, y: relY
        }));
        // spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY, 'mousedown', '-w', thisWindowID, '1']);
      } else if (state === States.SELECTING_MOVING) {
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseMove', x: relX, y: relY
        }));
        // spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY]);
      } else if (state === States.DRAWING_MOVING) {
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseMove', x: relX, y: relY
        }));
        // spawn('xdotool', ['mousemove', '-w', thisWindowID, relX, relY]);
      } else if (state === States.DRAWING_END_TOUCH) {
        state = States.TOUCHPAD_READY;
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseUp', x: relX, y: relY
        }));
        // spawn('xdotool', ['mouseup', '-w', thisWindowID, '1']);
        // spawn('xinput', ['enable', touchpadXInputID]);
        currentTimeout = setTimeout(() => {
          // let out = execFileSync('xdotool', ['getmouselocation']).toString();
          // let [x, y] = [out.split(' ')[0].split(':')[1], out.split(' ')[1].split(':')[1]];
          ipcRenderer.sendToHost(JSON.stringify({
            type: 'mouseDown', x: AREA_START_X, y: AREA_END_Y, button: 'left', clickCount: 1
          }));
          ipcRenderer.sendToHost(JSON.stringify({
            type: 'mouseUp', x: AREA_START_X, y: AREA_END_Y, button: 'left', clickCount: 1
          }));
          // spawn('xdotool', ['mousemove', '-w', thisWindowID, AREA_START_X, AREA_END_Y, 'click', '1', 'mousemove', x, y]);
        }, CONFIG.touchpad_support.candidate_timeout_ms);
      } else if (state === States.SELECTING_END_TOUCH) {
        state = States.TOUCHPAD_READY;
        // spawn('xdotool', ['click', '1']);
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseDown', x: relX, y: relY, button: 'left', clickCount: 1
        }));
        ipcRenderer.sendToHost(JSON.stringify({
          type: 'mouseUp', x: relX, y: relY, button: 'left', clickCount: 1
        }));
        // spawn('xinput', ['enable', touchpadXInputID]);
      }
      pointer.style.left = `${relX}px`;
      pointer.style.top = `${relY}px`;
      console.log('In', oldState, 'Out', state, 'thiswindow', thisWindowID, 'activewindow', activeWindowID);
    });

    evtest.stderr.on('data', (data) => {
      let lines = data.toString();
      lines.split('\n').forEach((line) => {
        if (touchpadEventID === null && (line.toLowerCase().includes('touchpad') || line.toLowerCase().includes('finger'))
         && !CONFIG.touchpad_support.device_blacklist.some(d => line.toLowerCase().includes(d.toLowerCase()))) {
          [touchpadEventID] = line.replace('/dev/input/event', '').split(':');
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
  let method = 1;
  try {
    ctr.Ea.b.C.B.C[2].C.view.Ui;
  } catch (e) {
    console.error(e);
    console.log('Using method 2');
    method = 2;
  }
  while (windowWidth) {
    try {
      $('body > ul > li:nth-child(7)').click(); // Toggle handwrite
      if (method === 1) {
        ctr.Ea.b.gh();
      } else if (method === 2) {
        // ctr.Ea.b.gh('zh-tw'); // Spawn it
        await sleep(CONFIG.ui_poll_interval_ms);
        if (!$('.goog-container.goog-container-vertical.ita-hwt-ime.ita-hwt-ltr.notranslate.ita-hwt-ime-st.ita-hwt-ime-init-opaque').is(':visible')) {
          throw new Error();
        }
      }
      break;
    } catch (e) {
      // Element may not be ready?
      console.error(e);
      await sleep(CONFIG.ui_poll_interval_ms);
    }
  }
  if (method === 1) {
    ctr.Ea.b.C.B.C[2].C.view.Ui(); // Toggle full size
  } else if (method === 2) {
    let {left, top} = $('.ita-hwt-grip').offset();
    let [x, y] = [left + ($('.ita-hwt-grip').width() / 2), top + ($('.ita-hwt-grip').height() / 2)];
    ipcRenderer.sendToHost(JSON.stringify({
      type: 'mouseMove', x, y
    }));
    for (let i = 0; i < 2; i++) {
      let evt = {
        type: ['mouseDown', 'mouseUp'][i % 2], x, y, button: 'left', clickCount: 2
      };
      console.log(evt);
      ipcRenderer.sendToHost(JSON.stringify(evt));
    }
    await sleep(CONFIG.ui_poll_interval_ms);
  }
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
      hint.style.opacity = 0.5;
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
      if (!CONFIG.touchpad_support.enabled) {
        let suc = await focusLastWindow();
        if (!suc) {
          return;
        }
        await sleep(CONFIG.ui_poll_interval_ms / 2);
      }
      if (state === States.TOUCHPAD_READY) {
        hint.style.opacity = 0.5;
      }
      if (activeWindowID !== thisWindowID) {
        if (helper) {
          console.log('helper', val);
          helper.stdin.write(`${val}\n`);
        } else {
          console.log('xdotool', val);
          await execFile('xdotool', ['type', val]);
        }
      }
      if (!CONFIG.touchpad_support.enabled) {
        await execFile('xdotool', ['windowfocus', thisWindowID]);
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
        #pointer {
          transition: opacity 0.2s ease;
          background-color: rgba(0, 0, 0, 0.5);
          opacity: 0;
          border-radius: 1em;
          transform: translate(-1em, -1em);
          width: 2em;
          height: 2em;
          left: 0px;
          top: 0px;
          pointer-events: none;
          z-index: 9999999999;
          position: absolute;
          backdrop-filter: blur(8px);
        }
        #hint {
          transition: opacity 0.2s ease;
          opacity: 0;
          font-size: 4.5em;
          z-index: 9999999999;
          position: absolute;
          pointer-events: none;
          width: 100%;
          height: 100%;
          left: 0;
          top: -20px;
          font-weight: 100;
          text-align: center;
          line-height: 1em;
        }
      </style>
    `);
    pointer = document.createElement('div');
    pointer.id = 'pointer';
    document.body.appendChild(pointer);
    hint = document.createElement('h1');
    hint.id = 'hint';
    hint.appendChild(document.createTextNode('請手寫文字'));
    hint.appendChild(document.createElement('br'));
    hint.appendChild(document.createTextNode('按Esc鍵離開'));
    document.body.appendChild(hint);
  });
};

document.addEventListener('DOMContentLoaded', (event) => {
  let script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js';
  script.onreadystatechange = main;
  script.onload = script.onreadystatechange;
  document.body.appendChild(script);
});
