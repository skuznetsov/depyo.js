def first[T](items: list[T]) -> T:
    return items[0]

class Stack[T]:
    def __init__(self):
        self.items: list[T] = []
    
    def push(self, item: T) -> None:
        self.items.append(item)
    
    def pop(self) -> T:
        return self.items.pop()

numbers = first([1, 2, 3]); stack = Stack[int](); stack.push(42)
