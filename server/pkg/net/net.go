package net

import (
	"context"
	"errors"
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

var (
	InvalidCid   = errors.New("Invalid Connection ID")
	DuplicateTun = errors.New("Duplicate Tunnel")
)

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

		time.Sleep(time.Second)

		r.conns.Delete(cid)
	}()

	return cid
}

func (r *Router) Send(cid CID, m OutMessage) error {
	a, ok := r.conns.Load(cid)
	if !ok {
		return InvalidCid
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
		return nil, DuplicateTun
	}

	a, ok := r.conns.Load(cid)
	if !ok {
		return nil, InvalidCid
	}

	conn, ok := a.(*Conn)
	if !ok {
		panic("impossible")
	}

	in := make(chan InMessage, 15)
	out := make(chan OutMessage, 15)

	ctx, cancel := context.WithCancel(conn.ctx)

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

			case m := <-out:
				conn.out <- m

			case <-ctx.Done():
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

		case <-ctx.Done():

		case <-r.ctx.Done():

		}

		time.Sleep(time.Second)

		r.tunnels.Delete(cid)
	}()

	return tun, nil
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
