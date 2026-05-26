import json
from datetime import datetime, date
from django.db.models import Q, Avg
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.http import JsonResponse
from django.utils import timezone
from .models import User, GymHall, Schedule, Message, Comment, Conversation

@login_required
def profile_api(request):
    user = request.user
    if request.method == 'GET':
        return JsonResponse({'status': 'success', 'user': {
            'id': user.id,
            'email': user.email,
            'nickname': user.nickname or '',
            'phone': user.phone or '',
            'spec': user.spec or '',
            'description': user.description or '',
            'avatar': user.photo.url if getattr(user, 'photo', None) else None,
        }})

    # POST - update profile (accepts multipart/form-data)
    if request.method == 'POST':
        try:
            # gather fields from either JSON or form
            new_password = None
            new_password_confirm = None

            if request.content_type and request.content_type.startswith('application/json'):
                data = json.loads(request.body)
                nickname = data.get('nickname')
                phone = data.get('phone')
                description = data.get('description')
                spec = data.get('spec')
                new_password = data.get('new_password')
                new_password_confirm = data.get('new_password_confirm')
            else:
                nickname = request.POST.get('nickname')
                phone = request.POST.get('phone')
                description = request.POST.get('description')
                spec = request.POST.get('spec')
                new_password = request.POST.get('new_password')
                new_password_confirm = request.POST.get('new_password_confirm')

            if nickname is not None:
                user.nickname = nickname
            if phone is not None:
                user.phone = phone
            if description is not None:
                user.description = description
            if spec is not None:
                user.spec = spec

            # password change: only require new password and confirmation (no current password)
            if new_password or new_password_confirm:
                if not new_password or not new_password_confirm:
                    return JsonResponse({'status': 'error', 'message': 'Both new password fields are required'}, status=400)
                if new_password != new_password_confirm:
                    return JsonResponse({'status': 'error', 'message': 'New password and confirmation do not match'}, status=400)
                user.set_password(new_password)

            # handle avatar upload
            if request.FILES.get('photo'):
                user.photo = request.FILES.get('photo')

            user.save()

            # If password changed, keep the session authenticated
            if new_password:
                try:
                    update_session_auth_hash(request, user)
                except Exception:
                    pass

            return JsonResponse({'status': 'success'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

def index(request):
    return render(request, 'api/index.html')

def login_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        email = data.get('login-email')
        password = data.get('login-password')
        user = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            return JsonResponse({'status': 'success'})
        return JsonResponse({'status': 'error', 'message': 'Invalid credentials'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

def signup_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        email = data.get('signup-email')
        password = data.get('signup-password')
        nickname = data.get('signup-nickname')
        confirm_password = data.get('signup-password-confirm')

        if password != confirm_password:
            return JsonResponse({'status': 'error', 'message': 'Passwords do not match'}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({'status': 'error', 'message': 'User with this email already exists'}, status=400)

        user = User.objects.create_user(
            email=email,
            password=password,
            nickname=nickname,
            role='CLIENT'
        )

        login(request, user)
        return JsonResponse({'status': 'success', 'message': 'Account created successfully'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


def comments_api(request):
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    comments = Comment.objects.filter(status=Comment.STATUS_APPROVED).select_related('author')
    if request.user.is_authenticated:
        comments = Comment.objects.filter(
            Q(status=Comment.STATUS_APPROVED) |
            Q(author=request.user, status=Comment.STATUS_PENDING)
        ).select_related('author')

    comments = comments.order_by('-created_at')

    result = []
    for comment in comments:
        result.append({
            'id': comment.id,
            'author_name': comment.author.nickname or comment.author.email,
            'author_avatar': comment.author.photo.url if getattr(comment.author, 'photo', None) else None,
            'rating': comment.rating,
            'text': comment.text,
            'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
            'status': comment.status,
            'is_mine': request.user.is_authenticated and comment.author_id == request.user.id,
        })

    return JsonResponse({
        'status': 'success',
        'comments': result,
    })


def comment_create_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'status': 'error', 'message': 'Authentication required'}, status=403)

    try:
        data = json.loads(request.body)
        text = (data.get('comment_text') or '').strip()
        rating = int(data.get('comment_rating', 0) or 0)
        rating = max(0, min(rating, 5))

        if not text:
            return JsonResponse({'status': 'error', 'message': 'Comment text is required'}, status=400)

        comment = Comment.objects.create(
            author=request.user,
            text=text,
            rating=rating,
            status=Comment.STATUS_PENDING,
        )

        return JsonResponse({'status': 'success', 'comment_id': comment.id})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


@login_required
def review_comments_api(request):
    if request.user.role != 'ADMIN':
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    pending = Comment.objects.filter(status=Comment.STATUS_PENDING).select_related('author').order_by('-created_at')
    logs = Comment.objects.exclude(status=Comment.STATUS_PENDING).select_related('author', 'reviewed_by').order_by('-reviewed_at')[:20]
    average_rating = Comment.objects.filter(status=Comment.STATUS_APPROVED).aggregate(avg=Avg('rating'))['avg'] or 0
    approved_count = Comment.objects.filter(status=Comment.STATUS_APPROVED).count()
    rejected_count = Comment.objects.filter(status=Comment.STATUS_REJECTED).count()

    pending_data = []
    for comment in pending:
        pending_data.append({
            'id': comment.id,
            'author_name': comment.author.nickname or comment.author.email,
            'author_avatar': comment.author.photo.url if getattr(comment.author, 'photo', None) else None,
            'rating': comment.rating,
            'text': comment.text,
            'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
        })

    logs_data = []
    for comment in logs:
        logs_data.append({
            'id': comment.id,
            'author_name': comment.author.nickname or comment.author.email,
            'author_avatar': comment.author.photo.url if getattr(comment.author, 'photo', None) else None,
            'rating': comment.rating,
            'text': comment.text,
            'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
            'status': comment.status,
            'reviewed_by': (comment.reviewed_by.nickname or comment.reviewed_by.email) if comment.reviewed_by else '',
            'reviewed_by_avatar': comment.reviewed_by.photo.url if getattr(comment.reviewed_by, 'photo', None) else None,
            'reviewed_at': comment.reviewed_at.strftime('%Y-%m-%d %H:%M') if comment.reviewed_at else None,
        })

    return JsonResponse({
        'status': 'success',
        'pending': pending_data,
        'logs': logs_data,
        'average_rating': round(average_rating, 1),
        'approved_count': approved_count,
        'rejected_count': rejected_count,
    })


@login_required
def review_comments_action_api(request):
    if request.user.role != 'ADMIN':
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        actions = data.get('actions', [])
        for item in actions:
            comment_id = item.get('id')
            action = item.get('action')
            comment = Comment.objects.filter(id=comment_id).first()
            if not comment or action not in ['approve', 'reject', 'repost']:
                continue

            if action == 'approve':
                comment.status = Comment.STATUS_APPROVED
                comment.reviewed_by = request.user
                comment.reviewed_at = timezone.now()
            elif action == 'reject':
                comment.status = Comment.STATUS_REJECTED
                comment.reviewed_by = request.user
                comment.reviewed_at = timezone.now()
            elif action == 'repost':
                comment.status = Comment.STATUS_PENDING
                comment.reviewed_by = None
                comment.reviewed_at = None

            comment.save()

        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
def main_cabinet(request):
    return render(request, 'api/main.html', {'user': request.user})

@login_required
def coach_api(request):
    if request.user.role not in ['ADMIN', 'MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method == 'GET':
        coaches = []
        for coach in User.objects.filter(role='COACH'):
            coaches.append({
                'id': coach.id,
                'email': coach.email,
                'nickname': coach.nickname or '',
                'phone': coach.phone or '',
                'spec': coach.spec or '',
                'description': coach.description or '',
                'hall_id': coach.hall.id if coach.hall else None,
                'hall_name': coach.hall.name if coach.hall else '',
                'photo_url': request.build_absolute_uri(coach.photo.url) if coach.photo else '',
            })
        return JsonResponse({'status': 'success', 'coaches': coaches})

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


@login_required
def client_api(request):
    if request.user.role not in ['ADMIN', 'MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method == 'GET':
        clients = []
        for client in User.objects.filter(role='CLIENT'):
            clients.append({
                'id': client.id,
                'email': client.email,
                'nickname': client.nickname or '',
                'phone': client.phone or '',
                'description': client.description or '',
                'hall_id': client.hall.id if client.hall else None,
                'hall_name': client.hall.name if client.hall else '',
                'photo_url': request.build_absolute_uri(client.photo.url) if client.photo else '',
            })
        return JsonResponse({'status': 'success', 'clients': clients})

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


@login_required
def halls_api(request):
    if request.user.role not in ['ADMIN', 'MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    halls = []
    for hall in GymHall.objects.all():
        halls.append({
            'id': hall.id,
            'name': hall.name,
        })
    return JsonResponse({'status': 'success', 'halls': halls})


@login_required
def attendance_api(request):
    if request.user.role not in ['ADMIN', 'MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    hall_id = request.GET.get('hall')
    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else date.today()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else date.today()
    except (ValueError, TypeError):
        return JsonResponse({'status': 'error', 'message': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

    users = User.objects.filter(role='COACH', hall__isnull=False)
    if hall_id:
        users = users.filter(hall_id=hall_id)

    attendance_list = []
    for user in users:
        attendance = Schedule.objects.filter(
            trainer=user,
            client__isnull=True,
            training_date__date__range=(start_date, end_date)
        ).order_by('training_date')

        for row in attendance:
            attendance_list.append({
                'id': row.id,
                'date': row.training_date.strftime('%Y-%m-%d %H:%M'),
                'status': row.attendance_status,
                'trainer_nickname': row.trainer.nickname or '',
                'trainer_email': row.trainer.email,
                'hall_name': row.trainer.hall.name if row.trainer.hall else '',
            })

    return JsonResponse({'status': 'success', 'attendance': attendance_list})


@login_required
def attendance_save_api(request):
    if request.user.role not in ['ADMIN', 'MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    data = json.loads(request.body.decode('utf-8')) if request.body else {}
    action = data.get('action', 'update')
    items = data.get('items', [])

    if action == 'create':
        trainer_id = data.get('trainer_id')
        training_date_str = data.get('training_date')
        status = data.get('status', 'UNKNOWN')

        if not trainer_id or not training_date_str:
            return JsonResponse({'status': 'error', 'message': 'trainer_id and training_date are required'}, status=400)

        try:
            training_date = datetime.fromisoformat(training_date_str)
        except (ValueError, TypeError):
            return JsonResponse({'status': 'error', 'message': 'Invalid training_date format. Use ISO format (YYYY-MM-DDTHH:MM)'}, status=400)

        trainer = User.objects.filter(id=trainer_id, role='COACH').first()

        if not trainer:
            return JsonResponse({'status': 'error', 'message': 'Invalid trainer'}, status=404)

        schedule = Schedule.objects.create(
            trainer=trainer,
            client=None,
            training_date=training_date,
            attendance_status=status if status in ['SHOWED', 'NO_SHOW', 'UNKNOWN'] else 'UNKNOWN'
        )

        return JsonResponse({'status': 'success', 'id': schedule.id})

    if action == 'update':
        for item in items:
            schedule_id = item.get('id')
            status = item.get('status')
            if schedule_id is None or status not in ['SHOWED', 'NO_SHOW', 'UNKNOWN']:
                continue

            schedule = Schedule.objects.filter(id=schedule_id).first()
            if not schedule:
                continue

            schedule.attendance_status = status
            schedule.save()

        return JsonResponse({'status': 'success'})

    return JsonResponse({'status': 'error', 'message': 'Unknown action'}, status=400)


@login_required
def communication_users_api(request):
    # Admins and managers: show full user list only when explicitly requested
    # (e.g. /communication-users-api/?all=1). Otherwise behave like regular users
    # and return only existing chats/conversations. This prevents admin from
    # seeing every user after logout/login unless they asked for it.
    if request.user.role in ['ADMIN', 'MANAGER'] and request.GET.get('all') == '1':
        contacts = []
        users = User.objects.filter(role__in=['COACH', 'CLIENT']).order_by('role', 'nickname')
        for user in users:
            last_message = Message.objects.filter(
                Q(sender=request.user, receiver=user) | Q(sender=user, receiver=request.user)
            ).order_by('-created_at').first()

            contacts.append({
                'id': user.id,
                'nickname': user.nickname or user.email,
                'email': user.email,
                'role': user.role,
                'hall_name': user.hall.name if user.hall else '',
                'last_message': last_message.text if last_message else '',
                'last_date': last_message.created_at.strftime('%Y-%m-%d %H:%M') if last_message else '',
            })

        return JsonResponse({'status': 'success', 'contacts': contacts})

    # Regular users: do not expose full user list. Return only users with whom
    # the current user already exchanged messages OR have an explicit Conversation
    # (empty chat created via Add). This prevents exposing all users to regular users.
    ids = set()
    # message participants
    message_pairs = Message.objects.filter(Q(sender=request.user) | Q(receiver=request.user)).values_list('sender', 'receiver')
    for s, r in message_pairs:
        ids.add(s)
        ids.add(r)
    # conversation participants
    convs = Conversation.objects.filter(Q(user_a=request.user) | Q(user_b=request.user))
    for conv in convs:
        ids.add(conv.user_a_id)
        ids.add(conv.user_b_id)
    ids.discard(request.user.id)

    contacts = []
    if ids:
        users = User.objects.filter(id__in=ids).order_by('nickname')
        for user in users:
            last_message = Message.objects.filter(
                Q(sender=request.user, receiver=user) | Q(sender=user, receiver=request.user)
            ).order_by('-created_at').first()

            contacts.append({
                'id': user.id,
                'nickname': user.nickname or user.email,
                'email': user.email,
                'role': user.role,
                'hall_name': user.hall.name if user.hall else '',
                'last_message': last_message.text if last_message else '',
                'last_date': last_message.created_at.strftime('%Y-%m-%d %H:%M') if last_message else '',
            })

    return JsonResponse({'status': 'success', 'contacts': contacts})


@login_required
def communication_messages_api(request):
    # Allow all authenticated users to fetch messages with a specific user.
    other_id = request.GET.get('other_id')
    if not other_id:
        return JsonResponse({'status': 'error', 'message': 'receiver id is required'}, status=400)

    other = User.objects.filter(id=other_id).first()
    if not other:
        return JsonResponse({'status': 'error', 'message': 'User not found'}, status=404)

    messages = []
    for msg in Message.objects.filter(
        Q(sender=request.user, receiver=other) | Q(sender=other, receiver=request.user)
    ).order_by('created_at'):
        messages.append({
            'id': msg.id,
            'sender_id': msg.sender.id,
            'receiver_id': msg.receiver.id,
            'is_sent': msg.sender_id == request.user.id,
            'text': msg.text,
            'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M'),
        })

    return JsonResponse({'status': 'success', 'messages': messages, 'other': {
        'id': other.id,
        'nickname': other.nickname or other.email,
        'email': other.email,
        'role': other.role,
    }})


@login_required
def communication_send_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    data = json.loads(request.body.decode('utf-8')) if request.body else {}
    receiver_id = data.get('receiver_id')
    text = (data.get('text') or '').strip()

    if not receiver_id or not text:
        return JsonResponse({'status': 'error', 'message': 'receiver_id and text are required'}, status=400)

    receiver = User.objects.filter(id=receiver_id).first()
    if not receiver:
        return JsonResponse({'status': 'error', 'message': 'User not found'}, status=404)

    Message.objects.create(sender=request.user, receiver=receiver, text=text)
    return JsonResponse({'status': 'success'})


@login_required
def communication_find_api(request):
    # Search a user by id. Used by non-admin users to start a dialog when they
    # know the target id. Returns limited profile data only.
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    other_id = request.GET.get('id') or request.GET.get('user_id')
    if not other_id:
        return JsonResponse({'status': 'error', 'message': 'id is required'}, status=400)

    try:
        other = User.objects.filter(id=int(other_id)).first()
    except Exception:
        other = None

    if not other or other.id == request.user.id:
        return JsonResponse({'status': 'error', 'message': 'User not found'}, status=404)

    user_data = {
        'id': other.id,
        'nickname': other.nickname or other.email,
        'email': other.email,
        'role': other.role,
        'hall_name': other.hall.name if other.hall else '',
        'photo_url': request.build_absolute_uri(other.photo.url) if other.photo else '',
    }

    return JsonResponse({'status': 'success', 'user': user_data})


@login_required
def communication_add_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    data = json.loads(request.body.decode('utf-8')) if request.body else {}
    other_id = data.get('user_id') or data.get('other_id') or data.get('id')
    text = data.get('text', '')
    if not other_id:
        return JsonResponse({'status': 'error', 'message': 'user_id is required'}, status=400)

    try:
        other = User.objects.filter(id=int(other_id)).first()
    except Exception:
        other = None

    if not other or other.id == request.user.id:
        return JsonResponse({'status': 'error', 'message': 'User not found'}, status=404)

    # If any message exists between users, or a Conversation exists, consider chat present.
    exists = Message.objects.filter(
        Q(sender=request.user, receiver=other) | Q(sender=other, receiver=request.user)
    ).exists()
    conv_exists = Conversation.objects.filter(
        Q(user_a=request.user, user_b=other) | Q(user_a=other, user_b=request.user)
    ).exists()

    if not exists and not conv_exists:
        # create a Conversation record (no visible message) so both users see the chat
        # normalize ordering: smaller id -> user_a to satisfy unique_together
        try:
            a, b = (request.user, other) if request.user.id <= other.id else (other, request.user)
            Conversation.objects.create(user_a=a, user_b=b)
        except Exception:
            # ignore race/unique errors
            pass

    return JsonResponse({'status': 'success'})


@login_required
def communication_delete_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    data = json.loads(request.body.decode('utf-8')) if request.body else {}
    other_id = data.get('user_id') or data.get('other_id') or data.get('id')
    if not other_id:
        return JsonResponse({'status': 'error', 'message': 'user_id is required'}, status=400)

    try:
        other = User.objects.filter(id=int(other_id)).first()
    except Exception:
        other = None

    if not other or other.id == request.user.id:
        return JsonResponse({'status': 'error', 'message': 'User not found'}, status=404)

    # Delete all messages between the two users and remove Conversation if exists
    Message.objects.filter(
        Q(sender=request.user, receiver=other) | Q(sender=other, receiver=request.user)
    ).delete()
    # remove conversation record (both ordering variants)
    Conversation.objects.filter(
        Q(user_a=request.user, user_b=other) | Q(user_a=other, user_b=request.user)
    ).delete()

    return JsonResponse({'status': 'success'})


@login_required
def client_save_api(request):
    if request.user.role not in ['ADMIN', 'MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    data, files = _coach_request_payload(request)
    action = data.get('action')

    if action == 'create':
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        nickname = data.get('nickname', '').strip() or email
        phone = data.get('phone', '').strip()
        description = data.get('description', '').strip()
        hall_id = data.get('hall')
        hall = None
        if hall_id:
            from .models import GymHall
            hall = GymHall.objects.filter(id=hall_id).first()

        if not email or not password:
            return JsonResponse({'status': 'error', 'message': 'Email and password are required'}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({'status': 'error', 'message': 'User with this email already exists'}, status=400)

        client = User.objects.create_user(
            email=email,
            password=password,
            nickname=nickname,
            role='CLIENT',
            phone=phone,
            description=description,
            hall=hall,
        )

        photo = files.get('photo')
        if photo:
            client.photo = photo
            client.save()

        return JsonResponse({'status': 'success'})

    if action == 'update':
        client_id = data.get('id')
        client = User.objects.filter(id=client_id, role='CLIENT').first()
        if not client:
            return JsonResponse({'status': 'error', 'message': 'Client not found'}, status=404)

        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        nickname = data.get('nickname', '').strip() or client.nickname
        phone = data.get('phone', '').strip()
        description = data.get('description', '').strip()
        hall_id = data.get('hall')
        hall = None
        if hall_id:
            from .models import GymHall
            hall = GymHall.objects.filter(id=hall_id).first()

        if email:
            if User.objects.filter(email=email).exclude(id=client.id).exists():
                return JsonResponse({'status': 'error', 'message': 'Email is already used'}, status=400)
            client.email = email

        client.nickname = nickname
        client.phone = phone
        client.description = description
        client.hall = hall

        if password:
            client.set_password(password)

        photo = files.get('photo')
        if photo:
            client.photo = photo

        client.save()
        return JsonResponse({'status': 'success'})

    if action == 'delete':
        client_id = data.get('id')
        client = User.objects.filter(id=client_id, role='CLIENT').first()
        if not client:
            return JsonResponse({'status': 'error', 'message': 'Client not found'}, status=404)
        client.delete()
        return JsonResponse({'status': 'success'})

    return JsonResponse({'status': 'error', 'message': 'Unknown action'}, status=400)


def _coach_request_payload(request):
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        return request.POST, request.FILES

    try:
        payload = json.loads(request.body)
    except Exception:
        payload = {}

    return payload, {}

@login_required
def coach_save_api(request):
    if request.user.role not in ['ADMIN', 'MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'Forbidden'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    data, files = _coach_request_payload(request)
    action = data.get('action')

    if action == 'create':
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        nickname = data.get('nickname', '').strip() or email
        phone = data.get('phone', '').strip()
        spec = data.get('spec', '').strip()
        description = data.get('description', '').strip()
        hall_id = data.get('hall')
        hall = None
        if hall_id:
            from .models import GymHall
            hall = GymHall.objects.filter(id=hall_id).first()

        if not email or not password:
            return JsonResponse({'status': 'error', 'message': 'Email and password are required'}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({'status': 'error', 'message': 'User with this email already exists'}, status=400)

        coach = User.objects.create_user(
            email=email,
            password=password,
            nickname=nickname,
            role='COACH',
            phone=phone,
            spec=spec,
            description=description,
            hall=hall,
        )

        photo = files.get('photo')
        if photo:
            coach.photo = photo
            coach.save()

        return JsonResponse({'status': 'success'})

    if action == 'update':
        coach_id = data.get('id')
        coach = User.objects.filter(id=coach_id, role='COACH').first()
        if not coach:
            return JsonResponse({'status': 'error', 'message': 'Coach not found'}, status=404)

        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        nickname = data.get('nickname', '').strip() or coach.nickname
        phone = data.get('phone', '').strip()
        spec = data.get('spec', '').strip()
        description = data.get('description', '').strip()
        hall_id = data.get('hall')
        hall = None
        if hall_id:
            from .models import GymHall
            hall = GymHall.objects.filter(id=hall_id).first()

        if email:
            if User.objects.filter(email=email).exclude(id=coach.id).exists():
                return JsonResponse({'status': 'error', 'message': 'Email is already used'}, status=400)
            coach.email = email

        coach.nickname = nickname
        coach.phone = phone
        coach.spec = spec
        coach.description = description
        coach.hall = hall

        if password:
            coach.set_password(password)

        photo = files.get('photo')
        if photo:
            coach.photo = photo

        coach.save()
        return JsonResponse({'status': 'success'})

    if action == 'delete':
        coach_id = data.get('id')
        coach = User.objects.filter(id=coach_id, role='COACH').first()
        if not coach:
            return JsonResponse({'status': 'error', 'message': 'Coach not found'}, status=404)
        coach.delete()
        return JsonResponse({'status': 'success'})

    return JsonResponse({'status': 'error', 'message': 'Unknown action'}, status=400)

def logout_view(request):
    logout(request)
    return redirect('index')