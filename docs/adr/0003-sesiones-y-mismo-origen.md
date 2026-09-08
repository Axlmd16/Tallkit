# ADR-0003: Autenticación por sesión y despliegue bajo el mismo origen

- Estado: Aceptada
- Fecha: 2026-09-08

## Contexto

La SPA y Django forman una sola aplicación web. V1 se usa dentro de la red local y una publicación
futura deberá usar HTTPS. La API no necesita ser consumida por clientes externos y los requisitos
exigen proteger cookies, escrituras y reintentos de login. `DA-001` estaba abierta y fue confirmada
por la aprobación explícita de este bootstrap.

## Decisión

Usar autenticación de sesión de Django y protección CSRF. La sesión se almacena en una cookie
`HttpOnly`, `SameSite=Lax` y `Secure` bajo HTTPS. El frontend obtiene el token con un endpoint
técnico, lo envía en `X-CSRFToken` y vuelve a leerlo después del login porque se rota. El backend
limita el login a cinco solicitudes por minuto.

Vite actúa como proxy en desarrollo y Nginx sirve la SPA y reenvía la API en producción. Ambos
mantienen rutas relativas y mismo origen. No se activa CORS y no se incorpora JWT.

## Alternativas consideradas

- JWT en almacenamiento del navegador: aumenta exposición ante XSS, revocación y renovación sin
  resolver una necesidad de clientes externos.
- JWT en cookie: conserva CSRF y añade manejo de tokens sin beneficio actual.
- Orígenes separados con CORS: exige una política adicional y complica cookies con credenciales.
- Autenticación HTTP básica: no ofrece una experiencia ni controles de sesión adecuados.

## Consecuencias

Se reutilizan autenticación, hash de contraseñas, rotación y administración de sesiones de Django.
Toda escritura debe conservar CSRF y el proxy debe preservar cookies y encabezados. Una futura API
para terceros o aplicación nativa podría justificar otro mecanismo mediante OpenSpec y nuevo ADR.

## Referencias

- `RNF-SEG-001` a `RNF-SEG-006`
- `backend/tests/api/test_authentication.py`
- `infra/nginx/default.conf`
- [Referencia terminológica](0003-sesiones-y-mismo-origen-glossary-reference.md)
