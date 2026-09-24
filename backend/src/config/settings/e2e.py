import tempfile
from pathlib import Path
from typing import Any, cast

from .base import *

DEBUG = False
e2e_rest_framework = cast(dict[str, Any], REST_FRAMEWORK)
cast(dict[str, str], e2e_rest_framework["DEFAULT_THROTTLE_RATES"])["login"] = "100/minute"

# Las fotografías de las pruebas extremo a extremo nunca se escriben en la carpeta real.
PRIVATE_MEDIA_ROOT = Path(tempfile.gettempdir()) / "sys-taller-e2e-private-media"
