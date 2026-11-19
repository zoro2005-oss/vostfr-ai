from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.admin import Plan

router = APIRouter()


@router.get("")
def list_public_plans(db: Session = Depends(get_db)):
    plans = db.query(Plan).filter(
        Plan.is_active.is_(True),
        Plan.is_archived.is_(False),
    ).order_by(Plan.price.asc()).all()

    return [
        {
            "id": plan.id,
            "code": plan.code,
            "name": plan.name,
            "description": plan.description,
            "price": float(plan.price or 0),
            "currency": plan.currency,
            "duration_days": plan.duration_days,
            "generation_limit": plan.generation_limit,
            "video_max_minutes": plan.video_max_minutes,
            "backup_enabled": plan.backup_enabled,
            "retention_minutes": plan.retention_minutes,
            "features": plan.features or {},
        }
        for plan in plans
    ]
