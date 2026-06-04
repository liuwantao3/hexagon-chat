# Frontend Sandbox Skill Tree Specification

## Overview

This document defines the skill tree architecture for the frontend sandbox engine. Each skill represents a modular capability that can be enabled/disabled independently, with dependency management and library auto-loading.

## Tree Structure

```
ROOT: Sandbox
│
├── Canvas (2D rendering)
│   ├── Animation (frame-based)
│   │   ├── Particle System
│   │   └── Sprite (2D character)
│   │
│   └── Input Handler
│       └── Gesture (touch)
│
├── Three.js (3D rendering)
│   ├── WebGL (low-level)
│   ├── Three.js Animation
│   │   ├── 3D Sprite
│   │   └── 3D Particle System
│
├── Physics Simulation
│   ├── Collision System
│   └── Constraint System
│
├── UI/Interactive
│   ├── Forms
│   ├── Menus/Dialogs
│   └── HUD
│
└── Audio
    ├── SFX
    └── Music
```

## Skill Definitions

### Tier 1: Foundation Skills

| Skill | Description | Library |
|-------|-------------|---------|
| sandbox | Core sandbox iframe rendering and communication | - |
| canvas | 2D canvas rendering | - |

### Tier 2: Rendering Skills

| Skill | Description | Library | Depends On |
|-------|-------------|---------|------------|
| threeJs | 3D graphics | three.js r128 | sandbox |
| webGl | Low-level WebGL | - | threeJs |
| animation | requestAnimationFrame loop | - | canvas |
| threeJsAnimation | 3D animations | - | threeJs |

### Tier 3: Game Skills

| Skill | Description | Library | Depends On |
|-------|-------------|---------|------------|
| particleSystem | Particle effects | - | animation |
| sprite | 2D character rendering | - | animation |
| sprite3d | 3D model rendering | - | threeJsAnimation |
| particleSystem3d | 3D particle effects | - | threeJsAnimation |

### Tier 4: Input/Interaction

| Skill | Description | Library | Depends On |
|-------|-------------|---------|------------|
| inputHandler | Keyboard/mouse | - | sandbox |
| gesture | Touch gestures | - | inputHandler |

### Tier 5: Physics

| Skill | Description | Library | Depends On |
|-------|-------------|---------|------------|
| physicsSimulation | Real-time physics | Matter.js | sandbox |
| collisionSystem | Hit detection | - | physicsSimulation |
| constraintSystem | Joints/constraints | - | physicsSimulation |

### Tier 6: UI

| Skill | Description | Library | Depends On |
|-------|-------------|---------|------------|
| uiInteractive | UI components | - | sandbox |
| forms | Form inputs | - | uiInteractive |
| menusDialogs | Menus/overlays | - | uiInteractive |
| hud | Game HUD | - | uiInteractive |

### Tier 7: Audio

| Skill | Description | Library | Depends On |
|-------|-------------|---------|------------|
| audio | Web Audio API | - | sandbox |
| sfx | Sound effects | - | audio |
| music | Background music | - | audio |

## Rules

### 1. Dependency Cascade

When a skill is enabled:
- All ancestor skills are automatically enabled
- Libraries are loaded in dependency order

### 2. Cascade Disable

When a skill is disabled:
- All descendant skills are automatically disabled
- Parent skills remain enabled if they have other enabled children

### 3. Library Auto-Load

- Libraries are loaded via `<script>` tag injection
- Libraries are cached in `window` by global name
- Loading errors are tracked per library

### 4. Visibility Control

- Skills can be hidden (`visible: false`)
- Hidden skills are available but not displayed in UI
- Used for internal/advanced skills

### 5. State Persistence

- Skill enabled/disabled states persist in localStorage
- States reset requires explicit call

### 6. No Breaking Changes

- Disabling a skill does not affect code execution
- Skills only control library availability and UI visibility
- Code should check skill state before using features

## Library Dependencies

| Skill | Library | CDN URL | Global |
|-------|---------|--------|--------|
| physicsSimulation | matter-js | https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js | Matter |
| threeJs | three.js | https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js | THREE |

## Implementation Notes

- Uses `useStorage` from VueUse for persistence
- Library loading returns promises for async/await
- `getAncestors()` returns all parents recursively
- `getDescendants()` returns all children recursively

## Example Usage

```typescript
import { useSkillTree } from '~/composables/useSkillTree'

const { enableSkill, isEnabled, getEnabledSkills } = useSkillTree()

// Enable a skill (auto-enables ancestors)
await enableSkill('physicsSimulation')

// Check if enabled
if (isEnabled('physicsSimulation')) {
  const engine = Matter.Engine.create()
}
```

---

*Document generated for OpenCode skill tree implementation*
*Last updated: 2024*