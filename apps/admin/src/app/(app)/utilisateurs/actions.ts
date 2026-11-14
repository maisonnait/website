'use server'

import { revalidatePath } from 'next/cache'
import { createUser, listUsers, setUserActive, setUserPassword } from '@nait/db'
import { requireOwner } from '@/lib/auth'
import { actionError, fail, ok, type ActionState } from '@/lib/errors'

const PASSWORD_MIN = 10
const PASSWORD_MAX = 200
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Le mot de passe doit compter au moins ${PASSWORD_MIN} caractères.`
  if (password.length > PASSWORD_MAX) return `Le mot de passe est trop long (${PASSWORD_MAX} caractères au maximum).`
  return null
}

export async function createUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireOwner()
  } catch (error) {
    return actionError(error, 'createUser')
  }

  const name = String(formData.get('name') ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const role = formData.get('role')
  const password = String(formData.get('password') ?? '')

  const fields: Record<string, string> = {}
  if (name.length < 2 || name.length > 80) fields.name = 'Indiquez le prénom et le nom (2 à 80 caractères).'
  if (!EMAIL.test(email) || email.length > 254) fields.email = 'Adresse e-mail invalide.'
  if (role !== 'owner' && role !== 'staff') fields.role = 'Choisissez un rôle.'
  const problem = passwordProblem(password)
  if (problem) fields.password = problem
  if (Object.keys(fields).length > 0) return fail('Corrigez les champs signalés.', fields)

  try {
    await createUser({ name, email, password, role: role === 'owner' ? 'owner' : 'staff' })
  } catch (error) {
    return actionError(error, 'createUser')
  }

  revalidatePath('/utilisateurs')
  return ok(`Compte créé pour ${name}. Transmettez-lui son mot de passe de vive voix.`)
}

/** Blocks or restores an account. A blocked user is signed out at once. */
export async function setUserActiveAction(userId: string, active: boolean, _previous: ActionState, _formData: FormData): Promise<ActionState> {
  let owner
  try {
    owner = await requireOwner()
  } catch (error) {
    return actionError(error, 'setUserActive')
  }
  if (!validId(userId) || typeof active !== 'boolean') return fail('Demande incomplète. Rechargez la page et réessayez.')
  if (!active && userId === owner.id) return fail('Vous ne pouvez pas désactiver votre propre compte.')

  try {
    if (!active) {
      const users = await listUsers()
      const target = users.find((user) => user.id === userId)
      const otherOwners = users.filter((user) => user.role === 'owner' && user.active && user.id !== userId)
      if (target?.role === 'owner' && otherOwners.length === 0) {
        return fail('Il doit rester au moins un propriétaire actif.')
      }
    }
    const user = await setUserActive(userId, active)
    revalidatePath('/utilisateurs')
    return ok(active ? `Le compte de ${user.name} est réactivé.` : `Le compte de ${user.name} est désactivé.`)
  } catch (error) {
    return actionError(error, 'setUserActive')
  }
}

export async function setUserPasswordAction(userId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireOwner()
  } catch (error) {
    return actionError(error, 'setUserPassword')
  }
  if (!validId(userId)) return fail('Demande incomplète. Rechargez la page et réessayez.')

  const password = String(formData.get('password') ?? '')
  const problem = passwordProblem(password)
  if (problem) return fail(problem, { password: problem })

  try {
    const user = await setUserPassword(userId, password)
    return ok(`Nouveau mot de passe enregistré pour ${user.name}.`)
  } catch (error) {
    return actionError(error, 'setUserPassword')
  }
}
