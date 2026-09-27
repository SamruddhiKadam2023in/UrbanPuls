"""Stores uploaded files in Cloudinary when configured, otherwise on local disk."""
import uuid
from fastapi import HTTPException, UploadFile
from core.config import settings

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
}

async def read_limited(file: UploadFile, allowed: dict[str, str] = ALLOWED_TYPES) -> bytes:
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    contents = await file.read(max_bytes + 1)
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File is larger than {settings.MAX_UPLOAD_MB} MB")
    return contents

async def save_upload(file: UploadFile, folder: str) -> str:
    contents = await read_limited(file)
    if settings.cloudinary_enabled:
        import cloudinary, cloudinary.uploader
        cloudinary.config(cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                          api_key=settings.CLOUDINARY_API_KEY,
                          api_secret=settings.CLOUDINARY_API_SECRET)
        result = cloudinary.uploader.upload(contents, folder=f"tpms/{folder}", resource_type="auto")
        return result["secure_url"]

    target_dir = settings.uploads_dir / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ALLOWED_TYPES[file.content_type]}"
    (target_dir / name).write_bytes(contents)
    return f"/api/uploads/{folder}/{name}"
