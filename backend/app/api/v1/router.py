from fastapi import APIRouter
from app.api.v1.endpoints import admin, auth, plans, projects
from app.api.v1.endpoints import settings as settings_endpoints

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(settings_endpoints.router, prefix="/settings", tags=["settings"])
api_router.include_router(plans.router, prefix="/plans", tags=["plans"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
