class TestContextManager:
    def __enter__(self):
        return (1, 2)
    
    def __exit__(self, exc_type, exc_value, exc_tb):
        return (self, exc_type, exc_value, exc_tb)

with open(__file__) as a:
with open(__file__) as a:
    with open(__file__) as b:
with TestContextManager() as a:
    with b:
        b
