"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

type GuidedSection = {
  id: string
  title: string
  description: string
  placeholder: string
}

const GUIDED_SECTIONS: GuidedSection[] = [
  {
    id: "role",
    title: "Role & Persona",
    description: "Who is the assistant? What's their expertise and background?",
    placeholder: "e.g., You are a helpful customer service representative with expertise in product support...",
  },
  {
    id: "tone",
    title: "Tone & Voice",
    description: "How should the assistant communicate?",
    placeholder: "e.g., Friendly, professional, empathetic, confident...",
  },
  {
    id: "response-style",
    title: "Response Style",
    description: "Length, format, emoji usage, and communication preferences",
    placeholder: "e.g., Short responses (1-2 sentences), no emojis, simple language...",
  },
  {
    id: "conversation-rules",
    title: "Conversation Rules",
    description: "How to handle greetings, unknowns, off-topic questions",
    placeholder: "e.g., Greet warmly, admit when you don't know something, stay focused on your expertise...",
  },
  {
    id: "special-instructions",
    title: "Special Instructions",
    description: "Custom business rules, memory notes, or specific behaviors",
    placeholder: "e.g., Each phone number is a separate conversation, remember key details from this conversation...",
  },
]

type GuidedModeProps = {
  value: string
  onChange: (value: string) => void
}

export function GuidedMode({ value, onChange }: GuidedModeProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(["role"])
  )
  const [sectionValues, setSectionValues] = React.useState<Record<string, string>>({
    role: "",
    tone: "",
    "response-style": "",
    "conversation-rules": "",
    "special-instructions": "",
  })

  // Parse existing prompt into sections if value is provided
  React.useEffect(() => {
    if (value && !value.includes("{domain_knowledge}")) {
      // Try to parse existing prompt (basic parsing)
      // This is a simple implementation - could be enhanced
      const sections: Record<string, string> = {
        role: "",
        tone: "",
        "response-style": "",
        "conversation-rules": "",
        "special-instructions": "",
      }
      setSectionValues(sections)
    }
  }, [value])

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const updateSection = (sectionId: string, content: string) => {
    const newValues = { ...sectionValues, [sectionId]: content }
    setSectionValues(newValues)
    generatePrompt(newValues)
  }

  const generatePrompt = (values: Record<string, string>) => {
    const parts: string[] = []

    if (values.role) {
      parts.push(values.role)
    }

    parts.push("\n{domain_knowledge}\n")

    if (values.tone || values["response-style"] || values["conversation-rules"] || values["special-instructions"]) {
      parts.push("\n## SMS Communication Guidelines\n")
    }

    if (values.tone) {
      parts.push(`\nTone:\n${values.tone}\n`)
    }

    if (values["response-style"]) {
      parts.push(`\nResponse Style:\n${values["response-style"]}\n`)
    }

    if (values["conversation-rules"]) {
      parts.push(`\nConversation Flow:\n${values["conversation-rules"]}\n`)
    }

    if (values["special-instructions"]) {
      parts.push(`\nSpecial Instructions:\n${values["special-instructions"]}\n`)
    }

    const generatedPrompt = parts.join("").trim()
    onChange(generatedPrompt)
  }

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Build your system prompt step-by-step. Fill in each section to customize your assistant's behavior.
        </p>
      </div>

      <div className="space-y-2">
        {GUIDED_SECTIONS.map((section, index) => {
          const isExpanded = expandedSections.has(section.id)
          return (
            <div key={section.id} className="border rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{section.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {section.description}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <>
                  <Separator />
                  <div className="p-4 space-y-2">
                    <Label htmlFor={`guided-${section.id}`}>{section.title}</Label>
                    {section.id === "role" ? (
                      <Textarea
                        id={`guided-${section.id}`}
                        value={sectionValues[section.id] || ""}
                        onChange={(e) => updateSection(section.id, e.target.value)}
                        placeholder={section.placeholder}
                        rows={3}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <Textarea
                        id={`guided-${section.id}`}
                        value={sectionValues[section.id] || ""}
                        onChange={(e) => updateSection(section.id, e.target.value)}
                        placeholder={section.placeholder}
                        rows={4}
                        className="font-mono text-sm"
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

