"""
Creates the public study rooms run by CrackRoom, so a new site is not empty. These are real,
joinable rooms with no invented hosts. Runs on every deploy but only acts on an empty table,
so rooms that staff later edit or remove are never brought back.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.rooms.models import Room

from .seed_demo import ROOMS


class Command(BaseCommand):
    help = 'Create the public CrackRoom study rooms if there are no rooms yet.'

    @transaction.atomic
    def handle(self, *args, **options):
        if Room.objects.exists():
            self.stdout.write('Rooms already exist; skipping.')
            return
        created = 0
        for slug, name, description, exam, level, subject, mode, visibility, focus, brk, capacity, rules in ROOMS:
            # Private rooms need a host to share the invite code, and these have none.
            if visibility != 'public':
                continue
            Room.objects.create(
                slug=slug, name=name, description=description, exam=exam, level=level, subject=subject, mode=mode,
                visibility=visibility, focus_minutes=focus, break_minutes=brk, capacity=capacity, rules=rules,
            )
            created += 1
        self.stdout.write(self.style.SUCCESS(f'Created {created} rooms.'))
