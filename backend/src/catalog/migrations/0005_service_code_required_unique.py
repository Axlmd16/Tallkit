from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_backfill_service_codes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="service",
            name="code",
            field=models.CharField(max_length=25, unique=True),
        ),
    ]
