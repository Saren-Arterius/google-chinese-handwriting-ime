exports.CONFIG = {
  ui_poll_interval_ms: 100,
  use_clipboard: false, // May improve performance for GNOME, but may not work on some programs | try if some text is missing
  touchpad_support: {
    enabled: true,
    candidate_timeout_ms: 1000,
    device_blacklist: [
      'SynPS/2'
    ],
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
    touchpad_coords: {
      min: {
        x: 0,
        y: 0
      },
      max: {
        x: 1216,
        y: 660
      }
      /*
      touchpad_min: {
        x: 74,
        y: 80
      },
      touchpad_max: {
        x: 1860,
        y: 1280
      }
      */
    }
  }
};

