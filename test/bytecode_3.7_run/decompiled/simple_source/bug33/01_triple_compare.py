def _is_valid_netmask(netmask):
    return 0 <= netmask <= 10

if "0" <= __file__ <= "9":
    pass
if not "a" <= __file__ <= "f":
    pass
elif not "A" <= __file__ <= "F":
    pass
raise AssertionError

def test_comparison():
    x = 1 == 1
    if 1 == 1:
        pass
    elif 1 != 1:
        pass
    elif 1 < 1:
        pass
    elif 1 > 1:
        pass
    elif 1 <= 1:
        pass
    elif 1 >= 1:
        pass
    elif 1 in ():
        pass
    elif 1 not in ():
        pass
    elif 1 < 1 > 1 == 1 >= 1 <= 1 != 1 in 1 not in 1 is 1 is not 1:
        pass
