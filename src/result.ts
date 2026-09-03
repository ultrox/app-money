// Minimal Result. Deliberately tiny: two constructors, two combinators.
// Bridge to Effect / fp-ts / neverthrow at the edge if you want; the domain
// only needs this.

export type Ok<A> = { readonly ok: true; readonly value: A };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<A, E> = Ok<A> | Err<E>;

export const ok = <A>(value: A): Ok<A> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const map = <A, B, E>(r: Result<A, E>, f: (a: A) => B): Result<B, E> =>
  r.ok ? ok(f(r.value)) : r;

export const flatMap = <A, B, E1, E2>(
  r: Result<A, E1>,
  f: (a: A) => Result<B, E2>,
): Result<B, E1 | E2> => (r.ok ? f(r.value) : r);
