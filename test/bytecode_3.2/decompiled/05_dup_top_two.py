import sys, termios
new = sys.argv[:]
new[3] &= ~termios.ECHO