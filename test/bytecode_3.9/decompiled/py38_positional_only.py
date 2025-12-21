def greet(name, /, greeting=(Hello)):
    return f"{greeting}, {name}!"

result = greet("Alice")
result2 = greet("Bob", "Hi", **(greeting))

