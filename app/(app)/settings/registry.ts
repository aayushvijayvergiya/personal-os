import type { ComponentType } from "react";
import CategoriesPanel from "./sections/CategoriesPanel";
import CustomFieldsPanel from "./sections/CustomFieldsPanel";
import JournalQuestionsPanel from "./sections/JournalQuestionsPanel";
import SessionPanel from "./sections/SessionPanel";

/**
 * To add a settings section:
 *   1. Drop a self-contained panel component in ./sections (it loads and saves its own data).
 *   2. Add one entry below.
 * The Control Panel grid, the search box, the icon rail and the item counts all read from
 * this array — nothing in page.tsx needs to change. A new `group` string creates a new
 * heading in the grid, in the order the groups first appear here.
 */
export interface SettingsSection {
  id: string;
  icon: string;
  title: string;
  /** Shown under the title in the opened panel, and searched. */
  description: string;
  group: string;
  /** Extra search terms that don't appear in the title or description. */
  keywords?: string[];
  /** Table to head-count for the "n items" label on the tile. Omit for sections with no list. */
  countTable?: string;
  Panel: ComponentType;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "categories",
    icon: "🏷️",
    title: "Goal Categories",
    description: "Colour-coded categories used to group and filter goals.",
    group: "Personalization",
    keywords: ["colour", "color", "label", "tag"],
    countTable: "categories",
    Panel: CategoriesPanel,
  },
  {
    id: "journal-questions",
    icon: "💭",
    title: "Journal Questions",
    description: "The reflection prompts that appear on the daily and weekly journal pages.",
    group: "Personalization",
    keywords: ["prompt", "reflection", "daily", "weekly"],
    countTable: "journal_questions",
    Panel: JournalQuestionsPanel,
  },
  {
    id: "custom-fields",
    icon: "🧩",
    title: "Custom Fields",
    description: "Extra fields added to the Task and Goal property dialogs.",
    group: "Personalization",
    keywords: ["field", "property", "task", "goal", "select"],
    countTable: "field_definitions",
    Panel: CustomFieldsPanel,
  },
  {
    id: "session",
    icon: "🔐",
    title: "Session",
    description: "Who you are signed in as, and how to log off.",
    group: "System",
    keywords: ["account", "sign out", "log off", "logout", "auth"],
    Panel: SessionPanel,
  },
];
