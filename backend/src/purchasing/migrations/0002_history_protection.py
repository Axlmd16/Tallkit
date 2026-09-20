"""Triggers PostgreSQL que congelan el contenido económico de una compra confirmada.

Las líneas solo cambian mientras la compra es DRAFT. Una compra CONFIRMED solo transiciona a
VOIDED alterando únicamente los metadatos de anulación (estado, versión, motivo, momento,
responsable y operación compensatoria); VOIDED es final. Reversible; sin desactivación.
"""

from django.db import migrations

FORWARD = """
CREATE FUNCTION purchasing_line_guard() RETURNS trigger AS $$
DECLARE
    purchase_id bigint;
    purchase_state text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        purchase_id := OLD.purchase_id;
    ELSE
        purchase_id := NEW.purchase_id;
    END IF;
    SELECT state INTO purchase_state FROM purchasing_purchase WHERE id = purchase_id;
    IF purchase_state IS NOT NULL AND purchase_state <> 'DRAFT' THEN
        RAISE EXCEPTION 'La compra confirmada no admite cambios en sus líneas'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchasing_line_guard
    BEFORE INSERT OR UPDATE OR DELETE ON purchasing_purchaseline
    FOR EACH ROW EXECUTE FUNCTION purchasing_line_guard();

CREATE FUNCTION purchasing_purchase_guard() RETURNS trigger AS $$
DECLARE
    void_keys text[] := ARRAY[
        'state', 'version', 'updated_at', 'void_reason', 'voided_at', 'voided_by_id',
        'void_operation_id'
    ];
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.state <> 'DRAFT' THEN
            RAISE EXCEPTION 'La compra confirmada no puede eliminarse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.state = 'DRAFT' THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'CONFIRMED'
        AND NEW.state IN ('CONFIRMED', 'VOIDED')
        AND (to_jsonb(NEW) - void_keys) = (to_jsonb(OLD) - void_keys)
        AND (NEW.state = 'VOIDED' OR to_jsonb(NEW) = to_jsonb(OLD))
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'La compra confirmada solo admite metadatos de anulación'
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchasing_purchase_guard
    BEFORE UPDATE OR DELETE ON purchasing_purchase
    FOR EACH ROW EXECUTE FUNCTION purchasing_purchase_guard();
"""

REVERSE = """
DROP TRIGGER purchasing_purchase_guard ON purchasing_purchase;
DROP FUNCTION purchasing_purchase_guard();
DROP TRIGGER purchasing_line_guard ON purchasing_purchaseline;
DROP FUNCTION purchasing_line_guard();
"""


class Migration(migrations.Migration):
    dependencies = [("purchasing", "0001_initial")]

    operations = [migrations.RunSQL(FORWARD, REVERSE)]
