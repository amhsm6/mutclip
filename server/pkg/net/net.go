package net

import (
    "context"
    "sync"

    "github.com/google/uuid"
)

type RID = uuid.UUID

type Router[T any] struct {
    source chan T
    routes sync.Map
    ctx    context.Context
}

type Route[T any] struct {
    filter      func(T) bool
    priority    int
    destination chan T
}

func NewRouter[T any](source chan T, ctx context.Context) *Router[T] {
    return &Router[T]{ source: source, ctx: ctx }
}

func (r *Router[T]) Route(ctx context.Context, filter func(T) bool, priority int, dest chan T) {
    route := &Route[T]{
        filter:      filter,
        priority:    priority,
        destination: dest,
    }

    rid := uuid.New()

    r.routes.Store(rid, route)

    go func() {
        select {
        case <-r.ctx.Done():
        case <-ctx.Done():
        }

        r.routes.Delete(rid)
    }()
}

func (r *Router[T]) Start() {
    for {
        select {
        case m := <-r.source:
            r.routes.Range(func(_, value any) bool {
                route, ok := value.(*Route[T])
                if !ok {
                    panic("impossible")
                }

                if route.filter(m) {
                    
                }

                return true
            })

        case <-r.ctx.Done():
            return
        }
    }
}
