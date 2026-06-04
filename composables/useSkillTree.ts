import { ref } from 'vue'
import { useStorage } from '@vueuse/core'

export interface SkillDefinition {
  name: string
  displayName: string
  description: string
  dependsOn: string[]
  libraries: { name: string; url: string; global?: string }[]
  enabled: boolean
  visible: boolean
}

export interface SkillState {
  enabled: boolean
  loaded: boolean
  loadError: string | null
}

const STORAGE_KEY = 'skill-tree-state'

const skillDefinitions: Record<string, SkillDefinition> = {
  sandbox: {
    name: 'sandbox',
    displayName: 'Sandbox',
    description: 'Core sandbox rendering and communication foundation',
    dependsOn: [],
    libraries: [],
    enabled: true,
    visible: true
  },
  canvas: {
    name: 'canvas',
    displayName: 'Canvas',
    description: '2D canvas rendering for graphics and animations',
    dependsOn: ['sandbox'],
    libraries: [],
    enabled: false,
    visible: true
  },
  threeJs: {
    name: 'threeJs',
    displayName: 'Three.js',
    description: '3D graphics rendering using Three.js',
    dependsOn: ['sandbox'],
    libraries: [
      { name: 'three', url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', global: 'THREE' }
    ],
    enabled: false,
    visible: true
  },
  webGl: {
    name: 'webGl',
    displayName: 'WebGL',
    description: 'Low-level WebGL rendering',
    dependsOn: ['threeJs'],
    libraries: [],
    enabled: false,
    visible: false
  },
  threeJsAnimation: {
    name: 'threeJsAnimation',
    displayName: 'Three.js Animation',
    description: '3D animations using Three.js',
    dependsOn: ['threeJs'],
    libraries: [],
    enabled: false,
    visible: true
  },
  sprite3d: {
    name: 'sprite3d',
    displayName: '3D Sprite',
    description: '3D character and model rendering',
    dependsOn: ['threeJsAnimation'],
    libraries: [],
    enabled: false,
    visible: true
  },
  particleSystem3d: {
    name: 'particleSystem3d',
    displayName: '3D Particle System',
    description: '3D particle effects',
    dependsOn: ['threeJsAnimation'],
    libraries: [],
    enabled: false,
    visible: true
  },
  animation: {
    name: 'animation',
    displayName: 'Animation',
    description: 'Frame-based animations using requestAnimationFrame',
    dependsOn: ['canvas'],
    libraries: [],
    enabled: false,
    visible: true
  },
  particleSystem: {
    name: 'particleSystem',
    displayName: 'Particle System',
    description: 'Particle effects and systems',
    dependsOn: ['animation'],
    libraries: [],
    enabled: false,
    visible: true
  },
  sprite: {
    name: 'sprite',
    displayName: 'Sprite',
    description: 'Character and sprite rendering',
    dependsOn: ['animation'],
    libraries: [],
    enabled: false,
    visible: true
  },
  inputHandler: {
    name: 'inputHandler',
    displayName: 'Input Handler',
    description: 'Keyboard and mouse input handling',
    dependsOn: ['sandbox'],
    libraries: [],
    enabled: false,
    visible: true
  },
  gesture: {
    name: 'gesture',
    displayName: 'Gesture',
    description: 'Touch and gesture interactions',
    dependsOn: ['inputHandler'],
    libraries: [],
    enabled: false,
    visible: true
  },
  physicsSimulation: {
    name: 'physicsSimulation',
    displayName: 'Physics Simulation',
    description: 'Real-time physics simulation with forces and dynamics',
    dependsOn: ['sandbox'],
    libraries: [
      { name: 'matter-js', url: 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js', global: 'Matter' }
    ],
    enabled: false,
    visible: true
  },
  collisionSystem: {
    name: 'collisionSystem',
    displayName: 'Collision System',
    description: 'Collision detection and response',
    dependsOn: ['physicsSimulation'],
    libraries: [],
    enabled: false,
    visible: true
  },
  constraintSystem: {
    name: 'constraintSystem',
    displayName: 'Constraint System',
    description: 'Physics constraints and joints',
    dependsOn: ['physicsSimulation'],
    libraries: [],
    enabled: false,
    visible: true
  },
  uiInteractive: {
    name: 'uiInteractive',
    displayName: 'UI/Interactive',
    description: 'User interface components and interactive controls',
    dependsOn: ['sandbox'],
    libraries: [],
    enabled: false,
    visible: true
  },
  forms: {
    name: 'forms',
    displayName: 'Forms',
    description: 'Form inputs and validation',
    dependsOn: ['uiInteractive'],
    libraries: [],
    enabled: false,
    visible: true
  },
  menusDialogs: {
    name: 'menusDialogs',
    displayName: 'Menus/Dialogs',
    description: 'Menus, dialogs, and overlays',
    dependsOn: ['uiInteractive'],
    libraries: [],
    enabled: false,
    visible: true
  },
  hud: {
    name: 'hud',
    displayName: 'HUD',
    description: 'Heads-up display for games',
    dependsOn: ['uiInteractive'],
    libraries: [],
    enabled: false,
    visible: true
  },
  audio: {
    name: 'audio',
    displayName: 'Audio',
    description: 'Web Audio API for sound and music',
    dependsOn: ['sandbox'],
    libraries: [],
    enabled: false,
    visible: true
  },
  sfx: {
    name: 'sfx',
    displayName: 'SFX',
    description: 'Sound effects generation and playback',
    dependsOn: ['audio'],
    libraries: [],
    enabled: false,
    visible: true
  },
  music: {
    name: 'music',
    displayName: 'Music',
    description: 'Background music and audio',
    dependsOn: ['audio'],
    libraries: [],
    enabled: false,
    visible: true
  }
}

const defaultStates: Record<string, SkillState> = Object.keys(skillDefinitions).reduce((acc, key) => {
  acc[key] = { enabled: false, loaded: false, loadError: null }
  return acc
}, {} as Record<string, SkillState>)

export const useSkillTree = () => {
  const states = useStorage<Record<string, SkillState>>(STORAGE_KEY, defaultStates)
  const loadingLibs = ref<Set<string>>(new Set())
  const libraryLoadErrors = ref<Record<string, string>>({})

  const getDefinition = (skillName: string): SkillDefinition | undefined => {
    return skillDefinitions[skillName]
  }

  const getAllDefinitions = (): Record<string, SkillDefinition> => {
    return skillDefinitions
  }

  const getChildren = (skillName: string): string[] => {
    return Object.keys(skillDefinitions).filter(key => 
      skillDefinitions[key].dependsOn.includes(skillName)
    )
  }

  const getAncestors = (skillName: string): string[] => {
    const ancestors: string[] = []
    const def = skillDefinitions[skillName]
    if (!def) return ancestors

    const collect = (name: string) => {
      const d = skillDefinitions[name]
      if (!d) return
      d.dependsOn.forEach(parent => {
        if (!ancestors.includes(parent)) {
          ancestors.push(parent)
          collect(parent)
        }
      })
    }
    collect(skillName)
    return ancestors
  }

  const isEnabled = (skillName: string): boolean => {
    return states.value[skillName]?.enabled ?? false
  }

  const isLoaded = (skillName: string): boolean => {
    return states.value[skillName]?.loaded ?? false
  }

  const isAvailable = (skillName: string): boolean => {
    const def = skillDefinitions[skillName]
    if (!def) return false

    return def.dependsOn.every(parent => isEnabled(parent))
  }

  const isVisible = (skillName: string): boolean => {
    const def = skillDefinitions[skillName]
    if (!def) return false
    return def.visible
  }

  const enableSkill = async (skillName: string): Promise<boolean> => {
    const def = skillDefinitions[skillName]
    if (!def) {
      console.error(`Skill "${skillName}" not found`)
      return false
    }

    const ancestors = getAncestors(skillName)
    for (const ancestor of ancestors) {
      if (!isEnabled(ancestor)) {
        await enableSkill(ancestor)
      }
    }

    const libPromises: Promise<void>[] = []
    for (const lib of def.libraries) {
      if (!(window as any)[lib.global] && !loadingLibs.value.has(lib.name)) {
        libPromises.push(loadLibrary(lib))
      }
    }

    if (libPromises.length > 0) {
      await Promise.all(libPromises)
    }

    states.value[skillName] = {
      enabled: true,
      loaded: true,
      loadError: null
    }

    const children = getChildren(skillName)
    for (const child of children) {
      if (skillDefinitions[child].dependsOn.every(p => isEnabled(p))) {
        states.value[child] = {
          ...states.value[child],
          enabled: true,
          loaded: true
        }
      }
    }

    return true
  }

  const disableSkill = async (skillName: string): Promise<boolean> => {
    if (skillName === 'sandbox') {
      console.warn('Cannot disable sandbox root skill')
      return false
    }

    const descendants = getDescendants(skillName)
    for (const descendant of descendants) {
      states.value[descendant] = {
        ...states.value[descendant],
        enabled: false
      }
    }

    states.value[skillName] = {
      ...states.value[skillName],
      enabled: false
    }

    return true
  }

  const getDescendants = (skillName: string): string[] => {
    const descendants: string[] = []
    const collect = (name: string) => {
      const children = getChildren(name)
      children.forEach(child => {
        if (!descendants.includes(child)) {
          descendants.push(child)
          collect(child)
        }
      })
    }
    collect(skillName)
    return descendants
  }

  const loadLibrary = (lib: { name: string; url: string; global?: string }): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any)[lib.global]) {
        resolve()
        return
      }

      loadingLibs.value.add(lib.name)

      const script = document.createElement('script')
      script.src = lib.url
      script.onload = () => {
        loadingLibs.value.delete(lib.name)
        resolve()
      }
      script.onerror = (e) => {
        loadingLibs.value.delete(lib.name)
        libraryLoadErrors.value[lib.name] = `Failed to load ${lib.name}`
        reject(new Error(`Failed to load library: ${lib.name}`))
      }
      document.head.appendChild(script)
    })
  }

  const getSkillState = (skillName: string): SkillState | undefined => {
    return states.value[skillName]
  }

  const getAllStates = (): Record<string, SkillState> => {
    return states.value
  }

  const getEnabledSkills = (): string[] => {
    return Object.keys(states.value).filter(key => states.value[key].enabled)
  }

  const initializeFromStorage = () => {
    Object.keys(skillDefinitions).forEach(key => {
      if (skillDefinitions[key].enabled && !states.value[key]) {
        states.value[key] = { enabled: true, loaded: true, loadError: null }
      }
    })
  }

  const reset = () => {
    Object.keys(states.value).forEach(key => {
      states.value[key] = { enabled: false, loaded: false, loadError: null }
    })
    states.value.sandbox = { enabled: true, loaded: true, loadError: null }
  }

  return {
    states,
    getDefinition,
    getAllDefinitions,
    getChildren,
    getAncestors,
    getDescendants,
    isEnabled,
    isLoaded,
    isAvailable,
    isVisible,
    enableSkill,
    disableSkill,
    getSkillState,
    getAllStates,
    getEnabledSkills,
    initializeFromStorage,
reset,
    loadingLibs
  }
}