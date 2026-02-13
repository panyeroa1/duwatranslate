# Mapping Languages Correctly

Ensure that Staff and Guest roles are consistently mapped to Language 1 and Language 2 across the application, resolving a discrepancy between the UI and the system prompt.

## Proposed Changes

### [Frontend State & Configuration]

#### [MODIFY] [state.ts](file:///Users/master/github-repo/translator/copy-translator/lib/state.ts)

Update `generateSystemPrompt` to align Staff with `lang1` and Guest with `lang2`, matching the `Header.tsx` implementation.

#### [MODIFY] [Sidebar.tsx](file:///Users/master/github-repo/translator/copy-translator/components/Sidebar.tsx)

Rename selectors for clarity:

- "Language 1" -> "Staff Language (Language 1)"
- "Language 2" -> "Guest Language (Language 2)"

## Verification Plan

### Manual Verification

- Open the Sidebar and verify the new labels.
- Check the Header to ensure "Staff" and "Guest" languages match the Sidebar selections correctly.
- Verify that the system prompt (visible to super admins in Sidebar) correctly reflects the role-to-language mapping.
