from flask import Flask, request
from flask_socketio import SocketIO
from clipboard import Clipboard, generate_id, start_cleanup

app = Flask(__name__)
sock = SocketIO(app, cors_allowed_origins='*', max_http_buffer_size=1e8)

start_cleanup()

@app.route('/newclip')
def newclip():
    id = generate_id()

    with Clipboard.lock:
        Clipboard.clips[id] = Clipboard()

    print(f'[Generate] {id}')

    return id

@sock.on('connect')
def handle_connect(auth):
    clipboard_id = auth['clip_id']
    sid = request.sid

    print('[Connect] %s -> %s' % (sid, clipboard_id))

    with Clipboard.lock:
        if clipboard_id not in Clipboard.clips:
            print('[ERROR] No such clipboard')
            sock.emit('noclipboard', to=sid)
            return

        Clipboard.clips[clipboard_id].clients.append(sid)
        Clipboard.clients[sid] = clipboard_id

        sock.emit('tx', to=sid)
        sock.send(Clipboard.clips[clipboard_id].contents, to=sid)

        print('[Send] %s -> %s' % (Clipboard.clips[clipboard_id].contents[:50] or '*empty*', sid))

@sock.on('disconnect')
def handle_disconnect():
    sid = request.sid

    print(f'[Disconnect] {sid}')

    with Clipboard.lock:
        if sid not in Clipboard.clients:
            sock.emit('error', to=sid)
            return

        clipboard_id = Clipboard.clients[sid]

        Clipboard.clips[clipboard_id].clients.remove(sid) # FIXME: use set
        del Clipboard.clients[sid]

@sock.on('message')
def handle_message(data):
    sid = request.sid

    print('[Recv] %s <- %s' % (data[:50] or '*empty*', sid))

    with Clipboard.lock:
        if sid not in Clipboard.clients:
            sock.emit('error', to=sid)
            return

        clipboard_id = Clipboard.clients[sid]

        Clipboard.clips[clipboard_id].contents = data

        others = list(filter(lambda id: id != sid, Clipboard.clips[clipboard_id].clients))
        sock.emit('tx', to=others)
        sock.send(data, to=others)
        print('[Send] %s -> %s' % (Clipboard.clips[clipboard_id].contents[:50], ', '.join(others) or '*no one*'))

        sock.emit('sync', to=sid)
        print('[Sync] %s' % sid)
