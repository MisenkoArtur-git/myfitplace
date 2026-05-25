from django.conf import settings
from django.http import JsonResponse


class AjaxAuthMiddleware:
    """Convert login redirects into JSON 403 responses for AJAX/fetch requests.

    If a view produces an HttpResponseRedirect to the login page (e.g. via @login_required),
    and the request contains header X-Requested-With: XMLHttpRequest (set by our fetch helper),
    return a JSON 403 so front-end can handle it instead of receiving HTML.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        try:
            is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.META.get('HTTP_X_REQUESTED_WITH') == 'XMLHttpRequest'
        except Exception:
            is_ajax = False

        # Redirects to login page are typically 302 with Location='/'.
        if is_ajax and (response.status_code in (301, 302)):
            location = response.get('Location', '') or response.get('location', '')
            login_url = settings.LOGIN_URL
            # if Location points to root or the resolved login name
            if location and (location.endswith(login_url) or location == '/' or location.endswith('/')):
                return JsonResponse({'status': 'error', 'message': 'Authentication required'}, status=403)

        return response
