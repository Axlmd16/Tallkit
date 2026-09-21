"""Triggers PostgreSQL que protegen la historia comercial y sus invariantes multifila.

- Los hechos de dinero, devoluciones, correcciones, anulaciones y asignaciones de costo son
  inmutables: nunca admiten UPDATE ni DELETE.
- Las líneas solo cambian mientras la venta es DRAFT.
- Una venta confirmada solo admite aumentar ``version``/``updated_at`` o transicionar a VOIDED
  alterando únicamente sus metadatos de anulación; VOIDED es final.
- Triggers de restricción diferidos verifican la suma exacta de partes y que los vínculos
  entre hechos pertenezcan a la misma venta.

Reversible; sin desactivación en producción.
"""

from django.db import migrations

IMMUTABLE_TABLES = [
    "sales_commercialpayment",
    "sales_paymentpart",
    "sales_paymentcorrection",
    "sales_salecostallocation",
    "sales_salereturn",
    "sales_salereturnline",
    "sales_commercialrefund",
    "sales_refundpart",
    "sales_salevoid",
]

FORWARD = """
CREATE FUNCTION sales_immutable_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'El registro comercial % es inmutable', TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION sales_line_guard() RETURNS trigger AS $$
DECLARE
    line_sale_id bigint;
    sale_state text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        line_sale_id := OLD.sale_id;
    ELSE
        line_sale_id := NEW.sale_id;
    END IF;
    SELECT state INTO sale_state FROM sales_sale WHERE id = line_sale_id;
    IF sale_state IS NOT NULL AND sale_state <> 'DRAFT' THEN
        RAISE EXCEPTION 'La venta confirmada no admite cambios en sus líneas'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_line_guard
    BEFORE INSERT OR UPDATE OR DELETE ON sales_saleline
    FOR EACH ROW EXECUTE FUNCTION sales_line_guard();

CREATE FUNCTION sales_sale_guard() RETURNS trigger AS $$
DECLARE
    counter_keys text[] := ARRAY['version', 'updated_at'];
    void_keys text[] := ARRAY[
        'state', 'version', 'updated_at', 'void_reason', 'voided_at', 'voided_by_id',
        'void_operation_id'
    ];
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.state <> 'DRAFT' THEN
            RAISE EXCEPTION 'La venta confirmada no puede eliminarse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.state = 'DRAFT' THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'CONFIRMED' AND NEW.state = 'CONFIRMED'
        AND (to_jsonb(NEW) - counter_keys) = (to_jsonb(OLD) - counter_keys)
    THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'CONFIRMED' AND NEW.state = 'VOIDED'
        AND (to_jsonb(NEW) - void_keys) = (to_jsonb(OLD) - void_keys)
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'La venta confirmada solo admite versión y metadatos de anulación'
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_sale_guard
    BEFORE UPDATE OR DELETE ON sales_sale
    FOR EACH ROW EXECUTE FUNCTION sales_sale_guard();

CREATE FUNCTION sales_parts_sum_check() RETURNS trigger AS $$
DECLARE
    parent_id bigint;
    parent_amount numeric;
    parts_sum numeric;
BEGIN
    IF TG_TABLE_NAME = 'sales_commercialpayment' THEN
        parent_id := NEW.id;
        SELECT COALESCE(SUM(amount), 0) INTO parts_sum
            FROM sales_paymentpart WHERE payment_id = parent_id;
        parent_amount := NEW.amount;
    ELSIF TG_TABLE_NAME = 'sales_paymentpart' THEN
        parent_id := NEW.payment_id;
        SELECT amount INTO parent_amount FROM sales_commercialpayment WHERE id = parent_id;
        SELECT COALESCE(SUM(amount), 0) INTO parts_sum
            FROM sales_paymentpart WHERE payment_id = parent_id;
    ELSIF TG_TABLE_NAME = 'sales_commercialrefund' THEN
        parent_id := NEW.id;
        SELECT COALESCE(SUM(amount), 0) INTO parts_sum
            FROM sales_refundpart WHERE refund_id = parent_id;
        parent_amount := NEW.amount;
    ELSE
        parent_id := NEW.refund_id;
        SELECT amount INTO parent_amount FROM sales_commercialrefund WHERE id = parent_id;
        SELECT COALESCE(SUM(amount), 0) INTO parts_sum
            FROM sales_refundpart WHERE refund_id = parent_id;
    END IF;
    IF parent_amount IS DISTINCT FROM parts_sum THEN
        RAISE EXCEPTION 'Las partes por medio deben sumar exactamente el importe del hecho'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER sales_payment_parts_sum
    AFTER INSERT ON sales_commercialpayment
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION sales_parts_sum_check();
CREATE CONSTRAINT TRIGGER sales_payment_part_sum
    AFTER INSERT ON sales_paymentpart
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION sales_parts_sum_check();
CREATE CONSTRAINT TRIGGER sales_refund_parts_sum
    AFTER INSERT ON sales_commercialrefund
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION sales_parts_sum_check();
CREATE CONSTRAINT TRIGGER sales_refund_part_sum
    AFTER INSERT ON sales_refundpart
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION sales_parts_sum_check();

CREATE FUNCTION sales_same_sale_check() RETURNS trigger AS $$
DECLARE
    mismatched boolean := false;
BEGIN
    IF TG_TABLE_NAME = 'sales_salereturnline' THEN
        SELECT r.sale_id <> l.sale_id INTO mismatched
            FROM sales_salereturn r, sales_saleline l
            WHERE r.id = NEW.sale_return_id AND l.id = NEW.sale_line_id;
    ELSIF TG_TABLE_NAME = 'sales_commercialrefund' THEN
        IF NEW.sale_return_id IS NOT NULL THEN
            SELECT r.sale_id <> NEW.sale_id INTO mismatched
                FROM sales_salereturn r WHERE r.id = NEW.sale_return_id;
        END IF;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM sales_commercialpayment p
            WHERE (p.id = NEW.original_payment_id OR p.id = NEW.replacement_payment_id)
              AND p.sale_id <> NEW.sale_id
        ) INTO mismatched;
    END IF;
    IF COALESCE(mismatched, false) THEN
        RAISE EXCEPTION 'Los hechos vinculados deben pertenecer a la misma venta'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER sales_return_line_same_sale
    AFTER INSERT ON sales_salereturnline
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION sales_same_sale_check();
CREATE CONSTRAINT TRIGGER sales_refund_same_sale
    AFTER INSERT ON sales_commercialrefund
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION sales_same_sale_check();
CREATE CONSTRAINT TRIGGER sales_correction_same_sale
    AFTER INSERT ON sales_paymentcorrection
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION sales_same_sale_check();
"""

for _table in IMMUTABLE_TABLES:
    FORWARD += f"""
CREATE TRIGGER {_table}_immutable
    BEFORE UPDATE OR DELETE ON {_table}
    FOR EACH ROW EXECUTE FUNCTION sales_immutable_guard();
"""

REVERSE = """
DROP TRIGGER sales_correction_same_sale ON sales_paymentcorrection;
DROP TRIGGER sales_refund_same_sale ON sales_commercialrefund;
DROP TRIGGER sales_return_line_same_sale ON sales_salereturnline;
DROP FUNCTION sales_same_sale_check();
DROP TRIGGER sales_refund_part_sum ON sales_refundpart;
DROP TRIGGER sales_refund_parts_sum ON sales_commercialrefund;
DROP TRIGGER sales_payment_part_sum ON sales_paymentpart;
DROP TRIGGER sales_payment_parts_sum ON sales_commercialpayment;
DROP FUNCTION sales_parts_sum_check();
DROP TRIGGER sales_sale_guard ON sales_sale;
DROP FUNCTION sales_sale_guard();
DROP TRIGGER sales_line_guard ON sales_saleline;
DROP FUNCTION sales_line_guard();
"""
for _table in IMMUTABLE_TABLES:
    REVERSE += f"DROP TRIGGER {_table}_immutable ON {_table};\n"
REVERSE += "DROP FUNCTION sales_immutable_guard();\n"


class Migration(migrations.Migration):
    dependencies = [("sales", "0001_initial")]

    operations = [migrations.RunSQL(FORWARD, REVERSE)]
