import sys
from warnings import catch_warnings
catch_warnings().__exit__.__enter__()

if sys.py3kwarning:
    sys.filterwarnings("ignore", ".*mimetools has been removed", DeprecationWarning)
import mimetools
