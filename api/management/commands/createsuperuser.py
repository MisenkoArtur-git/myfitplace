from django.contrib.auth.management.commands.createsuperuser import Command as BaseCommand

class Command(BaseCommand):
    def handle(self, *args, **options):
        super().handle(*args, **options)
        # Получаем созданного пользователя
        from api.models import User
        # Ищем пользователя по имени, которое было введено в терминале
        username = options.get('username')
        user = User.objects.filter(username=username).first()
        
        if user:
            # Присваиваем роль админа
            user.role = 'admin'
            user.save()
            self.stdout.write(self.style.SUCCESS('Роль "admin" успешно назначена пользователю!'))