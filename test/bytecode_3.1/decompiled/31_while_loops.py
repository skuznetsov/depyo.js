import sys

width = 80
height = 24

inner_l = int((width - 60) / 2)
inner_r = 61 + inner_l

sys.stderr.write("?3l")
sys.stderr.write("[H")
sys.stderr.write("#8")
sys.stderr.write("[9;%dH" % inner_l)
sys.stderr.write("[1J")
sys.stderr.write("[18;60H")
sys.stderr.write("[0J")
sys.stderr.write("[1K")
sys.stderr.write("[9;%dH" % inner_r)
sys.stderr.write("[0K")

i = 10

while i <= 16:
    sys.stderr.write("[%d;%dH" % (i, inner_l))
    sys.stderr.write("[1K")
    sys.stderr.write("[%d;%dH" % (i, inner_r))
    sys.stderr.write("[0K")
    i += 1
sys.stderr.write("[17;30H")
sys.stderr.write("[2K")

i = 1

while i <= width:
    sys.stderr.write("[%d;%df" % (height, i))
    sys.stderr.write("*")
    sys.stderr.write("[%d;%df" % (1, i))
    sys.stderr.write("*")
    i += 1
sys.stderr.write("[2;2H")

i = 2

while i < height:
    sys.stderr.write("+")
    sys.stderr.write("[1D")
    sys.stderr.write("D")
    i += 1
sys.stderr.write("[%d;%dH" % (height - 1, width - 1))

i = height - 1

while i > 1:
    sys.stderr.write("+")
    sys.stderr.write("[1D")
    sys.stderr.write("M")
    i -= 1
sys.stderr.write("[2;1H")

i = 2

while i < height:
    sys.stderr.write("*")
    sys.stderr.write("[%d;%dH" % (i, width))
    sys.stderr.write("*")
    sys.stderr.write("[10D")
    sys.stderr.write("E")
    sys.stderr.write("\n")
    i += 1
sys.stderr.write("[2;10H")
sys.stderr.write("[42D")
sys.stderr.write("[2C")

i = 3

while i < width - 1:
    sys.stderr.write("+")
    sys.stderr.write("[0C")
    sys.stderr.write("[2D")
    sys.stderr.write("[1C")
    i += 1
sys.stderr.write("[%d;%dH" % (height - 1, inner_r - 1))
sys.stderr.write("[42C")
sys.stderr.write("[2D")

i = width - 2

while i > 2:
    sys.stderr.write("+")
    sys.stderr.write("[1D")
    sys.stderr.write("[1C")
    sys.stderr.write("[0D")
    sys.stderr.write("")
    i -= 1
sys.stderr.write("[10;%dH" % (2 + inner_l))

i = 10

while i <= 15:
    j = 2 + inner_l
    while j < inner_r - 1:
        sys.stderr.write(" ")
        j += 1
    
    sys.stderr.write("[1B")
    sys.stderr.write("[58D")
    i += 1
try:
    input("")
except:
    None if i < 10 else ##ERROR##