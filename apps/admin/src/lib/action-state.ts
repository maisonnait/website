/**
 * Shape of what a Server Action hands back to its form. This file has no server import,
 * so client components can share the type and the starting value.
 */
export interface ActionState {
  ok: boolean
  /** Sentence shown next to the form. */
  message: string
  /** Messages for single fields, keyed by input name. */
  fields?: Record<string, string>
  /** Changes on every result so that the form can react even when the message repeats. */
  at?: number
}

export const IDLE_STATE: ActionState = { ok: false, message: '' }
