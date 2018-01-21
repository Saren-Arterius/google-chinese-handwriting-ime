#!/usr/bin/env python3
from time import sleep
from sys import argv
import pyperclip
import ctypes
X11 = ctypes.CDLL("libX11.so")
CLIPBOARD_WAIT_DELAY = 2

class Display(ctypes.Structure):
    """ opaque struct """

class XKeyEvent(ctypes.Structure):
    _fields_ = [
        ('type', ctypes.c_int),
        ('serial', ctypes.c_ulong),
        ('send_event', ctypes.c_int),
        ('display', ctypes.POINTER(Display)),
        ('window', ctypes.c_ulong),
        ('root', ctypes.c_ulong),
        ('subwindow', ctypes.c_ulong),
        ('time', ctypes.c_ulong),
        ('x', ctypes.c_int),
        ('y', ctypes.c_int),
        ('x_root', ctypes.c_int),
        ('y_root', ctypes.c_int),
        ('state', ctypes.c_uint),
        ('keycode', ctypes.c_uint),
        ('same_screen', ctypes.c_int),
    ]

class XEvent(ctypes.Union):
    _fields_ = [
        ('type', ctypes.c_int),
        ('xkey', XKeyEvent),
        ('pad', ctypes.c_long * 24),
    ]

X11.XOpenDisplay.restype = ctypes.POINTER(Display)

def linux_send_key(code, mask):
    display = X11.XOpenDisplay(None)
    winFocus = ctypes.c_ulong()
    retval = ctypes.c_ulong()
    X11.XGetInputFocus(display, ctypes.byref(
        winFocus), ctypes.byref(retval))

    k = XEvent(type=2).xkey
    k.state = mask
    k.keycode = X11.XKeysymToKeycode(display, code)  # ctrl
    k.root = X11.XDefaultRootWindow(display)
    k.window = winFocus
    X11.XSendEvent(display, k.window, True, 1, ctypes.byref(k))
    X11.XCloseDisplay(display)

def linux_backspace():
    linux_send_key(0xff08, 0)

def linux_paste():
    linux_send_key(0x0076, 4)  # Ctrl

def type_char(char):
    was = None
    try:
        was = pyperclip.paste()
    except:
        pass
    pyperclip.copy(char)
    # call(["xdotool", "key", "CTRL+V"], False)
    linux_paste()
    if was is not None:
        sleep(CLIPBOARD_WAIT_DELAY)
        pyperclip.copy(was)

if __name__ == '__main__':
    if argv[1] == '!' and argv[2] == 'bs':
        linux_backspace()
    else:
        type_char(argv[1])