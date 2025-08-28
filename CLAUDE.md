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

11. **📝 DEVELOPMENT HISTORY MAINTENANCE**:
    - After EVERY development session, MUST update `DEVELOPMENT_HISTORY.md`
    - Record ALL changes made: files modified, features added, bugs fixed
    - Document future plans, pending tasks, and known issues
    - Include technical details: color changes, responsive breakpoints, component modifications
    - Provide context for future AI agents to understand project evolution
    - Format: Chronological entries with clear categorization (completed/pending/issues)

**Purpose**: Ensure project continuity and context preservation for future AI interactions.