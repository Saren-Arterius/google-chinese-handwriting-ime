const {
  execSync
} = require('mz/child_process');

let dpi = 1;
try {
  dpi = parseInt(execSync('xdpyinfo | grep dots | awk \'{print $2}\'').toString().split('x')[0], 10) / 96;
} catch (e) {
  console.error(e);
}

exports.CONFIG = {
  ui_poll_interval_ms: 100,
  use_clipboard: process.env.DESKTOP_SESSION.startsWith('gnome') || true,
  touchpad_support: {
    enabled: true,
    candidate_timeout_ms: 1000,
    preferred_device_id: {
      xinput: null,
      dev_event: null
    },
    key_mappings: {
      escape: {
        9: true // Esc
      },
      clear_timeout: {
        9: true, // Esc
        22: true // Backspace
      }
    },
    coords: {
      desktop_dpi_scale: dpi, // Normally you would want this as 1, hidpi 2
      touchpad_max: {
        x: 1216,
        y: 680
      }
    }
  }
};

