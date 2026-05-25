from django.test import TestCase, Client
from .models import User, Comment
from django.utils import timezone


class CommentsApiTests(TestCase):
	def setUp(self):
		self.client = Client()
		# create users
		self.user = User.objects.create_user(email='user@example.com', password='pass123', nickname='User')
		self.admin = User.objects.create_user(email='admin@example.com', password='adminpass', nickname='Admin', role='ADMIN', is_staff=True)

		# create comments
		Comment.objects.create(author=self.user, text='First approved', rating=4, status=Comment.STATUS_APPROVED)
		Comment.objects.create(author=self.user, text='Second pending', rating=5, status=Comment.STATUS_PENDING)

	def test_public_comments_api_no_aggregates(self):
		resp = self.client.get('/comments-api/')
		self.assertEqual(resp.status_code, 200)
		data = resp.json()
		self.assertIn('comments', data)
		# aggregates must NOT be present for public API
		self.assertNotIn('average_rating', data)
		self.assertNotIn('approved_count', data)

	def test_admin_review_api_has_aggregates(self):
		# login as admin
		self.client.force_login(self.admin)
		resp = self.client.get('/review-comments-api/')
		self.assertEqual(resp.status_code, 200)
		data = resp.json()
		self.assertIn('average_rating', data)
		self.assertIn('approved_count', data)
