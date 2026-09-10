from typing import Any, cast

from .base import *

DEBUG = False
e2e_rest_framework = cast(dict[str, Any], REST_FRAMEWORK)
cast(dict[str, str], e2e_rest_framework["DEFAULT_THROTTLE_RATES"])["login"] = "100/minute"
