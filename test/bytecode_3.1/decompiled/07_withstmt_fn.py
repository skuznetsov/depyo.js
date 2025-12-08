import sys
from warnings import catch_warnings
catch_warnings().__exit__.__enter__()
with sys.filterwarnings("ignore", ".*mimetools has been removed", DeprecationWarning):
    sys.filterwarnings("ignore", ".*mimetools has been removed", DeprecationWarning)
import mimetools