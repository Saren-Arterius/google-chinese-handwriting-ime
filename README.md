# Google Chinese Handwriting IME
A Chinese IME that works by exploiting Google Translate using Electron. This application aims to solve my friend's Chinese input problem when using Linux desktop. Therefore, this application is for Linux desktops only.

# Why?
- Google input tool works only inside Chrom{e, ium}
- My friend said that all Chinese handwriting IMEs in Linux suck, and I promised to my friend that I will make this for him
- I could do a better touchpad support that benefits laptop users.

# Installation
1. Ensure `xdotool`, `python3` and latest `node` and `yarn` installed. 
  - For touchpad support, `evdev` and `xinput` are also required. `xorg-xdpyinfo` is optional as to detect DPI scale.
  - Ensure that you are using X instead of Wayland.
2. `$ git clone https://github.com/Saren-Arterius/google-chinese-handwriting-ime.git && cd google-chinese-handwriting-ime`
3. `$ yarn`
4. `# pip3 install pyperclip` or equivalent package from your distro.

# Config for touchpad
1. Open `config.js`
2. If `xorg-xdpyinfo` is not installed, change `touchpad_support.coords.desktop_dpi_scale` to your desktop DPI scale (normally 1 or 2)
3. `$ evtest`, select your touchpad, touch and move your finger to right bottom, observe the maximum `ABS_X` and `ABS_Y` value between the flashing messages.
4. Change `...touchpad_max.x` and `...touchpad_max.y` to the values you observed.

# Running
1. `$ cd google-chinese-handwriting-ime`
2. `$ yarn start`

# Screenshot
![Screenshot](https://drop.wtako.net/file/82b27c79a2f1c858dc62ecbd7fd605a5a9259101.png)

# Touchpad Action
High quality full version mp4: https://drop.wtako.net/file/848313e75126a23dca61193487a25f8c0fe924d6.mp4

![Touchpad Action](https://drop.wtako.net/file/f1a6cd7c7ab44b928f53014e630f2b8d6d779605.gif)

# Known problems
- Input might be missing if you are too fast
  - Or may be not 100% reliable at all anytime
- May not work on applications like gnome terminal
- The use of clipboard hack may make the text input unresponsive if you copied an image to clipboard
  - If the image inside clipboard is no longer needed, copy some text to clean the clipboard before text input
- For KDE, need to set "Focus Stealing Prevention" to "none"
![steal prevention](https://drop.wtako.net/file/53c5896dc98bc6ed153c4e903d08ea5250f76233.png)

# Tested
- XPS 9360
- Arch Linux
- KDE 5.14