# Skill Tree Use Case Examples

## Basic Canvas & Animation

### Bouncing Ball
```
Create a bouncing ball animation. Ball falls from top, bounces off bottom with gravity and elasticity. Enable canvas, animation, physicsSimulation.
```

### Particle Explosion
```
Create a particle explosion effect - 100 particles burst outward from center, fade out over 2 seconds. Use particleSystem skill.
```

### Sprite Sheet Animation
```
Animate a character walking in place using sprite sheet frames. 8 frames, loop infinitely. Use sprite skill.
```

---

## Three.js 3D

### Rotating Cube
```
Create a 3D rotating cube with Three.js. Wireframe purple cube, auto-rotate on Y axis. Enable threeJs, threeJsAnimation.
```

### 3D Scene with Camera
```
Create a 3D scene with: ground plane, floating sphere, orbiting camera. Use threeJs skill.
```

### 3D Character
```
Render a 3D character model (use basic geometry) that walks in place. Use sprite3d skill.
```

---

## Physics Simulation

### Pendulum
```
Create a pendulum that swings with realistic physics. Use physicsSimulation skill with constraintSystem.
```

### Stacking Boxes
```
Stack 5 boxes that fall and stack with physics. Boxes have mass and friction. Use physicsSimulation skill.
```

### Collision Demo
```
Show ball-to-ball collision with momentum conservation. Enable collisionSystem skill.
```

---

## Interactive UI

### Game Menu
```
Create a game main menu with: New Game, Continue, Options buttons. Hover effects, click to start. Use uiInteractive, menusDialogs.
```

### Inventory HUD
```
Create RPG-style inventory HUD: gold count, health bar, item slots (4x4 grid). Use hud skill.
```

### Form Input
```
Create a character creation form: name input, class select, stats distribution (str/dex/int sliders). Use forms skill.
```

---

## Audio

### Background Music
```
Add background battle music that loops. Use music skill.
```

### Sound Effects
```
Add sound effects: button click (pop), coin pickup (ding), damage (hit). Use sfx skill.
```

---

## Combined (RPG Example)

### Simple RPG Battle
```
Create an RPG battle scene:
- Enable threeJs, threeJsAnimation, sprite3d for 3D characters
- Enable physicsSimulation for collision detection
- Enable hud for health bars
- Enable sfx for attack sounds
- Player character on left, enemy on right
- Click enemy to attack (play animation + sound)
- Enemy counterattacks with damage to player health
```

### Platformer Game
```
Create a simple 2D platformer:
- Enable canvas, animation, sprite
- Enable physicsSimulation for gravity/jumping
- Enable collisionSystem for ground detection
- Player can jump with space, move with arrow keys
- Platforms to jump between
- Collectible coins
```

### Particle Effects Demo
```
Create various particle effects demos:
- Enable particleSystem and particleSystem3d
- Demo 1: Fire (orange particles rising, fading)
- Demo 2: Rain (blue particles falling)
- Demo 3: Sparks (on collision/click)
- Demo 4: Magic (spiral around cursor)
```

---

## Quick Test Prompts

```
# Test 2D animation only
"Enable canvas and animation. Create a blue circle that moves in a figure-8 pattern."

# Test physics only
"Enable physicsSimulation. Create two balls that collide and bounce off each other."

# Test 3D only
"Enable threeJs. Create a spinning torus knot with purple wireframe."

# Test UI only
"Enable uiInteractive. Create a button that shows an alert when clicked."

# Test audio only
"Enable audio. Play a sine wave tone at 440Hz for 1 second."
```

---

## Skills to Enable Reference

| Use Case | Skills to Enable |
|----------|-----------------|
| 2D animation | canvas, animation |
| 3D graphics | threeJs |
| 3D animation | threeJs, threeJsAnimation |
| Physics | physicsSimulation, collisionSystem, constraintSystem |
| Game UI | uiInteractive, hud, menusDialogs |
| Forms | uiInteractive, forms |
| Sound | audio, sfx, music |
| Particles (2D) | canvas, animation, particleSystem |
| Particles (3D) | threeJs, threeJsAnimation, particleSystem3d |
| Input | inputHandler, gesture |
| Full RPG | threeJs, threeJsAnimation, sprite3d, physicsSimulation, collisionSystem, hud, sfx |

---

*Examples for testing skill tree functionality*
*Last updated: 2024*