import { create } from "zustand"
import i18n from "../i18n"

type Lang = "zh" | "en"

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

function applyLang(lang: Lang) {
  i18n.changeLanguage(lang)
  localStorage.setItem("tangent_lang", lang)
}

const saved = localStorage.getItem("tangent_lang")
const initial: Lang = saved === "zh" || saved === "en" ? saved : "en"
applyLang(initial)

export const useLangStore = create<LangState>((set, get) => ({
  lang: initial,
  setLang: (lang) => {
    applyLang(lang)
    set({ lang })
  },
  toggleLang: () => {
    const next = get().lang === "zh" ? "en" : "zh"
    applyLang(next)
    set({ lang: next })
  },
}))
