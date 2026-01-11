import { useReducer, type ReactNode } from 'react'
import { PlannerContext } from './PlannerContext'
import { plannerReducer, createInitialState } from './reducer'

interface PlannerProviderProps {
  children: ReactNode
}

export function PlannerProvider({ children }: PlannerProviderProps) {
  const [state, dispatch] = useReducer(plannerReducer, undefined, createInitialState)

  return <PlannerContext.Provider value={{ state, dispatch }}>{children}</PlannerContext.Provider>
}
