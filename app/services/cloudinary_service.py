from fastapi import UploadFile

import cloudinary
import cloudinary.uploader

from app.config import get_settings
from app.exceptions import AppException

settings = get_settings()

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


def upload_owner_photo(file: UploadFile) -> str:
    if not all(
        [
            settings.cloudinary_cloud_name,
            settings.cloudinary_api_key,
            settings.cloudinary_api_secret,
        ]
    ):
        raise AppException(status_code=500, detail="Servicio de imagen no configurado")

    try:
        result = cloudinary.uploader.upload(
            file.file,
            folder=settings.cloudinary_folder,
            resource_type="image",
            overwrite=False,
        )
    except Exception as exc:
        raise AppException(
            status_code=502, detail="No fue posible almacenar la imagen"
        ) from exc

    secure_url = result.get("secure_url")
    if not secure_url:
        raise AppException(
            status_code=502, detail="Proveedor de imagen sin URL de respuesta"
        )
    return secure_url
