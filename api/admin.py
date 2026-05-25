from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from .models import User, GymHall, Schedule, Finance, Comment


class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('email', 'nickname', 'role', 'hall', 'phone', 'spec', 'description', 'photo', 'is_staff', 'is_active')


class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = ('email', 'nickname', 'role', 'hall', 'phone', 'spec', 'description', 'photo', 'is_staff', 'is_active', 'password')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = User
    list_display = ('email', 'nickname', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'nickname')
    ordering = ('email',)
    readonly_fields = ('last_login',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('nickname', 'role', 'hall', 'phone', 'spec', 'description', 'photo')}),
        ('Permissions', {'fields': ('is_staff', 'is_active', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nickname', 'role', 'hall', 'phone', 'spec', 'description', 'photo', 'password1', 'password2', 'is_staff', 'is_active'),
        }),
    )


@admin.register(GymHall)
class GymHallAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'status')
    list_filter = ('status',)
    search_fields = ('name', 'address')

@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ('trainer', 'client', 'training_date')
    list_filter = ('training_date', 'trainer')
    search_fields = ('trainer__email', 'client__email')

@admin.register(Finance)
class FinanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'operation_type', 'amount', 'date')
    list_filter = ('operation_type', 'date')
    search_fields = ('user__email', 'description')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('author', 'rating', 'status', 'created_at', 'reviewed_by', 'reviewed_at')
    list_filter = ('status', 'rating', 'created_at')
    search_fields = ('author__email', 'author__nickname', 'text')
    readonly_fields = ('created_at', 'reviewed_at', 'reviewed_by')