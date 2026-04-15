from collections import namedtuple

class Event(namedtuple("Event", "time, priority, action, argument")):
    pass
