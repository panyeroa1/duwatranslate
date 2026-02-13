# Walkthrough - Language Mapping Fixes

The Staff and Guest roles are now correctly and consistently mapped to their respective languages throughout the application.

## Changes Implemented

### [Role-to-Language Alignment]

- **[state.ts](file:///Users/master/github-repo/translator/copy-translator/lib/state.ts)**: Updated `generateSystemPrompt` to align Staff with `language1` (Dutch by default) and Guest with `language2` (English by default). This ensures the AI's internal instructions match what the user sees in the Header.

### [UI Improvements]

- **[Sidebar.tsx](file:///Users/master/github-repo/translator/copy-translator/components/Sidebar.tsx)**: Renamed the language selectors for better clarity:
  - "Language 1" is now **"Staff Language (Language 1)"**.
  - "Language 2" is now **"Guest Language (Language 2)"**.

## Verification

- **Sidebar**: The new labels are visible and correctly indicate which role each language applies to.
- **System Prompt**: Super Admins can verify in the Sidebar that the generated prompt now correctly lists `Orus` for Staff (${lang1}) and `Charon` for Guest (${lang2}).
- **Header**: The "Staff" and "Guest" displays correctly pull the codes from the corresponding Sidebar selections.
