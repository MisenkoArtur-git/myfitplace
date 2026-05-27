from django.contrib.auth.management.commands.createsuperuser import Command as BaseCommand


class Command(BaseCommand):
    def handle(self, *args, **options):
        super().handle(*args, **options)
        # Получаем созданного пользователя по email (у нас заменено USERNAME_FIELD)
        from api.models import User
        # Base command may provide 'email' or 'username' depending on prompts
        email = options.get('email') or options.get('username')
        if not email:
            return
        user = User.objects.filter(email=email).first()

        if user:
            # Присваиваем роль админа в нужном формате
            user.role = 'ADMIN'
            user.save()
            self.stdout.write(self.style.SUCCESS('Роль "ADMIN" успешно назначена пользователю!'))