package net

import (
	"context"
	"errors"
	"sync"
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

var (
	ErrInvalidCid   = errors.New("invalid connection id")
	ErrDuplicateTun = errors.New("duplicate tunnel")
)

func NewRouter(ctx context.Context) *Router {
	source := make(chan InMessage, 15)
	drain := make(chan InMessage, 15)
	router := &Router{
		Source: source,
		Drain:  drain,
		ctx:    ctx,
	}

	go func() {
		<-ctx.Done()

		close(source)
		close(drain)
	}()

	return router
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
		return ErrInvalidCid
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
		return nil, ErrDuplicateTun
	}

	a, ok := r.conns.Load(cid)
	if !ok {
		return nil, ErrInvalidCid
	}

	conn, ok := a.(*Conn)
	if !ok {
		panic("impossible")
	}

	ctx, cancel := context.WithCancel(conn.ctx)

	in := make(chan InMessage, 15)
	out := make(chan OutMessage, 15)

	tun := &Tunnel{
		Context: ctx,
		Cancel:  cancel,
		In:      in,
		Out:     out,
	}

	r.tunnels.Store(cid, tun)

	go func() {
		defer cancel()

		for {
			select {

			case m, ok := <-out:
				if !ok {
					return
				}

				conn.out <- m

			case <-ctx.Done():
				return

			case <-r.ctx.Done():
				return

			}
		}
	}()

	go func() {
		<-ctx.Done()

		close(in)
		close(out)

		r.tunnels.Delete(cid)
	}()

	return tun, nil
}

func (r *Router) Start() {
	for {
		select {

		case m, ok := <-r.Source:
			if !ok {
				return
			}

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
