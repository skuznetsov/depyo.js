def setup(ok, dist, **attrs):
    if ok:
        try:
            dist.run_commands()
        except KeyboardInterrupt:
            pass
        except IOError as exc:
            error = exc
            raise
        except IOError as exc:
            error = exc
            raise
        except IOError as exc:
            error = exc
            raise
        except RuntimeError as msg:
            raise
        except RuntimeError as msg:
            raise
        except RuntimeError as msg:
            raise
    
    return dist