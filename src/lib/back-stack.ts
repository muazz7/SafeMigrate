'use client';

import { useEffect } from 'react';

/**
 * Hardware back-button interceptors — BUILD-SPEC §9.1.
 *
 * Required behaviour: back closes an open modal, then navigates back, then
 * prompts before exiting. Without this a judge pressing back once leaves the app.
 *
 * Components register through `useBackInterceptor` and never touch Capacitor
 * themselves (§9.2); AppShell owns the single platform listener.
 */

type Interceptor = () => void;

const stack: Interceptor[] = [];

const push = (fn: Interceptor): void => {
  stack.push(fn);
};

const remove = (fn: Interceptor): void => {
  const index = stack.lastIndexOf(fn);
  if (index !== -1) stack.splice(index, 1);
};

/**
 * Runs the most recently registered interceptor, if any.
 * Returns true when the press was consumed and must not fall through to
 * navigation or app exit.
 */
export function consumeBackPress(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

/**
 * Registers `onBack` while `active` is true — typically a modal's close handler.
 * The most recently mounted active interceptor wins, so nested overlays unwind
 * in the order the user opened them.
 */
export function useBackInterceptor(active: boolean, onBack: Interceptor): void {
  useEffect(() => {
    if (!active) return;
    push(onBack);
    return () => remove(onBack);
  }, [active, onBack]);
}
