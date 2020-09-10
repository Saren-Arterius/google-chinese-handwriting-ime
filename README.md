# Google Chinese Handwriting IME
A Chinese IME that works by exploiting [Google Translate](https://translate.google.com/) using Electron. This application aims to solve my friend's Chinese input problem when using Linux desktop. Therefore, this application is for Linux desktops only. 

MacOS-style laptop touchpad input support is recently added.

# Why?
- Google input tool works only inside Chrom{e, ium}
- My friend said that all Chinese handwriting IMEs in Linux suck, and I promised to my friend that I will make this for him
- I could do a better touchpad support that benefits laptop users.

# Installation
1. Ensure `xdotool`, `python3`, `gconf` and latest `node` and `yarn` installed. 
  - For touchpad support, `evtest` and `xorg-xinput` are also required.
  - Ensure that you are using X instead of Wayland.
2. `$ git clone https://github.com/Saren-Arterius/google-chinese-handwriting-ime.git && cd google-chinese-handwriting-ime`
3. `$ yarn`
4. `# pip3 install pyperclip` or equivalent package from your distro.
5. `# usermod -a -G input $(whoami)`

# Config for touchpad
1. Open `config.js` with your text editor
2. Run `$ evtest`, select your touchpad. Now touch your touchpad and move your finger to right bottom, observe the maximum `ABS_X` and `ABS_Y` value between the flashing messages. 
  - Change `touchpad_support.touchpad_coords.max.x` and `touchpad_support.touchpad_coords.max.y` to the values you observed.
  - Repeat for minimum `ABS_X` and `ABS_Y` and apply to `touchpad_support.touchpad_coords.min.x` `touchpad_support.touchpad_coords.min.y` for the left top corner.
3. If the cursor went outside of the drawing area when writing, or if there is too much padding, adjust the config above and find the best values.
4. If your touchpad is not autodetected, run `$ xinput list` and `$ evtest` to find corresponding device IDs for your touchpad. Optionally you may add a new entry into `device_blacklist` to avoid interference.

# Running
1. `$ cd google-chinese-handwriting-ime`
2. `$ yarn start`

# Screenshot
![Screenshot](https://drop.wtako.net/file/82b27c79a2f1c858dc62ecbd7fd605a5a9259101.png)

# See it in action
- High quality full version mp4: https://drop.wtako.net/file/ddb9bb29707182454ba46ce9be11a8c84c4f870d.mp4
- Handshot mp4: https://drop.wtako.net/file/6046c0e60369e3f3a1ebc40e5e4dbf752317b742.mp4
![Touchpad Action](https://drop.wtako.net/file/9e05f084439c9db567788f3680e7e71b7a4ae34b.gif)

# Known problems
- No wayland support!
- `xdotool type` reliability and performance
  - Slow performance on GNOME
  - Some text input maybe missing
- `use_clipboard` could work better for GNOME and more reliable, but it may not work on some applications
  - The use of clipboard hack may make the text input unresponsive if you copied an image to clipboard
  - If the image inside clipboard is no longer needed, copy some text to clean the clipboard before text input
- For KDE Plasma, need to set "Focus Stealing Prevention" to "none"
![steal prevention](https://drop.wtako.net/file/53c5896dc98bc6ed153c4e903d08ea5250f76233.png)

# Tested on
- XPS 9360
  - Arch Linux
  - KDE Plasma 5.14 / GNOME 3.30
- Fujishu SH572
  - Arch Linux
  - KDE Plasma 5.14

# Terms
This application is licensed under [Creative Commons Zero v1.0 Universal](https://github.com/Saren-Arterius/google-chinese-handwriting-ime/blob/master/LICENSE.md) which is basically a "do whatever you want" license. Google Translate itself is covered by [Google Terms of Service and Provacy Policies](https://policies.google.com/).
