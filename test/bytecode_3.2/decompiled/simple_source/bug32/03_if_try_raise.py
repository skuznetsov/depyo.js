def setup(ok, dist, **attrs):
    if ok:
        try:
            dist.run_commands()
        except KeyboardInterrupt:
            raise SystemExit("interrupted")
        except exc = IOError as exc:
            error = exc
            raise
            raise SystemExit(error)
        except exc = IOError as exc:
            error = exc
            raise
            raise SystemExit(error)
        except exc = IOError as exc:
            error = exc
            raise
            raise SystemExit(error)
        except:
            pass
        except msg = RuntimeError as msg:
            raise
            raise SystemExit("error: " + str(msg))
            
        except msg = RuntimeError as msg:
            raise
            raise SystemExit("error: " + str(msg))
            
        except msg = RuntimeError as msg:
            raise
            raise SystemExit("error: " + str(msg))
            
        except:
            pass
    
    return dist
