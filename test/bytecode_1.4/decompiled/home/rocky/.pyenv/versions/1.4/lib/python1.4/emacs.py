start_marker = "+"
end_marker = "~"

def eval(string):
    tmpstr = start_marker + "(" + string + ")" + end_marker
    print tmpstr

def dired(directory):
    eval("dired " + '"' + directory + '"')

def buffer_menu():
    eval("buffer-menu(buffer-list)")
