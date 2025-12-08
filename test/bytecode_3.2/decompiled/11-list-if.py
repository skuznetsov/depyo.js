def long_has_args(opt, longopts):
    return [o for o in longopts if o.startswith(opt)]