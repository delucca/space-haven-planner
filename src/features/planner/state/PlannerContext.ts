import { createContext, type Dispatch } from 'react'
import type { PlannerState, PlannerAction } from './types'

export interface PlannerContextValue {
  state: PlannerState
  dispatch: Dispatch<PlannerAction>
}

export const PlannerContext = createContext<PlannerContextValue | null>(null)



