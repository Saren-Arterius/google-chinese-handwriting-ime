# Google Chinese Handwriting IME
A Chinese IME that works by exploiting Google Translate using Electron. This application aims to solve my friend's Chinese input problem when using Linux desktop. Therefore, this application is for Linux desktops only.

# Why?
- Google input tool works only inside Chrom{e, ium}
- I promised to my friend that I will make this for him

# Installation
1. Ensure `xdotool`, `python3` and latest `node` installed. Also ensure that you are using X instead of Wayland.
2. `git clone https://github.com/Saren-Arterius/google-chinese-handwriting-ime.git && cd google-chinese-handwriting-ime`
3. `npm install`
4. `sudo pip install pyperclip (If gnome)`

# Running
1. `cd google-chinese-handwriting-ime`
2. `npm start`

# Screenshot
![Screenshot](https://drop.wtako.net/file/82b27c79a2f1c858dc62ecbd7fd605a5a9259101.png)

# Known problems
- Input might be missing if you are too fast
- May not work on applications like gnome terminal
