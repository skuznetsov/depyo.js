def bug():
    def convert(node):
        return node and convert(node.left)
