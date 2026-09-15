import logging
import secrets
from typing import List, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models import TeamMember, User
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


class TeamService:
    """Gestión de equipo multi-usuario con roles y permisos"""
    
    ROLES = {
        "admin": {
            "name": "Administrador",
            "description": "Acceso total al negocio",
            "permissions": {
                "can_create_invoice": True,
                "can_view_invoices": True,
                "can_manage_products": True,
                "can_view_reports": True,
                "can_manage_settings": True,
                "can_manage_team": True,
            }
        },
        "seller": {
            "name": "Vendedor",
            "description": "Solo crear facturas y ver productos",
            "permissions": {
                "can_create_invoice": True,
                "can_view_invoices": True,
                "can_manage_products": False,
                "can_view_reports": False,
                "can_manage_settings": False,
                "can_manage_team": False,
            }
        },
        "accountant": {
            "name": "Contador",
            "description": "Ver reportes y facturas, no crear",
            "permissions": {
                "can_create_invoice": False,
                "can_view_invoices": True,
                "can_manage_products": False,
                "can_view_reports": True,
                "can_manage_settings": False,
                "can_manage_team": False,
            }
        },
        "viewer": {
            "name": "Solo lectura",
            "description": "Ver dashboard sin editar",
            "permissions": {
                "can_create_invoice": False,
                "can_view_invoices": True,
                "can_manage_products": False,
                "can_view_reports": True,
                "can_manage_settings": False,
                "can_manage_team": False,
            }
        }
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def invite_member(
        self,
        owner_id: int,
        whatsapp_id: str,
        name: str,
        role: str = "seller",
        email: str = None
    ) -> TeamMember:
        """Invitar nuevo miembro al equipo"""
        # Verificar si ya existe
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.user_id == owner_id,
                TeamMember.whatsapp_id == whatsapp_id
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            if existing.status == "removed":
                # Reactivar
                existing.status = "invited"
                existing.invited_at = datetime.utcnow()
                existing.role = role
                for perm, value in self.ROLES.get(role, {}).get("permissions", {}).items():
                    setattr(existing, perm, value)
                await self.db.commit()
                return existing
            raise ValueError("Este número ya está en el equipo")
        
        # Crear invitación
        role_config = self.ROLES.get(role, self.ROLES["seller"])
        permissions = role_config["permissions"]
        
        member = TeamMember(
            user_id=owner_id,
            whatsapp_id=whatsapp_id,
            name=name,
            email=email,
            role=role,
            status="invited",
            **permissions
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)
        
        return member

    async def accept_invitation(self, whatsapp_id: str, user_id: int) -> Optional[TeamMember]:
        """Aceptar invitación (cuando el invitado escribe al bot)"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.whatsapp_id == whatsapp_id,
                TeamMember.status == "invited"
            )
        )
        member = result.scalar_one_or_none()
        
        if member:
            member.status = "active"
            member.joined_at = datetime.utcnow()
            member.last_active_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(member)
        
        return member

    async def get_team_members(self, owner_id: int) -> List[TeamMember]:
        """Listar miembros del equipo"""
        result = await self.db.execute(
            select(TeamMember)
            .where(TeamMember.user_id == owner_id)
            .order_by(TeamMember.created_at.desc())
        )
        return result.scalars().all()

    async def update_member_role(
        self,
        owner_id: int,
        member_id: int,
        role: str,
        custom_permissions: Dict[str, bool] = None
    ) -> Optional[TeamMember]:
        """Cambiar rol de un miembro"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.id == member_id,
                TeamMember.user_id == owner_id
            )
        )
        member = result.scalar_one_or_none()
        
        if not member:
            return None
        
        if role in self.ROLES:
            permissions = self.ROLES[role]["permissions"]
            member.role = role
        elif custom_permissions:
            permissions = custom_permissions
        else:
            permissions = {
                "can_create_invoice": member.can_create_invoice,
                "can_view_invoices": member.can_view_invoices,
                "can_manage_products": member.can_manage_products,
                "can_view_reports": member.can_view_reports,
                "can_manage_settings": member.can_manage_settings,
                "can_manage_team": member.can_manage_team,
            }
        
        for perm, value in permissions.items():
            setattr(member, perm, value)
        
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def remove_member(self, owner_id: int, member_id: int) -> bool:
        """Eliminar miembro del equipo"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.id == member_id,
                TeamMember.user_id == owner_id
            )
        )
        member = result.scalar_one_or_none()
        
        if not member:
            return False
        
        member.status = "removed"
        await self.db.commit()
        return True

    async def check_permission(self, whatsapp_id: int, permission: str) -> bool:
        """Verificar si un usuario (por WhatsApp) tiene un permiso"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.whatsapp_id == str(whatsapp_id),
                TeamMember.status == "active"
            )
        )
        member = result.scalar_one_or_none()
        
        if not member:
            # Verificar si es owner
            owner_result = await self.db.execute(
                select(User).where(User.whatsapp_id == str(whatsapp_id))
            )
            owner = owner_result.scalar_one_or_none()
            return owner is not None  # Owner tiene todos los permisos
        
        return getattr(member, permission, False)

    async def get_member_by_whatsapp(self, whatsapp_id: str) -> Optional[TeamMember]:
        """Obtener miembro por WhatsApp ID"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.whatsapp_id == whatsapp_id,
                TeamMember.status == "active"
            )
        )
        return result.scalar_one_or_none()

    async def update_last_active(self, whatsapp_id: str):
        """Actualizar última actividad"""
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.whatsapp_id == whatsapp_id,
                TeamMember.status == "active"
            )
        )
        member = result.scalar_one_or_none()
        if member:
            member.last_active_at = datetime.utcnow()
            await self.db.commit()


# ===== Decorador de permisos para handlers =====
def require_permission(permission: str):
    """Decorador para verificar permisos en handlers de WhatsApp"""
    def decorator(func):
        async def wrapper(text: str, whatsapp_id: str, db: AsyncSession, whatsapp_service: WhatsAppService, *args, **kwargs):
            service = TeamService(db)
            has_perm = await service.check_permission(whatsapp_id, permission)
            
            if not has_perm:
                await whatsapp_service.send_text_message(
                    whatsapp_id,
                    f"❌ No tienes permiso para esta acción.\n"
                    f"Permiso requerido: {permission}\n"
                    f"Contacta al administrador."
                )
                return
            
            return await func(text, whatsapp_id, db, whatsapp_service, *args, **kwargs)
        return wrapper
    return decorator


# ===== Integración con NLP para comandos de equipo =====
async def handle_team_command(
    text: str,
    whatsapp_id: str,
    db: AsyncSession,
    whatsapp_service: WhatsAppService
):
    """Procesar comandos de gestión de equipo"""
    text_lower = text.lower().strip()
    service = TeamService(db)
    
    # Verificar si es owner
    owner_result = await db.execute(select(User).where(User.whatsapp_id == whatsapp_id))
    owner = owner_result.scalar_one_or_none()
    
    if not owner:
        await whatsapp_service.send_text_message(whatsapp_id, "❌ No autorizado")
        return
    
    if "equipo" in text_lower or "team" in text_lower or "miembro" in text_lower:
        if "listar" in text_lower or "ver" in text_lower:
            members = await service.get_team_members(owner.id)
            
            if not members:
                await whatsapp_service.send_text_message(
                    whatsapp_id,
                    "👥 *Tu equipo está vacío*\n\n"
                    "Invita a alguien con: *invitar [número] [nombre] [rol]*\n"
                    "Roles: admin, vendedor, contador, solo_lectura"
                )
                return
            
            msg = "👥 *Mi Equipo:*\n\n"
            for m in members:
                status_emoji = {
                    "active": "🟢",
                    "invited": "🟡",
                    "suspended": "🔴",
                    "removed": "⚫"
                }.get(m.status, "⚪")
                
                role_name = TeamService.ROLES.get(m.role, {}).get("name", m.role)
                msg += f"{status_emoji} {m.name} ({m.whatsapp_id})\n"
                msg += f"   Rol: {role_name} | Estado: {m.status}\n"
                if m.last_active_at:
                    msg += f"   Última actividad: {m.last_active_at.strftime('%d/%m/%Y %H:%M')}\n"
                msg += "\n"
            
            await whatsapp_service.send_text_message(whatsapp_id, msg)
        
        elif text_lower.startswith("invitar "):
            # invitar 51999888777 Juan vendedor
            parts = text_lower.split()
            if len(parts) >= 4:
                invited_whatsapp = parts[1]
                name = parts[2]
                role = parts[3]
                
                try:
                    member = await service.invite_member(
                        owner.id, invited_whatsapp, name, role
                    )
                    await whatsapp_service.send_text_message(
                        whatsapp_id,
                        f"✅ Invitación enviada a {name} ({invited_whatsapp})\n"
                        f"Rol: {TeamService.ROLES.get(role, {}).get('name', role)}\n\n"
                        f"El invitado debe escribir al bot para aceptar."
                    )
                except ValueError as e:
                    await whatsapp_service.send_text_message(whatsapp_id, f"❌ {str(e)}")
            else:
                await whatsapp_service.send_text_message(
                    whatsapp_id,
                    "Formato: *invitar [número WhatsApp] [nombre] [rol]*\n"
                    "Roles: admin, vendedor, contador, solo_lectura\n"
                    "Ej: invitar 51999888777 Juan vendedor"
                )
        
        elif text_lower.startswith(("cambiar rol ", "rol ")):
            # cambiar rol [nombre/numero] [nuevo_rol]
            await whatsapp_service.send_text_message(
                whatsapp_id,
                "Para cambiar rol usa el dashboard web en /dashboard/settings"
            )
        
        elif text_lower.startswith(("eliminar ", "quitar ")):
            await whatsapp_service.send_text_message(
                whatsapp_id,
                "Para eliminar miembros usa el dashboard web en /dashboard/settings"
            )