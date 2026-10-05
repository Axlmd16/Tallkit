from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_product_manufacturer_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="ServiceCodeCounter",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("last_number", models.PositiveBigIntegerField(default=0)),
            ],
        ),
        migrations.AddConstraint(
            model_name="servicecodecounter",
            constraint=models.CheckConstraint(
                condition=models.Q(("id", 1)), name="service_code_counter_single_row"
            ),
        ),
        migrations.AddField(
            model_name="service",
            name="code",
            field=models.CharField(max_length=25, null=True),
        ),
    ]
