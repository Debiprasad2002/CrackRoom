"""
Local development data: the same rooms and notes the frontend ships as samples.

Rooms are created as CrackRoom-run rooms (no invented student hosts). Published notes get
a one-page placeholder PDF that says it is a placeholder, so the open and download flow
can be exercised without pretending real notes exist. Refuses to run unless DEBUG is on.
"""

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from datetime import datetime, time, timedelta

from django.utils import timezone

from apps.accounts.models import User
from apps.mentorship.models import Mentor, Slot
from apps.resources.models import Resource
from apps.rooms.models import Room

ROOMS = [
    ('rotational-motion-sprint', 'Rotational Motion Sprint', 'Torque, moment of inertia and rolling — one chapter, fully closed by the end of the week.', 'JEE', 'class11', 'physics', 'pomodoro', 'public', 50, 10, 24, ['Mics off during focus blocks', 'Share doubts only in breaks', 'Be kind']),
    ('organic-at-dawn', 'Organic at Dawn', 'Early-morning GOC and reaction mechanisms before school. Quiet, steady, consistent.', 'both', 'class12', 'chemistry', 'silent', 'public', 45, 5, 40, ['Silent during focus', 'Arrive on time for the first block']),
    ('calculus-deep-work', 'Calculus Deep Work', 'Long blocks for integration and differential equations. Bring a problem set.', 'JEE', 'dropper', 'mathematics', 'pomodoro', 'public', 60, 10, 20, ['Phones face down', 'Post your target at the start']),
    ('neet-bio-ncert-line-by-line', 'NCERT Biology, Line by Line', 'Reading NCERT Biology carefully together, then quick recall rounds in each break.', 'NEET', 'all', 'biology', 'revision', 'public', 40, 10, 50, ['Keep NCERT open', 'Recall rounds are optional']),
    ('physics-doubt-desk', 'Physics Doubt Desk', 'Work through your own problems; discuss what stuck during the break window.', 'both', 'class12', 'physics', 'doubt', 'public', 30, 10, 16, ['Write the full question when asking', 'No answer dumping — explain the idea']),
    ('droppers-night-shift', 'Droppers Night Shift', 'Late-evening mixed-subject sessions for droppers keeping a long daily target.', 'both', 'dropper', 'mixed', 'silent', 'public', 50, 10, 60, ['Silent during focus', 'Log your hours at the end']),
    ('human-physiology-circle', 'Human Physiology Circle', 'A small invite-only group covering physiology diagrams and NCERT-based MCQs.', 'NEET', 'class11', 'biology', 'pomodoro', 'private', 25, 5, 8, ['Invite only', 'Attend at least three sessions a week']),
    ('coordinate-geometry-club', 'Coordinate Geometry Club', 'Straight lines to conics — timed problem sets, then compare approaches.', 'JEE', 'class11', 'mathematics', 'doubt', 'private', 45, 15, 10, ['Invite only', 'Attempt before discussing']),
    ('physical-chem-numericals', 'Physical Chemistry Numericals', 'Mole concept, equilibrium and electrochemistry numericals at exam pace.', 'both', 'all', 'chemistry', 'pomodoro', 'public', 25, 5, 30, ['Calculator off', 'Note your accuracy after each block']),
    ('formula-flash-revision', 'Formula Flash Revision', 'Short, sharp revision blocks for formulas and named reactions before mocks.', 'JEE', 'class12', 'mixed', 'revision', 'public', 20, 5, 40, ['Keep your formula sheet handy']),
]

RESOURCES = [
    ('kinematics-core-concepts', 'Kinematics — Core Concepts and Graphs', 'Motion in one and two dimensions, relative velocity and reading x–t and v–t graphs, with solved examples.', 'both', 'class11', 'physics', 'Kinematics', 'English', 'published'),
    ('rotational-motion-formula-sheet', 'Rotational Motion Formula Sheet', 'Moments of inertia, parallel and perpendicular axis theorems and rolling motion, one page each.', 'JEE', 'class11', 'physics', 'Rotational Motion', 'English', 'published'),
    ('electrostatics-hinglish', 'Electrostatics — Short Notes (Hinglish)', "Coulomb's law, field, potential and capacitors explained simply, with common mistakes.", 'both', 'class12', 'physics', 'Electrostatics', 'Hinglish', 'published'),
    ('mole-concept-practice', 'Mole Concept — Practice Set with Solutions', 'Forty graded numericals from stoichiometry to limiting reagent, with step-by-step solutions.', 'both', 'class11', 'chemistry', 'Mole Concept', 'English', 'published'),
    ('goc-mechanisms', 'GOC — Electronic Effects and Mechanisms', 'Inductive, resonance and hyperconjugation effects; carbocation stability with worked comparisons.', 'both', 'class11', 'chemistry', 'General Organic Chemistry', 'English', 'published'),
    ('coordination-compounds-hindi', 'Coordination Compounds — Notes (Hindi)', "Werner's theory, nomenclature, isomerism and crystal field theory in Hindi.", 'both', 'class12', 'chemistry', 'Coordination Compounds', 'Hindi', 'published'),
    ('integration-techniques', 'Integration Techniques Handbook', 'Substitution, by parts, partial fractions and definite-integral properties with JEE-style examples.', 'JEE', 'class12', 'mathematics', 'Integration', 'English', 'published'),
    ('conic-sections-summary', 'Conic Sections — Chapter Summary', 'Parabola, ellipse and hyperbola: standard forms, tangents and normals side by side.', 'JEE', 'class11', 'mathematics', 'Conic Sections', 'English', 'published'),
    ('probability-concept-map', 'Probability — Concept Map and Practice', "Conditional probability, Bayes' theorem and distributions mapped as one connected chapter.", 'JEE', 'class12', 'mathematics', 'Probability', 'English', 'published'),
    ('human-physiology-diagrams', 'Human Physiology — Labelled Diagrams', 'Digestive, respiratory, circulatory and excretory systems with NCERT-aligned labelling.', 'NEET', 'class11', 'biology', 'Human Physiology', 'English', 'published'),
    ('genetics-crosses', 'Genetics — Crosses and Pedigree Analysis', 'Mendelian ratios, linkage, sex determination and pedigree charts with practice questions.', 'NEET', 'class12', 'biology', 'Genetics and Evolution', 'English', 'published'),
    ('ecology-hinglish', 'Ecology — Quick Revision (Hinglish)', 'Population interactions, ecosystems and biodiversity conservation as rapid-fire revision points.', 'NEET', 'class12', 'biology', 'Ecology and Environment', 'Hinglish', 'published'),
    ('modern-physics-draft', 'Modern Physics — Draft', 'Not yet reviewed.', 'both', 'class12', 'physics', 'Modern Physics', 'English', 'draft'),
    ('trigonometry-old-syllabus', 'Trigonometry — Old Syllabus', 'Archived after the syllabus change.', 'JEE', 'class11', 'mathematics', 'Trigonometry', 'English', 'archived'),
]


# Clearly labelled placeholders: real mentors are onboarded and verified in admin.
MENTORS = [
    ('demo-mentor-physics', 'Demo mentor · Physics', ['JEE', 'NEET'], ['physics'], ['English', 'Hinglish'], 30, 210),
    ('demo-mentor-maths', 'Demo mentor · Mathematics', ['JEE'], ['mathematics'], ['English', 'Hindi'], 45, 262),
    ('demo-mentor-biology', 'Demo mentor · Biology', ['NEET'], ['biology'], ['English', 'Hindi'], 30, 330),
    ('demo-mentor-chemistry', 'Demo mentor · Chemistry', ['JEE', 'NEET'], ['chemistry'], ['Hinglish'], 30, 30),
]
EVENING = [time(18, 0), time(19, 0), time(20, 30)]


def placeholder_pdf(title: str) -> bytes:
    """A valid one-page PDF stating that it is a development placeholder."""

    def escape(text):
        return text.encode('ascii', 'replace').decode().replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')

    lines = [
        ('F2', 20, 'CrackRoom development placeholder'),
        ('F1', 13, escape(title)),
        ('F1', 11, 'This is not the real notes file. It exists so the open and'),
        ('F1', 11, 'download flow can be tested locally. Upload the real PDF in admin.'),
    ]
    stream = 'BT 72 740 Td ' + ' '.join(f'/{font} {size} Tf ({text}) Tj 0 -28 Td' for font, size, text in lines) + ' ET'
    objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R '
        '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
        f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ]
    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f'{number} 0 obj\n{body}\nendobj\n'.encode()
    xref = len(out)
    out += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode()
    out += ''.join(f'{offset:010d} 00000 n \n' for offset in offsets).encode()
    out += f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return bytes(out)


class Command(BaseCommand):
    help = 'Load the sample rooms and notes for local development (DEBUG only).'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('seed_demo only runs with DJANGO_DEBUG=1. It must never touch production data.')

        for slug, name, description, exam, level, subject, mode, visibility, focus, brk, capacity, rules in ROOMS:
            Room.objects.update_or_create(
                slug=slug,
                defaults=dict(
                    name=name, description=description, exam=exam, level=level, subject=subject, mode=mode,
                    visibility=visibility, focus_minutes=focus, break_minutes=brk, capacity=capacity, rules=rules,
                    host=None, is_active=True,
                ),
            )

        for slug, title, description, exam, level, subject, chapter, language, status in RESOURCES:
            resource, _ = Resource.objects.update_or_create(
                slug=slug,
                defaults=dict(
                    title=title, description=description, exam=exam, level=level, subject=subject,
                    chapter=chapter, language=language, source='CrackRoom (development placeholder)',
                ),
            )
            if status == Resource.Status.PUBLISHED and not resource.file:
                resource.file.save(f'{slug}.pdf', ContentFile(placeholder_pdf(title)), save=False)
                resource.pages = 1
            resource.status = status
            resource.full_clean()
            resource.save()

        today = timezone.localdate()
        for slug, name, exams, subjects, languages, minutes, hue in MENTORS:
            user, _ = User.objects.get_or_create(email=f'{slug}@crackroom.local')
            mentor, _ = Mentor.objects.update_or_create(
                slug=slug,
                defaults=dict(
                    user=user, display_name=name, headline='Development placeholder. Add real mentors in admin.',
                    bio='This profile exists so booking can be tried locally. It is not a real person.',
                    exams=exams, subjects=subjects, languages=languages, session_minutes=minutes, avatar_hue=hue,
                    meeting_url='https://meet.google.com/demo-only', is_verified=False, is_active=True,
                ),
            )
            for day in range(1, 8):
                for t in EVENING:
                    start = timezone.make_aware(datetime.combine(today + timedelta(days=day), t))
                    Slot.objects.get_or_create(mentor=mentor, starts_at=start, is_cancelled=False, defaults={'minutes': minutes})

        self.stdout.write(self.style.SUCCESS(f'Seeded {len(ROOMS)} rooms, {len(RESOURCES)} resources and {len(MENTORS)} demo mentors.'))
