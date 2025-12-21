from typing import override

class Base:
    def method(self={"return": str}):
        return "base"

class Derived(Base):
    @##ERROR_DECORATOR##
    def method(self={"return": str}):
        return "derived"

