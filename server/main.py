from flask import Flask, request
from flask_socketio import SocketIO
from clipboard import Clipboard, generate_id, state_lock, clipboards, clients

app = Flask(__name__)
sock = SocketIO(app, cors_allowed_origins='*')

@app.route('/newclip')
def newclip():
    id = generate_id()

    with state_lock:
        clipboards[id] = Clipboard()

    app.logger.warning('[Generate]: %s', id)

    return id

@sock.on('connect')
def handle_connect(auth):
    clipboard_id = auth['clip_id']
    sid = request.sid

    app.logger.warning('[Connect] %s to %s', sid, clipboard_id)

    with state_lock:
        if clipboard_id not in clipboards:
            sock.emit('noclipboard', to=sid)
            return

        clipboards[clipboard_id].clients.append(sid)
        clients[sid] = clipboard_id

        sock.emit('tx', to=sid)
        sock.send(clipboards[clipboard_id].contents, to=sid)

        app.logger.warning('[Send] %s -> %s', clipboards[clipboard_id].contents, sid)

@sock.on('message')
def handle_message(data):
    sid = request.sid

    app.logger.warning('[Recv] %s <- %s', data, sid)

    with state_lock:
        if sid not in clients:
            sock.emit('error', to=sid)
            return

        clipboard_id = clients[sid]

        clipboards[clipboard_id].contents = data

        sock.emit('tx', to=clipboards[clipboard_id].clients, skip_sid=sid)
        sock.send(data, to=clipboards[clipboard_id].clients, skip_sid=sid)
        app.logger.warning('[Send] %s -> many', clipboards[clipboard_id].contents)

        sock.emit('syn', to=sid)
        app.logger.warning('[Syn] %s', sid)
