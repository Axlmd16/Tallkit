"""Triggers PostgreSQL que protegen la historia de inventario contabilizada.

- Los movimientos son inmutables: sin UPDATE ni DELETE.
- Las líneas solo cambian mientras su operación está PREPARED.
- Una operación contabilizada solo transiciona POSTED → REVERSED sin alterar su contenido;
  REVERSED es final y solo una operación PREPARED puede eliminarse.
Reversible; los triggers no se desactivan en operación normal.
"""

from django.db import migrations

FORWARD = """
CREATE FUNCTION inventory_movement_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Historia de inventario inmutable: los movimientos no se modifican ni eliminan'
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movement_immutable
    BEFORE UPDATE OR DELETE ON inventory_inventorymovement
    FOR EACH ROW EXECUTE FUNCTION inventory_movement_immutable();

CREATE FUNCTION inventory_line_guard() RETURNS trigger AS $$
DECLARE
    op_id bigint;
    op_state text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        op_id := OLD.operation_id;
    ELSE
        op_id := NEW.operation_id;
    END IF;
    SELECT state INTO op_state FROM inventory_inventoryoperation WHERE id = op_id;
    IF op_state IS NOT NULL AND op_state <> 'PREPARED' THEN
        RAISE EXCEPTION 'La operación contabilizada no admite cambios en sus líneas'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_line_guard
    BEFORE INSERT OR UPDATE OR DELETE ON inventory_inventoryoperationline
    FOR EACH ROW EXECUTE FUNCTION inventory_line_guard();

CREATE FUNCTION inventory_operation_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.state <> 'PREPARED' THEN
            RAISE EXCEPTION 'La operación contabilizada no puede eliminarse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.state = 'PREPARED' THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'POSTED'
        AND NEW.state = 'REVERSED'
        AND NEW.kind = OLD.kind
        AND NEW.source_type = OLD.source_type
        AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id
        AND NEW.reason = OLD.reason
        AND NEW.observation = OLD.observation
        AND NEW.actor_id = OLD.actor_id
        AND NEW.fingerprint = OLD.fingerprint
        AND NEW.reverses_id IS NOT DISTINCT FROM OLD.reverses_id
        AND NEW.created_at = OLD.created_at
        AND NEW.posted_at IS NOT DISTINCT FROM OLD.posted_at
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'La operación contabilizada solo admite la transición a REVERSED'
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_operation_guard
    BEFORE UPDATE OR DELETE ON inventory_inventoryoperation
    FOR EACH ROW EXECUTE FUNCTION inventory_operation_guard();
"""

REVERSE = """
DROP TRIGGER inventory_operation_guard ON inventory_inventoryoperation;
DROP FUNCTION inventory_operation_guard();
DROP TRIGGER inventory_line_guard ON inventory_inventoryoperationline;
DROP FUNCTION inventory_line_guard();
DROP TRIGGER inventory_movement_immutable ON inventory_inventorymovement;
DROP FUNCTION inventory_movement_immutable();
"""


class Migration(migrations.Migration):
    dependencies = [("inventory", "0001_initial")]

    operations = [migrations.RunSQL(FORWARD, REVERSE)]
