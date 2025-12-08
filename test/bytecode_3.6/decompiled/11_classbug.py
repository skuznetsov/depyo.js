class _TemplateMetaclass(type):
    def __init__(cls, name, bases, dct=(__class__)):
        super(_TemplateMetaclass, cls).__init__(name, bases, dct)