package net

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Router struct {
	Source chan InMessage
	Drain  chan InMessage

	tunnels sync.Map
	conns   sync.Map

	ctx context.Context
}

type Tunnel struct {
	context.Context
	Cancel context.CancelFunc

	In  chan InMessage
	Out chan OutMessage
}

type Conn struct {
	out chan<- OutMessage
	ctx context.Context
}

func NewRouter(ctx context.Context) *Router {
	return &Router{
		Source: make(chan InMessage, 15),
		Drain:  make(chan InMessage, 15),
		ctx:    ctx,
	}
}

func (r *Router) Connect(out chan<- OutMessage, ctx context.Context) CID {
	cid := newCID()

	conn := &Conn{out, ctx}
	r.conns.Store(cid, conn)

	go func() {
		select {
		case <-ctx.Done():
		case <-r.ctx.Done():
		}

		r.conns.Delete(cid)
	}()

	return cid
}

func (r *Router) Send(cid CID, m OutMessage) error {
	a, ok := r.conns.Load(cid)
	if !ok {
		return fmt.Errorf("invalid cid: %v", cid)
	}

	conn, ok := a.(*Conn)
	if !ok {
		panic("impossible")
	}

	conn.out <- m
	return nil
}

func (r *Router) Broadcast(m OutMessage, except map[CID]struct{}) {
	r.conns.Range(func(key, value any) bool {
		cid, ok := key.(CID)
		if !ok {
			panic("impossible")
		}

		if _, ok := except[cid]; ok {
			return true
		}

		conn, ok := value.(*Conn)
		if !ok {
			panic("impossible")
		}

		conn.out <- m
		return true
	})
}

func (r *Router) Tunnel(cid CID) (*Tunnel, error) {
	_, ok := r.tunnels.Load(cid)
	if ok {
		return nil, fmt.Errorf("duplicate tunnel: %v", cid)
	}

	a, ok := r.conns.Load(cid)
	if !ok {
		return nil, fmt.Errorf("invalid cid: %v", cid)
	}

	conn, ok := a.(*Conn)
	if !ok {
		panic("impossible")
	}

	in := make(chan InMessage, 15)
	out := make(chan OutMessage, 15)

	tunCtx, cancel := context.WithCancel(conn.ctx)

	tun := &Tunnel{
		Context: tunCtx,
		Cancel:  cancel,
		In:      in,
		Out:     out,
	}

	r.tunnels.Store(cid, tun)

	go func() {
		defer cancel()

		for {
			select {
			case m := <-out:
				conn.out <- m

			case <-tunCtx.Done():
				return

			case <-r.ctx.Done():
				return
			}
		}
	}()

	go func() {
		defer cancel()
		defer close(in)
		defer close(out)

		select {
		case <-tunCtx.Done():
		case <-r.ctx.Done():
		}

		time.Sleep(time.Second)

		r.tunnels.Delete(cid)
	}()

	return tun, nil
}

func (r *Router) DestroyTunnel(cid CID) error {
	a, ok := r.tunnels.LoadAndDelete(cid)
	if !ok {
		return fmt.Errorf("invalid tunnel: %v", cid)
	}

	tun, ok := a.(*Tunnel)
	if !ok {
		panic("impossible")
	}

	tun.Cancel()
	return nil
}

func (r *Router) Start() {
	defer close(r.Source)
	defer close(r.Drain)

	for {
		select {
		case m := <-r.Source:
			sent := false
			r.tunnels.Range(func(key, val any) bool {
				cid, ok := key.(CID)
				if !ok {
					panic("impossible")
				}

				tun, ok := val.(*Tunnel)
				if !ok {
					panic("impossible")
				}

				if m.Cid == cid {
					tun.In <- m

					sent = true
					return false
				}

				return true
			})

			if !sent {
				r.Drain <- m
			}

		case <-r.ctx.Done():
			return
		}
	}
}
