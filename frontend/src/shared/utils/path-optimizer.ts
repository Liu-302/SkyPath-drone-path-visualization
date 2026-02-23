import { distance3D } from '@/shared/utils/geometry'
import type { PathPoint } from '@/stores/dataset'

/**
 * Path Optimization Utilities
 * Implements algorithms to minimize path distance (Traveling Salesperson Problem variants)
 */

/**
 * Optimizes the path order to minimize total distance.
 * Assumes the first point (start point) is fixed.
 * Uses Nearest Neighbor heuristic followed by 2-Opt local search optimization.
 * 
 * @param points The current list of path points
 * @returns A new list of path points with optimized order
 */
export function calculateOptimalPath(points: PathPoint[]): PathPoint[] {
  if (points.length <= 3) {
    return [...points]
  }

  // Clone points to avoid mutation
  const originalPoints = [...points]
  
  // 1. Separate start point (fixed) and the rest
  const startPoint = originalPoints[0]
  const otherPoints = originalPoints.slice(1)

  // 2. Nearest Neighbor Heuristic Construction
  // Start with the fixed start point
  const path = [startPoint]
  const unvisited = new Set(otherPoints)

  let current = startPoint

  while (unvisited.size > 0) {
    let nearest: PathPoint | null = null
    let minDist = Infinity

    for (const p of unvisited) {
      const d = distance3D(current, p)
      if (d < minDist) {
        minDist = d
        nearest = p
      }
    }

    if (nearest) {
      path.push(nearest)
      unvisited.delete(nearest)
      current = nearest
    } else {
      break // Should not happen
    }
  }

  // 3. 2-Opt Improvement
  // Iteratively attempt to swap edges to reduce total distance
  let improved = true
  // Limit iterations to prevent UI freezing on large datasets, typically converges quickly
  let iterations = 0
  const maxIterations = 50 

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++
    
    // We keep index 0 fixed, so we start swapping from range [1...length-1]
    // The segment to reverse is points[i...k]
    // We check edges (i-1, i) and (k, k+1) vs (i-1, k) and (i, k+1)
    
    for (let i = 1; i < path.length - 1; i++) {
        for (let k = i + 1; k < path.length; k++) {
            // Edge 1: (i-1) -> i
            // Edge 2: k -> (k+1) or end
            // Candidate: (i-1) -> k
            // Candidate: i -> (k+1) or end
            
            // Current length of these two edges
            const p_i_minus_1 = path[i-1]
            const p_i = path[i]
            const p_k = path[k]
            const p_k_plus_1 = (k + 1 < path.length) ? path[k+1] : null

            const currentDist = distance3D(p_i_minus_1, p_i) + (p_k_plus_1 ? distance3D(p_k, p_k_plus_1) : 0)
            const newDist = distance3D(p_i_minus_1, p_k) + (p_k_plus_1 ? distance3D(p_i, p_k_plus_1) : 0)

            if (newDist < currentDist) {
                // Perform 2-opt swap: Reverse segment from i to k
                reverseSegment(path, i, k)
                improved = true
            }
        }
    }
  }

  return path
}

/**
 * Reverses the elements in the array from start index to end index (inclusive)
 */
function reverseSegment(arr: any[], start: number, end: number) {
  let l = start
  let r = end
  while (l < r) {
    const temp = arr[l]
    arr[l] = arr[r]
    arr[r] = temp
    l++
    r--
  }
}
