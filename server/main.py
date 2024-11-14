from flask import Flask, request
from flask_socketio import SocketIO
from clipboard import Clipboard, generate_id, state_lock, clipboards, clients

app = Flask(__name__)
sock = SocketIO(app)

@app.route('/')
def index():
    return '<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/3.0.4/socket.io.js" integrity="sha512-aMGMvNYu8Ue4G+fHa359jcPb1u+ytAF+P2SCb+PxrjCdO3n3ZTxJ30zuH39rimUggmTwmh2u7wvQsDTHESnmfQ==" crossorigin="anonymous"></script>'

@app.route('/newclip')
def newclip():
    id = generate_id()

    with state_lock:
        clipboards[id] = Clipboard()

    return id

@sock.on('connect')
def handle_connect(auth):
    clipboard_id = auth
    sid = request.sid

    with state_lock:
        if clipboard_id in clipboards:
            clipboards[clipboard_id].clients.append(sid)
            clients[sid] = clipboard_id

            sock.emit('tx', to=sid)
            sock.send(clipboards[clipboard_id].contents, to=sid)
        else:
            sock.emit('noclipboard', to=sid)

@sock.on('message')
def handle_message(data):
    sid = request.sid

    with state_lock:
        if sid not in clients:
            sock.emit('error', to=sid)
            return

        clipboard_id = clients[sid]

        clipboards[clipboard_id].contents = data

        sock.emit('tx', to=clipboards[clipboard_id].clients, skip_sid=sid)
        sock.send(data, to=clipboards[clipboard_id].clients, skip_sid=sid)

        sock.emit('syn', to=sid)

if __name__ == '__main__':
    sock.run(app, '0.0.0.0', 1509)
