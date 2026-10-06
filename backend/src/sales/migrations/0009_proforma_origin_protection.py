"""Trigger que protege el origen proforma de una venta, también mientras es borrador.

El origen solo nace al insertar la venta desde el contrato de conversión: ninguna
actualización puede fijarlo, cambiarlo ni quitarlo, y una venta de origen proforma no se
elimina aunque quede sin líneas, porque eso liberaría una segunda conversión de la oferta.
No altera las reglas de las ventas directas ni de mantenimiento.

Reversible; sin desactivación en producción.
"""

from django.db import migrations

FORWARD = """
CREATE FUNCTION sales_proforma_origin_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.origin_type = 'PROFORMA' THEN
            RAISE EXCEPTION 'La venta originada en una proforma no puede eliminarse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF (OLD.origin_type = 'PROFORMA' OR NEW.origin_type = 'PROFORMA')
        AND (
            NEW.origin_type, NEW.origin_proforma_id, NEW.origin_order_id,
            NEW.origin_reference, NEW.proforma_snapshot
        ) IS DISTINCT FROM (
            OLD.origin_type, OLD.origin_proforma_id, OLD.origin_order_id,
            OLD.origin_reference, OLD.proforma_snapshot
        )
    THEN
        RAISE EXCEPTION 'El origen proforma de la venta es inmutable'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_proforma_origin_guard
    BEFORE UPDATE OR DELETE ON sales_sale
    FOR EACH ROW EXECUTE FUNCTION sales_proforma_origin_guard();
"""

REVERSE = """
DROP TRIGGER sales_proforma_origin_guard ON sales_sale;
DROP FUNCTION sales_proforma_origin_guard();
"""


class Migration(migrations.Migration):
    dependencies = [("sales", "0008_sale_proforma_origin")]

    operations = [migrations.RunSQL(FORWARD, REVERSE)]
