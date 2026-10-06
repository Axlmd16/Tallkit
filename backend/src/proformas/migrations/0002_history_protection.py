"""Triggers PostgreSQL que protegen la oferta emitida y su marca histórica.

- El activo de marca es inmutable: nunca admite UPDATE ni DELETE.
- Las líneas solo cambian mientras la proforma es DRAFT.
- Un borrador se edita libremente y solo pasa a ISSUED o VOIDED.
- Una proforma emitida solo admite aumentar ``version``/``updated_at`` o transicionar a
  CONVERTED o VOIDED alterando únicamente los metadatos de esa transición.
- CONVERTED y VOIDED son finales. Solo un borrador puede eliminarse.

Reversible; sin desactivación en producción.
"""

from django.db import migrations

FORWARD = """
CREATE FUNCTION proformas_immutable_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'El registro de proformas % es inmutable', TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proformas_proformabrandasset_immutable
    BEFORE UPDATE OR DELETE ON proformas_proformabrandasset
    FOR EACH ROW EXECUTE FUNCTION proformas_immutable_guard();

CREATE FUNCTION proformas_line_guard() RETURNS trigger AS $$
DECLARE
    parent_id bigint;
    parent_state text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        parent_id := OLD.proforma_id;
    ELSE
        parent_id := NEW.proforma_id;
    END IF;
    SELECT state INTO parent_state FROM proformas_proforma WHERE id = parent_id;
    IF parent_state IS NOT NULL AND parent_state <> 'DRAFT' THEN
        RAISE EXCEPTION 'La proforma emitida no admite cambios en sus líneas'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.proforma_id <> OLD.proforma_id THEN
        RAISE EXCEPTION 'Una línea no cambia de proforma'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proformas_line_guard
    BEFORE INSERT OR UPDATE OR DELETE ON proformas_proformaline
    FOR EACH ROW EXECUTE FUNCTION proformas_line_guard();

CREATE FUNCTION proformas_proforma_guard() RETURNS trigger AS $$
DECLARE
    counter_keys text[] := ARRAY['version', 'updated_at'];
    convert_keys text[] := ARRAY[
        'state', 'version', 'updated_at', 'converted_at', 'converted_by_id'
    ];
    void_keys text[] := ARRAY['state', 'version', 'updated_at', 'voided_at', 'voided_by_id'];
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.state <> 'DRAFT' THEN
            RAISE EXCEPTION 'La proforma emitida no puede eliminarse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.state = 'DRAFT' THEN
        IF NEW.state NOT IN ('DRAFT', 'ISSUED', 'VOIDED') THEN
            RAISE EXCEPTION 'Un borrador solo puede emitirse o anularse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD.state = 'ISSUED' AND NEW.state = 'ISSUED'
        AND (to_jsonb(NEW) - counter_keys) = (to_jsonb(OLD) - counter_keys)
    THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'ISSUED' AND NEW.state = 'CONVERTED'
        AND (to_jsonb(NEW) - convert_keys) = (to_jsonb(OLD) - convert_keys)
    THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'ISSUED' AND NEW.state = 'VOIDED'
        AND (to_jsonb(NEW) - void_keys) = (to_jsonb(OLD) - void_keys)
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'La proforma emitida solo admite versión y transiciones autorizadas'
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proformas_proforma_guard
    BEFORE UPDATE OR DELETE ON proformas_proforma
    FOR EACH ROW EXECUTE FUNCTION proformas_proforma_guard();
"""

REVERSE = """
DROP TRIGGER proformas_proforma_guard ON proformas_proforma;
DROP FUNCTION proformas_proforma_guard();
DROP TRIGGER proformas_line_guard ON proformas_proformaline;
DROP FUNCTION proformas_line_guard();
DROP TRIGGER proformas_proformabrandasset_immutable ON proformas_proformabrandasset;
DROP FUNCTION proformas_immutable_guard();
"""


class Migration(migrations.Migration):
    dependencies = [("proformas", "0001_initial")]

    operations = [migrations.RunSQL(FORWARD, REVERSE)]
