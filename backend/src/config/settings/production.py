from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False
if SECRET_KEY == "unsafe-development-key":  # noqa: S105
    raise ImproperlyConfigured("DJANGO_SECRET_KEY es obligatoria en producción")
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
