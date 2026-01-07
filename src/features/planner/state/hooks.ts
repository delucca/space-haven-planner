import { useContext, type Dispatch } from 'react'
import type { PlannerState, PlannerAction } from './types'
import { PlannerContext, type PlannerContextValue } from './PlannerContext'

export function usePlannerState(): PlannerState {
  const context = useContext(PlannerContext)
  if (!context) {
    throw new Error('usePlannerState must be used within a PlannerProvider')
  }
  return context.state
}

export function usePlannerDispatch(): Dispatch<PlannerAction> {
  const context = useContext(PlannerContext)
  if (!context) {
    throw new Error('usePlannerDispatch must be used within a PlannerProvider')
  }
  return context.dispatch
}

export function usePlanner(): PlannerContextValue {
  const context = useContext(PlannerContext)
  if (!context) {
    throw new Error('usePlanner must be used within a PlannerProvider')
  }
  return context
}
