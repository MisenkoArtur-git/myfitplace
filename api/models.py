from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import MinValueValidator, MaxValueValidator

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, nickname=None, role='CLIENT', **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, nickname=nickname, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, nickname=None, role='ADMIN', **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, nickname=nickname, role=role, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    nickname = models.CharField(max_length=50, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    role = models.CharField(max_length=50, choices=[
        ('ADMIN', 'Admin'), ('MANAGER', 'Manager'),
        ('COACH', 'Coach'), ('CLIENT', 'Client'),
    ], default='CLIENT')
    hall = models.ForeignKey('GymHall', null=True, blank=True, on_delete=models.SET_NULL)
    
    spec = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    photo = models.ImageField(upload_to='users/', null=True, blank=True)
    
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.nickname or self.email} ({self.role})"

class GymHall(models.Model):
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=255, default='')
    status = models.CharField(max_length=50, default='Active')

    def __str__(self):
        return self.name

class Schedule(models.Model):
    STATUS_UNKNOWN = 'UNKNOWN'
    STATUS_SHOWED = 'SHOWED'
    STATUS_NO_SHOW = 'NO_SHOW'

    ATTENDANCE_CHOICES = [
        (STATUS_UNKNOWN, 'Unknown'),
        (STATUS_SHOWED, 'showed up'),
        (STATUS_NO_SHOW, 'no-showed'),
    ]

    trainer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trainer_appointments', limit_choices_to={'role': 'COACH'})
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='client_appointments', limit_choices_to={'role': 'CLIENT'}, null=True, blank=True)
    training_date = models.DateTimeField()
    attendance_status = models.CharField(max_length=10, choices=ATTENDANCE_CHOICES, default=STATUS_UNKNOWN)

    def __str__(self):
        client_info = self.client.email if self.client else 'No client'
        return f"Training: {self.trainer.email} -> {client_info}"

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message from {self.sender.email} to {self.receiver.email} at {self.created_at}"


class Conversation(models.Model):
    """Represents a chat existence between two users without requiring a message.

    This allows creating an empty chat (visible in UI) while keeping messages
    in the `Message` model. Conversations are undirected: user_a/user_b order
    is normalized so there is only one Conversation per pair.
    """
    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_a')
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_b')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('user_a', 'user_b'),)

    def __str__(self):
        return f"Conversation: {self.user_a.email} <-> {self.user_b.email}"

class Comment(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending review'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField()
    rating = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(5)])
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='reviewed_comments')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author.email} comment ({self.status})"

class Finance(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    operation_type = models.CharField(max_length=50, choices=[('Income', 'Income'), ('Expense', 'Expense')])
    description = models.CharField(max_length=255, blank=True)
    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.operation_type}: {self.amount}"