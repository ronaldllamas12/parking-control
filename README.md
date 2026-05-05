# Backend Control de Acceso de Parqueadero

Backend con FastAPI para control de acceso de parqueadero en conjunto residencial.

## Caracteristicas

- FastAPI + SQLAlchemy + Alembic + PostgreSQL.
- JWT OAuth2 Password Flow con roles `admin` y `vigilante`.
- Registro de propietarios con foto en Cloudinary (solo se guarda la URL).
- Verificacion de acceso por UID y registro de historial de ingresos.
- Docker y docker-compose listos para ejecutar.

## Estructura

- `app/main.py`: inicializacion de FastAPI, CORS, routers y startup.
- `app/models.py`: modelos SQLAlchemy (`users`, `propietarios`, `historial_accesos`).
- `app/schemas.py`: validaciones estrictas con Pydantic.
- `app/crud.py`: operaciones de base de datos.
- `app/database.py`: engine, sesion y dependencia DB.
- `app/security.py`: JWT, autenticacion y autorizacion por rol.
- `alembic/`: configuracion y migraciones.

## Variables de entorno

1. Crear archivo `.env` a partir de `.env.example`.
2. Completar credenciales reales de Cloudinary y cambiar secretos.

Variables importantes:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ALLOWED_ORIGINS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `VIGILANTE_USERNAME`
- `VIGILANTE_PASSWORD`

## Ejecutar con Docker

1. Construir y levantar servicios:

```bash
docker compose up --build -d
```

2. Ejecutar migraciones Alembic dentro del contenedor API:

```bash
docker compose run --rm api alembic upgrade head
```

3. Reiniciar API para que cargue tablas y usuarios por defecto si es necesario:

```bash
docker compose restart api
```

4. Probar salud:

```bash
curl http://localhost:8000/health
```

## Flujo de autenticacion

1. Solicitar token:

```bash
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=Admin123*"
```

2. Usar token en `Authorization: Bearer <token>`.

## Endpoints

### 1) Registrar propietario (solo admin)

- `POST /api/v1/propietarios/`
- `multipart/form-data`:
  - `nombre` (string)
  - `torre` (regex: `^[A-Z]{1,3}[0-9]{0,2}$`)
  - `apartamento` (regex: `^[0-9]{2,4}[A-Z]?$`)
  - `foto` (archivo imagen)

Ejemplo:

```bash
curl -X POST http://localhost:8000/api/v1/propietarios/ \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -F "nombre=Juan Perez" \
  -F "torre=A" \
  -F "apartamento=101" \
  -F "foto=@/ruta/foto.jpg"
```

### 2) Verificar acceso por UID (solo vigilante)

- `GET /api/v1/acceso/verificar/{uid}`
- Devuelve 404 si el UID no existe.
- Si existe, retorna datos del propietario y `foto_url`.
- Tambien crea registro en `historial_accesos`.

Ejemplo:

```bash
curl -X GET http://localhost:8000/api/v1/acceso/verificar/AB12CD34EF \
  -H "Authorization: Bearer <TOKEN_VIGILANTE>"
```

## Notas de seguridad

- No se exponen errores internos de SQL ni estructura de DB al cliente.
- CORS controlado por variable de entorno.
- UID corto generado con fuente criptografica segura (`secrets`).
- Se recomienda rotar claves y usar password policy en produccion.
