# AI Run Coach - Mobile Design Guidelines

## Brand Identity
**Purpose**: Performance-focused running companion with AI-powered coaching and social motivation.

**Aesthetic**: Athletic Performance Dark - High contrast dark theme with electric cyan accents. Clean data visualization meets premium fitness tracking. Memorable element: Glowing cyan progress rings and real-time GPS trails that feel like energy flowing through the app.

**Differentiation**: AI coaching feels like a living presence through pulsing cyan indicators and conversational insights, not buried in menus.

## Navigation Architecture

**Root Navigation**: Tab Bar (5 tabs)

**Tabs**:
1. Today - Daily summary, quick stats, AI coaching card
2. Runs - Run history with timeline
3. Start (center) - Floating action button to begin run
4. Events - Discover races, challenges
5. Profile - Stats, settings, social

**Auth**: Required (SSO - Apple Sign-In, Google Sign-In)

**Screens**:
- Login/Signup
- Today Dashboard
- Active Run (full-screen modal)
- Run History
- Run Detail (with map replay)
- Events Discovery
- Event Detail
- Goals Dashboard
- Goal Detail
- Profile
- Settings
- Edit Profile

## Screen-by-Screen Specifications

### Login Screen
- **Stack-only** pre-auth flow
- Logo at top third
- SSO buttons (Apple, Google) centered
- Transparent header, no safe area insets needed
- Footer: Terms/Privacy links

### Today Dashboard
- **Transparent header**, title "Today", right button: notification bell icon
- **Scrollable** content
- Hero card: Current week stats with circular progress rings (cyan glow)
- AI Coach card: Personalized tip with avatar icon
- Recent run summary (if exists)
- Quick action buttons: Goals, Achievements
- **Top inset**: headerHeight + Spacing.xl, **Bottom inset**: tabBarHeight + Spacing.xl

### Active Run (Modal)
- **Full-screen modal** (presented from Start tab)
- **Header**: Transparent, left: close icon, right: settings icon
- Map view fills screen with overlay UI
- Floating stats panel at top: Time, Distance, Pace (glass morphism effect)
- Large pause/stop button at bottom center (cyan glow shadow)
- **Insets**: top: insets.top + Spacing.xl, bottom: insets.bottom + Spacing.xl

### Run History
- **Default header**, title "Runs", right: filter icon
- **List view** with search bar in header
- Cards: Date, distance, time, route preview thumbnail
- Empty state: "empty-runs.png" illustration
- **Top inset**: Spacing.xl, **Bottom inset**: tabBarHeight + Spacing.xl

### Run Detail
- **Transparent header**, left: back, right: share icon
- **Scrollable** content
- Full-width map at top
- Stats grid: Distance, Time, Pace, Elevation
- Pace chart (line graph)
- Heart rate zones chart (if available)
- AI insights card
- **Top inset**: headerHeight + Spacing.xl, **Bottom inset**: insets.bottom + Spacing.xl

### Events Discovery
- **Default header**, title "Events", search bar, right: location icon
- **List view**
- Event cards: Image, title, date, distance, location
- Filter chips: Date, Distance, Type
- Empty state: "empty-events.png"
- **Top inset**: Spacing.xl, **Bottom inset**: tabBarHeight + Spacing.xl

### Goals Dashboard
- **Default header**, title "Goals", right: add icon
- **Scrollable** content
- Active goals: Progress cards with circular progress
- Completed goals section
- Empty state: "empty-goals.png"
- **Top inset**: Spacing.xl, **Bottom inset**: tabBarHeight + Spacing.xl

### Profile
- **Transparent header**, title: username, right: settings icon
- **Scrollable** content
- Avatar with edit button
- Stats overview: Total runs, distance, time
- Achievement badges grid
- Personal records list
- **Top inset**: headerHeight + Spacing.xl, **Bottom inset**: tabBarHeight + Spacing.xl

## Color Palette

**Dark Theme**:
- Background: #0A0E1A (deep navy black)
- Surface: #151B2D (elevated cards)
- Surface Variant: #1E2638 (input fields)

**Primary**: #00E5CC (electric cyan/teal)
- Primary Dark: #00B8A3 (pressed state)
- Primary Glow: #00E5CC with 40% opacity (shadows, rings)

**Text**:
- Primary: #FFFFFF
- Secondary: #8B92A8 (muted text)
- Disabled: #4A5468

**Semantic**:
- Success: #00FF88 (PR achieved)
- Warning: #FFB800
- Error: #FF4757
- Chart Colors: #00E5CC, #FF6B9D, #8B5CF6, #FFB800

**Accents**:
- Pace Good: #00FF88
- Pace Average: #FFB800
- Pace Slow: #FF6B9D

## Typography

**Font**: Montserrat (Google Font) for headings, Inter for body

**Scale**:
- Display: Montserrat Bold, 32px (Hero stats)
- H1: Montserrat Bold, 24px (Screen titles)
- H2: Montserrat SemiBold, 20px (Card titles)
- H3: Montserrat SemiBold, 16px (Sections)
- Body: Inter Regular, 16px
- Caption: Inter Regular, 14px (Secondary info)
- Small: Inter Regular, 12px (Labels)

## Visual Design

- **Cards**: 16px border radius, Surface color, subtle 1px border (#FFFFFF 5% opacity)
- **Buttons**: 12px radius, Primary color, press state: Primary Dark
- **Floating Action Button (Start)**: 64px circle, cyan with glow shadow (shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 12, shadowColor: Primary)
- **Progress Rings**: 8px stroke, Primary color with glow effect
- **Charts**: Cyan line/bars, grid lines #FFFFFF 10% opacity
- **Icons**: Feather icons, @expo/vector-icons
- **Maps**: Dark style with cyan route overlay

## Assets to Generate

**App Branding**:
1. **icon.png** - Circular cyan lightning bolt on dark gradient background
   - WHERE USED: Device home screen
2. **splash-icon.png** - Simplified lightning bolt icon
   - WHERE USED: Launch screen

**Empty States**:
3. **empty-runs.png** - Minimalist running shoe silhouette with dotted path
   - WHERE USED: Run History screen (no runs yet)
4. **empty-events.png** - Finish line banner with location pin
   - WHERE USED: Events screen (no events found)
5. **empty-goals.png** - Mountain peak with flag on summit
   - WHERE USED: Goals Dashboard (no goals set)

**Avatars**:
6. **avatar-default-1.png** - Abstract runner silhouette (cyan gradient)
   - WHERE USED: Profile screen, default avatar option
7. **avatar-default-2.png** - Geometric runner icon (angular, sporty)
   - WHERE USED: Profile screen, default avatar option

**Feature Illustrations**:
8. **ai-coach-avatar.png** - Geometric AI head icon (cyan outlines, dark fill)
   - WHERE USED: Today Dashboard, AI Coach card
9. **onboarding-welcome.png** - Runner with GPS trail swoosh
   - WHERE USED: First launch onboarding (if implemented)

All illustrations: Dark background compatible, cyan accent color, minimal style, athletic aesthetic.