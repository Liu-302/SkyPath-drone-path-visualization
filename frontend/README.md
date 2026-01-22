# SkyPath Frontend

Vue.js 3 frontend application for SkyPath 3D visualization project.

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Key Features](#key-features)
- [State Management](#state-management)
- [3D Visualization](#d-visualization)
- [Styling](#styling)

## Architecture

This frontend uses a **Feature-Based Architecture**, organizing code by business features rather than technical layers. This approach provides:

- **High cohesion**: Related code stays together
- **Easy onboarding**: New developers can quickly find relevant files
- **Better testing**: Features can be tested independently
- **Scalability**: Easy to add or remove features

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Vue 3 | 3.5.21 |
| 3D Engine | Three.js | 0.160.0 |
| 3D Wrapper | TresJS | 5.1.0 |
| State Management | Pinia | 3.0.4 |
| Build Tool | Vite (via FesJS) | 5.0.0-beta.0 |
| Language | TypeScript | 5.9.2 |
| Styling | SCSS | 1.49.11 |
| Package Manager | Yarn | Latest |

## Project Structure

```
frontend/
├── src/
│   ├── features/                    # Business feature modules
│   │   ├── kpi/                   # KPI calculation and display
│   │   │   ├── components/          # KPI panel, details, overview
│   │   │   │   ├── KPIPanel.vue
│   │   │   │   ├── MissionOverview.vue
│   │   │   │   ├── WaypointDetails.vue
│   │   │   │   ├── ViewpointDetails.vue
│   │   │   │   ├── SafetyDetails.vue
│   │   │   │   ├── WaypointDetailGroup.vue
│   │   │   │   ├── KPIHeader.vue
│   │   │   │   └── CalculationStatus.vue
│   │   │   ├── composables/         # Vue 3 composition functions
│   │   │   │   ├── useKpiCalculation.ts
│   │   │   │   ├── useKpiPlayback.ts
│   │   │   │   ├── useWaypointSelection.ts
│   │   │   │   ├── useWaypointDetails.ts
│   │   │   │   └── useFlightSummary.ts
│   │   │   ├── services/            # KPI calculation services
│   │   │   │   ├── kpi-calculator.ts
│   │   │   │   ├── energy-calculator.ts
│   │   │   │   ├── coverage-calculator.ts
│   │   │   │   └── collision-detector.ts
│   │   │   └── types/              # TypeScript type definitions
│   │   │       └── kpi.ts
│   │   │
│   │   ├── upload/                 # File upload and model loading
│   │   │   ├── components/
│   │   │   │   ├── FileUploadZone.vue
│   │   │   │   ├── DroneLoading.vue
│   │   │   │   └── ParticleBackground.vue
│   │   │   ├── composables/
│   │   │   │   ├── useFileUpload.ts
│   │   │   │   ├── useLoadingProgress.ts
│   │   │   │   └── useModelLoader.ts
│   │   │   └── types/
│   │   │       └── upload.ts
│   │   │
│   │   ├── visualization/          # 3D visualization components
│   │   │   ├── components/
│   │   │   │   ├── CameraFrustum.vue
│   │   │   │   ├── BuildingHighlighter.vue
│   │   │   │   ├── AxisGizmo.vue
│   │   │   │   └── VisualizeControlPanel.vue
│   │   │   ├── composables/
│   │   │   │   ├── useCameraController.ts
│   │   │   │   ├── usePathRenderer.ts
│   │   │   │   └── useViewpoints.ts
│   │   │   ├── services/
│   │   │   │   ├── viewpoint-calculator.ts
│   │   │   │   └── path-parser.service.ts
│   │   │   └── types/
│   │   │       ├── camera.ts
│   │   │       └── viewpoint.ts
│   │   │
│   │   └── shared/                 # Shared components
│   │       ├── components/
│   │       │   └── ConfirmDialog.vue
│   │       ├── composables/
│   │       │   └── useConfirmDialog.ts
│   │       └── types/
│   │           └── collision.ts
│   │
│   ├── pages/                        # Page-level components
│   │   ├── index.vue                # Landing page with redirect
│   │   ├── Upload.vue               # Upload page
│   │   └── Visualize.vue            # Main visualization page
│   │
│   ├── stores/                       # Pinia stores
│   │   ├── dataset.ts               # Path data and history
│   │   └── kpi.ts                  # KPI metrics state
│   │
│   ├── shared/                       # Global utilities
│   │   ├── utils/
│   │   │   ├── geometry.ts          # Geometry calculations
│   │   │   ├── camera-utils.ts     # Camera helper functions
│   │   │   └── coordinate-converter.ts
│   │   ├── constants/
│   │   │   └── constants.ts        # Configuration constants
│   │   ├── services/
│   │   │   └── index.ts
│   │   └── types/
│   │
│   ├── styles/                       # Global styles
│   │   └── theme.css                # Theme variables and global CSS
│   │
│   ├── .fes/                         # FesJS configuration files
│   └── app.jsx                       # Application entry point
│
├── public/                            # Static assets
│   ├── favicon.ico
│   └── draco/                        # Draco geometry compression
│
├── .fes.js                           # FesJS/Vite configuration
├── babel.config.json                  # Babel configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies
└── yarn.lock                        # Dependency lock file
```

## Prerequisites

- **Node.js**: 18.18 or higher
- **Yarn**: Latest version (or npm)
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

## Getting Started

### Installation

```bash
# Install dependencies
yarn install
```

### Development Server

```bash
# Start development server with hot reload
yarn dev
```

## Development

### Adding a New Feature

1. **Create feature directory** under `src/features/`
   ```bash
   mkdir src/features/my-feature
   ```

2. **Create standard structure**:
   ```
   my-feature/
   ├── components/
   ├── composables/
   ├── services/
   └── types/
   ```

3. **Implement functionality** following existing patterns

4. **Import and use** in pages or other features

### Import Path Aliases

The project uses path aliases defined in `tsconfig.json`:

```typescript
// Import components
import KPIPanel from '@/features/kpi/components/KPIPanel.vue'

// Import composables
import { useKpiCalculation } from '@/features/kpi/composables/useKpiCalculation'

// Import services
import { calculateAllKPIs } from '@/features/kpi/services/kpi-calculator'

// Import types
import type { KPIMetrics } from '@/features/kpi/types/kpi'

// Import global utilities
import { distance3D } from '@/shared/utils/geometry'

// Import stores
import { useDatasetStore } from '@/stores/dataset'
```

## Key Features

### Upload Page (`src/pages/Upload.vue`)
- Drag and drop file upload
- Support for OBJ 3D models
- Visual loading progress
- Particle background animation
- Automatic redirect to visualization page

### Visualization Page (`src/pages/Visualize.vue`)
- 3D scene with building model
- Drone path visualization with waypoints
- Interactive camera controls
- KPI panel with real-time updates
- Path editing with undo/redo support

### KPI Panel (`src/features/kpi/`)
- Mission overview (path length, flight time, coverage)
- Waypoint details with coordinate editing
- Viewpoint details (pitch, yaw, roll)
- Safety details (battery, collision detection)
- Playback controls (play/pause/stop)

## State Management

### Dataset Store (`src/stores/dataset.ts`)
Manages path data and undo/redo history:
- Parsed points from uploaded files
- History stack for undo/redo
- Point updates with validation

### KPI Store (`src/stores/kpi.ts`)
Manages KPI calculation state:
- KPI metrics (path length, coverage, overlap, energy)
- Calculation status
- Error handling

## 3D Visualization

### Three.js + TresJS
- **Scene Management**: Automatic scene graph handling
- **Camera Controls**: OrbitControls for smooth navigation
- **Lighting**: Ambient and directional lights
- **Materials**: Standard materials with proper shading

### Key Components
- `CameraFrustum`: Visualizes camera viewing area
- `AxisGizmo`: Shows coordinate system orientation
- `BuildingHighlighter`: Highlights selected building areas

## Styling

### Theme System
Uses CSS custom properties defined in `src/styles/theme.css`:
- Colors (primary, accent, glass effects)
- Spacing (radius, padding)
- Typography (font families, sizes)
- Transitions and animations

### SCSS Support
Component-scoped styles with SCSS preprocessing:
```vue
<style scoped lang="scss">
.my-component {
  color: var(--text-primary);
  background: var(--glass-bg);

  &:hover {
    background: var(--glass-bg-hover);
  }
}
</style>
```

## Configuration Files

### `.fes.js`
Main configuration for FesJS (Vite wrapper):
- Vue plugin configuration
- Build settings
- Server configuration
- Path aliases

### `tsconfig.json`
TypeScript configuration:
- Path aliases (`@/`, `@@/`)
- Compiler options
- Type checking settings

## License

See [LICENSE](../LICENSE) in the root directory.

---
