from threading import Thread, Lock
import random
import time
import string

class Clipboard:
    lock = Lock()
    clips = {}
    clients = {}

    def __init__(self):
        self.contents = ''
        self.clients = []
    
def generate_id():
    id_1 = ''.join([random.choice(string.ascii_lowercase) for _ in range(3)])
    id_2 = ''.join([random.choice(string.ascii_lowercase) for _ in range(3)])
    id_3 = random.randint(0, 999)
    # FIXME: check if the clipboard is not registered
    return f'{id_1}-{id_2}-{id_3}'

def cleanup():
    while True:
        with Clipboard.lock:
            empty = list(filter(lambda item: not item[1].clients, Clipboard.clips.items()))
            for id, _ in empty:
                print(f'Clean {id}', flush=True)
                del Clipboard.clips[id]

        time.sleep(60)

def start_cleanup():
    t = Thread(target=cleanup)
    t.daemon = True
    t.start()
