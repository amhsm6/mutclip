from flask import Flask, request
from flask_socketio import SocketIO
from clipboard import Clipboard, generate_id, start_cleanup

app = Flask(__name__)
socket = SocketIO(app, cors_allowed_origins='*', max_http_buffer_size=1e8)

start_cleanup()

@app.route('/newclip')
def newclip():
    id = generate_id()

    with Clipboard.lock:
        Clipboard.clips[id] = Clipboard()

    print(f'[Generate] {id}', flush=True)

    return id

@socket.on('connect')
def handle_connect(auth):
    clipboard_id = auth['clip_id']
    sid = request.sid

    with Clipboard.lock:
        if clipboard_id not in Clipboard.clips:
            print(f'[ERROR] {{{clipboard_id}}} No such clipboard', flush=True)
            socket.emit('noclipboard', to=sid)
            return

        print(f'[Connect] {{{clipboard_id}}} {sid}', flush=True)

        Clipboard.clips[clipboard_id].clients.add(sid)
        Clipboard.all_clients[sid] = clipboard_id

        socket.emit('tx', to=sid)
        socket.send(Clipboard.clips[clipboard_id].contents, to=sid)

        display_contents = Clipboard.clips[clipboard_id].contents[:50] or '*empty*'
        print(f'[Send] {{{clipboard_id}}} {display_contents} -> {sid}', flush=True)

@socket.on('disconnect')
def handle_disconnect():
    sid = request.sid

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]

        print(f'[Disconnect] {{{clipboard_id}}} {sid}', flush=True)

        Clipboard.clips[clipboard_id].clients.remove(sid)
        del Clipboard.all_clients[sid]

@socket.on('message')
def handle_message(data):
    sid = request.sid

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]

        display_contents = data[:50] or '*empty*'
        print(f'[Recv] {{{clipboard_id}}} {display_contents} <- {sid}', flush=True)

        Clipboard.clips[clipboard_id].contents = data

        others = list(filter(lambda id: id != sid, Clipboard.clips[clipboard_id].all_clients))
        socket.emit('tx', to=others)
        socket.send(data, to=others)

        display_receivers = ', '.join(others) or '*no one*'
        print(f'[Send] {{{clipboard_id}}} {display_contents} -> {display_receivers}', flush=True)

        socket.emit('sync', to=sid)
        print(f'[Sync] {{{clipboard_id}}} {sid}', flush=True)
