from flask import Flask, request, abort
from flask_socketio import SocketIO
from clipboard import Clipboard, Text, File, generate_id, start_cleanup

app = Flask(__name__)
socket = SocketIO(app, cors_allowed_origins='http://34.227.150.51', max_http_buffer_size=1e8)

start_cleanup()

@app.route('/newclip')
def newclip():
    id = generate_id()

    with Clipboard.lock:
        Clipboard.clips[id] = Clipboard()

    print(f'[Generate] {id}', flush=True)

    return id

@app.route('/check/<id>')
def check(id):
    with Clipboard.lock:
        if id not in Clipboard.clips:
            abort(404)
    
    return ''

def send_contents(socket, clipboard_id, contents, users):
    display_users = ', '.join(users) or '*no one*'

    if contents.type == 'text':
        socket.emit('text', contents.data, to=users, include_self=False)
        print(f'[Send] {{{clipboard_id}}} {contents.data} -> {display_users}', flush=True)

    elif contents.type == 'file':
        if not contents.ready:
            return

        header = {
            'type': contents.content_type,
            'name': contents.filename,
            'numChunks': contents.num_chunks
        }     
        socket.emit('file', header, to=users, include_self=False)
        print(f'[Send] {{{clipboard_id}}} [INIT/{contents.num_chunks}] {contents.filename}: {contents.content_type} -> {display_users}', flush=True)

        def send(chunk_index, user):
            def callback(cont):
                if cont:
                    send(chunk_index + 1, user)

            if chunk_index >= len(contents.chunks):
                return
                
            chunk = {
                'index': chunk_index,
                'data': contents.chunks[chunk_index]
            }
            socket.emit('chunk', chunk, to=user, callback=callback)
            print(f'[Send] {{{clipboard_id}}} [{chunk_index+1}/{contents.num_chunks}] {contents.filename}: {contents.content_type} -> {user}', flush=True)

        for user in users:
            send(0, user)

    else:
        raise Exception()

@socket.on('connect')
def handle_connect(auth):
    sid = request.sid

    clipboard_id = auth['clip_id']

    with Clipboard.lock:
        if clipboard_id not in Clipboard.clips:
            print(f'[ERROR] {{{clipboard_id}}} No such clipboard', flush=True)
            socket.emit('noclipboard', to=sid)
            return

        clipboard = Clipboard.clips[clipboard_id]

        clipboard.clients.add(sid)
        Clipboard.all_clients[sid] = clipboard_id
        print(f'[Connect] {{{clipboard_id}}} {sid}', flush=True)

        send_contents(socket, clipboard_id, clipboard.contents, [sid])

@socket.on('disconnect')
def handle_disconnect():
    sid = request.sid

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]
        clipboard = Clipboard.clips[clipboard_id]

        clipboard.clients.remove(sid)
        del Clipboard.all_clients[sid]
        print(f'[Disconnect] {{{clipboard_id}}} {sid}', flush=True)

@socket.on('text')
def handle_text(data):
    sid = request.sid

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]
        clipboard = Clipboard.clips[clipboard_id]

        clipboard.contents = Text(data)
        print(f'[Recv] {{{clipboard_id}}} {data} <- {sid}', flush=True)

        others = list(filter(lambda id: id != sid, clipboard.clients))
        send_contents(socket, clipboard_id, clipboard.contents, others)

        socket.emit('sync', to=sid)
        print(f'[Sync] {{{clipboard_id}}} {sid}', flush=True)

@socket.on('file')
def handle_file(data):
    sid = request.sid

    content_type = data['type']
    filename = data['name']
    num_chunks = data['numChunks']

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return

        clipboard_id = Clipboard.all_clients[sid]
        clipboard = Clipboard.clips[clipboard_id]

        clipboard.contents = File(num_chunks, content_type, filename, sid)
        print(f'[Recv] {{{clipboard_id}}} [INIT/{num_chunks}] {filename}: {content_type} <- {sid}', flush=True)

@socket.on('chunk')
def handle_chunk(data):
    sid = request.sid

    chunk_index = data['index']
    chunk_data = data['data']

    with Clipboard.lock:
        if sid not in Clipboard.all_clients:
            socket.emit('error', to=sid)
            return False

        clipboard_id = Clipboard.all_clients[sid]
        clipboard = Clipboard.clips[clipboard_id]

        contents = clipboard.contents

        if contents.type != 'file' or contents.sid != sid:
            socket.emit('sync', to=sid)
            print(f'[Sync] {{{clipboard_id}}} {sid}', flush=True)

            return False

        if chunk_index != contents.next_chunk:
            socket.emit('error', to=sid)
            return False

        contents.chunks.append(chunk_data)
        contents.next_chunk += 1

        print(f'[Recv] {{{clipboard_id}}} [{chunk_index+1}/{contents.num_chunks}] {contents.filename}: {contents.content_type} <- {sid}', flush=True)

        if contents.next_chunk < contents.num_chunks:
            return True

        contents.ready = True

        others = list(filter(lambda id: id != sid, clipboard.clients))
        send_contents(socket, clipboard_id, contents, others)

        socket.emit('sync', to=sid)
        print(f'[Sync] {{{clipboard_id}}} {sid}', flush=True)

        return False
