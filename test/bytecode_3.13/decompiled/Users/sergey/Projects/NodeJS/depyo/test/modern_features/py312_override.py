from typing import override

class Base:
    def method(self) -> str:
        return "base"

class Derived(Base):
    @override
    def method(self) -> str:
        return "derived"
