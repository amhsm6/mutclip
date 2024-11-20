from flask import Flask, request
from flask_socketio import SocketIO
from clipboard import Clipboard, generate_id, start_cleanup

app = Flask(__name__)
sock = SocketIO(app, cors_allowed_origins='*')

start_cleanup()

@app.route('/newclip')
def newclip():
    id = generate_id()

    with Clipboard.lock:
        Clipboard.clips[id] = Clipboard()

    print('[Generate] %s' % id)

    return id

@sock.on('connect')
def handle_connect(auth):
    clipboard_id = auth['clip_id']
    sid = request.sid

    print('[Connect] %s to %s' % (sid, clipboard_id))

    with Clipboard.lock:
        if clipboard_id not in Clipboard.clips:
            print('[ERROR] No such clipboard')
            sock.emit('noclipboard', to=sid)
            return

        Clipboard.clips[clipboard_id].clients.append(sid)
        Clipboard.clients[sid] = clipboard_id

        sock.emit('tx', to=sid)
        sock.send(Clipboard.clips[clipboard_id].contents, to=sid)

        print('[Send] %s -> %s' % (Clipboard.clips[clipboard_id].contents, sid))

@sock.on('disconnect')
def handle_disconnect():
    sid = request.sid

    print('[Disconnect] %s' % sid)

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

    print('[Recv] %s <- %s' % (data, sid))

    with Clipboard.lock:
        if sid not in Clipboard.clients:
            sock.emit('error', to=sid)
            return

        clipboard_id = Clipboard.clients[sid]

        Clipboard.clips[clipboard_id].contents = data

        sock.emit('tx', to=Clipboard.clips[clipboard_id].clients, skip_sid=sid)
        sock.send(data, to=Clipboard.clips[clipboard_id].clients, skip_sid=sid)
        print('[Send] %s -> many' % Clipboard.clips[clipboard_id].contents)

        sock.emit('syn', to=sid)
        print('[Syn] %s' % sid)
