#!/usr/bin/env bash
# Render build step. The free plan has no pre-deploy hook, so migrations run here.
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input
