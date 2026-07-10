import os

from alembic import command
from alembic.config import Config

here = os.path.dirname(os.path.dirname(__file__))
config_path = os.path.join(here, 'alembic.ini')
print('Using alembic config:', config_path)
cfg = Config(config_path)
command.upgrade(cfg, 'head')
print('Alembic upgrade head completed')
