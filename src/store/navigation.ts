import { create } from "zustand"
import type { Provider } from "@/types"

export type NavSelection =
  | { type: "all" }
  | { type: "category"; provider: Provider }
  | { type: "flux"; fluxId: string; provider: Provider }

interface NavigationState {
  selection: NavSelection
  setSelection: (s: NavSelection) => void
}

export const useNavigationStore = create<NavigationState>()((set) => ({
  selection: { type: "all" },
  setSelection: (selection) => set({ selection }),
}))
