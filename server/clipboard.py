import random
import string
from threading import Lock

state_lock = Lock()
clipboards = {}
clients = {}

class Clipboard:
    def __init__(self):
        self.contents = None
        self.clients = []
    
def generate_id():
    id_1 = ''.join([random.choice(string.ascii_lowercase) for _ in range(3)])
    id_2 = ''.join([random.choice(string.ascii_lowercase) for _ in range(3)])
    id_3 = random.randint(0, 999)
    return f'{id_1}-{id_2}-{id_3}'
