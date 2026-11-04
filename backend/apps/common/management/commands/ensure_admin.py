"""
Creates or updates the admin account from environment variables, on every deploy.
Render's free plan has no shell, so `createsuperuser` cannot be run by hand there.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create or update the admin from DJANGO_SUPERUSER_EMAIL and DJANGO_SUPERUSER_PASSWORD.'

    def handle(self, *args, **options):
        email = os.environ.get('DJANGO_SUPERUSER_EMAIL', '').strip().lower()
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')
        if not email or not password:
            self.stdout.write('No admin credentials set; skipping.')
            return
        User = get_user_model()
        # Matches an account that already signed in with Google, so one person can be both.
        user = User.objects.filter(email__iexact=email).first() or User(email=email)
        created = user.pk is None
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f'Admin {"created" if created else "updated"}.'))
