"""This program is self-checking!"""

def loop_continue_dead_code(slots):
    for name in slots:
        if name:
            pass
        elif x:
            y()
        z()

loop_continue_dead_code([None,
    1])
