# Development Guidelines

## ⚠️ MANDATORY DEVELOPMENT WORKFLOW ⚠️

**CRITICAL**: Before ANY code changes, ALWAYS run the complete quality check:

```bash
bun run dev-check
```

This command MUST be executed after every code change and will:
1. ✅ Check TypeScript types
2. ✅ Run Biome linting & formatting
3. ✅ Test build process
4. ✅ Clean build artifacts (out/, .next/)
5. 🤖 **Generate AI improvement suggestions**
6. ✅ Auto-start development server

**NEVER skip this step** - it ensures zero errors in production and maintains code quality standards.

## 🔒 ZERO-TOLERANCE CI FAILURE ENFORCEMENT 🔒

**ABSOLUTE MANDATE**: CI failures are STRICTLY FORBIDDEN. The following enforcement systems are permanently in place:

### 🚫 PRE-COMMIT HOOK ENFORCEMENT
- **Husky Git hooks** automatically run ALL quality checks before EVERY commit
- **CANNOT be bypassed or skipped** - commits will be blocked if any check fails
- Pre-commit checks include:
  1. ✅ TypeScript compilation check
  2. ✅ Biome linting & formatting
  3. ✅ Full test suite execution
  4. ✅ Complete build verification

### 🛡️ MANDATORY COMMIT WORKFLOW
**EVERY commit must pass ALL checks:**

```bash
# Automatic pre-commit execution (cannot be skipped)
git commit -m "message"  # Will run full quality check automatically
```

### ⚠️ CI FAILURE CONSEQUENCES
**IF CI ever fails:**
1. **IMMEDIATELY** stop all development work
2. **FIRST** fix the CI failure
3. **THEN** continue with new features
4. **NEVER** commit CI-breaking code

### 🔧 PERMANENT ENFORCEMENT TOOLS
- **Husky**: Git pre-commit hooks (`.husky/pre-commit`)
- **Biome**: Automatic linting & formatting
- **TypeScript**: Strict type checking
- **Jest/Bun Test**: Comprehensive test coverage
- **Build Verification**: Complete build success check

### 📋 CLAUDE AI OBLIGATIONS
**AI MUST ALWAYS:**
1. ✅ Run `bun run dev-check` before any commit
2. ✅ Verify ALL tests pass
3. ✅ Confirm build succeeds
4. ✅ Fix ANY pre-commit hook failures
5. ✅ NEVER force-push or bypass checks

**AI MUST NEVER:**
1. ❌ Commit code with linting errors
2. ❌ Skip quality checks
3. ❌ Bypass pre-commit hooks
4. ❌ Ignore TypeScript errors
5. ❌ Push failing builds

This system GUARANTEES zero CI failures and maintains pristine code quality permanently.

## 🚀 AI-DRIVEN PROACTIVE IMPROVEMENT SYSTEM

**CRITICAL AI BEHAVIOR**: Claude Code AI MUST be proactive in suggesting improvements:

### 💡 Auto-Improvement Triggers
AI must AUTOMATICALLY suggest improvements when:
- Code quality can be enhanced
- UI/UX can be more competitive vs. rivals
- Performance can be optimized
- Automation can be increased
- SEO can be strengthened
- Accessibility can be improved

### 🎯 Improvement Categories Priority
1. **HIGH PRIORITY**: Performance, UI/UX, SEO
2. **MEDIUM PRIORITY**: Automation, Code Quality
3. **LOW PRIORITY**: Nice-to-have enhancements

### 📊 Competitive Analysis Integration
- Always benchmark against: jsonformatter.org, base64encode.org, codebeautify.org
- Aim to exceed competitor features by 200%+
- Focus on: Speed, Beauty, User Experience, No Ads

### 🔄 Continuous Improvement Loop
Every development session, AI MUST:
1. Analyze current implementation quality
2. Compare with competitor benchmarks
3. Identify 3-5 specific improvement opportunities
4. Propose concrete implementation steps
5. Estimate impact on KPIs (PV, UX metrics)

**Commands for AI analysis:**
```bash
bun run ai-suggest    # Generate improvement suggestions
bun run analyze       # Full project analysis
```

## Tech Stack

- Next.js 15 (App Router)
- TypeScript (strict mode)
- Bun (package manager & runtime)
- Tailwind CSS
- shadcn/ui
- Biome (linter & formatter)
- GitHub Pages

## Code Quality Standards
- Type-safe implementations
- Responsive design
- Dark mode support
- Accessibility (WCAG 2.1 AA)
- Performance (Lighthouse 95+)

## Development Principles
- Client-side only tools
- No external API dependencies
- Privacy-first (no tracking/analytics)
- Progressive enhancement
- Mobile-first approach

## Project Structure
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── tools/
│       └── [tool]/
│           └── page.tsx
├── components/
│   ├── ui/
│   ├── layout/
│   └── tools/
├── lib/
│   └── utils.ts
└── config/
    └── site.ts
```

## Coding Standards

### TypeScript
- Strict mode enabled
- Prefer interfaces over types
- No `any` types
- Proper error handling

### React/Next.js
- Leverage Server Components
- Minimize Client Components
- Proper hook usage
- Component composition

### Styling
- Tailwind CSS utilities
- CSS variables for theming
- Consistent spacing system
- Semantic class names

### Performance
- Image optimization (next/image)
- Code splitting
- Lazy loading
- Minimize bundle size

## Testing & Validation

- Unit tests with bun test
- Manual testing across devices
- Browser compatibility check
- Accessibility audit
- Performance monitoring

## CI/CD Pipeline

- Automated testing (bun test)
- Code quality checks (Biome)
- Build verification
- Automatic deployment to GitHub Pages

## Git Workflow
- Clear commit messages
- Feature branches
- PR reviews when applicable
- Semantic versioning

## Documentation
- Clear README for each tool
- Inline code comments where necessary
- Usage examples
- API documentation if applicable

## 🎯 ULTRA-PERMANENT DESIGN & DEVELOPMENT RULES

### 🚫 ABSOLUTE PROHIBITIONS
**NEVER violate these rules under ANY circumstances:**

1. **🚫 NO EMOJIS IN CODE**:
   - NEVER use emojis in any code files
   - ALL icons MUST use Lucide React icons from https://lucide.dev/icons/
   - Replace ALL existing emojis with appropriate Lucide icons

2. **🎨 UNIFIED COLOR PALETTE**:
   - ALL tools MUST use the same color scheme as homepage
   - Base colors: slate/blue system, accent #0066cc
   - NO random colors: orange, purple, pink variations
   - Consistent border/card styling across all components

3. **📱 MOBILE-FIRST RESPONSIVE DESIGN**:
   - ALL content MUST be comfortable on mobile devices
   - Minimum touch targets: 44px x 44px
   - Adequate spacing: min 16px margins on mobile
   - Readable font sizes: min 16px on mobile
   - NO cramped layouts on small screens

4. **🏗️ STRICT OOUI (Object-Oriented UI)**:
   - Each component represents ONE clear object/concept
   - Clear object boundaries with appropriate visual containers
   - Consistent interaction patterns across similar objects
   - Logical information hierarchy within each object

5. **🔍 THOROUGH CODE INVESTIGATION**:
   - ALWAYS read ALL relevant files before making changes
   - NEVER skip investigating existing code patterns
   - Maintain consistency with existing implementations
   - Document deviations only when absolutely necessary

### 📋 MANDATORY CONTENT STANDARDS

6. **🌐 ENGLISH-ONLY INTERFACE**:
   - ALL user-facing text MUST be in English
   - NO Japanese text in UI (code comments OK)
   - Professional, clear, concise copywriting

7. **🔒 PRIVACY-CONSCIOUS CONTENT**:
   - Prepare for potential Ad integration (future-proof privacy statements)
   - Prepare for potential Analytics integration
   - NO absolute "never tracking" promises
   - Use terms like "currently no tracking" or "privacy-focused"

8. **🏫 PERSONAL INFO PROTECTION**:
   - NO specific university names in public content
   - Use generic terms like "studied computer science" or "engineering education"
   - Maintain professional anonymity where appropriate

### 🔧 TECHNICAL ENFORCEMENT

9. **🤖 AI IMPROVEMENT ENGINE INTEGRATION**:
   - AI improvement suggestions MUST check rule compliance
   - Automated detection of rule violations
   - Proactive suggestions for rule adherence improvements

10. **⚡ CONTINUOUS RULE APPLICATION**:
    - Apply these rules to ALL new development
    - Retrofit existing code to comply with rules
    - Include rule compliance in all quality checks

### 🎯 IMPLEMENTATION PRIORITIES
1. **CRITICAL (Fix Immediately)**: Emojis, Mobile UX, Privacy statements
2. **HIGH (Next Session)**: Color unification, OOUI compliance
3. **MEDIUM (Ongoing)**: Code investigation thoroughness, English consistency

**These rules are PERMANENT and MUST be followed by all future AI interactions with this codebase.**

### 📚 MANDATORY PROJECT DOCUMENTATION

1. **📝 DEVELOPMENT HISTORY MAINTENANCE**:
    - After EVERY development session, MUST update `DEVELOPMENT_HISTORY.md`
    - Record ALL changes made: files modified, features added, bugs fixed
    - Document future plans, pending tasks, and known issues
    - Include technical details: color changes, responsive breakpoints, component modifications
    - Provide context for future AI agents to understand project evolution
    - Format: Chronological entries with clear categorization (completed/pending/issues)

**Purpose**: Ensure project continuity and context preservation for future AI interactions.

## 🛠️ WEB TOOL DEVELOPMENT STANDARDS

### 📐 MANDATORY TOOL PAGE STRUCTURE
**EVERY tool page MUST follow this exact structure:**

#### 1. PAGE COMPONENT STRUCTURE
```typescript
'use client'

export default function [ToolName]Page() {
  return (
    <div className="min-h-screen bg-white dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Header />

        {/* Hero Section */}
        <section className="mb-8">...</section>

        {/* Main Tool Interface */}
        <section className="grid gap-8 lg:grid-cols-[1fr,1fr] OR lg:grid-cols-3">
          {/* Input/Controls Section */}
          <div>...</div>

          {/* Output/Preview Section */}
          <div>...</div>
        </section>

        {/* Features Section (optional on mobile) */}
        <section className="hidden xs:block mb-8 sm:mb-12 md:mb-16">...</section>

        {/* Content Sections for SEO */}
        <section className="mb-8 sm:mb-12 md:mb-16 border-t border-border-light dark:border-border-dark pt-8 sm:pt-12">
          {/* About This Tool */}
          <div className="mb-12">...</div>

          {/* How to Use */}
          <div className="mb-12">...</div>

          {/* Key Features */}
          <div className="mb-12">...</div>

          {/* Examples */}
          <div className="mb-12">...</div>

          {/* FAQ */}
          <div className="mb-12">...</div>
        </section>

        <Footer />
      </div>
    </div>
  )
}
```

#### 2. HERO SECTION REQUIREMENTS
- **Title**: h1 tag with tool name
- **Description**: Brief description of tool purpose
- **Styling**: Text center aligned, max-width-3xl for readability
- **Responsive font sizes**: text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl

#### 3. MAIN INTERFACE LAYOUT PATTERNS
**Choose based on tool complexity:**
- **Simple Tools**: Single column with stacked input/output
- **Complex Tools**: 2-column grid (lg:grid-cols-2)
- **Multi-section Tools**: 3-column grid (lg:grid-cols-3)
- **All layouts**: Must stack on mobile (grid-cols-1)

#### 4. CONTROL BUTTONS STANDARDS
```typescript
// Primary Action Button
<button className="rounded-lg bg-accent px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] text-white font-medium text-sm sm:text-base transition-all hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95">

// Secondary Action Button
<button className="rounded-lg border border-border-light px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base transition-all hover:border-accent hover:text-accent dark:border-border-dark hover:shadow-lg active:scale-95">

// Danger Action Button
<button className="rounded-lg border border-red-300 px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-medium text-sm sm:text-base text-red-600 transition-all hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950">
```

#### 5. INPUT/OUTPUT PANELS
```typescript
// Container Structure
<div className="rounded-lg border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark overflow-hidden transition-all hover:shadow-lg">
  {/* Header */}
  <div className="p-3 sm:p-4 md:p-6 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark">
    <h3 className="text-lg font-semibold">Title</h3>
    <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary mt-1">
      Description
    </p>
  </div>

  {/* Content */}
  <div className="p-3 sm:p-4 md:p-6">
    {/* Input/Output content */}
  </div>
</div>
```

#### 6. CONTENT SECTIONS (SEO CRITICAL)
**MANDATORY sections for ALL tools:**

##### About This Tool (3 paragraphs minimum)
- Paragraph 1: What the tool does and its primary use cases
- Paragraph 2: Technical details and privacy/security features
- Paragraph 3: Target audience and benefits

##### How to Use (4 steps minimum)
- Step-by-step guide with clear instructions
- Each step in a bordered container
- Use numbered steps with descriptive titles

##### Key Features (6 items minimum)
- Grid layout (sm:grid-cols-2)
- Each feature with title and description
- Focus on unique selling points

##### Examples (3 examples minimum)
- Real-world use cases
- Input/output demonstrations
- Practical applications

##### FAQ (8 questions minimum)
- Common user questions
- Technical clarifications
- Best practices
- Troubleshooting

### 🎨 DESIGN CONSISTENCY RULES

#### COLOR USAGE
```css
/* Primary Colors */
--accent: #0066cc;
--accent-dark: #0052a3;
--accent-light: #3385d6;

/* Background Colors */
--background-light: #ffffff;
--background-dark: #0a0a0a;
--card-light: #f8f9fa;
--card-dark: #1a1a1a;

/* Text Colors */
--foreground-light: #1a1a1a;
--foreground-dark: #e5e5e5;
--foreground-light-secondary: #6b7280;
--foreground-dark-secondary: #9ca3af;

/* Border Colors */
--border-light: #e5e7eb;
--border-dark: #2a2a2a;
```

#### SPACING SYSTEM
- Mobile padding: px-3 py-3
- Tablet padding: sm:px-4 sm:py-4
- Desktop padding: md:px-6 md:py-6
- Section margins: mb-8 sm:mb-12 md:mb-16
- Component gaps: gap-3 sm:gap-4 md:gap-6

#### TYPOGRAPHY
- Headings: font-semibold or font-bold
- Body text: Default font-weight
- Code/technical: font-mono
- Minimum font sizes: text-xs on mobile, text-sm on tablet, text-base on desktop

### 🔧 FUNCTIONAL REQUIREMENTS

#### STATE MANAGEMENT
```typescript
// Required hooks for ALL tools
const [state, setState] = useState<ToolState>(defaultState)
const { generateShareUrl, shareInfo, getInitialStateFromUrl } = useUrlSharing<ToolState>(TOOL_NAME)

// Optional based on tool needs
const { state, setState: setHistoryState, undo, redo, canUndo, canRedo } = useHistory<ToolState>(defaultState)
```

#### LOCAL STORAGE
- Save state on every change
- Load state on component mount
- Clear function with user confirmation

#### URL SHARING
- Implement useUrlSharing hook
- Handle URL length limitations
- Show appropriate messages when data is truncated

#### COMMON ACTIONS
**Every tool MUST support:**
1. Share (URL sharing)
2. Export/Download (JSON or appropriate format)
3. Clear/Reset (with confirmation)
4. Copy to clipboard (where applicable)

### 📱 RESPONSIVE DESIGN REQUIREMENTS

#### BREAKPOINTS
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

#### MOBILE-FIRST APPROACH
- Design for mobile by default
- Enhance for larger screens
- Touch targets minimum 44x44px
- Adequate spacing between interactive elements

#### GRID SYSTEM
- Mobile: Single column
- Tablet: May use 2 columns for simple layouts
- Desktop: 2-3 columns based on complexity

### ✅ QUALITY CHECKLIST
**Before committing ANY tool:**

1. **Structure Compliance**
   - [ ] Follows exact page structure template
   - [ ] All mandatory sections present
   - [ ] Proper component hierarchy

2. **Design Consistency**
   - [ ] Uses only approved colors
   - [ ] Follows spacing system
   - [ ] Consistent button styles
   - [ ] Proper typography hierarchy

3. **Functionality**
   - [ ] URL sharing works
   - [ ] Local storage implemented
   - [ ] Export/download functional
   - [ ] Clear/reset with confirmation
   - [ ] Copy to clipboard where needed

4. **Responsive Design**
   - [ ] Mobile layout works
   - [ ] Touch targets 44px minimum
   - [ ] Text readable on all devices
   - [ ] Proper stacking on small screens

5. **Content Quality**
   - [ ] About section (3 paragraphs)
   - [ ] How to Use (4+ steps)
   - [ ] Features (6+ items)
   - [ ] Examples (3+ cases)
   - [ ] FAQ (8+ questions)

6. **Performance**
   - [ ] Bundle size optimized
   - [ ] No unnecessary re-renders
   - [ ] Proper memoization
   - [ ] Lazy loading where appropriate

7. **Accessibility**
   - [ ] Proper ARIA labels
   - [ ] Keyboard navigation
   - [ ] Focus management
   - [ ] Color contrast compliance

### 🚫 PROHIBITED PATTERNS
**NEVER use these patterns:**
- Custom color schemes per tool
- Inconsistent spacing
- Different button styles
- Missing SEO content sections
- Non-responsive layouts
- External API dependencies
- Tracking/analytics code
- Tool-specific navigation
- Custom fonts beyond system

### 📝 NEW TOOL DEVELOPMENT WORKFLOW

1. **Copy Template Structure**
   - Start from the page component template above
   - Maintain exact structure

2. **Implement Core Functionality**
   - Tool-specific logic
   - State management
   - Data processing

3. **Add Standard Features**
   - URL sharing
   - Local storage
   - Export functionality
   - Clear/reset

4. **Create Content Sections**
   - Write comprehensive About section
   - Document How to Use steps
   - List all features
   - Provide real examples
   - Answer common questions

5. **Test Responsiveness**
   - Check all breakpoints
   - Verify touch targets
   - Test on real devices

6. **Run Quality Checks**
   ```bash
   bun run dev-check
   ```

7. **Update Tool Registry**
   - Add to /src/config/tools.tsx
   - Update navigation
   - Add to sitemap

**These standards are ABSOLUTE and MUST be followed for EVERY new tool without exception.**