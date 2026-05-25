from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('cabinet/', views.main_cabinet, name='main_cabinet'), # <-- ИМЯ ДОЛЖНО СОВПАДАТЬ
    path('login-api/', views.login_api, name='login_api'),
    path('signup-api/', views.signup_api, name='signup_api'),
    path('comments-api/', views.comments_api, name='comments_api'),
    path('comment-create-api/', views.comment_create_api, name='comment_create_api'),
    path('review-comments-api/', views.review_comments_api, name='review_comments_api'),
    path('review-comments-action-api/', views.review_comments_action_api, name='review_comments_action_api'),
    path('coach-api/', views.coach_api, name='coach_api'),
    path('coach-save-api/', views.coach_save_api, name='coach_save_api'),
    path('client-api/', views.client_api, name='client_api'),
    path('client-save-api/', views.client_save_api, name='client_save_api'),
    path('halls-api/', views.halls_api, name='halls_api'),
    path('attendance-api/', views.attendance_api, name='attendance_api'),
    path('attendance-save-api/', views.attendance_save_api, name='attendance_save_api'),
    path('communication-users-api/', views.communication_users_api, name='communication_users_api'),
    path('communication-messages-api/', views.communication_messages_api, name='communication_messages_api'),
    path('communication-send-api/', views.communication_send_api, name='communication_send_api'),
    path('logout/', views.logout_view, name='logout'),
    path('profile-api/', views.profile_api, name='profile_api'),
]