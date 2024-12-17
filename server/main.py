from flask import Flask, request
from flask_socketio import SocketIO
from clipboard import Clipboard, FileBuffer, generate_id, start_cleanup

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

        clipboard = Clipboard.clips[clipboard_id]

        clipboard.clients.add(sid)
        Clipboard.all_clients[sid] = clipboard_id
        print(f'[Connect] {{{clipboard_id}}} {sid}', flush=True)

        socket.emit('text', clipboard.contents, to=sid)
        print(f'[Send] {{{clipboard_id}}} {clipboard.contents} -> {sid}', flush=True)

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

@socket.on('text')
def handle_text(data):
    sid = request.sid

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]
        clipboard = Clipboard.clips[clipboard_id]

        clipboard.contents = data
        print(f'[Recv] {{{clipboard_id}}} {data} <- {sid}', flush=True)

        others = list(filter(lambda id: id != sid, clipboard.clients))
        socket.emit('text', data, to=others)

        display_receivers = ', '.join(others) or '*no one*'
        print(f'[Send] {{{clipboard_id}}} {data} -> {display_receivers}', flush=True)

        socket.emit('sync', to=sid)
        print(f'[Sync] {{{clipboard_id}}} {sid}', flush=True)

@socket.on('file')
def handle_file(data):
    sid = request.sid

    content_type = data['type']
    filename = data['name']
    num_chunks = data['numChunks']

    print(f'{content_type} {filename} {num_chunks}')

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]
        Clipboard.clips[clipboard_id].buffer = FileBuffer(num_chunks, content_type, filename)

@socket.on('chunk')
def handle_chunk(data):
    sid = request.sid

    chunk_index = data['index']
    chunk_data = data['data']

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]
        buffer = Clipboard.clips[clipboard_id].buffer

        if not buffer or chunk_index != buffer.next_chunk:
            socket.emit('wrongchunk', to=sid)
            return

        buffer.data += chunk_data
        buffer.next_chunk += 1

        if buffer.next_chunk < buffer.num_chunks:
            return True


